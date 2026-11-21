/**
 * Hedgile - Nickel Trade Management System
 *
 * This is the main entry point for the Hedgile application.
 * It initializes the application, validates environment configuration,
 * and exports the core functionality.
 */

import { validateEnv } from './config/env.js';
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

  // Log initialization
  console.log(`${APP_INFO.name} v${APP_INFO.version} initialized`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Port: ${env.PORT}`);
  console.log(`Log level: ${env.LOG_LEVEL}`);
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
