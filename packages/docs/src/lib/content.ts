import { cache } from 'react';
import { foxmd, tocArrayToTree } from 'foxmd';

import { docsMarkdownRendererOptions } from '../components/docs-markdown';

// @ts-expect-error -- intentional usage for React Fast Refresh support
// eslint-disable-next-line import-x/no-webpack-loader-syntax, import-x/no-unresolved -- intentional usage
import CONTENT from '!!raw-loader!@/_doc.md';

export const getContent = cache(function getContent() {
  const { jsx, toc: tocObj } = foxmd(CONTENT, {
    foxmdRendererOptions: {
      ...docsMarkdownRendererOptions
    },
    foxmdParserOptions: {
      UNSAFE_pickSingleImageChildOutOfParentParagraph: true
    }
  });

  const toc = tocArrayToTree(tocObj);
  const tocIds = tocObj.map(item => item.id);

  return { jsx, toc, tocIds };
});
