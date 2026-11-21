import { z } from 'zod';
import {
  amount,
  calculate,
  div,
  mul,
  roundQuantity,
  toDecimalString,
  type Amount,
} from './decimal';

export { calculate, roundQuantity, roundValue } from './decimal';

/** kg is the base unit; each factor is how many of that unit make 1 kg. */
export const unitsPerKg = {
  kg: '1',
  lb: '2.20462262',
  mt: '0.001',
} as const;

export type Unit = keyof typeof unitsPerKg;
export const units = Object.keys(unitsPerKg) as Unit[];

export const unitSchema = z.enum(['kg', 'lb', 'mt']);

export const conversionInput = z.object({
  quantity: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d+)?$/, 'Enter a number such as 1250.5'),
  from: unitSchema,
  to: unitSchema,
});

/** Convert via kg with the exact factors. Returns an exact, unrounded Amount. */
export function convert(quantity: Amount, from: Unit, to: Unit): Amount {
  unitSchema.parse(from);
  unitSchema.parse(to);
  if (from === to) return quantity;
  const kg = div(quantity, amount(unitsPerKg[from]));
  return mul(kg, amount(unitsPerKg[to]));
}

/** Parse, convert and round to 5 decimals (the one rounding step), as a plain decimal string. */
export function convertText(input: z.input<typeof conversionInput>): string {
  const { quantity, from, to } = conversionInput.parse(input);
  return toDecimalString(
    calculate(() => convert(amount(quantity), from, to), roundQuantity),
    5
  );
}
