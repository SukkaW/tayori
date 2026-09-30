import { getRawContent } from '@/lib/content';
import { DOCS, DOCS_SLUGS } from '@/lib/docs';
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

const PREAMBLE = `# tayori

${SITE_DESCRIPTION}. ${SITE_URL}

This file contains the full documentation of both modes: \`tayori\` (Hey API mode, ${SITE_URL}${DOCS['hey-api'].path}) and \`tayori-connect\` (ConnectRPC mode, ${SITE_URL}${DOCS.connect.path}). Both packages share the same hooks and SWR semantics, they only differ in how a request is described.
`;

export function GET() {
  const documents = DOCS_SLUGS.map(slug => `# ${DOCS[slug].llmsHeading}\n\n${getRawContent(slug).trim()}\n`);

  return new Response([PREAMBLE, ...documents].join('\n'));
}
