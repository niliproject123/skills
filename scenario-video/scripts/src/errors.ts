// One error shape for everything the video tools refuse to do: a code that names the problem, a
// message a person can act on, and the facts behind it. Nothing in these tools throws a bare Error
// or a string, and nothing catches one without saying so.

export class VideoError extends Error {
  readonly code: string;
  readonly facts: Record<string, unknown> | undefined;

  constructor(code: string, message: string, facts?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = 'VideoError';
    this.code = code;
    this.facts = facts;
  }
}

/** The first line of whatever was thrown — for a log line or a problems entry, never to hide it. */
export function firstLineOf(thrown: unknown): string {
  if (thrown instanceof Error) return thrown.message.split('\n')[0] ?? thrown.name;
  return String(thrown);
}
