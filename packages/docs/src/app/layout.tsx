import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';

import '@/styles/globals.css';
import 'stylex-webpack/stylex.css';

const styles = stylex.create({
  html: {
    fontFamily: 'var(--font-instrument-sans), system-ui, sans-serif',
    backgroundColor: '#f7f4ef',
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

export const metadata: Metadata = {
  title: 'tayori — React data fetching stack',
  description:
    'A typed client-side stack built on SWR and Hey API. Composable, SSR-ready, and thin enough to understand in an afternoon.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      {...stylexPropsWithClassName(stylex.props(styles.html), instrumentSans.variable, jetbrainsMono.variable)}
    >
      <body {...stylex.props(styles.body)}>{children}</body>
    </html>
  );
}
