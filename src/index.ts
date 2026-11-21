/**
 * Hedgile - Nickel Trade Management System
 *
 * This is the main entry point for the Hedgile application.
 * It initializes the application, validates environment configuration,
 * and exports the core functionality.
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { validateEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';
import { generateId, type Trade, type Position, type Valuation } from './types/trade.js';
import { ValidationError } from './utils/validation.js';

/**
 * Application metadata.
 */
export const APP_INFO = {
  name: 'Hedgile',
  version: '0.1.0',
  description: 'Nickel trade management system for small trading teams',
} as const;

/**
 * Initialize the application.
 * Validates environment configuration and returns the validated config.
 * @throws ValidationError if environment validation fails
 */
export function initialize(): void {
  // Validate environment at startup
  const env = validateEnv();

  const logger = createLogger(env.LOG_LEVEL);
  logger.info(`${APP_INFO.name} v${APP_INFO.version} initialized`, {
    environment: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
  });
}

/**
 * Health check endpoint.
 * Returns basic health information about the application.
 */
export function healthCheck(): object {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    ...APP_INFO,
  };
}

/**
 * Generate a new trade ID.
 * This is a convenience function for creating unique trade identifiers.
 */
export function createTradeId(): string {
  return generateId();
}

/**
 * Re-export types for convenience.
 */
export type { Trade, Position, Valuation };
export { ValidationError };

/**
 * Run initialize() when this file is executed directly (`node dist/index.js`),
 * not when it is imported.
 */
function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  try {
    initialize();
  } catch (error) {
    // The settings are invalid, so LOG_LEVEL cannot be trusted: always report it.
    const issues =
      error instanceof ZodError
        ? error.issues.map((i) => ({ setting: i.path.join('.'), problem: i.message }))
        : String(error);
    createLogger('error').error('Hedgile could not start: invalid configuration', { issues });
    process.exitCode = 1;
  }
}
