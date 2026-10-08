// check-templates — typecheck this skill's templates the way a project holds them:
// <temp>/walkthroughs/{walk/*.ts, example.walk.ts, example.steps.ts}, strict TypeScript.
//
//   node scripts/check-templates.mjs <node_modules folder holding playwright, typescript and @types/node>
//
// It needs no app and runs nothing in a browser: a typecheck proves the files fit together, not that a
// walk works. The exit code is tsc's.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const modules = process.argv[2] ? resolve(process.argv[2]) : '';
for (const needed of ['playwright', 'typescript', join('@types', 'node')]) {
  if (!modules || !existsSync(join(modules, needed))) {
    console.error(`check-templates: give a node_modules folder that holds playwright, typescript and @types/node — ${modules ? `${needed} is not in ${modules}` : 'none was given'}`);
    process.exit(2);
  }
}
const templates = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const project = mkdtempSync(join(tmpdir(), 'walkthrough-templates-'));
try {
  const walkthroughs = join(project, 'walkthroughs');
  mkdirSync(join(walkthroughs, 'walk'), { recursive: true });
  for (const file of readdirSync(join(templates, 'walk'))) cpSync(join(templates, 'walk', file), join(walkthroughs, 'walk', file));
  for (const file of ['example.walk.ts', 'example.steps.ts']) cpSync(join(templates, file), join(walkthroughs, file));
  writeFileSync(join(project, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noUncheckedIndexedAccess: true,
      noEmit: true, skipLibCheck: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['node'],
      typeRoots: [join(modules, '@types')], baseUrl: '.', paths: { playwright: [join(modules, 'playwright')] },
    },
    include: ['walkthroughs/**/*.ts'],
  }, null, 2));
  const ran = spawnSync(process.execPath, [join(modules, 'typescript', 'bin', 'tsc'), '-p', join(project, 'tsconfig.json')], { encoding: 'utf8' });
  process.stdout.write(ran.stdout ?? '');
  process.stderr.write(ran.stderr ?? '');
  console.log(ran.status === 0 ? 'check-templates: every template typechecks' : `check-templates: tsc exited ${ran.status}`);
  process.exitCode = ran.status ?? 1;
} finally {
  rmSync(project, { recursive: true, force: true });
}
