import { Anchor, Blockquote, DocsMarkdownRoot, Paragraph } from './docs-markdown';
import { getContent } from '../lib/content';

export function DocsContent() {
  const { jsx } = getContent();

  return (
    <DocsMarkdownRoot>
      <Blockquote>
        <Paragraph>
          LLM friendly version of the documentation can be found at <Anchor href="/llms-full.txt" target="_blank">/llms-full.txt</Anchor>.
        </Paragraph>
      </Blockquote>

      {jsx}
    </DocsMarkdownRoot>
  );
}
