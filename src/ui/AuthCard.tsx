import type { ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth__card">
        <div className="brand brand--large">
          <span className="brand__mark" aria-hidden="true">
            H
          </span>
          Hedgile
        </div>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
