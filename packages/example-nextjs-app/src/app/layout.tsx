import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tayori – Petstore Example',
  description: 'Example app demonstrating tayori + Hey API + SWR'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
        {children}
      </body>
    </html>
  );
}
