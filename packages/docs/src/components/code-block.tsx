import { codeToHtml } from 'shiki';
import { transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';

import { CopyButton } from './copy-button';

const styles = stylex.create({
  wrap: {
    position: 'relative',
    marginBlock: '14px',
    marginInline: '0',
    minWidth: 0,
    maxWidth: '100%'
  }
});

export async function CodeBlock({ children, lang = 'typescript' }: {
  children: string,
  lang?: string
}) {
  const html = await codeToHtml(children.trim(), {
    lang,
    theme: 'one-dark-pro',
    transformers: [
      transformerNotationDiff(),
      transformerNotationHighlight()
    ]
  });

  return (
    <div {...stylexPropsWithClassName(stylex.props(styles.wrap), 'code-wrap')}>
      {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- Shiki returns trusted highlighted HTML for static docs snippets. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <CopyButton code={children.trim()} />
    </div>
  );
}
