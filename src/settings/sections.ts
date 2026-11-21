/**
 * The Settings sub-menu. Each section is its own page under /settings/<path>.
 * Locked sections are visible placeholders that explain what will come.
 */
export interface SettingsSection {
  path: string;
  label: string;
  locked?: boolean;
}

export const settingsSections: SettingsSection[] = [
  { path: '', label: 'General' },
  { path: 'books', label: 'Books' },
  { path: 'markets', label: 'Markets' },
  { path: 'calendars', label: 'Calendars' },
  { path: 'currencies', label: 'Currencies' },
  { path: 'units', label: 'Units of measure' },
  { path: 'quality-stages', label: 'Quality stages' },
  { path: 'parameters', label: 'Parameters' },
  { path: 'connections', label: 'Connections', locked: true },
  { path: 'ledgers', label: 'Ledgers', locked: true },
  { path: 'valuation', label: 'Valuation & result recognition', locked: true },
];
