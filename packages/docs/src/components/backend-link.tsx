'use client';

import { setBackend } from '../lib/backend-state';
import type { DocsSlug } from '../lib/docs';

/** A link to the documentation of a backend, which selects it without reloading the page */
export function BackendLink({ slug, ...props }: React.ComponentProps<'a'> & { slug: DocsSlug }) {
  return (
    <a
      href={`/?backend=${slug}#docs`}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        setBackend(slug, 'docs');
        document.getElementById('docs')?.scrollIntoView();
      }}
      {...props}
    />
  );
}
