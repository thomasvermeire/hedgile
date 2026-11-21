/** Group a plain decimal string with thousands separators: "22629.2581" -> "22,629.2581". */
export function formatDecimal(text: string, options: { trimZeros?: boolean } = {}): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new RangeError(`Not a decimal string: ${text}`);
  const [, sign = '', whole = '0', rawFraction = ''] = match;
  const fraction = options.trimZeros ? rawFraction.replace(/0+$/, '') : rawFraction;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}
