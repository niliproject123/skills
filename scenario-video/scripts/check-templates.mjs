// check-templates — typecheck the skill's templates against these tools, laid out the way a project
// holds them: `<temp>/guide-videos/{example.scenario.ts, example.plan.ts}` with the tools linked in
// at `guide-videos/tools`, and `<temp>/tests/existing-test.example.spec.ts`. Exit code = tsc's.
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tools = dirname(fileURLToPath(import.meta.url));
const templates = resolve(tools, '..', 'templates');
const project = mkdtempSync(join(tmpdir(), 'scenario-video-templates-'));
try {
  mkdirSync(join(project, 'guide-videos'), { recursive: true });
  mkdirSync(join(project, 'tests'), { recursive: true });
  symlinkSync(tools, join(project, 'guide-videos', 'tools'), 'junction');
  cpSync(join(templates, 'example.scenario.ts'), join(project, 'guide-videos', 'example.scenario.ts'));
  cpSync(join(templates, 'example.plan.ts'), join(project, 'guide-videos', 'example.plan.ts'));
  cpSync(join(templates, 'existing-test.example.spec.ts'), join(project, 'tests', 'existing-test.example.spec.ts'));
  writeFileSync(join(project, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, skipLibCheck: true,
      lib: ['ES2022', 'DOM'], types: ['node'], typeRoots: [join(tools, 'node_modules', '@types')],
      baseUrl: '.', paths: { '@playwright/test': [join(tools, 'node_modules', '@playwright', 'test')], playwright: [join(tools, 'node_modules', 'playwright')] },
    },
    include: ['guide-videos/*.ts', 'tests/*.ts'],
  }, null, 2));
  const tsc = join(tools, 'node_modules', 'typescript', 'bin', 'tsc');
  const ran = spawnSync(process.execPath, [tsc, '-p', join(project, 'tsconfig.json')], { encoding: 'utf8' });
  process.stdout.write(ran.stdout ?? '');
  process.stderr.write(ran.stderr ?? '');
  console.log(ran.status === 0 ? 'check-templates: every template typechecks against the tools' : `check-templates: tsc exited ${ran.status}`);
  process.exitCode = ran.status ?? 1;
} finally {
  rmSync(project, { recursive: true, force: true });
}
