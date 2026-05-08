import { DocsMarkdownRoot } from './docs-markdown';
import { getContent } from '../lib/content';

export function DocsContent() {
  const { jsx } = getContent();

  return (
    <DocsMarkdownRoot>
      {jsx}
    </DocsMarkdownRoot>
  );
}
