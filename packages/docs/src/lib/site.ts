import type { Metadata } from 'next';

export const SITE_URL = 'https://tayori.skk.moe';
export const SITE_NAME = 'tayori';
export const SITE_TITLE = 'tayori — React data fetching stack (made by Sukka)';
export const SITE_DESCRIPTION = 'An opinionated React client-side data fetching stack built on top of SWR, for Hey API and ConnectRPC backends';
export const REPO_URL = 'https://github.com/SukkaW/tayori';

export const LLMS_FULL_TXT_ALTERNATE: NonNullable<Metadata['alternates']>['types'] = {
  'text/markdown': [{
    url: '/llms-full.txt',
    title: 'LLM friendly version of tayori\'s documentation'
  }]
};

export const OG_IMAGE = {
  width: 1200,
  height: 630,
  url: `${SITE_URL}/og.png`,
  alt: `tayori — ${SITE_DESCRIPTION}`,
  type: 'image/png'
} as const;

export interface PageMetadataInput {
  /** Path of the page, e.g. `/hey-api` */
  path: '/' | `/${string}`,
  title: string,
  description: string
}

/**
 * Next.js merges `metadata` objects shallowly: a page that overrides `alternates` or `openGraph`
 * replaces the whole object coming from the root layout. Every page therefore declares them in full.
 */
export function createPageMetadata({ path, title, description }: PageMetadataInput): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
      types: LLMS_FULL_TXT_ALTERNATE
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [OG_IMAGE]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@isukkaw'
    }
  };
}
