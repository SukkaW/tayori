'use client';

import { Fragment, useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  layout: {
    maxWidth: '1040px',
    marginInline: 'auto',
    display: 'grid',
    gridTemplateColumns: {
      default: '214px 1fr',
      '@media (max-width: 880px)': '1fr'
    },
    paddingBlock: '0',
    paddingInline: {
      default: 'clamp(24px,5vw,72px)',
      '@media (max-width: 880px)': '20px'
    },
    width: '100%',
    minWidth: 0
  },
  layoutChild: {
    minWidth: 0
  },
  nav: {
    paddingTop: 'clamp(32px,4vw,48px)',
    paddingRight: '24px',
    paddingBottom: 'clamp(32px,4vw,48px)',
    paddingLeft: '0',
    position: 'sticky',
    top: 0,
    maxHeight: '100vh',
    overflowY: 'auto',
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: '#e5e0d8',
    display: {
      default: 'block',
      '@media (max-width: 880px)': 'none'
    }
  },
  heading: {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#b3a99e',
    marginBottom: 14
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e0d8',
    marginTop: '9px',
    marginRight: '0',
    marginBottom: '9px',
    marginLeft: '-12px',
    width: 'calc(100% + 12px)'
  },
  link: {
    display: 'block',
    paddingTop: '4px',
    paddingRight: '0',
    paddingBottom: '4px',
    paddingLeft: '12px',
    marginLeft: -12,
    fontSize: 12.5,
    color: {
      default: '#786e63',
      ':hover': '#1c1915'
    },
    textDecoration: 'none',
    transitionProperty: 'color, border-color',
    transitionDuration: '0.15s',
    borderLeftWidth: 2,
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
    lineHeight: 1.4
  },
  linkActive: {
    color: '#0e7490',
    fontWeight: 500,
    borderLeftColor: '#0e7490'
  },
  linkDepth2: {
    paddingLeft: 22,
    fontSize: 12,
    color: {
      default: '#b3a99e',
      ':hover': '#786e63'
    }
  },
  linkDepth2Active: {
    color: '#0e7490'
  },
  content: {
    minWidth: 0
  },
  fab: {
    display: {
      default: 'none',
      '@media (max-width: 880px)': 'flex'
    },
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 200,
    width: 46,
    height: 46,
    borderRadius: '50%',
    backgroundColor: {
      default: '#1c1915',
      ':hover': '#2e2a26'
    },
    color: '#fff',
    borderWidth: 0,
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.22)',
    transitionProperty: 'background-color, transform',
    transitionDuration: '0.2s',
    transform: {
      default: 'scale(1)',
      ':hover': 'scale(1.06)'
    }
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
    backgroundColor: 'rgba(28, 25, 21, 0.45)',
    backdropFilter: 'blur(4px)'
  },
  sheet: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 301,
    backgroundColor: '#ffffff',
    width: '100%',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    borderBottomRightRadius: '0',
    borderBottomLeftRadius: '0',
    paddingTop: '20px',
    paddingRight: '24px',
    paddingBottom: '40px',
    paddingLeft: '24px',
    maxHeight: '72vh',
    overflowY: 'auto'
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e0d8',
    marginTop: '0',
    marginRight: 'auto',
    marginBottom: '20px',
    marginLeft: 'auto'
  },
  sheetLinkSpacing: {
    paddingTop: 9,
    paddingBottom: 9
  }
});

const TOC_ITEMS = [
  { id: 'intro', label: 'Introduction', d: 1 },
  { id: 'getting-started', label: 'Getting Started', d: 1 },
  { id: 'gs-install', label: 'Installation', d: 2 },
  { id: 'gs-heyapi', label: 'Generate the SDK', d: 2 },
  { id: 'gs-setup', label: 'Create instance', d: 2 },
  { id: 'gs-provider', label: 'Add the provider', d: 2 },
  { id: 'gs-hook', label: 'First hook', d: 2 },
  { id: 'api', label: 'API Reference', d: 1 },
  { id: 'use-data', label: 'useData()', d: 2 },
  { id: 'use-data-imm', label: 'useDataImmutable()', d: 2 },
  { id: 'use-mutation', label: 'useMutation()', d: 2 },
  { id: 'use-infinite', label: 'useInfinite()', d: 2 },
  { id: 'provider', label: 'TayoriProvider', d: 2 },
  { id: 'typescript', label: 'TypeScript', d: 1 },
  { id: 'hey-api', label: 'Hey API', d: 1 },
  { id: 'ssr', label: 'Server-Side Rendering', d: 1 }
] as const;

export function DocsSectionInner({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState('intro');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const els = TOC_ITEMS.reduce<HTMLElement[]>((acc, t) => {
      const el = document.getElementById(t.id);
      if (el) acc.push(el);
      return acc;
    }, []);

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: '-8% 0px -82% 0px' }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <div {...stylex.props(styles.layout)}>
        <nav aria-label="Table of contents" {...stylex.props(styles.nav, styles.layoutChild)}>
          <div {...stylex.props(styles.heading)}>On this page</div>
          {TOC_ITEMS.map((t, i) => (
            <Fragment key={t.id}>
              {t.d === 1 && i > 0 && <div {...stylex.props(styles.separator)} />}
              <a
                href={`#${t.id}`}
                {...stylex.props(
                  styles.link,
                  t.d === 2 && styles.linkDepth2,
                  active === t.id && styles.linkActive,
                  t.d === 2 && active === t.id && styles.linkDepth2Active
                )}
              >
                {t.label}
              </a>
            </Fragment>
          ))}
        </nav>
        <div {...stylex.props(styles.content, styles.layoutChild)}>{children}</div>
      </div>

      <Drawer.Root open={mobileOpen} onOpenChange={setMobileOpen} direction="bottom">
        <Drawer.Trigger asChild>
          <button
            type="button"
            aria-label="Open table of contents"
            {...stylex.props(styles.fab)}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>
        </Drawer.Trigger>

        <Drawer.Portal>
          <Drawer.Overlay {...stylex.props(styles.overlay)} />
          <Drawer.Content {...stylex.props(styles.sheet)}>
            <div {...stylex.props(styles.sheetHandle)} />
            <Drawer.Title {...stylex.props(styles.heading)}>On this page</Drawer.Title>
            {TOC_ITEMS.map(t => (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={() => setMobileOpen(false)}
                {...stylex.props(
                  styles.link,
                  styles.sheetLinkSpacing,
                  t.d === 2 && styles.linkDepth2,
                  active === t.id && styles.linkActive,
                  t.d === 2 && active === t.id && styles.linkDepth2Active
                )}
              >
                {t.label}
              </a>
            ))}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
