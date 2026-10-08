import { getRawContent } from '@/lib/content';
import { DOCS, DOCS_SLUGS } from '@/lib/docs';
import { labelHeadings } from '@/lib/docs-source';
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

const PREAMBLE = `# tayori

${SITE_DESCRIPTION}. ${SITE_URL}

tayori has two backends and this file holds one complete document for each of them, with the same outline. Read only the document that matches the project and ignore the other one:

${DOCS_SLUGS.map(slug => `- \`${DOCS[slug].packageName}\` (${DOCS[slug].label} mode): use it when ${DOCS[slug].llmsWhen}. Read "${DOCS[slug].packageName} — ${DOCS[slug].label} mode" below, online at ${SITE_URL}/?backend=${slug}#docs`).join('\n')}

Every document starts with its own top level heading and is separated from the next one by a horizontal rule. The name of the backend is part of every section heading inside a document, like "Getting Started (Hey API)". Packages, imports, API names and examples of one document do not apply to the other backend.
`;

export function GET() {
  const documents = DOCS_SLUGS.map(slug => {
    const { label, packageName } = DOCS[slug];
    return `# ${packageName} — ${label} mode\n\nEverything up to the next horizontal rule is about the \`${packageName}\` package (${label} mode) only.\n\n${labelHeadings(getRawContent(slug), label).trim()}\n`;
  });

  return new Response([PREAMBLE, ...documents].join('\n---\n\n'));
}
