/** A new random id with a readable prefix, e.g. newId('co') -> 'co_3f9a…'. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}
