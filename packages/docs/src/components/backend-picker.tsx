import * as stylex from '@stylexjs/stylex';

import { DOCS } from '../lib/docs';
import type { DocsSlug } from '../lib/docs';
import { ArrowRightIcon, ConnectIcon, HeyAPIIcon } from './icons';

const styles = stylex.create({
  root: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#e5e0d8'
  },
  inner: {
    maxWidth: '1280px',
    marginInline: 'auto',
    paddingBlock: 'clamp(40px,6vw,64px)',
    paddingInline: 'clamp(24px,5vw,72px)'
  },
  heading: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: '-0.025em',
    lineHeight: 1.25,
    margin: 0,
    color: '#1c1915'
  },
  sub: {
    textAlign: 'center',
    marginTop: 10,
    marginRight: 'auto',
    marginBottom: 'clamp(24px, 3vw, 32px)',
    marginLeft: 'auto',
    maxWidth: '560px',
    fontSize: 14.5,
    lineHeight: 1.65,
    color: '#6a7282'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: {
      default: '1fr 1fr',
      '@media (max-width: 640px)': '1fr'
    },
    rowGap: 14,
    columnGap: 14,
    maxWidth: '960px',
    marginInline: 'auto'
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: 10,
    columnGap: 0,
    paddingBlock: '22px',
    paddingInline: '24px',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: '#e5e0d8',
      ':hover': '#0e7490'
    },
    backgroundColor: '#ffffff',
    color: '#1c1915',
    textDecoration: 'none',
    boxShadow: {
      default: 'none',
      ':hover': '0 8px 24px rgba(28, 25, 21, 0.06)'
    },
    transitionProperty: 'border-color, box-shadow',
    transitionDuration: '0.15s'
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 10
  },
  cardIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e0d8',
    color: '#0e7490',
    flexShrink: 0
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: '-0.015em',
    lineHeight: 1.2,
    margin: 0
  },
  cardPackage: {
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: 11.5,
    color: '#6a7282',
    marginTop: 3
  },
  cardText: {
    fontSize: 14,
    lineHeight: 1.65,
    color: '#6a7282',
    margin: 0
  },
  cardFit: {
    fontSize: 13,
    lineHeight: 1.6,
    color: '#6a7282',
    margin: 0,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#f1f5f9'
  },
  cardFitLabel: {
    color: '#1c1915',
    fontWeight: 600
  },
  cardCta: {
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 6,
    marginTop: 'auto',
    fontSize: 13,
    fontWeight: 500,
    color: '#0e7490'
  }
});

interface PickerCard {
  slug: DocsSlug,
  icon: React.ReactNode,
  fit: string
}

const CARDS: PickerCard[] = [
  {
    slug: 'hey-api',
    icon: <HeyAPIIcon height={22} />,
    fit: 'Your API is described with OpenAPI and you generate a typed SDK with @hey-api/openapi-ts.'
  },
  {
    slug: 'connect',
    icon: <ConnectIcon height={18} />,
    fit: 'Your API is described with Protocol Buffers and served over Connect or gRPC-web (@connectrpc/connect v2).'
  }
];

export function BackendPicker() {
  return (
    <section id="choose-your-backend" {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.inner)}>
        <h2 {...stylex.props(styles.heading)}>Choose your backend</h2>
        <p {...stylex.props(styles.sub)}>
          Same hooks, same SWR semantics, one core. Pick the adapter that matches how your API is described.
        </p>

        <div {...stylex.props(styles.grid)}>
          {CARDS.map(({ slug, icon, fit }) => {
            const page = DOCS[slug];
            return (
              <a key={slug} href={page.path} {...stylex.props(styles.card)}>
                <div {...stylex.props(styles.cardHead)}>
                  <span {...stylex.props(styles.cardIcon)}>{icon}</span>
                  <div>
                    <h3 {...stylex.props(styles.cardTitle)}>{page.title}</h3>
                    <div {...stylex.props(styles.cardPackage)}>{page.packageName}</div>
                  </div>
                </div>
                <p {...stylex.props(styles.cardText)}>{page.description}</p>
                <p {...stylex.props(styles.cardFit)}>
                  <span {...stylex.props(styles.cardFitLabel)}>Pick this if </span>
                  {fit}
                </p>
                <span {...stylex.props(styles.cardCta)}>
                  Read the {page.label} docs
                  <ArrowRightIcon />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
