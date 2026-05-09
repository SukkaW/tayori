import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';

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
      'text/markdown': '/llms-full.txt'
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

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html
      lang="en"
      {...stylexPropsWithClassName(stylex.props(styles.html), instrumentSans.variable, jetbrainsMono.variable)}
    >
      <body {...stylex.props(styles.body)}>{children}</body>
    </html>
  );
}
