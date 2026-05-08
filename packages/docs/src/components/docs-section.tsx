import * as stylex from '@stylexjs/stylex';

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
  return (
    <section id="docs" {...stylex.props(styles.wrap)}>
      <DocsSectionInner>
        <DocsContent />
      </DocsSectionInner>
    </section>
  );
}
