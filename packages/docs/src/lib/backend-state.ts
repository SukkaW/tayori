import { useSyncExternalStore } from 'react';

import { DOCS_SLUGS } from './docs';
import type { DocsSlug } from './docs';

export const DEFAULT_BACKEND: DocsSlug = 'hey-api';

const listeners = new Set<() => void>();

function getBackend(): DocsSlug {
  const backend = new URLSearchParams(window.location.search).get('backend');
  return DOCS_SLUGS.find(slug => slug === backend) ?? DEFAULT_BACKEND;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // `replaceState` does not fire events, back / forward does
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

/**
 * The backend the documentation is showing: `?backend=` of the URL, which is the only place it is
 * stored. The static HTML always holds the default backend, so the server snapshot is the default.
 */
export function useBackend(): DocsSlug {
  return useSyncExternalStore(subscribe, getBackend, () => DEFAULT_BACKEND);
}

export function setBackend(slug: DocsSlug, hash?: string) {
  const url = new URL(window.location.href);
  if (slug === DEFAULT_BACKEND) {
    url.searchParams.delete('backend');
  } else {
    url.searchParams.set('backend', slug);
  }
  if (hash !== undefined) url.hash = hash;
  window.history.replaceState(null, '', url);
  listeners.forEach(listener => listener());
}

interface Anchor {
  element: Element,
  /** Distance of the element from the top of the viewport */
  top: number
}

/** The first heading in the viewport, or the last one above it */
function getHeadingAnchor(): Element | undefined {
  const headings = Array.from(document.querySelectorAll('#docs h2[id], #docs h3[id]'));
  return headings.find(heading => heading.getBoundingClientRect().top >= 0)
    ?? headings.findLast(heading => heading.getBoundingClientRect().top < 0);
}

let pendingAnchor: Anchor | undefined;

/**
 * Switch backends from inside the documentation. Tab cards change height, so the reader's place is
 * remembered by an element that stays in the page (the control that was used, or a heading) and put
 * back after the switch.
 */
export function switchBackend(slug: DocsSlug, control?: Element) {
  const element = control ?? getHeadingAnchor();
  pendingAnchor = element && { element, top: element.getBoundingClientRect().top };
  setBackend(slug);
}

export function takePendingAnchor(): Anchor | undefined {
  const anchor = pendingAnchor;
  pendingAnchor = undefined;
  return anchor;
}
