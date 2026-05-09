import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export const alt = 'tayori — An opinionated React client-side data fetching stack built on top of SWR and Hey API';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function fontsourceFile(pkg: string, file: string) {
  return readFile(join(process.cwd(), 'node_modules', pkg, 'files', file));
}

const SITE_URL = 'https://tayori.skk.moe';
const REPO_URL = 'https://github.com/SukkaW/tayori';
const DESCRIPTION = 'An opinionated React client-side data fetching stack built on top of SWR and Hey API.';

export default async function OpengraphImage() {
  const [
    instrumentSans600,
    instrumentSans400Italic,
    instrumentSans400,
    notoSansJpKanji,
    notoSansJpHiragana,
    jetbrainsMono500
  ] = await Promise.all([
    fontsourceFile('@fontsource/instrument-sans', 'instrument-sans-latin-600-normal.woff'),
    fontsourceFile('@fontsource/instrument-sans', 'instrument-sans-latin-400-italic.woff'),
    fontsourceFile('@fontsource/instrument-sans', 'instrument-sans-latin-400-normal.woff'),
    // 便 (U+4FBF) lives in Noto Sans JP subset 110
    fontsourceFile('@fontsource/noto-sans-jp', 'noto-sans-jp-110-400-normal.woff'),
    // り (U+308A) lives in Noto Sans JP subset 119
    fontsourceFile('@fontsource/noto-sans-jp', 'noto-sans-jp-119-400-normal.woff'),
    fontsourceFile('@fontsource/jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff')
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Instrument Sans"'
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            paddingLeft: 80,
            paddingRight: 80
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 128,
              fontWeight: 600,
              color: '#1c1915',
              letterSpacing: '-0.04em',
              lineHeight: 1
            }}
          >
            tayori
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 32,
              fontSize: 32,
              color: '#90a1b9',
              lineHeight: 1
            }}
          >
            <span style={{ fontFamily: '"Noto Sans JP"' }}>便り</span>
            <span style={{ marginLeft: 18, marginRight: 18 }}>·</span>
            <span style={{ fontStyle: 'italic' }}>news from afar</span>
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 64,
              fontSize: 36,
              color: '#6a7282',
              lineHeight: 1.4,
              maxWidth: 920,
              textAlign: 'center'
            }}
          >
            {DESCRIPTION}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 48,
            alignItems: 'center',
            paddingLeft: 80,
            paddingRight: 80,
            paddingTop: 32,
            paddingBottom: 32,
            backgroundColor: '#f1f5f9',
            fontFamily: '"JetBrains Mono"',
            fontSize: 28,
            color: '#0e7490'
          }}
        >
          <span>{SITE_URL}</span>
          <span>{REPO_URL}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Instrument Sans', data: instrumentSans600, weight: 600, style: 'normal' },
        { name: 'Instrument Sans', data: instrumentSans400Italic, weight: 400, style: 'italic' },
        { name: 'Instrument Sans', data: instrumentSans400, weight: 400, style: 'normal' },
        { name: 'Noto Sans JP', data: notoSansJpKanji, weight: 400, style: 'normal' },
        { name: 'Noto Sans JP', data: notoSansJpHiragana, weight: 400, style: 'normal' },
        { name: 'JetBrains Mono', data: jetbrainsMono500, weight: 500, style: 'normal' }
      ]
    }
  );
}
