'use client';

import { useLayoutEffect } from 'foxact/use-isomorphic-layout-effect';

import { takePendingAnchor, useBackend } from '../lib/backend-state';
import { BackendPill } from './backend-switch';

const RENAMED_ANCHORS: Record<string, string | undefined> = {
  // "Cache Tag Invalidation" became "Cache Tags"
  'cache-tag-invalidation': 'cache-tags'
};

/** Puts the backend pill on top of the documentation and keeps the reader in place when the backend changes */
export function BackendDocs({ children }: React.PropsWithChildren) {
  const backend = useBackend();

  // The page loads on the default backend and switches after hydration when the URL asks for
  // another one, which changes what the tab cards show
  useLayoutEffect(() => {
    const anchor = takePendingAnchor();
    if (anchor) {
      if (anchor.element.isConnected) {
        window.scrollBy({ top: anchor.element.getBoundingClientRect().top - anchor.top, behavior: 'instant' });
      }
      return;
    }

    const hash = window.location.hash.slice(1);
    const id = RENAMED_ANCHORS[hash] ?? hash;
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
  }, [backend]);

  return (
    <>
      <BackendPill />
      {children}
    </>
  );
}
