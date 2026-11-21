/**
 * Class names for table rows. Backtrading lines (entered with a date in the
 * past) are shown light red so they stand out.
 */
export function rowClassName({ backtrading = false }: { backtrading?: boolean }): string {
  return backtrading ? 'row row--backtrading' : 'row';
}
