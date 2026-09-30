import * as stylex from '@stylexjs/stylex';

import { getContent } from '../lib/content';
import type { DocsSlug } from '../lib/docs';
import { DocsSectionInner } from './toc';
import { DocsContent } from './docs-content';

const styles = stylex.create({
  wrap: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#e5e0d8',
    overflowX: 'clip'
  }
});

export function DocsSection({ slug }: { slug: DocsSlug }) {
  const { toc, tocIds } = getContent(slug);

  return (
    <section id="docs" {...stylex.props(styles.wrap)}>
      <DocsSectionInner toc={toc} tocIds={tocIds}>
        <DocsContent slug={slug} />
      </DocsSectionInner>
    </section>
  );
}
