import type { Metadata } from 'next';

import { Hero } from '@/components/hero';
import { BackendPicker } from '@/components/backend-picker';
import { Footer } from '@/components/footer';
import { LegacyHashRedirect } from '@/components/legacy-hash-redirect';
import { createPageMetadata, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  path: '/',
  title: SITE_TITLE,
  description: SITE_DESCRIPTION
});

export default function Home() {
  return (
    <>
      <LegacyHashRedirect />
      <Hero />
      <BackendPicker />
      <Footer />
    </>
  );
}
