import { useSearchParams } from 'react-router';
import { AuthCard } from '../ui/AuthCard';

export function meta() {
  return [{ title: 'No access · Hedgile' }];
}

const messages: Record<string, string> = {
  no_membership:
    'Your LaimonID account is not a member of any Hedgile organisation yet. Ask an admin of your organisation to invite your email address.',
  email_not_verified:
    'Your LaimonID email address is not verified yet. Verify it in LaimonID, then sign in again.',
  failed: 'The sign-in could not be completed. Please try again.',
};

export default function NoAccess() {
  const [params] = useSearchParams();
  const message = messages[params.get('reason') ?? ''] ?? messages.failed;
  return (
    <AuthCard title="You cannot sign in yet">
      <p>{message}</p>
      <a className="button" href="/auth/login">
        Try again
      </a>
    </AuthCard>
  );
}
