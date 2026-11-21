import { AuthCard } from '../ui/AuthCard';

export function meta() {
  return [{ title: 'Signed out · Hedgile' }];
}

export default function SignedOut() {
  return (
    <AuthCard title="You are signed out">
      <a className="button button--primary" href="/auth/login">
        Sign in again
      </a>
    </AuthCard>
  );
}
