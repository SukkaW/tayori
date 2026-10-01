'use strict';

const { SWRConfig } = require('swr');

// The brand tayori puts on its keys (`kTayoriKey` in tayori-core), referenced through the symbol
// registry so this helper works for every package without importing any of them.
const kTayoriKey = Symbol.for('tayori.key');

/**
 * Delete every tayori entry, and every SWR-infinite aggregate, from SWR's default cache.
 *
 * `mutate(filter, undefined, { revalidate: false })` only resets `data` / `error` and keeps the entry
 * (with its `_k`) around, which lets later tests match stale entries by tag. Call this from an
 * `afterEach` of tests that use the default cache; RTL's own cleanup (unmount) runs first.
 */
function clearTayoriDefaultCache() {
  const { cache } = SWRConfig.defaultValue;
  const keys = Array.from(cache.keys());
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i];
    const entry = cache.get(key);
    const original = entry ? entry._k : undefined;
    if (key.startsWith('$inf$') || (typeof original === 'object' && original !== null && kTayoriKey in original)) {
      cache.delete(key);
    }
  }
}

module.exports = { clearTayoriDefaultCache };
