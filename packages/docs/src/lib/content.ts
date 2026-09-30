import { cache } from 'react';
import { foxmd, tocArrayToTree } from 'foxmd';

import { docsMarkdownRendererOptions } from '../components/docs-markdown';
import type { DocsSlug } from './docs';

// @ts-expect-error -- intentional usage for React Fast Refresh support
// eslint-disable-next-line import-x/no-webpack-loader-syntax, import-x/no-unresolved -- intentional usage
import HEY_API_CONTENT from '!!raw-loader!@/content/hey-api.md';
// @ts-expect-error -- intentional usage for React Fast Refresh support
// eslint-disable-next-line import-x/no-webpack-loader-syntax, import-x/no-unresolved -- intentional usage
import CONNECT_CONTENT from '!!raw-loader!@/content/connect.md';

export type { DocsSlug } from './docs';

const RAW_CONTENT: Record<DocsSlug, string> = {
  'hey-api': HEY_API_CONTENT,
  connect: CONNECT_CONTENT
};

export const getRawContent = (slug: DocsSlug): string => RAW_CONTENT[slug];

export const getContent = cache(function getContent(slug: DocsSlug) {
  // Every foxmd() call has its own slugger, so heading ids are stable per document
  const { jsx, toc: tocObj } = foxmd(getRawContent(slug), {
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
