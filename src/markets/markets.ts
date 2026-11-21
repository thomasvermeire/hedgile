/** Shared by the Markets page and its server module; safe for browser code. */
export const sourceTypes = ['manual', 'upload', 'connection'] as const;
export type SourceType = (typeof sourceTypes)[number];

export const sourceTypeLabels: Record<SourceType, string> = {
  manual: 'Manual',
  upload: 'Upload',
  connection: 'Connection',
};

export const sourceTypeOptions = sourceTypes.map((t) => ({
  value: t,
  label: sourceTypeLabels[t],
}));

export interface MetalReferenceView {
  id: string;
  metalId: string;
  name: string;
  /** The publisher, e.g. LME or MB. */
  source: string;
  sourceType: SourceType;
  active: boolean;
}

export interface MetalView {
  id: string;
  symbol: string;
  name: string;
  /** True when the organisation keeps books for this metal; otherwise market-only. */
  isBook: boolean;
  references: MetalReferenceView[];
}
