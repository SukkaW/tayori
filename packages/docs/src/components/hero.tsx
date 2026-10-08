import { highlight } from '../lib/shiki';
import { Balancer } from 'react-wrap-balancer';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';

import { dedent as ts } from 'ts-dedent';

import { DOCS } from '../lib/docs';
import type { DocsSlug } from '../lib/docs';
import { REPO_URL } from '../lib/site';
import { BackendLink } from './backend-link';
import { ArrowRightIcon, ConnectIcon, GitHubIcon, HeyAPIIcon, SWRIcon } from './icons';

const styles = stylex.create({
  root: {
    paddingTop: 'clamp(32px,5vw,56px)',
    paddingRight: 'clamp(24px,5vw,72px)',
    paddingBottom: 'clamp(32px,5vw,56px)',
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
    maxWidth: '560px',
    lineHeight: 1.65,
    textAlign: 'center',
    marginTop: '0',
    marginRight: 'auto',
    marginBottom: 'clamp(20px,3vw,28px)',
    marginLeft: 'auto'
  },
  link: {
    color: '#0e7490',
    textDecoration: {
      default: 'none',
      ':hover': 'underline'
    }
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
    marginBottom: 24
  },
  pill: {
    fontSize: 12,
    color: '#6a7282',
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e0d8',
    backgroundColor: '#ffffff',
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
      '@media (max-width: 640px)': '1fr'
    },
    rowGap: 7,
    columnGap: 7
  },
  bentoCard: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
    textAlign: 'left',
    borderRadius: 8,
    // nord background, matches the shiki theme used for the snippets
    backgroundColor: '#2e3440',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gridColumn: {
      default: 'span 2',
      '@media (max-width: 640px)': 'span 1'
    }
  },
  bentoWide: {
    gridColumn: {
      default: 'span 3',
      '@media (max-width: 640px)': 'span 1'
    }
  },
  bentoLabel: {
    display: 'flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 7,
    flexShrink: 0,
    paddingTop: '10px',
    paddingBottom: '2px',
    paddingInline: '20px',
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(236, 239, 244, 0.5)',
    whiteSpace: 'nowrap'
  },
  bentoDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    backgroundColor: '#88c0d0'
  },
  bentoDotConnect: {
    backgroundColor: '#a3be8c'
  },
  bentoLabelHook: {
    color: 'rgba(236, 239, 244, 0.3)',
    textTransform: 'none',
    letterSpacing: '0.02em'
  },
  bentoCode: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0
  }
});

interface BentoCard {
  id: string,
  mode: DocsSlug,
  hook: string,
  wide: boolean,
  code: string
}

const BENTO: BentoCard[] = [
  {
    id: 'use-data',
    mode: 'hey-api',
    hook: 'useData',
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
    mode: 'hey-api',
    hook: 'useData · conditional',
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
    id: 'use-infinite',
    mode: 'hey-api',
    hook: 'useInfinite',
    wide: false,
    code: ts`
      const { data, setSize } = useInfinite(
        getAllPlanets,
        (i, prev) => (i > 0 && !prev?.cursor
          ? null // reached the end
          : { query: { cursor: prev?.cursor } })
      );
    `.trim()
  },
  {
    id: 'connect-use-data',
    mode: 'connect',
    hook: 'useData',
    wide: true,
    code: ts`
      const { data, error, isLoading } = useData(
        ElizaService.method.say,
        { message: { sentence: 'Hello from tayori' } }
      );

      // data is typed as SayResponse | undefined
    `.trim()
  },
  {
    id: 'connect-use-mutation',
    mode: 'connect',
    hook: 'useMutation',
    wide: true,
    code: ts`
      const { trigger, isMutating } = useMutation(
        PlanetService.method.createPlanet
      );

      await trigger({
        message: { name: 'Mars' },
        headers: { 'x-request-id': requestId }
      });
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
  { icon: <HeyAPIIcon height={20} />, label: 'Hey API' },
  { icon: <ConnectIcon height={12} />, label: 'ConnectRPC' }
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
            An opinionated React client-side data fetching stack built on top of
            {' '}
            <a href="https://swr.vercel.app" target="_blank" rel="noopener noreferrer" {...stylex.props(styles.link)}>SWR</a>,
            {' '}for{' '}
            <a href="https://heyapi.dev" target="_blank" rel="noopener noreferrer" {...stylex.props(styles.link)}>Hey API</a>
            {' '}and{' '}
            <a href="https://connectrpc.com" target="_blank" rel="noopener noreferrer" {...stylex.props(styles.link)}>ConnectRPC</a>
            {' '}backends.
          </Balancer>
        </p>

        {/* ── Actions ─────────────────────────────────────────── */}
        <div {...stylex.props(styles.actions)}>
          <BackendLink slug="hey-api" {...stylex.props(styles.button, styles.primaryButton)}>
            Hey API docs
            <ArrowRightIcon />
          </BackendLink>

          <BackendLink slug="connect" {...stylex.props(styles.button, styles.primaryButton)}>
            ConnectRPC docs
            <ArrowRightIcon />
          </BackendLink>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.button)}
          >
            <GitHubIcon />
            {' '}
            View on GitHub
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
            >
              <div {...stylex.props(styles.bentoLabel)}>
                <span aria-hidden {...stylex.props(styles.bentoDot, c.mode === 'connect' && styles.bentoDotConnect)} />
                {DOCS[c.mode].label}
                <span {...stylex.props(styles.bentoLabelHook)}>{c.hook}</span>
              </div>
              <div
                {...stylex.props(styles.bentoCode)}
                // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- Shiki returns trusted highlighted HTML for static docs snippets.
                dangerouslySetInnerHTML={{ __html: highlighted[i] }}
              />
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
