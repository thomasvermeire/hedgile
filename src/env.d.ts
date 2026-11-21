// Secrets are not in wrangler.jsonc, so `wrangler types` cannot see them.
// They are declared here (merged into Env) and validated in src/config/env.ts.
declare namespace Cloudflare {
  interface Env {
    SESSION_SECRET: string;
    BOOTSTRAP_ADMIN_EMAIL?: string;
    BOOTSTRAP_ADMIN_PASSWORD?: string;
    ANTHROPIC_API_KEY?: string;
  }
}
interface Env {
  SESSION_SECRET: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
  ANTHROPIC_API_KEY?: string;
}
