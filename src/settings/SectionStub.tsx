/** Temporary page for a Settings section that is being built. */
export function SectionStub({ title, locked = false }: { title: string; locked?: boolean }) {
  return (
    <>
      <p className="breadcrumb">Settings</p>
      <h1>{title}</h1>
      <div className="empty-state">
        <p>{locked ? 'This section is locked.' : 'This section is being built.'}</p>
      </div>
    </>
  );
}
