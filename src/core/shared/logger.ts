import pino from "pino";

export function createLogger(level = process.env.VIBE_LOG_LEVEL ?? "info") {
  return pino({ level });
}

export type Logger = ReturnType<typeof createLogger>;
