import type { Change, ChangeType, Release } from './releases';

const groups: { type: ChangeType; label: string }[] = [
  { type: 'story', label: 'Stories' },
  { type: 'bug', label: 'Bugs' },
  { type: 'improvement', label: 'Improvements' },
];

function ChangeGroup({ label, changes }: { label: string; changes: Change[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="release__group">
      <h3>{label}</h3>
      <ul>
        {changes.map((c) => (
          <li key={`${c.laimonadeId ?? 'none'}-${c.title}`}>{c.title}</li>
        ))}
      </ul>
    </div>
  );
}

export function ReleaseList({
  releases,
  currentVersion,
}: {
  releases: Release[];
  currentVersion: string;
}) {
  return (
    <>
      <h1>Releases</h1>
      <p className="muted">
        Each release lists the stories, bugs and improvements that changed since the previous one.
      </p>
      <ol className="releases">
        {releases.map((release, i) => {
          const previous = releases[i + 1];
          return (
            <li key={release.version} className="release">
              <h2>
                v{release.version}
                <span className="muted release__date"> · {release.date}</span>
                {release.version === currentVersion && (
                  <span className="release__current">Running</span>
                )}
              </h2>
              <p className="muted">
                {previous ? `Changes since v${previous.version}` : 'First release'}
              </p>
              {groups.map((g) => (
                <ChangeGroup
                  key={g.type}
                  label={g.label}
                  changes={release.changes.filter((c) => c.type === g.type)}
                />
              ))}
            </li>
          );
        })}
      </ol>
    </>
  );
}
