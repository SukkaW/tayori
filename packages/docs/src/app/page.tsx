import type { Metadata } from 'next';

import { Hero } from '@/components/hero';
import { DocsSection } from '@/components/docs-section';
import { Footer } from '@/components/footer';
import { createPageMetadata, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  path: '/',
  title: SITE_TITLE,
  description: SITE_DESCRIPTION
});

export default function Home() {
  return (
    <>
      <Hero />
      <DocsSection />
      <Footer />
    </>
  );
}
