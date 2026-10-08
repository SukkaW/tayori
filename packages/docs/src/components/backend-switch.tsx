'use client';

import { useId } from 'react';
import * as stylex from '@stylexjs/stylex';
import { stylexPropsWithClassName } from 'stylex-webpack/utils';

import { switchBackend, useBackend } from '../lib/backend-state';
import { DOCS, DOCS_SLUGS } from '../lib/docs';
import type { DocsSlug } from '../lib/docs';
import { ConnectIcon, HeyAPIIcon } from './icons';

const styles = stylex.create({
  card: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e0d8',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16
  },
  tabList: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#f1f5f9',
    // the line under the tabs, which the underline of the active tab covers
    boxShadow: 'inset 0 -1px 0 #e5e0d8',
    overflowX: 'auto',
    overflowY: 'hidden'
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 8,
    fontFamily: 'inherit',
    fontSize: 13.5,
    fontWeight: 500,
    lineHeight: 1,
    paddingBlock: '14px',
    paddingInline: '20px',
    borderWidth: 0,
    borderBottomWidth: 3,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    // the hover color stays above the line under the tabs
    backgroundClip: 'padding-box',
    cursor: 'pointer',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'rgba(255, 255, 255, 0.6)'
    },
    color: {
      default: '#6a7282',
      ':hover': '#1c1915'
    },
    transitionProperty: 'color, background-color, border-color',
    transitionDuration: '0.15s'
  },
  tabActive: {
    color: {
      default: '#0e7490',
      ':hover': '#0e7490'
    },
    backgroundColor: {
      default: '#ffffff',
      ':hover': '#ffffff'
    },
    borderBottomColor: '#0e7490'
  },
  notice: {
    display: 'flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 8,
    fontSize: 13,
    lineHeight: 1.4,
    color: '#6a7282',
    backgroundColor: '#f1f5f9',
    boxShadow: 'inset 0 -1px 0 #e5e0d8',
    paddingBlock: '12px',
    paddingInline: '20px'
  },
  icon: {
    flexShrink: 0,
    opacity: 0.85
  },
  panel: {
    paddingTop: 'clamp(16px, 3vw, 20px)',
    paddingBottom: 'clamp(16px, 3vw, 20px)',
    paddingLeft: 'clamp(16px, 3vw, 20px)',
    paddingRight: 'clamp(16px, 3vw, 20px)'
  },
  pillStick: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    // only the pill takes clicks, the docs stay reachable around it
    pointerEvents: 'none'
  },
  pillBody: {
    pointerEvents: 'auto'
  },
  pillTrack: {
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 2,
    paddingBlock: '3px',
    paddingInline: '3px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e0d8',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 6px 24px rgba(28, 25, 21, 0.1)'
  },
  pillSegment: {
    display: 'inline-flex',
    alignItems: 'center',
    rowGap: 0,
    columnGap: 7,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1,
    paddingBlock: '8px',
    paddingInline: '14px',
    borderRadius: 999,
    borderWidth: 0,
    cursor: 'pointer',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'rgba(14, 116, 144, 0.06)'
    },
    color: {
      default: '#6a7282',
      ':hover': '#1c1915'
    },
    transitionProperty: 'color, background-color',
    transitionDuration: '0.15s'
  },
  pillSegmentActive: {
    color: {
      default: '#0e7490',
      ':hover': '#0e7490'
    },
    backgroundColor: {
      default: 'rgba(14, 116, 144, 0.1)',
      ':hover': 'rgba(14, 116, 144, 0.14)'
    }
  }
});

const ICONS: Record<DocsSlug, React.ReactNode> = {
  'hey-api': <HeyAPIIcon height={15} {...stylex.props(styles.icon)} />,
  connect: <ConnectIcon height={13} {...stylex.props(styles.icon)} />
};

/** The padding of a card, none when the card holds nothing but code */
function getPanelProps(codeOnly: boolean) {
  return codeOnly
    ? stylexPropsWithClassName(stylex.props(), 'backend-tab-code')
    : stylexPropsWithClassName(stylex.props(styles.panel), 'backend-tab-panel');
}

/** A card that shows what differs between the backends, with a tab per backend that has something to show */
export function BackendTabs({ variants, codeOnly }: { variants: Partial<Record<DocsSlug, React.ReactNode>>, codeOnly: boolean }) {
  const backend = useBackend();
  const id = useId();

  const available = DOCS_SLUGS.filter(slug => variants[slug] !== undefined);
  const selected = available.includes(backend) ? backend : available[0];

  return (
    <div {...stylex.props(styles.card)}>
      <div role="tablist" aria-label="Backend" {...stylex.props(styles.tabList)}>
        {available.map(slug => (
          <button
            key={slug}
            type="button"
            role="tab"
            id={`${id}-${slug}-tab`}
            aria-selected={slug === selected}
            aria-controls={`${id}-${slug}-panel`}
            onClick={(event) => switchBackend(slug, event.currentTarget)}
            {...stylex.props(styles.tab, slug === selected && styles.tabActive)}
          >
            {ICONS[slug]}
            {DOCS[slug].label}
          </button>
        ))}
      </div>
      {available.map(slug => (
        <div
          key={slug}
          role="tabpanel"
          id={`${id}-${slug}-panel`}
          aria-labelledby={`${id}-${slug}-tab`}
          hidden={slug !== selected}
          {...getPanelProps(codeOnly)}
        >
          {variants[slug]}
        </div>
      ))}
    </div>
  );
}

/** Content that only applies to one backend, which is only shown while that backend is selected */
export function BackendOnly({ slug, codeOnly, children }: React.PropsWithChildren<{ slug: DocsSlug, codeOnly: boolean }>) {
  const backend = useBackend();

  return (
    <div hidden={slug !== backend} {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.notice)}>
        {ICONS[slug]}
        This section only applies to the {DOCS[slug].label} backend.
      </div>
      <div {...getPanelProps(codeOnly)}>
        {children}
      </div>
    </div>
  );
}

/** The same choice as a pill that sticks to the top of the viewport while the documentation scrolls */
export function BackendPill() {
  const backend = useBackend();

  return (
    <div {...stylex.props(styles.pillStick)}>
      <div {...stylex.props(styles.pillBody)}>
        <div role="group" aria-label="Backend" {...stylex.props(styles.pillTrack)}>
          {DOCS_SLUGS.map(slug => (
            <button
              key={slug}
              type="button"
              aria-pressed={slug === backend}
              onClick={() => switchBackend(slug)}
              {...stylex.props(styles.pillSegment, slug === backend && styles.pillSegmentActive)}
            >
              {ICONS[slug]}
              {DOCS[slug].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
