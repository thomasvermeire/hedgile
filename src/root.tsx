import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import type { ReactNode } from 'react';
import type { Route } from './+types/root';
import stylesheet from './styles/app.css?url';

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: stylesheet },
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = 'Something went wrong';
  let detail = 'The error has been logged. Try again, or go back to the start page.';
  if (isRouteErrorResponse(error)) {
    const body = error.data as { kind?: string; settings?: string[] } | undefined;
    if (body?.kind === 'config') {
      title = 'Hedgile is not configured yet';
      detail = `These settings are missing or invalid: ${(body.settings ?? []).join(', ')}. See README.md, "Deploy".`;
    } else if (error.status === 404) {
      title = 'Page not found';
      detail = 'This page does not exist.';
    } else if (error.status === 403) {
      title = 'Not allowed';
      detail =
        typeof error.data === 'string' ? error.data : 'You do not have permission to do this.';
    }
  }
  return (
    <main className="auth">
      <div className="auth__card">
        <h1>{title}</h1>
        <p>{detail}</p>
        <a className="button" href="/">
          Go to the start page
        </a>
      </div>
    </main>
  );
}
