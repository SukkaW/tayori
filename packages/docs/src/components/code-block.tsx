import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';

import { highlight } from '../lib/shiki';
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
  const html = await highlight(children.trim(), lang);

  return (
    <div {...stylexPropsWithClassName(stylex.props(styles.wrap), 'code-wrap')}>
      {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- Shiki returns trusted highlighted HTML for static docs snippets. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <CopyButton code={children.trim()} />
    </div>
  );
}
