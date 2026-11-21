export type AppVersion = { version: string; commit: string };

/** The running build's version and short commit; 'dev' values when not injected (tests, odd tooling). */
export function getAppVersion(): AppVersion {
  return {
    version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev',
    commit: typeof __APP_COMMIT__ === 'string' && __APP_COMMIT__ ? __APP_COMMIT__ : 'dev',
  };
}

/** `v0.2.0 · abc1234`, or just `v0.2.0` when the commit is unknown. */
export function formatVersionLabel({ version, commit }: AppVersion): string {
  return commit && commit !== 'dev' ? `v${version} · ${commit}` : `v${version}`;
}
