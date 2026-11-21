/**
 * Release notes, newest first. Filled from Laimonade's done items when a release is cut
 * (see "Cutting a release" in README.md). Each release lists what changed since the one below it.
 */
export type ChangeType = 'story' | 'bug' | 'improvement';

export type Change = {
  type: ChangeType;
  title: string;
  /** Laimonade backlog item id; null for work that was not tracked there. */
  laimonadeId: string | null;
};

export type Release = {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  changes: Change[];
};

export const releases: Release[] = [
  {
    version: '0.2.0',
    date: '2026-11-21',
    changes: [
      {
        type: 'improvement',
        title: 'Email and password sign-in instead of LaimonID',
        laimonadeId: null,
      },
      {
        type: 'story',
        title: 'Version list with changes against the previous release',
        laimonadeId: '6af886679e448d3923ba6f5f',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-21',
    changes: [
      { type: 'story', title: 'Set up the project', laimonadeId: '6b018991a3c74ae9c3f68e0d' },
      {
        type: 'story',
        title: 'Multi-tenant organisations with LaimonID sign-in',
        laimonadeId: '6af886649e448d3923ba6e3b',
      },
      {
        type: 'story',
        title: "Navigation menu in the spec's order, with locked entries",
        laimonadeId: '6af886659e448d3923ba6e61',
      },
      {
        type: 'story',
        title: 'Shared UI kit: type-ahead dropdowns, cards, locks and row highlights',
        laimonadeId: '6af886659e448d3923ba6e8b',
      },
      {
        type: 'story',
        title: 'Deploy pipeline with previews and a demo-data reset',
        laimonadeId: '6af886659e448d3923ba6eb2',
      },
      {
        type: 'story',
        title: 'Laimon panel: chat and document reading with user confirmation',
        laimonadeId: '6af886669e448d3923ba6ee8',
      },
    ],
  },
];
