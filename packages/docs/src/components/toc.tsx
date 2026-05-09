'use client';

import { Fragment, useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import * as stylex from '@stylexjs/stylex';
import type { ToCTree } from 'foxmd';

const styles = stylex.create({
  layout: {
    maxWidth: '1280px',
    marginInline: 'auto',
    display: 'grid',
    gridTemplateColumns: {
      default: '300px 1fr',
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
    color: '#6a7282',
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
      default: '#6a7282',
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
      default: '#6a7282',
      ':hover': '#6a7282'
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

const TOC_KEYS = new Set(['id', 'index', 'text']);

interface ToCItemProps {
  toc: ToCTree,
  active: string,
  isChild?: boolean,
  isSheet?: boolean,
  onLinkClick?: () => void
}

function ToCItem({ toc, active, isChild, isSheet, onLinkClick }: ToCItemProps) {
  const childKeys = useMemo(
    () => Object.keys(toc).reduce<string[]>((acc, key) => {
      if (!TOC_KEYS.has(key) && typeof toc[key] === 'object') acc.push(key);
      return acc;
    }, []).sort((a, b) => Number(a) - Number(b)),
    [toc]
  );

  return (
    <>
      <a
        href={`#${toc.id}`}
        onClick={onLinkClick}
        {...stylex.props(
          styles.link,
          isSheet && styles.sheetLinkSpacing,
          isChild && styles.linkDepth2,
          active === toc.id && styles.linkActive,
          isChild && active === toc.id && styles.linkDepth2Active
        )}
      >
        {toc.text}
      </a>
      {childKeys.map(key => (
        <ToCItem
          key={(toc[key]).id}
          toc={toc[key]}
          active={active}
          isChild
          isSheet={isSheet}
          onLinkClick={onLinkClick}
        />
      ))}
    </>
  );
}

interface DocsSectionInnerProps {
  children: React.ReactNode,
  toc: ToCTree,
  tocIds: string[]
}

export function DocsSectionInner({ children, toc, tocIds }: DocsSectionInnerProps) {
  const tocItems = Object.keys(toc)
    .map(key => toc[key]);

  const [active, setActive] = useState(tocIds[0] ?? '');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Normally it would be not ideal to create IntersectionObserver for each component
    // but since we are an "SPA" anyway and tocIds will never change in production
    const els = tocIds.reduce<HTMLElement[]>((acc, id) => {
      const el = document.getElementById(id);
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
  }, [tocIds]);

  return (
    <>
      <div {...stylex.props(styles.layout)}>
        <nav aria-label="Table of contents" {...stylex.props(styles.nav, styles.layoutChild)}>
          <div {...stylex.props(styles.heading)}>On this page</div>
          {tocItems.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <div {...stylex.props(styles.separator)} />}
              <ToCItem toc={t} active={active} />
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
            {tocItems.map(t => (
              <ToCItem
                key={t.id}
                toc={t}
                active={active}
                isSheet
                onLinkClick={() => setMobileOpen(false)}
              />
            ))}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
