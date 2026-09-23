// Every log line carries an elapsed stamp and an actor tag: `[+12.345s] [Dana] pressed "Save"`.
// A run is read back from its log, so a line without either is a line nobody can place.

export class Logger {
  private readonly actor: string;
  private readonly startedAt: number;

  constructor(actor: string, startedAt: number = Date.now()) {
    this.actor = actor;
    this.startedAt = startedAt;
  }

  /** The same clock, another actor — so every line of one run is on one timeline. */
  forActor(actor: string): Logger {
    return new Logger(actor, this.startedAt);
  }

  private stamp(): string {
    return `[+${((Date.now() - this.startedAt) / 1000).toFixed(3)}s] [${this.actor}]`;
  }

  info(message: string): void {
    console.log(`${this.stamp()} ${message}`);
  }

  warn(message: string): void {
    console.warn(`${this.stamp()} WARNING ${message}`);
  }

  error(message: string): void {
    console.error(`${this.stamp()} ERROR ${message}`);
  }
}
