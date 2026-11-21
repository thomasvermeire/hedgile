/** An R2Bucket stand-in for tests: keeps objects in memory. */
export function createTestR2(): R2Bucket & { keys(): string[] } {
  const store = new Map<string, { body: ArrayBuffer; contentType?: string }>();
  const bucket = {
    async put(
      key: string,
      value: ArrayBuffer,
      options?: { httpMetadata?: { contentType?: string } }
    ) {
      store.set(key, { body: value, contentType: options?.httpMetadata?.contentType });
      return { key };
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      return {
        body: new Response(item.body).body,
        httpMetadata: { contentType: item.contentType },
      };
    },
    async delete(key: string) {
      store.delete(key);
    },
    keys: () => [...store.keys()],
  };
  return bucket as unknown as R2Bucket & { keys(): string[] };
}
