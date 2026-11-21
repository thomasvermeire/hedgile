import { z } from 'zod';
import { LOG_LEVELS } from '../utils/logger.js';

/**
 * Environment variable schema for Hedgile application.
 * All environment variables are validated at startup.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

/**
 * Type representing the validated environment variables.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables and return the validated config.
 * @throws Error if validation fails
 */
export function validateEnv(): Env {
  return envSchema.parse(process.env);
}
