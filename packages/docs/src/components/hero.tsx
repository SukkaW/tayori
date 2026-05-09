import { highlight } from '../lib/shiki';
import { Balancer } from 'react-wrap-balancer';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';

import { dedent as ts } from 'ts-dedent';

const styles = stylex.create({
  root: {
    paddingTop: 'clamp(32px,5vw,56px)',
    paddingRight: 'clamp(24px,5vw,72px)',
    paddingBottom: 'clamp(16px,2.5vw,28px)',
    paddingLeft: 'clamp(24px,5vw,72px)',
    maxWidth: '1280px',
    marginInline: 'auto',
    textAlign: 'center'
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 0,
    marginBottom: 'clamp(16px, 2.5vw, 24px)'
  },
  name: {
    fontSize: 36,
    fontWeight: 600,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    margin: 0
  },
  tagline: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 1,
    color: '#90a1b9',
    letterSpacing: '0.01em'
  },
  taglineJp: {
    fontStyle: 'normal'
  },
  taglineEn: {
    fontStyle: 'italic'
  },
  sub: {
    fontSize: 16,
    color: '#6a7282',
    maxWidth: '520px',
    lineHeight: 1.65,
    textAlign: 'center',
    marginTop: '0',
    marginRight: 'auto',
    marginBottom: 'clamp(20px,3vw,28px)',
    marginLeft: 'auto'
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 10,
    columnGap: 10,
    marginBottom: 'clamp(24px, 3.5vw, 36px)',
    flexWrap: 'wrap'
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 7,
    columnGap: 7,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    paddingBlock: '8px',
    paddingInline: '18px',
    borderRadius: 7,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: '#e5e0d8',
      ':hover': '#90a1b9'
    },
    backgroundColor: '#ffffff',
    color: {
      default: '#6a7282',
      ':hover': '#1c1915'
    },
    transitionProperty: 'border-color, color',
    transitionDuration: '0.15s'
  },
  primaryButton: {
    backgroundColor: '#0e7490',
    color: '#fff',
    borderColor: '#0e7490',
    opacity: {
      default: 1,
      ':hover': 0.88
    }
  },
  pills: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: 6,
    columnGap: 6,
    justifyContent: 'center',
    marginBottom: 8
  },
  pill: {
    fontSize: 12,
    color: '#6a7282',
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e0d8',
    backgroundColor: '#ffffff',
    marginBottom: 24,
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 5,
    columnGap: 5,
    flexShrink: 0,
    paddingBlock: '3px',
    paddingInline: '9px',
    borderRadius: 20,
    whiteSpace: 'nowrap'
  },
  bento: {
    display: 'grid',
    gridTemplateColumns: {
      default: '1fr 1fr 1fr 1fr 1fr 1fr',
      '@media (max-width: 640px)': '1fr 1fr',
      '@media (max-width: 400px)': '1fr'
    },
    rowGap: 7,
    columnGap: 7
  },
  bentoCard: {
    // backgroundColor: '#161311',
    // borderRadius: 9,
    // paddingBlock: '14px',
    // paddingInline: '16px',
    // borderWidth: 1,
    // borderStyle: 'solid',
    // borderColor: 'rgba(255, 255, 255, 0.06)',
    // minWidth: 0,
    overflow: 'hidden',
    textAlign: 'left',
    gridColumn: {
      default: 'span 2',
      '@media (max-width: 640px)': 'span 1'
    }
  },
  bentoWide: {
    gridColumn: {
      default: 'span 3',
      '@media (max-width: 400px)': 'span 1'
    }
  },
  // bentoLabel: {
  //   fontFamily: 'var(--font-jetbrains-mono), monospace',
  //   fontSize: 9.5,
  //   fontWeight: 500,
  //   // color: '#0e7490',
  //   color: '#90a1b9',
  //   letterSpacing: '0.07em',
  //   marginBottom: 10,
  //   opacity: 0.85
  // },
  scrollHint: {
    display: 'flex',
    alignItems: 'center',
    rowGap: 7,
    columnGap: 7,
    justifyContent: 'center',
    marginTop: 18,
    fontSize: 12,
    color: '#90a1b9',
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  scrollHintIcon: {
    opacity: 0.9
  }
});

const BENTO = [
  {
    id: 'use-data',
    wide: false,
    code: ts`
      const { data, error } = useData(
        getAllPlanets,
        {
          query: { page: 1, per_page: 20 }
        }
      );
    `.trim()
  },
  {
    id: 'conditional',
    wide: false,
    code: ts`
      const { data, error } = useData(
        getAllPlanets,
        searchQuery
          ? { query: { q: searchQuery } }
          : null
      );
    `.trim()
  },
  {
    id: 'function-arg',
    label: 'useData · function arg',
    wide: false,
    code: ts`
      const { data } = useData(
        getPlanetById,
        () => (astronomer?.asteroidNamedAfter
          ? { id: astronomer.asteroidNamedAfter }
          : null)
      );
    `.trim()
  },
  {
    id: 'mutation-demand',
    label: 'useMutation',
    wide: true,
    code: ts`
      const { trigger, isMutating } = useMutation(updatePlanet);

      await trigger({
        path: { planetId },
        body: { name: nextName }
      });
    `.trim()
  },
  {
    id: 'use-infinite',
    label: 'useInfinite',
    wide: true,
    code: ts`
      const { data, size, setSize } = useInfinite(
        getAllPlanets,
        (i, prev) => (prev?.nextCursor
          ? { query: { cursor: prev.nextCursor, perPage: 20 } }
          : null)
      );
    `.trim()
  }
];

const FEATURE_PILLS = [
  'Fully type-safe',
  'IDE autocompletion',
  'SSR-ready'
];

const STACK_PILLS = [
  { icon: <SWRIcon height={8} />, label: 'SWR' },
  { icon: <HeyAPIIcon height={20} />, label: 'Hey API' }
];

export async function Hero() {
  const highlighted = await Promise.all(
    BENTO.map(({ code }) => highlight(code.trim()))
  );

  return (
    <section id="hero">
      <div {...stylex.props(styles.root)}>

        {/* ── Identity ────────────────────────────────────────── */}
        <div {...stylex.props(styles.identity)}>
          <h1 {...stylex.props(styles.name)}>tayori</h1>
          <p {...stylex.props(styles.tagline)}>
            <span {...stylex.props(styles.taglineJp)}>便り</span>
            {' '}·{' '}
            <span {...stylex.props(styles.taglineEn)}>news from afar</span>
          </p>
        </div>

        {/* ── Description ─────────────────────────────────────── */}
        <p {...stylex.props(styles.sub)}>
          <Balancer>
            An opinionated React client-side data fetching stack built on top of SWR and Hey API.
          </Balancer>
        </p>

        {/* ── Actions ─────────────────────────────────────────── */}
        <div {...stylex.props(styles.actions)}>
          <a href="#docs" {...stylex.props(styles.button, styles.primaryButton)}>
            Getting Started
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>

          <a
            href="https://github.com/SukkaW/tayori"
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.button)}
          >
            <GHIcon /> View on GitHub
          </a>
        </div>

        {/* ── Feature pills ───────────────────────────────────── */}
        <div {...stylex.props(styles.pills)}>
          {STACK_PILLS.map(({ icon, label }) => (
            <span key={label} {...stylex.props(styles.pill)}>
              {icon}
              {label}
            </span>
          ))}

          {FEATURE_PILLS.map(p => (
            <span key={p} {...stylex.props(styles.pill)}>{p}</span>
          ))}
        </div>

        {/* ── Code bento ──────────────────────────────────────── */}
        <div {...stylex.props(styles.bento)}>
          {BENTO.map((c, i) => (
            <div
              key={c.id}
              {...stylexPropsWithClassName(stylex.props(styles.bentoCard, c.wide && styles.bentoWide), 'bento-card')}
              // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- Shiki returns trusted highlighted HTML for static docs snippets.
              dangerouslySetInnerHTML={{ __html: highlighted[i] }}
            />
          ))}
        </div>

        <div {...stylex.props(styles.scrollHint)}>
          <span>Scroll down to explore the docs</span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            {...stylex.props(styles.scrollHintIcon)}
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>

      </div>
    </section>
  );
}

function GHIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function HeyAPIIcon(props: React.ComponentProps<'svg'>) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" {...props}><path fill="#3c3c43" d="M897.5 560.55c11.01 13.45 11.41 28.16 5.33 43.07-7.88 19.33-20.16 35.97-34.07 51.4-15.93 17.65-34.67 31.08-57.84 37.65-2.56.73-4.25 2.53-5.93 4.39a406 406 0 0 1-77.8 67 440 440 0 0 1-63.81 35.19c-3.85 1.72-5.57 3.54-4.5 8.32 3.72 16.7 5.81 33.69 7.18 50.74.98 12.13-5.62 19.4-16.86 19.03-7.5-.26-12.46-5.12-13.46-13.45-1.96-16.32-4.4-32.57-8.13-48.6-1.47-6.3-3.3-12.53-5.06-18.77-2.26-8.07-1.06-11.85 6.34-15.7 16.54-8.62 33.42-16.6 49.86-25.4 30.1-16.12 57.9-35.54 82.16-59.75.7-.7 1.35-1.45 2.77-2.96-27.7-8.92-51.01-23.56-68.42-47.54-7.28 8.82-14.75 16.57-23.04 23.47-24.27 20.2-42.7 44.74-54.84 73.93-1.78 4.26-4.99 6.94-9.18 8.66-16.72 6.85-34.2 10.93-51.92 14.07-23.34 4.12-46.87 6.03-70.55 5a334 334 0 0 1-102.72-20.7c-4.27-1.6-7.25-1.22-10.77 1.65-18.45 15.01-31.78 34-42.84 54.73-9.7 18.18-16.24 37.52-20.18 57.75a16.1 16.1 0 0 1-24.44 10.6c-5.9-3.75-6.66-9.96-5.58-15.98 5.91-33.21 17.98-63.97 37.36-91.74 7.26-10.4 15.03-20.36 24.03-29.34 1.25-1.25 2.9-2.27 3.55-4.63-6.18-3.67-12.51-7.25-18.67-11.11-78.23-49.05-129.16-117.9-150.38-208.1-6.86-29.16-8.54-58.7-6.65-88.7 2.97-47.38 14.76-92.16 36.76-134.16 20.55-39.24 48.97-72.04 83.37-99.78 28.1-22.65 58.84-40.8 92.68-53.42a353 353 0 0 1 74.27-18.85 386 386 0 0 1 53.67-3.93c43.82-.04 85.94 8.53 126.5 24.8 51.01 20.46 94.62 51.3 130.28 93.36 35.53 41.91 58.67 89.77 70.33 143.33 5.68 26.14 7.66 52.64 6.83 79.3-.28 9.1-.71 18.29-2.6 27.28-.57 2.78.22 4.8 2.7 6.34 3.03 1.89 5.71 4.49 6.72 7.83 1.32 4.39 4.39 5.2 8.16 5.88 17.08 3.08 26.9 12.81 29.71 29.24.86 5.04-.18 9.95-1.46 14.76-.82 3.04-.31 4.91 2.58 6.47 3.23 1.74 5.98 4.23 8.56 7.37M555.38 685.7a263 263 0 0 0 52.66-15.08c29.3-11.85 52.89-30.54 69.3-57.89a15 15 0 0 0 1.84-11.87c-2.37-10.02-4.5-20.1-6.91-30.12-4.61-19.18 1.5-36.4 18.9-45.4 3.99-2.07 7.78-4.53 12.13-5.78 3.35-.97 5.54-2.59 5.79-6.44.32-4.97 1.31-9.9 1.52-14.86 1.19-27.96-6.34-53.97-18.15-78.94-8-16.9-18.7-32.28-27.57-48.69-6.41-11.86-12.55-23.88-19.12-35.66-3.17-5.68-3.85-5.53-9.3-2.37-39 22.57-79.95 39.12-125.46 43.07a414 414 0 0 1-76.27-.63c-28.7-2.8-56.2-10.48-82.06-23.47-2.5-1.26-4.11-1.02-6.03 1.1-5.36 5.97-10.5 12.1-14.65 18.96-22.4 37.05-38.4 76.2-41 120.14-1.3 22.08-.99 43.93 4.9 65.3 14.44 52.45 47.73 88.6 97.07 110.5 29.33 13.03 60.03 20.1 92.07 22.34 23.42 1.65 46.47-.16 70.34-4.2m1.33-489.15a226 226 0 0 1 79.1 37.12c17.68 12.96 34.28 27.08 45.17 46.66.97 1.74 2.61 2.48 4.17 3.42 10.6 6.37 20.7 13.37 29.17 22.53 26.29 28.4 38.27 62.77 40.8 100.62 1.83 27.05-.56 53.86-9.77 79.7-.8 2.26-2 4.54-1.14 8.54 17.2-20.39 36.59-28.98 60.76-13.16 2.79-10.76 3.18-21.43 3.53-31.98.7-20.48-.65-40.9-4.77-61.03-18.7-91.25-69-159.4-150.91-203.52-54.49-29.34-113.05-40.02-174.71-34.27-30.5 2.85-60.17 8.92-88.71 20.1-60.64 23.74-109.72 61.87-144.06 117.65-34.8 56.52-47.24 118.35-42.2 184.15a259 259 0 0 0 23.92 91.13C256.15 626.1 301.75 672.57 362.12 704c47.79 24.86 99.13 34.81 153.03 31.9 25.43-1.37 50.02-6.49 74.39-13.52 7.44-2.15 9.18-7.62 11.56-13.59-3.16-.89-5.41.5-7.74 1.13-41.3 11.37-83.13 16.15-125.88 10.55-34.77-4.56-68.22-13.63-99.25-30.14-70.5-37.5-106.31-96.63-108.58-176.28-.12-4.5.35-9.06-.25-13.48-3.6-26.45-4.87-52.8-.96-79.45 5.44-37.06 17.72-70.92 42.81-99.34 2.45-2.76 1.85-4.2-.35-6.52-7.9-8.32-13.6-18.07-17.79-28.7-3.55-9.01-3.03-10.91 4.3-17.3a30 30 0 0 1 2.36-1.84c31.67-22.37 64.87-41.9 101.13-56.08 28.2-11.03 57.13-18.93 87.33-21.44 26.2-2.18 52.15 0 78.48 6.67m165.35 425.9q.66 1.07 1.27 2.15c13.67 24.72 35.8 36.56 62.8 39.83 17.97 2.18 33.77-5.04 47.65-15.83 18.88-14.68 32.02-34.15 43.4-54.9a13.6 13.6 0 0 0 1.54-6.73c-.01-3-.53-5.86-3.46-7.2-3.26-1.49-5.77.37-7.88 2.71-1.46 1.6-2.81 3.3-4.21 4.95-3.12 3.69-6.02 7.59-9.4 11.01-4.43 4.47-9.04 3.63-12.42-1.64-3.47-5.4-.82-9.8 1.93-14.3 7.79-12.77 12.6-26.78 16.9-40.98.42-1.41.51-2.94.6-4.43.22-3.53-1.05-6.32-4.59-7.41-3.61-1.12-6.68.1-8.6 3.32-1.7 2.85-3.1 5.89-4.5 8.91a275 275 0 0 1-13.93 26.53c-3.33 5.52-6.83 7.02-10.96 5.28-5.44-2.3-8.13-7.23-6.78-12.84.7-2.9 1.71-5.73 2.76-8.53 4.71-12.61 10.41-24.88 12.8-38.27.8-4.44-.86-7.54-4.96-9.12-3.93-1.52-7.22-.16-9.61 3.16-.96 1.32-1.46 2.98-2.22 4.46-6.6 12.7-11.32 26.36-19.4 38.28-3.44 5.07-5.84 5.36-11.49 2.77-4.68-2.15-5.23-5.53-3.61-9.86.46-1.25.78-2.55 1.23-3.8 3.32-9.24 6.68-18.47 9.97-27.72 1.18-3.3 1.57-6.6-1.58-9.12-3.21-2.57-6.78-2.43-10.36-.89-1.87.8-3.28 2.24-4.61 3.76a94 94 0 0 0-10.36 14.68c-7 11.98-12.1 24.84-17.72 37.47-3.04 6.83-5.74 7.24-10.76 1.49-3.18-3.65-6.43-7.22-10.24-10.23-4.88-3.87-11.18-4.32-16.3-1.24-4.86 2.92-6.48 7.61-5.1 14.4a209 209 0 0 0 22.2 59.88" /><path fill="#3c3c43" d="M362.4 849.6c2.87-17.54 7.28-34.2 14.14-50.12 2.72-6.33 8.94-10.03 15-9.6 8.2.6 13.4 8.3 11.17 17.69-2.9 12.26-6.49 24.36-9.66 36.55-1.88 7.23-3.02 14.6-4.12 22-1.13 7.68-4.38 10.46-12.04 11.46-9.98 1.3-16.46-4.27-16.13-14.24.14-4.45 1-8.88 1.64-13.75m116.1-283.1c18.76 4.03 36.74 2.06 54.52-3.26 3.66-1.1 7.3-2.36 11.15-2.54 12-.58 18.56 6.33 16.98 18.25a131 131 0 0 1-11.36 39.09c-10.67 22.53-29.37 31.05-53.03 29.13-21.31-1.73-36.9-12.6-44.68-33.09-4.64-12.22-7.5-24.89-5.63-38.04 1.57-10.92 9.13-15.56 20.13-12.91 3.88.93 7.68 2.18 11.92 3.37m40.71 59.27c1.3-1.04 2.68-1.98 3.87-3.13 4.85-4.64 4.78-5.87-.4-10.11-11.37-9.29-29.82-8.9-41.59.63-3.66 2.97-3.43 5.29-.37 8.47 9.88 10.28 24.89 12.16 38.5 4.14m90.77-167.13c20.22 6.5 31.14 21.82 31.43 42.74.16 12.27-2.23 23.59-10.85 32.68-10.5 11.09-23.53 15.47-38.53 11.91-14.98-3.56-24.72-12.92-28.85-27.99-3.3-12.03-3.36-23.93.82-35.75 7.03-19.9 24.7-28.37 45.97-23.59m-19.45 19.8c-1.44.33-2.97.48-4.31 1.04-4.5 1.86-8.17 7.24-7.74 11.8.5 5.32 3.19 9.33 8.31 11.38 4.53 1.82 9.14.6 12.9-3.66 2.82-3.2 4.72-6.84 3.32-11.31-1.78-5.73-5.96-8.5-12.48-9.26m-149.9 9.35c2.4 20.7-1.22 39.15-18.1 52.43-15.61 12.3-39.2 7.98-50.12-8.42-11.53-17.32-10.7-44.64 2.3-60.47 10.31-12.56 24.06-16.38 39.49-12.6 14.77 3.63 23.68 13.44 26.42 29.06m-36.04 11.26c3.73-4.95 4.11-10.02.43-15.17-3.02-4.23-8.1-6.22-12.64-5.01a12.2 12.2 0 0 0-9.09 10.68c-.61 5.84 1.6 10.13 6.73 12.75 5.35 2.73 9.97 1.22 14.57-3.25m234.17-67.12c-4.08-1.77-7.14-4.38-10.47-6.6-12.29-8.18-25.2-13.45-40.4-9.26-4.37 1.2-8.28-.26-10.69-4.46-2.45-4.26-1.94-9.08 1.65-12.91 6.1-6.5 14.27-8 22.47-7.61 18.38.89 32.74 10.1 44.82 23.38.78.86 1.45 1.83 2.06 2.82 2.07 3.4 4.77 6.79 1.98 10.99-2.66 3.98-6.6 4.71-11.42 3.65m-227.77-16.78c-14.81-.22-26.92 5.58-38 14-3.52 2.68-6.76 5.76-11.44 2.34-3.64-2.66-4.92-7.96-3.06-13.1 2.8-7.77 8.66-13 15.31-17.2 11.85-7.48 24.61-11.55 38.86-8.5 3.28.7 6.42 1.8 9.21 3.64 3.34 2.2 6.9 4.42 5.76 9.38-1.3 5.63-5.33 9.26-10.68 9.58-1.82.1-3.66-.08-5.96-.14" /></svg>;
}

function SWRIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="none" viewBox="0 0 291 69" {...props}><path fill="currentColor" d="M0 36.53c.07 17.6 14.4 32.01 32.01 32.01a32.05 32.05 0 0 0 32.01-32V32a13.2 13.2 0 0 1 23.4-8.31h20.7A32.1 32.1 0 0 0 77.2 0a32.05 32.05 0 0 0-32 32.01v4.52A13.2 13.2 0 0 1 32 49.71a13.2 13.2 0 0 1-13.18-13.18 3.77 3.77 0 0 0-3.77-3.77H3.76A3.77 3.77 0 0 0 0 36.53m122.49 32.01a32.14 32.14 0 0 1-30.89-23.7h20.67a13.16 13.16 0 0 0 23.4-8.3V32a32.05 32.05 0 0 1 32.01-32c17.43 0 31.64 14 32 31.33l.1 5.2a13.2 13.2 0 0 0 23.4 8.31h20.7a32.1 32.1 0 0 1-30.91 23.7c-17.61 0-31.94-14.42-32.01-32l-.1-4.7v-.2a13.2 13.2 0 0 0-13.18-12.81 13.2 13.2 0 0 0-13.18 13.18v4.52a32.05 32.05 0 0 1-32.01 32.01M247.94 23.7a13.16 13.16 0 0 1 23.4 8.31 3.77 3.77 0 0 0 3.77 3.77h11.3a3.77 3.77 0 0 0 3.76-3.77A32.05 32.05 0 0 0 258.16 0a32.1 32.1 0 0 0-30.92 23.7z" /></svg>
  );
}
