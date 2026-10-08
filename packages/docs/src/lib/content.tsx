import { cache } from 'react';
import { foxmd, tocArrayToTree } from 'foxmd';

import { BackendOnly, BackendTabs } from '../components/backend-switch';
import { docsMarkdownRendererOptions } from '../components/docs-markdown';
import { DOCS_SLUGS } from './docs';
import type { DocsSlug } from './docs';
import { isCodeOnly, selectBackend, splitDocs } from './docs-source';

// @ts-expect-error -- intentional usage for React Fast Refresh support
// eslint-disable-next-line import-x/no-webpack-loader-syntax, import-x/no-unresolved -- intentional usage
import DOCS_CONTENT from '!!raw-loader!@/content/docs.md';

export type { DocsSlug } from './docs';

const foxmdParserOptions = {
  UNSAFE_pickSingleImageChildOutOfParentParagraph: true
};

/** The markdown of one backend, for `llms-full.txt` */
export const getRawContent = cache((slug: DocsSlug): string => selectBackend(DOCS_CONTENT, slug));

export const getContent = cache(function getContent() {
  const { skeleton, groups } = splitDocs(DOCS_CONTENT);

  // The variants of a tab card hold no headings, so each one is rendered on its own
  const tabs = groups.map(group => ({
    variants: DOCS_SLUGS.reduce<Partial<Record<DocsSlug, React.ReactNode>>>((variants, slug) => {
      const markdown = group[slug];
      if (markdown !== undefined) {
        variants[slug] = foxmd(markdown, { foxmdRendererOptions: docsMarkdownRendererOptions, foxmdParserOptions }).jsx;
      }
      return variants;
    }, {}),
    // Code on its own gets a tab card without padding around it
    codeOnly: Object.values(group).every(isCodeOnly)
  }));

  // Every foxmd() call has its own slugger, so heading ids are stable per document
  const customReactComponentsForHtmlTags = {
    ...docsMarkdownRendererOptions.customReactComponentsForHtmlTags,
    // the placeholder of a tab card, see `splitDocs`
    'docs-tabs': ({ index }: { index: string }) => {
      const { variants, codeOnly } = tabs[Number(index)];
      const backends = DOCS_SLUGS.filter(slug => variants[slug] !== undefined);
      return backends.length === 1
        ? <BackendOnly slug={backends[0]} codeOnly={codeOnly}>{variants[backends[0]]}</BackendOnly>
        : <BackendTabs variants={variants} codeOnly={codeOnly} />;
    }
  };

  const { jsx, toc: tocObj } = foxmd(skeleton, {
    foxmdRendererOptions: { ...docsMarkdownRendererOptions, customReactComponentsForHtmlTags },
    foxmdParserOptions
  });

  const toc = tocArrayToTree(tocObj);
  const tocIds = tocObj.map(item => item.id);

  return { jsx, toc, tocIds };
});
