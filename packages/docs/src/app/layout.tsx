import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';
import type { Graph, Person, SoftwareSourceCode, WebSite } from 'schema-dts';

import { LLMS_FULL_TXT_ALTERNATE, OG_IMAGE, REPO_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';

import '@/styles/globals.css';
import 'stylex-webpack/stylex.css';

const styles = stylex.create({
  html: {
    fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif',
    backgroundColor: '#f1f5f9',
    color: '#1c1915',
    scrollBehavior: 'smooth'
  },
  body: {
    minHeight: '100vh',
    margin: 0
  }
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-sans'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono'
});

// Every page declares its own canonical URL (plus `alternates`, `openGraph` and `twitter`, since
// Next.js merges metadata shallowly), the root layout only provides site-wide defaults.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    'tayori',
    'SWR',
    'Hey API',
    'ConnectRPC',
    'Connect',
    'protobuf',
    'React',
    'Next.js',
    'TypeScript',
    'OpenAPI',
    'data fetching',
    'client-side data fetching',
    'typed API client',
    'data fetching hooks'
  ],
  authors: [{ name: 'Sukka', url: 'https://skk.moe' }],
  creator: 'Sukka',
  publisher: 'Sukka',
  alternates: {
    types: LLMS_FULL_TXT_ALTERNATE
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE]
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    creator: '@isukkaw'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1
    }
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  }
};

const PERSON_ID = 'https://skk.moe/#person';
const WEBSITE_ID = `${SITE_URL}/#website`;
const SOFTWARE_ID = `${SITE_URL}/#software`;

const author: Person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Sukka',
  url: 'https://skk.moe',
  sameAs: [
    'https://github.com/SukkaW',
    'https://twitter.com/isukkaw',
    'https://bsky.app/profile/skk.moe',
    'https://acg.mn/@sukka'
  ]
};

const website: WebSite = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: SITE_URL,
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  inLanguage: 'en-US',
  author: { '@id': PERSON_ID }
};

const software: SoftwareSourceCode = {
  '@type': 'SoftwareSourceCode',
  '@id': SOFTWARE_ID,
  name: SITE_NAME,
  description: `${SITE_DESCRIPTION}. Published as the npm packages "tayori" (Hey API mode) and "tayori-connect" (ConnectRPC mode).`,
  url: SITE_URL,
  codeRepository: REPO_URL,
  programmingLanguage: 'TypeScript',
  runtimePlatform: 'React',
  keywords: ['SWR', 'Hey API', 'OpenAPI', 'ConnectRPC', 'protobuf', 'React', 'data fetching'],
  license: 'https://opensource.org/licenses/MIT',
  author: { '@id': PERSON_ID }
};

const jsonLd: Graph = {
  '@context': 'https://schema.org',
  '@graph': [author, website, software]
};

const serializeJsonLd = (data: unknown) => JSON.stringify(data).replaceAll('<', String.raw`\u003c`).replaceAll('>', String.raw`\u003e`);

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html
      lang="en"
      {...stylexPropsWithClassName(stylex.props(styles.html), instrumentSans.variable, jetbrainsMono.variable)}
    >
      <body {...stylex.props(styles.body)}>
        {children}

        <script
          type="application/ld+json"
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- JSON-LD payload is built from static data.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </body>
    </html>
  );
}
