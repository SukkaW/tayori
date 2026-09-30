import type { MetadataRoute } from 'next';

import { DOCS, DOCS_SLUGS } from '@/lib/docs';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
      priority: 1
    },
    ...DOCS_SLUGS.map((slug): MetadataRoute.Sitemap[number] => ({
      url: `${SITE_URL}${DOCS[slug].path}`,
      changeFrequency: 'weekly',
      priority: 0.9
    }))
  ];
}
