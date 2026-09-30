import { useCallback } from 'react';
import { mutate, useSWRConfig } from 'swr';

import { isTayoriKey } from './key';
import type { CacheTag } from './types';

/**
 * Whether the (resolved) SWR key belongs to a tayori request (from any backend) whose
 * `cacheTags` share at least one tag with the given list.
 */
export function matchesCacheTags(key: unknown, cacheTags: CacheTag[]): boolean {
  if (!isTayoriKey(key)) {
    return false;
  }
  if (typeof key === 'function') {
    // SWR always resolves key functions before storing them, so this never happens,
    // but the type guard above includes key functions.
    return false;
  }
  const cacheTagsFromKey = key[3];
  if (!cacheTagsFromKey?.length) {
    return false;
  }
  return cacheTags.some((tag) => cacheTagsFromKey.includes(tag));
}

/**
 * Revalidate every tayori request (from any backend) whose `cacheTags` share at least one tag
 * with the given list.
 *
 * Uses SWR's global `mutate`, so it only reaches SWR's default cache. Inside React, prefer
 * `useMutateWithTags()`, which uses the cache provider of the nearest `<SWRConfig />`.
 *
 * Known limitation: SWR's filter-based `mutate` skips `useSWRInfinite` aggregates, so pages loaded by
 * `useInfinite` are matched but the list itself is not refetched.
 */
export function mutateWithTags(cacheTags: CacheTag[]) {
  return mutate((key) => matchesCacheTags(key, cacheTags));
}

/**
 * Same as `mutateWithTags`, but bound to the cache provider of the nearest `<SWRConfig />`.
 */
export function useMutateWithTags() {
  const { mutate: swrMutate } = useSWRConfig();
  return useCallback(
    (cacheTags: CacheTag[]) => swrMutate((key) => matchesCacheTags(key, cacheTags)),
    [swrMutate]
  );
}
