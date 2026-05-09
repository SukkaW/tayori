import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';
import type { Person, SoftwareSourceCode, WebSite, WithContext } from 'schema-dts';

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

const SITE_URL = 'https://tayori.skk.moe';
const SITE_TITLE = 'tayori — React data fetching stack (made by Sukka)';
const SITE_DESCRIPTION = 'An opinionated React client-side data fetching stack built on top of SWR and Hey API';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    'tayori',
    'SWR',
    'Hey API',
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
    canonical: '/',
    types: {
      'text/markdown': [{
        url: '/llms-full.txt',
        title: 'LLM friendly version of tayori\'s documentation'
      }]
    }
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'tayori',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION
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

const author: Person = {
  '@type': 'Person',
  name: 'Sukka',
  url: 'https://skk.moe',
  sameAs: [
    'https://github.com/SukkaW',
    'https://twitter.com/isukkaw',
    'https://bsky.app/profile/skk.moe',
    'https://acg.mn/@sukka'
  ]
};

const websiteJsonLd: WithContext<WebSite> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: SITE_URL,
  name: 'tayori',
  description: SITE_DESCRIPTION,
  inLanguage: 'en-US',
  author
};

const softwareJsonLd: WithContext<SoftwareSourceCode> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'tayori',
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  codeRepository: 'https://github.com/SukkaW/tayori',
  programmingLanguage: 'TypeScript',
  runtimePlatform: 'React',
  license: 'https://opensource.org/licenses/MIT',
  author
};

const serializeJsonLd = (data: unknown) => JSON.stringify(data).replaceAll('<', String.raw`\u003c`).replaceAll('>', String.raw`\u003e`);

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html
      lang="en"
      {...stylexPropsWithClassName(stylex.props(styles.html), instrumentSans.variable, jetbrainsMono.variable)}
    >
      <body {...stylex.props(styles.body)}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- JSON-LD payload is built from static data.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- JSON-LD payload is built from static data.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(softwareJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
