// The scenario's own report — `scenario-report.md` in the recording folder: what failed, every
// browser error, which parts ran, the watchdog's last samples. The exit code says whether it passed;
// this says why, and it is what a person reads before deciding whether a failed run may become a video.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Noise } from './listeners';

export const SCENARIO_REPORT_FILE = 'scenario-report.md';

export interface ReportFacts {
  name: string;
  runId: string;
  seconds: number;
  failures: string[];
  notes: string[];
  noise: Noise;
  parts: string;
  ended: string | null;
  watchdog: { ticks: number; everyMs: number; stall: string | null; dump: string[] };
}

const list = (lines: readonly string[]): string[] => (lines.length ? lines.map((line) => `- ${line}`) : ['none']);

export function writeScenarioReport(folder: string, facts: ReportFacts): string {
  const errors = facts.noise.consoleErrors.length + facts.noise.pageErrors.length + facts.noise.failedRequests.length + facts.noise.badAnswers.length;
  const passed = facts.failures.length === 0 && errors === 0;
  const lines = [
    `# Scenario — ${facts.name}`,
    '',
    `**${passed ? 'PASSED' : 'FAILED'}** — ${facts.failures.length} failed check(s), ${errors} browser error(s), ${facts.seconds.toFixed(1)}s, run id \`${facts.runId}\``,
    '',
    `Parts: ${facts.parts}`,
    '',
    ...(facts.ended ? ['## Ended early', '', '```', facts.ended, '```', ''] : []),
    '## Failed checks', '', ...list(facts.failures), '',
    '## Browser errors', '',
    `Console (${facts.noise.consoleErrors.length}):`, ...list(facts.noise.consoleErrors), '',
    `Uncaught (${facts.noise.pageErrors.length}):`, ...list(facts.noise.pageErrors), '',
    `Failed requests (${facts.noise.failedRequests.length}):`, ...list(facts.noise.failedRequests), '',
    `4xx/5xx from the app (${facts.noise.badAnswers.length}):`, ...list(facts.noise.badAnswers), '',
    '## Notes', '', ...list(facts.notes), '',
    '## Watchdog', '',
    `${facts.watchdog.ticks} samples, one each ${facts.watchdog.everyMs}ms. ${facts.watchdog.stall ?? 'No stall.'}`, '',
    '```', ...facts.watchdog.dump, '```', '',
  ];
  const file = join(folder, SCENARIO_REPORT_FILE);
  writeFileSync(file, lines.join('\n'));
  return file;
}
