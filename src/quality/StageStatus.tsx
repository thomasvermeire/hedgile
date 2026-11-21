import { Lock } from '../ui/Lock';

export type StageStatusValue = 'active' | 'inactive' | 'locked';

const labels: Record<StageStatusValue, string> = {
  active: 'Active',
  inactive: 'Inactive',
  locked: 'Locked',
};

/** A stage's status badge; locked stages also show the lock. */
export function StageStatus({ status }: { status: StageStatusValue }) {
  return (
    <span className="stage-status">
      <span className={`badge badge--stage-${status}`}>{labels[status]}</span>
      {status === 'locked' && <Lock label="Locked: not available yet" />}
    </span>
  );
}
