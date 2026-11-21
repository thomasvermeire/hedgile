/** Standard lists a book metal's base unit of measure and base currency are chosen from. */
export const uomOptions = [
  { value: 'kg', label: 'kg (kilogram)' },
  { value: 'g', label: 'g (gram)' },
  { value: 'mt', label: 'mt (metric tonne)' },
  { value: 'lb', label: 'lb (pound)' },
  { value: 'oz t', label: 'oz t (troy ounce)' },
  { value: 'st', label: 'st (short ton)' },
  { value: 'lt', label: 'lt (long ton)' },
];

export const currencyCodes = [
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'CNY',
  'HKD',
  'JPY',
  'IDR',
  'AUD',
  'CAD',
  'SGD',
  'INR',
  'KRW',
  'ZAR',
  'BRL',
  'RUB',
  'AED',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'TRY',
  'MXN',
  'NZD',
  'CLP',
  'PEN',
  'CDF',
  'ZMW',
];

export const currencyOptions = currencyCodes.map((c) => ({ value: c, label: c }));
export const uomValues: readonly string[] = uomOptions.map((u) => u.value);
export const defaultUom = 'kg';
