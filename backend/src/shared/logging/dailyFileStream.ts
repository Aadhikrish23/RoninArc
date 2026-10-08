import fs from "node:fs";
import path from "node:path";

/**
 * Append-only JSON Lines file per day (`<prefix>-YYYY-MM-DD.jsonl`), the
 * offline record that works with no network at all. Old files beyond the
 * retention window are deleted when the day rolls over.
 */
export class DailyFileStream {
  private day = "";
  private stream: fs.WriteStream | null = null;

  constructor(
    private readonly dir: string,
    private readonly prefix: string,
    private readonly retentionDays: number,
  ) {
    fs.mkdirSync(dir, { recursive: true });
  }

  write(line: string): boolean {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.day) this.rotate(day);
    return this.stream!.write(line.endsWith("\n") ? line : `${line}\n`);
  }

  /** Path of the file currently being written. */
  currentFile(): string {
    const day = this.day || new Date().toISOString().slice(0, 10);
    return path.join(this.dir, `${this.prefix}-${day}.jsonl`);
  }

  end(): void {
    this.stream?.end();
    this.stream = null;
  }

  private rotate(day: string) {
    this.stream?.end();
    this.day = day;
    this.stream = fs.createWriteStream(this.currentFile(), { flags: "a" });
    this.prune();
  }

  private prune() {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const pattern = new RegExp(`^${this.prefix}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl$`);
    try {
      for (const file of fs.readdirSync(this.dir)) {
        const match = pattern.exec(file);
        if (match && Date.parse(match[1]) < cutoff) fs.rmSync(path.join(this.dir, file), { force: true });
      }
    } catch {
      // Pruning is best-effort; never let it break logging.
    }
  }
}
