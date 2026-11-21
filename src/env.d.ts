// Secrets are not in wrangler.jsonc, so `wrangler types` cannot see them.
// They are declared here (merged into Env) and validated in src/config/env.ts.
declare namespace Cloudflare {
  interface Env {
    SESSION_SECRET: string;
    LAIMONID_CLIENT_SECRET: string;
    ANTHROPIC_API_KEY?: string;
  }
}
interface Env {
  SESSION_SECRET: string;
  LAIMONID_CLIENT_SECRET: string;
  ANTHROPIC_API_KEY?: string;
}
