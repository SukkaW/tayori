import * as stylex from '@stylexjs/stylex';

import { Anchor, Blockquote, DocsMarkdownRoot, Paragraph } from './docs-markdown';
import { getContent } from '../lib/content';
import { DOCS } from '../lib/docs';
import type { DocsSlug } from '../lib/docs';

const styles = stylex.create({
  intro: {
    marginBottom: 'clamp(24px, 3vw, 32px)'
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 6,
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: 11.5,
    fontWeight: 500,
    letterSpacing: '0.02em',
    color: '#0e7490',
    backgroundColor: 'rgba(14, 116, 144, 0.08)',
    borderRadius: 20,
    paddingBlock: '3px',
    paddingInline: '10px',
    marginBottom: 14
  },
  title: {
    fontSize: 'clamp(28px, 4vw, 34px)',
    fontWeight: 600,
    letterSpacing: '-0.035em',
    lineHeight: 1.1,
    margin: 0,
    color: '#1c1915'
  },
  lead: {
    marginTop: 12,
    marginBottom: 0,
    fontSize: 15.5,
    lineHeight: 1.7,
    color: '#6a7282',
    maxWidth: '64ch'
  }
});

export function DocsContent({ slug }: { slug: DocsSlug }) {
  const { jsx } = getContent(slug);
  const page = DOCS[slug];

  return (
    <DocsMarkdownRoot>
      <header {...stylex.props(styles.intro)}>
        <span {...stylex.props(styles.eyebrow)}>{page.packageName}</span>
        <h1 {...stylex.props(styles.title)}>{page.title}</h1>
        <p {...stylex.props(styles.lead)}>{page.description}</p>
      </header>

      <Blockquote>
        <Paragraph>
          LLM friendly version of the documentation (both modes) can be found at <Anchor href="/llms-full.txt" target="_blank">/llms-full.txt</Anchor>.
        </Paragraph>
      </Blockquote>

      {jsx}
    </DocsMarkdownRoot>
  );
}
