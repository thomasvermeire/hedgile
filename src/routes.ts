import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  // Public
  route('health', 'routes/health.ts'),
  ...prefix('auth', [
    route('login', 'routes/auth.login.ts'),
    route('callback', 'routes/auth.callback.ts'),
    route('logout', 'routes/auth.logout.ts'),
    route('signed-out', 'routes/auth.signed-out.tsx'),
    route('no-access', 'routes/auth.no-access.tsx'),
  ]),

  // Signed in: API and files
  route('api/laimon/chat', 'routes/api.laimon.chat.ts'),
  route('api/laimon/extract', 'routes/api.laimon.extract.ts'),
  route('attachments/:attachmentId', 'routes/attachment.ts'),

  // Signed in: the app shell (menu + Laimon panel) around every page
  layout('routes/app-layout.tsx', [
    index('routes/home.tsx'),
    route('settings', 'routes/settings.tsx'),
    route('master-data/companies', 'routes/master-data.companies.tsx'),
    route('master-data/materials', 'routes/master-data.materials.tsx'),
    route('market-data/metals/:referenceId', 'routes/market-data.metal.tsx'),
    route('laimon/drafts/:draftId', 'routes/laimon.draft.tsx'),
    route('releases', 'routes/releases.tsx'),
    route('*', 'routes/module-placeholder.tsx'),
  ]),
] satisfies RouteConfig;
