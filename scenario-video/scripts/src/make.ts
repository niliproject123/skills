/**
 * make — record a scenario run as guide videos, then cut them.
 *
 *   npm --prefix <tools folder> run video -- <scenario> [options]
 *
 * Options:
 *   --into <folder>        where the recording goes. Default: `<output folder>/<next n>_<scenario>/`.
 *   --build-only <folder>  do not record; cut an existing recording again (after a plan change).
 *   --accept-failed-run    build even though the scenario exited non-zero. The video log says so.
 *
 * In order, and each step stops the run by name when it fails: the settings; the plan
 * (`<scenarios folder>/<scenario>.plan.ts`, with chapters approved); ffmpeg; the app's health check;
 * the seed, with a fresh run id; the scenario, with recording on; the cut.
 *
 * Environment: `APP_ADDRESS` overrides the app address for one run; `SCENARIO_RUN_ID` fixes the run
 * id instead of minting one; `SHOW_BROWSER=yes` opens a visible browser. The scenario receives
 * `VIDEO_RECORDING_FOLDER`, `SCENARIO_RUN_ID` and `VIDEO_SETTINGS_FILE`.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { buildGuideVideos, ffmpegBinary, RUN_RESULT_FILE, type RunResult } from './build';
import { wordsFor } from './captions';
import { appAddressOf, loadSettings, SETTINGS_FILE_VARIABLE, type LoadedSettings } from './config';
import { firstLineOf, VideoError } from './errors';
import { Logger } from './log';
import { DEFAULT_COLOURS, DEFAULT_FONT, type Look } from './overlay';
import { captionRulesWritten, chaptersWritten, checkPlan, writeRecordingPlan, type GuidePlan } from './plan';
import { RECORDING_FOLDER_VARIABLE } from './recorder';

const log = new Logger('scenario-video');
/** Resolves a package from the tools folder, wherever the command was started. */
const fromTools = createRequire(import.meta.url);
export const RUN_ID_VARIABLE = 'SCENARIO_RUN_ID';

function optionValue(args: string[], name: string): string | null {
  const at = args.indexOf(name);
  if (at === -1) return null;
  const value = args[at + 1];
  if (!value || value.startsWith('--')) throw new VideoError('make.option_without_value', `${name} needs a folder after it`);
  return resolve(value);
}

function gitFact(root: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (thrown) {
    // Not a failure of the recording — but written into the log as what it is, never left blank.
    return `unknown (git ${args[0]} failed: ${firstLineOf(thrown)})`;
  }
}

async function loadPlan(loaded: LoadedSettings, scenario: string): Promise<{ plan: GuidePlan; planFile: string }> {
  const planFile = join(loaded.root, loaded.settings.folders.scenarios, `${scenario}.plan.ts`);
  if (!existsSync(planFile)) throw new VideoError('make.no_plan', `no plan for "${scenario}" — expected ${planFile}`);
  const module = (await import(pathToFileURL(planFile).href)) as { plan?: GuidePlan; default?: { plan?: GuidePlan } };
  const plan = module.plan ?? module.default?.plan;
  if (!plan) throw new VideoError('make.plan_not_exported', `${planFile} does not export \`plan\``);
  if (plan.name !== scenario) throw new VideoError('make.plan_name_mismatch', `${planFile} names its plan "${plan.name}", not "${scenario}"`);
  checkPlan(plan);
  return { plan, planFile };
}

/** `<output>/<next n>_<scenario>` — numbered, so recordings never overwrite each other. */
function nextFolder(loaded: LoadedSettings, scenario: string): string {
  const output = join(loaded.root, loaded.settings.folders.output);
  mkdirSync(output, { recursive: true });
  const taken = readdirSync(output).map((name) => Number(/^(\d+)_/.exec(name)?.[1] ?? 0));
  return join(output, `${String(Math.max(0, ...taken) + 1).padStart(2, '0')}_${scenario}`);
}

function lookOf(loaded: LoadedSettings, peopleLabel: string): Look {
  const { branding, captions, masking } = loaded.settings;
  let logo: string | null = null;
  if (branding.logo) {
    const file = resolve(loaded.root, branding.logo);
    if (!existsSync(file)) throw new VideoError('make.logo_missing', `branding.logo names ${file}, which does not exist`);
    const types: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
    const type = types[extname(file).toLowerCase()];
    if (!type) throw new VideoError('make.logo_type', `branding.logo is ${extname(file)} — use png, jpg, svg or webp`);
    logo = `data:${type};base64,${readFileSync(file).toString('base64')}`;
  }
  const unknownColours = Object.keys(branding.colours).filter((key) => !(key in DEFAULT_COLOURS));
  if (unknownColours.length) throw new VideoError('make.unknown_colour', `branding.colours has ${unknownColours.join(', ')} — known: ${Object.keys(DEFAULT_COLOURS).join(', ')}`);
  return {
    direction: captions.direction,
    font: branding.font ?? DEFAULT_FONT,
    colours: { ...DEFAULT_COLOURS, ...branding.colours },
    logo,
    peopleLabel,
    masking: { fields: masking.fields, patterns: masking.patterns },
  };
}

async function checkAppIsUp(loaded: LoadedSettings): Promise<void> {
  const { healthCheck, startCommand } = loaded.settings.app;
  const address = process.env['APP_ADDRESS'] && healthCheck.startsWith(loaded.settings.app.address)
    ? healthCheck.replace(loaded.settings.app.address, appAddressOf(loaded.settings))
    : healthCheck;
  let status: number;
  try {
    status = (await fetch(address, { signal: AbortSignal.timeout(10_000) })).status;
  } catch (thrown) {
    throw new VideoError('app.not_reachable', `the app's health check ${address} did not answer (${firstLineOf(thrown)}) — start the app first: ${startCommand}`);
  }
  if (status < 200 || status >= 300) throw new VideoError('app.unhealthy', `the app's health check ${address} answered ${status} — it must answer 2xx before a recording. Start command: ${startCommand}`);
  log.info(`the app is up — ${address} answered ${status}`);
}

/** The seed, shown live and kept in seed.log. `{runId}` in the command is replaced. */
function runSeed(command: string, runId: string, folder: string, root: string): void {
  const filled = command.replace(/\{runId\}/g, runId);
  log.info(`seeding: ${filled}`);
  const ran = spawnSync(filled, { cwd: root, shell: true, encoding: 'utf8', env: { ...process.env, [RUN_ID_VARIABLE]: runId } });
  writeFileSync(join(folder, 'seed.log'), `${ran.stdout ?? ''}\n${ran.stderr ?? ''}`);
  if (ran.stdout) process.stdout.write(ran.stdout);
  if (ran.stderr) process.stderr.write(ran.stderr);
  if (ran.error) throw new VideoError('seed.could_not_start', `the seed command could not start: ${ran.error.message}`);
  if (ran.status !== 0) throw new VideoError('seed.failed', `the seed exited ${ran.status} — nothing was recorded. Its output is in ${join(folder, 'seed.log')}`);
}

/** The scenario, output shown live and kept in scenario.log. Resolves with its exit code. */
function runScenario(command: string[], folder: string, root: string, env: NodeJS.ProcessEnv): Promise<number | null> {
  const output = createWriteStream(join(folder, 'scenario.log'));
  return new Promise((done, failed) => {
    const [program, ...rest] = command;
    const child = spawn(program as string, rest, { cwd: root, env, shell: process.platform === 'win32' && program !== process.execPath });
    child.stdout.on('data', (chunk: Buffer) => { process.stdout.write(chunk); output.write(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { process.stderr.write(chunk); output.write(chunk); });
    child.on('error', failed);
    child.on('close', (code) => output.end(() => done(code)));
  });
}

function commandOf(plan: GuidePlan, loaded: LoadedSettings): string[] {
  if ('command' in plan.run) return [...plan.run.command];
  const file = join(loaded.root, loaded.settings.folders.scenarios, plan.run.scenario);
  if (!existsSync(file)) throw new VideoError('make.no_scenario', `the plan runs ${file}, which does not exist`);
  return [process.execPath, fromTools.resolve('tsx/cli'), file];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scenario = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--into' && args[index - 1] !== '--build-only');
  if (!scenario) throw new VideoError('make.no_scenario_named', 'name a scenario: npm run video -- <scenario> [--into <folder>] [--build-only <folder>] [--accept-failed-run]');
  const loaded = loadSettings(process.env['INIT_CWD'] ?? process.cwd());
  const { plan, planFile } = await loadPlan(loaded, scenario);
  const buildOnly = optionValue(args, '--build-only');
  const acceptedFailedRun = args.includes('--accept-failed-run');
  ffmpegBinary(); // before a minute of recording, not after it

  if (!buildOnly) await checkAppIsUp(loaded); // before a folder is made for a recording that cannot happen
  const folder = buildOnly ?? optionValue(args, '--into') ?? nextFolder(loaded, plan.name);
  if (!buildOnly) {
    if (existsSync(join(folder, RUN_RESULT_FILE))) throw new VideoError('make.folder_used', `${folder} already holds a recording — use --build-only to cut it again, or another folder`);
    mkdirSync(folder, { recursive: true });
    const runId = process.env[RUN_ID_VARIABLE] ?? `video-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')}`;
    const seed = plan.seed === false ? null : (plan.seed ?? loaded.settings.seed);
    if (seed) runSeed(seed.command, runId, folder, loaded.root);
    else log.info(plan.seed === false ? 'no seed — the plan says this scenario needs none' : 'no seed — the settings name none');

    const words = wordsFor(loaded.settings.captions.language, loaded.settings.captions.words);
    writeRecordingPlan(folder, {
      planName: plan.name,
      language: loaded.settings.captions.language,
      words,
      look: lookOf(loaded, words.people),
      chapters: chaptersWritten(plan),
      captionRules: captionRulesWritten(plan),
    });
    const command = commandOf(plan, loaded);
    const startedAt = new Date().toISOString();
    log.info(`recording ${plan.name} into ${folder} (run id ${runId})`);
    const exitCode = await runScenario(command, folder, loaded.root, {
      ...process.env, [RECORDING_FOLDER_VARIABLE]: folder, [RUN_ID_VARIABLE]: runId, [SETTINGS_FILE_VARIABLE]: loaded.file,
    });
    const result: RunResult = {
      scenario: plan.name,
      command: command.map((part) => (part.startsWith(loaded.root) ? relative(loaded.root, part) : part)),
      exitCode,
      runId,
      appAddress: appAddressOf(loaded.settings),
      seedCommand: seed ? seed.command.replace(/\{runId\}/g, runId) : '',
      startedAt,
      endedAt: new Date().toISOString(),
      branch: gitFact(loaded.root, ['rev-parse', '--abbrev-ref', 'HEAD']),
      commit: gitFact(loaded.root, ['rev-parse', '--short', 'HEAD']),
      acceptedFailedRun,
    };
    writeFileSync(join(folder, RUN_RESULT_FILE), JSON.stringify(result, null, 2));
    log.info(`the scenario exited ${exitCode}`);
  } else if (acceptedFailedRun) {
    const file = join(folder, RUN_RESULT_FILE);
    if (!existsSync(file)) throw new VideoError('make.no_run_result', `${file} is missing — --build-only needs a folder a recording was made into`);
    const result = JSON.parse(readFileSync(file, 'utf8')) as RunResult;
    writeFileSync(file, JSON.stringify({ ...result, acceptedFailedRun: true }, null, 2));
  }

  const built = buildGuideVideos(plan, folder, relative(loaded.root, planFile));
  for (const video of built.videos) log.info(`made ${video}`);
  for (const subtitle of built.subtitles) log.info(`subtitles ${subtitle}`);
  for (const missing of built.notMade) log.error(`NOT MADE ${missing}`);
  log.info(`video log → ${built.logFile}`);
  process.exit(built.notMade.length === 0 ? 0 : 1);
}

main().catch((thrown: unknown) => {
  console.error('FATAL', thrown);
  process.exit(1);
});
