import { z } from 'zod';
import { LOG_LEVELS } from '../utils/logger.js';

const emailList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

/**
 * The Worker's settings: vars from wrangler.jsonc plus secrets. Checked on the
 * first request each Worker instance serves (Workers have no separate start-up).
 */
export const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('production'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  LAIMONID_ISSUER: z.url({ protocol: /^https?$/ }),
  LAIMONID_CLIENT_ID: z.string().min(1),
  LAIMONID_CLIENT_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  BOOTSTRAP_ADMIN_EMAILS: emailList,
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
  LAIMON_MODEL: z.string().min(1).default('claude-opus-5-5'),
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(public readonly problems: { setting: string; problem: string }[]) {
    super(`Invalid configuration: ${problems.map((p) => p.setting).join(', ')}`);
    this.name = 'ConfigError';
  }
}

const cache = new WeakMap<object, AppConfig>();

/**
 * Validate the Worker env once per instance and return typed settings.
 * @throws ConfigError naming each invalid or missing setting
 */
export function getConfig(env: object): AppConfig {
  const cached = cache.get(env);
  if (cached) return cached;
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => ({
        setting: issue.path.join('.'),
        problem: issue.message,
      }))
    );
  }
  cache.set(env, result.data);
  return result.data;
}
