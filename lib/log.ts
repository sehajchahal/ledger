/**
 * Structured logging for the job runner.
 *
 * Runs are long, concurrent, and unattended. Grepping prose out of interleaved
 * output does not work, so every line is a JSON object with the run and prompt
 * it belongs to. In a terminal it stays readable because the message comes
 * first; in a log aggregator it is queryable.
 *
 * Set LOG_FORMAT=json for one object per line, or leave it unset for the
 * human-readable form used during development.
 */

export type Level = "debug" | "info" | "warn" | "error";

export type Context = Record<string, string | number | boolean | null | undefined>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return LEVELS[configured as Level] ?? LEVELS.info;
}

function asJson(): boolean {
  return process.env.LOG_FORMAT === "json";
}

function emit(level: Level, message: string, context: Context = {}): void {
  if (LEVELS[level] < threshold()) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...context,
  };

  const line = asJson()
    ? JSON.stringify(entry)
    : `${message}${formatContext(context)}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function formatContext(context: Context): string {
  const parts = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`);

  return parts.length > 0 ? `  ${parts.join(" ")}` : "";
}

export const log = {
  debug: (message: string, context?: Context) => emit("debug", message, context),
  info: (message: string, context?: Context) => emit("info", message, context),
  warn: (message: string, context?: Context) => emit("warn", message, context),
  error: (message: string, context?: Context) => emit("error", message, context),

  /** Binds context onto every line, so a run does not have to repeat its id. */
  child(base: Context) {
    return {
      debug: (message: string, context?: Context) =>
        emit("debug", message, { ...base, ...context }),
      info: (message: string, context?: Context) =>
        emit("info", message, { ...base, ...context }),
      warn: (message: string, context?: Context) =>
        emit("warn", message, { ...base, ...context }),
      error: (message: string, context?: Context) =>
        emit("error", message, { ...base, ...context }),
    };
  },
};

/** Errors reduced to something loggable without dumping a stack into every line. */
export function errorContext(error: unknown): Context {
  if (error instanceof Error) {
    return { error: error.message, errorType: error.constructor.name };
  }
  return { error: String(error) };
}
