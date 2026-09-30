import type { Metadata } from 'next';

import { SiteHeader } from '@/components/site-header';
import { DocsSection } from '@/components/docs-section';
import { Footer } from '@/components/footer';
import { DOCS } from '@/lib/docs';
import { createPageMetadata } from '@/lib/site';

const page = DOCS.connect;

export const metadata: Metadata = createPageMetadata({
  path: page.path,
  title: `${page.title} — tayori`,
  description: 'Use tayori-connect with ConnectRPC services and protobuf-es generated code: setup, useData, useMutation, useInfinite, cache tags, error handling, streaming and server-side rendering with Next.js.'
});

export default function ConnectDocsPage() {
  return (
    <>
      <SiteHeader current="connect" />
      <DocsSection slug="connect" />
      <Footer />
    </>
  );
}
