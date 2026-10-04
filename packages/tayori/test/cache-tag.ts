import type { CacheTag } from 'tayori-core';

/**
 * A cache tag unique to the test that creates it.
 *
 * Hook tests run under an isolated `<SWRConfig provider />` (a fresh `Map` per mount), but
 * `unstable_mutateWithTags` goes through SWR's global `mutate`, which is bound to SWR's default
 * cache: shared by every test in the process and not swappable by any provider. Unique tags make the
 * entries such a test leaves behind inert for every other test, the same way SWR's own test suite
 * uses unique keys instead of clearing the default cache.
 */
export function createTag(name = 'tag'): CacheTag {
  return `#${name}-${Math.random().toString(36).slice(2, 10)}`;
}
