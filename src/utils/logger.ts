/**
 * The one way the app logs: leveled, filtered by LOG_LEVEL, one line per entry.
 * Errors and warnings go to stderr, everything else to stdout.
 */

export const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'trace'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  trace(message: string, context?: Record<string, unknown>): void;
}

/**
 * Create a logger that writes entries at `level` and more severe.
 */
export function createLogger(level: LogLevel): Logger {
  const threshold = LOG_LEVELS.indexOf(level);
  const write =
    (entryLevel: LogLevel) =>
    (message: string, context?: Record<string, unknown>): void => {
      if (LOG_LEVELS.indexOf(entryLevel) > threshold) return;
      const line = `[${entryLevel}] ${message}${context ? ' ' + JSON.stringify(context) : ''}`;
      if (entryLevel === 'error' || entryLevel === 'warn') console.error(line);
      else console.log(line);
    };
  return {
    error: write('error'),
    warn: write('warn'),
    info: write('info'),
    debug: write('debug'),
    trace: write('trace'),
  };
}
