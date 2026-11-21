/**
 * KNOWN: the value is published for that date. LAST KNOWN: no value for that
 * date yet, so the most recent published one is shown instead.
 */
export type Knowledge = 'known' | 'last_known';

export function KnownBadge({ status }: { status: Knowledge }) {
  return (
    <span className={`badge badge--${status === 'known' ? 'known' : 'last-known'}`}>
      {status === 'known' ? 'KNOWN' : 'LAST KNOWN'}
    </span>
  );
}
