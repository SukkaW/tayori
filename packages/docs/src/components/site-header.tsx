import * as stylex from '@stylexjs/stylex';

import { DOCS, DOCS_SLUGS } from '../lib/docs';
import type { DocsSlug } from '../lib/docs';
import { REPO_URL } from '../lib/site';
import { ConnectIcon, GitHubIcon, HeyAPIIcon } from './icons';

const styles = stylex.create({
  root: {
    backgroundColor: '#f1f5f9'
  },
  inner: {
    maxWidth: '1280px',
    marginInline: 'auto',
    paddingBlock: '14px',
    paddingInline: 'clamp(24px,5vw,72px)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 16
  },
  wordmark: {
    display: 'inline-flex',
    alignItems: 'baseline',
    rowGap: 0,
    columnGap: 8,
    marginRight: 'auto',
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: '-0.04em',
    lineHeight: 1,
    color: '#1c1915',
    textDecoration: 'none'
  },
  wordmarkTagline: {
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: '0.01em',
    color: '#90a1b9'
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 6,
    columnGap: 6
  },
  navLabel: {
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#90a1b9',
    marginRight: 4
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 7,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1,
    textDecoration: 'none',
    paddingBlock: '7px',
    paddingInline: '12px',
    borderRadius: 7,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: {
      default: 'transparent',
      ':hover': '#e5e0d8'
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': '#ffffff'
    },
    color: {
      default: '#6a7282',
      ':hover': '#1c1915'
    },
    transitionProperty: 'color, background-color, border-color',
    transitionDuration: '0.15s'
  },
  linkActive: {
    color: {
      default: '#0e7490',
      ':hover': '#0e7490'
    },
    backgroundColor: {
      default: 'rgba(14, 116, 144, 0.08)',
      ':hover': 'rgba(14, 116, 144, 0.12)'
    },
    borderColor: {
      default: 'rgba(14, 116, 144, 0.25)',
      ':hover': 'rgba(14, 116, 144, 0.35)'
    }
  },
  linkIcon: {
    flexShrink: 0,
    opacity: 0.85
  },
  githubLink: {
    marginLeft: 6
  }
});

const MODE_ICONS: Record<DocsSlug, React.ReactNode> = {
  'hey-api': <HeyAPIIcon height={15} {...stylex.props(styles.linkIcon)} />,
  connect: <ConnectIcon height={13} {...stylex.props(styles.linkIcon)} />
};

export function SiteHeader({ current }: { current?: DocsSlug }) {
  return (
    <header {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.inner)}>
        <a href="/" {...stylex.props(styles.wordmark)}>
          <span>tayori</span>
          <span {...stylex.props(styles.wordmarkTagline)}>便り</span>
        </a>

        <nav aria-label="Documentation" {...stylex.props(styles.nav)}>
          <span {...stylex.props(styles.navLabel)}>Docs</span>
          {DOCS_SLUGS.map(slug => {
            const isActive = slug === current;
            return (
              <a
                key={slug}
                href={DOCS[slug].path}
                aria-current={isActive ? 'page' : undefined}
                {...stylex.props(styles.link, isActive && styles.linkActive)}
              >
                {MODE_ICONS[slug]}
                {DOCS[slug].label}
              </a>
            );
          })}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.link, styles.githubLink)}
          >
            <GitHubIcon />
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
