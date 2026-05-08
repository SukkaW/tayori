import type { Metadata } from 'next';
import './globals.css';
import DataFetchingProvider from './contexts/data-fetching';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'tayori – Planets Example',
  description: 'Example app demonstrating tayori + Hey API + SWR with the Scalar Galaxy API'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
        <DataFetchingProvider>
          {children}
        </DataFetchingProvider>

        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
