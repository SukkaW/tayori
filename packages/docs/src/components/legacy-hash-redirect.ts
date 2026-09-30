'use client';

import { useEffect } from 'react';

import { DOCS } from '../lib/docs';

/**
 * The documentation used to live on `/` (Hey API only). Deep links such as `/#installation` still
 * arrive here, and a hash never reaches the server, so hop to the same anchor on the Hey API page.
 */
const RENAMED_ANCHORS: Record<string, string> = {
  // "Cache Tag Invalidation" became "Cache Tags"
  'cache-tag-invalidation': 'cache-tags'
};

const OWN_ANCHORS = new Set(['hero', 'choose-your-backend']);

export function LegacyHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || OWN_ANCHORS.has(hash)) return;
    window.location.replace(`${DOCS['hey-api'].path}#${RENAMED_ANCHORS[hash] ?? hash}`);
  }, []);

  return null;
}
