import { Lock as LockIcon } from 'lucide-react';

/** The lock shown on entries and fields that are not available yet. */
export function Lock({ label = 'Locked' }: { label?: string }) {
  return (
    <span className="lock" title={label}>
      <LockIcon aria-hidden="true" size={14} />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
