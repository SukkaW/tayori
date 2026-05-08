import * as stylex from '@stylexjs/stylex';

import { getContent } from '../lib/content';
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

export function DocsSection() {
  const { toc, tocIds } = getContent();

  return (
    <section id="docs" {...stylex.props(styles.wrap)}>
      <DocsSectionInner toc={toc} tocIds={tocIds}>
        <DocsContent />
      </DocsSectionInner>
    </section>
  );
}
