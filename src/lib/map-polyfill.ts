/**
 * Minimal Map upsert polyfill for runtimes before Chrome 145 / Safari 26.2 /
 * Firefox 144 (and Cursor Electron ~Chrome 144).
 * Used only by Studio PDF (Inkbar); do not import from app layout.
 */
export function ensureMapGetOrInsertComputed(): void {
  const proto = Map.prototype as Map<unknown, unknown> & {
    getOrInsertComputed?: (key: unknown, cb: (key: unknown) => unknown) => unknown;
    getOrInsert?: (key: unknown, defaultValue: unknown) => unknown;
  };
  if (typeof proto.getOrInsertComputed !== "function") {
    proto.getOrInsertComputed = function getOrInsertComputed(key, callbackFn) {
      if (this.has(key)) return this.get(key);
      const value = callbackFn(key);
      this.set(key, value);
      return value;
    };
  }
  if (typeof proto.getOrInsert !== "function") {
    proto.getOrInsert = function getOrInsert(key, defaultValue) {
      if (this.has(key)) return this.get(key);
      this.set(key, defaultValue);
      return defaultValue;
    };
  }
}
