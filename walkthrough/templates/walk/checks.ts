// Checks and the report. A check is named after the requirement it proves and ends PASS, FAIL or NOT
// CHECKED — the last with a reason, always: a check the walk could not make here (the case it needs did not
// come up, a page was closed before it was read) is said by name, never counted as a pass and never
// silently skipped. A check records and never throws; a step goes on after a FAIL.
//
// The report is one markdown file per run: the header (run id, app, mode, start step, exit code), one row per
// step (result, acting time, time waiting for a person, scroll), every check, the requirements a step
// named in `expects` that no check proved, every browser error, and the notes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { WalkError, type StepChecks } from './types';

export type CheckStatus = 'PASS' | 'FAIL' | 'NOT CHECKED';

export interface CheckRecord {
  step: string;
  requirement: string;
  name: string;
  status: CheckStatus;
  expected: string;
  received: string;
  reason: string;
}

export interface StepRow {
  /** '12', or '—' for an unnumbered step. */
  number: string;
  key: string;
  actor: string;
  /** done · failed checks · error · not reached */
  result: string;
  /** Ran by itself because it stands before the chosen start step. */
  beforeStart: boolean;
  /** The step's own time, the waits for a person taken out. */
  actingSeconds: number | null;
  /** Time spent waiting for "Next" inside the step (its first control gated). */
  waitingSeconds: number | null;
  scroll: { pixels: number; screens: number } | null;
  scrollFailure: string;
}

const same = (actual: unknown, expected: unknown): boolean =>
  actual === expected || (typeof actual === 'object' && actual !== null && JSON.stringify(actual) === JSON.stringify(expected));

export class Checks {
  readonly records: CheckRecord[] = [];

  constructor(private readonly log: (actor: string, message: string) => void) {}

  /** The checks of one step, logged under its actor. `step` is how the report names it: '12 · send-invite'. */
  forStep(step: string, actor: string): StepChecks {
    const record = (requirement: string, name: string, status: CheckStatus, expected: string, received: string, reason: string): void => {
      if (!requirement.trim() || !name.trim()) throw new WalkError('check.unnamed', `a check in step ${step} has no requirement or no name — every check is named after the requirement it proves`);
      this.records.push({ step, requirement, name, status, expected, received, reason });
      const tail = status === 'FAIL' ? ` (expected ${expected}, got ${received})` : status === 'NOT CHECKED' ? ` — ${reason}` : '';
      this.log(actor, `${status === 'FAIL' ? 'ASSERT FAILED' : status}: ${requirement} · ${name}${tail}`);
    };
    return {
      check: (requirement, name, condition, detail) => {
        record(requirement, name, condition ? 'PASS' : 'FAIL', detail.expected, detail.received, '');
        return condition;
      },
      same: (requirement, name, actual, expected) => {
        const ok = same(actual, expected);
        record(requirement, name, ok ? 'PASS' : 'FAIL', JSON.stringify(expected), JSON.stringify(actual), '');
        return ok;
      },
      notChecked: (requirement, name, reason) => {
        if (!reason.trim()) throw new WalkError('check.no_reason', `NOT CHECKED "${name}" in step ${step} carries no reason — say why it could not be checked here`);
        record(requirement, name, 'NOT CHECKED', '', '', reason);
      },
    };
  }

  ofStep(step: string): CheckRecord[] {
    return this.records.filter((one) => one.step === step);
  }

  count(status: CheckStatus): number {
    return this.records.filter((one) => one.status === status).length;
  }
}

export interface ReportInput {
  walk: string;
  runId: string;
  appAddress: string;
  mode: string;
  startStep: string;
  startedAt: Date;
  seconds: number;
  exitCode: number;
  ended: string;
  steps: StepRow[];
  checks: CheckRecord[];
  /** A requirement a step named in `expects` that none of its checks named. */
  unproved: { step: string; requirement: string }[];
  browserErrors: string[];
  notes: string[];
  logFile: string;
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const secondsCell = (value: number | null): string => (value === null ? '—' : value.toFixed(1));

export function writeReport(file: string, input: ReportInput): void {
  const pass = input.checks.filter((one) => one.status === 'PASS').length;
  const fail = input.checks.filter((one) => one.status === 'FAIL').length;
  const notChecked = input.checks.filter((one) => one.status === 'NOT CHECKED').length;
  const scrolled = input.steps.flatMap((row) => (row.scroll ? [row.scroll] : []));
  const lines = [
    `# Walkthrough report — ${input.walk}`,
    '',
    '| | |',
    '|---|---|',
    `| result | **${input.exitCode === 0 ? 'PASSED' : 'FAILED'}** (exit code ${input.exitCode}) |`,
    `| ended | ${cell(input.ended)} |`,
    `| run id | \`${input.runId}\` |`,
    `| app | ${input.appAddress} |`,
    `| mode · start step | ${input.mode} · ${input.startStep} |`,
    `| started · length | ${input.startedAt.toISOString()} · ${input.seconds.toFixed(0)} s |`,
    `| checks | ${pass} PASS · ${fail} FAIL · ${notChecked} NOT CHECKED |`,
    `| browser errors | ${input.browserErrors.length} |`,
    `| log | ${input.logFile} |`,
    '',
    '## Steps',
    '',
    'Acting time is the step\'s own time with the waits for a person taken out. Scroll is every scroll of the page',
    'and its scrolled elements during the step, summed; screens = pixels / window height.',
    '',
    '| step | key | actor | result | acting s | waiting s | scroll px | screens | checks P/F/NC |',
    '|---|---|---|---|---:|---:|---:|---:|---|',
    ...input.steps.map((row) => {
      const mine = input.checks.filter((one) => one.step === `${row.number} · ${row.key}`);
      const counts = `${mine.filter((one) => one.status === 'PASS').length}/${mine.filter((one) => one.status === 'FAIL').length}/${mine.filter((one) => one.status === 'NOT CHECKED').length}`;
      const scroll = row.scroll ? [row.scroll.pixels.toLocaleString('en-US'), row.scroll.screens.toFixed(1)] : [row.scrollFailure ? `not measured: ${cell(row.scrollFailure)}` : '—', '—'];
      return `| ${row.number} | ${cell(row.key)} | ${cell(row.actor)} | ${cell(row.result)}${row.beforeStart ? ' (before the start step, by itself)' : ''} | ${secondsCell(row.actingSeconds)} | ${secondsCell(row.waitingSeconds)} | ${scroll[0]} | ${scroll[1]} | ${counts} |`;
    }),
    `| **total** | ${input.steps.length} steps | | | | | **${scrolled.reduce((sum, one) => sum + one.pixels, 0).toLocaleString('en-US')}** | **${scrolled.reduce((sum, one) => sum + one.screens, 0).toFixed(1)}** | ${pass}/${fail}/${notChecked} |`,
    '',
    '## Checks',
    '',
    '| step | requirement | check | status | expected | received | reason |',
    '|---|---|---|---|---|---|---|',
    ...input.checks.map((one) => `| ${cell(one.step)} | ${cell(one.requirement)} | ${cell(one.name)} | ${one.status} | ${cell(one.expected)} | ${cell(one.received)} | ${cell(one.reason)} |`),
    '',
    '## Requirements named by a step and proved by no check',
    '',
    ...(input.unproved.length ? input.unproved.map((one) => `- step ${one.step}: ${one.requirement}`) : ['- none']),
    '',
    '## Browser errors',
    '',
    ...(input.browserErrors.length ? input.browserErrors.map((line) => `- ${line}`) : ['- none']),
    '',
    '## Notes',
    '',
    ...(input.notes.length ? input.notes.map((line) => `- ${line}`) : ['- none']),
    '',
  ];
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, lines.join('\n'), 'utf8');
}
