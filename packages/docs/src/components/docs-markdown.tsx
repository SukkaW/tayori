import * as stylex from '@stylexjs/stylex';

import { CodeBlock } from './code-block';
import type { FoxmdRendererOptions } from 'foxmd';

const styles = stylex.create({
  main: {
    paddingTop: 'clamp(32px,4vw,48px)',
    paddingRight: '0',
    paddingBottom: 'clamp(64px,8vw,96px)',
    paddingLeft: {
      default: 'clamp(28px,4vw,52px)',
      '@media (max-width: 880px)': 0
    },
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    counterReset: 'section -1'
  },
  h2: {
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: '-0.025em',
    marginTop: {
      default: '36px',
      ':first-of-type': '0'
    },
    marginRight: '0',
    marginBottom: '12px',
    marginLeft: '0',
    lineHeight: 1.25,
    scrollMarginTop: 16,
    counterIncrement: 'section',
    '::before': {
      content: 'counter(section, decimal-leading-zero)',
      display: 'block',
      fontFamily: 'var(--font-jetbrains-mono), monospace',
      fontSize: 12,
      fontWeight: 400,
      letterSpacing: '0.06em',
      color: '#0e7490',
      // opacity: 0.7,
      marginBottom: 5
    }
  },
  h3: {
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    marginTop: '22px',
    marginRight: '0',
    marginBottom: '9px',
    marginLeft: '0',
    color: '#1c1915',
    scrollMarginTop: 16
  },
  paragraph: {
    fontSize: 14.5,
    lineHeight: 1.78,
    color: '#6a7282',
    marginBottom: 12,
    overflowWrap: 'anywhere'
  },
  strong: {
    color: '#1c1915',
    fontWeight: 600
  },
  link: {
    color: '#0e7490',
    textDecoration: {
      default: 'none',
      ':hover': 'underline'
    }
  },
  inlineCode: {
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: 12,
    backgroundColor: '#f7f4ef',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e5e0d8',
    borderRadius: 4,
    paddingBlock: '1px',
    paddingInline: '5px',
    color: '#0e7490'
  },
  callout: {
    backgroundColor: 'rgba(14, 116, 144, 0.08)',
    borderLeftWidth: 2,
    borderLeftStyle: 'solid',
    borderLeftColor: '#0e7490',
    borderTopLeftRadius: '0',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
    borderBottomLeftRadius: '0',
    paddingBlock: '12px',
    paddingInline: '16px',
    marginBlock: '14px',
    marginInline: '0',
    fontSize: 13.5,
    color: '#6a7282',
    lineHeight: 1.65,
    maxWidth: '100%',
    overflowWrap: 'anywhere'
  },
  list: {
    marginTop: '8px',
    marginRight: '0',
    marginBottom: '14px',
    marginLeft: '20px',
    fontSize: 14.5,
    color: '#6a7282',
    lineHeight: 1.72
  },
  listItem: {
    marginBottom: 4
  },
  table: {
    width: '100%',
    maxWidth: '100%',
    borderCollapse: 'collapse',
    marginTop: '12px',
    marginRight: '0',
    marginBottom: '18px',
    marginLeft: '0',
    fontSize: 13,
    display: 'block',
    overflowX: 'auto'
  },
  tableHeadCell: {
    textAlign: 'left',
    paddingBlock: '7px',
    paddingInline: '10px',
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#6a7282',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e5e0d8'
  },
  tableCell: {
    paddingBlock: '9px',
    paddingInline: '10px',
    color: '#6a7282',
    verticalAlign: 'top',
    lineHeight: 1.5,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#f7f4ef'
  }
});

function filterLinkHref(href: string) {
  return href.startsWith('javascript:') ? '#' : href;
}

export function DocsMarkdownRoot({ children }: { children: React.ReactNode }) {
  return <div {...stylex.props(styles.main)}>{children}</div>;
}

export const docsMarkdownRendererOptions: FoxmdRendererOptions = {
  suppressHydrationWarning: false,
  customRenderMethods: {
    code(reactKey: string, code: string, lang?: string) {
      return <CodeBlock key={reactKey} lang={lang || 'text'}>{code}</CodeBlock>;
    },
    codespan(reactKey: string, text: React.ReactNode) {
      return <code key={reactKey} {...stylex.props(styles.inlineCode)}>{text}</code>;
    },
    link(reactKey: string, href: string, text: React.ReactNode, title?: string) {
      return (
        <a
          key={reactKey}
          href={filterLinkHref(href)}
          title={title}
          {...stylex.props(styles.link)}
        >
          {text}
        </a>
      );
    },
    paragraph(reactKey: string, children: React.ReactNode) {
      return <p key={reactKey} {...stylex.props(styles.paragraph)}>{children}</p>;
    },
    strong(reactKey: string, children: React.ReactNode) {
      return <strong key={reactKey} {...stylex.props(styles.strong)}>{children}</strong>;
    },
    blockquote(reactKey: string, children: React.ReactNode) {
      return <blockquote key={reactKey} {...stylex.props(styles.callout)}>{children}</blockquote>;
    },
    table(reactKey: string, children: React.ReactNode) {
      return <table key={reactKey} {...stylex.props(styles.table)}>{children}</table>;
    }
  },
  customReactComponentsForHtmlTags: {
    h2: (props: React.ComponentProps<'h2'>) => <h2 {...props} {...stylex.props(styles.h2)} />,
    h3: (props: React.ComponentProps<'h3'>) => <h3 {...props} {...stylex.props(styles.h3)} />,
    ul: (props: React.ComponentProps<'ul'>) => <ul {...props} {...stylex.props(styles.list)} />,
    ol: (props: React.ComponentProps<'ol'>) => <ol {...props} {...stylex.props(styles.list)} />,
    li: (props: React.ComponentProps<'li'>) => <li {...props} {...stylex.props(styles.listItem)} />,
    th: (props: React.ComponentProps<'th'>) => <th {...props} {...stylex.props(styles.tableHeadCell)} />,
    td: (props: React.ComponentProps<'td'>) => <td {...props} {...stylex.props(styles.tableCell)} />
  },
  UNSAFE_allowHtml: true
};
