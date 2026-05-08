import * as stylex from '@stylexjs/stylex';

import { CodeBlock } from './code-block';

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
    maxWidth: '100%'
  },
  section: {
    marginBottom: 'clamp(52px, 7vw, 80px)',
    scrollMarginTop: 16
  },
  sectionNumber: {
    fontFamily: 'var(--font-jetbrains-mono), monospace',
    fontSize: 11,
    color: '#0e7490',
    letterSpacing: '0.06em',
    opacity: 0.7,
    marginBottom: 5
  },
  sectionTitle: {
    fontSize: 'clamp(18px, 2.3vw, 23px)',
    fontWeight: 600,
    letterSpacing: '-0.025em',
    marginBottom: 12,
    lineHeight: 1.25,
    scrollMarginTop: 16
  },
  subTitle: {
    fontSize: 15,
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
    color: '#786e63',
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
    color: '#786e63',
    lineHeight: 1.65,
    maxWidth: '100%',
    overflowWrap: 'anywhere'
  },
  calloutStrong: {
    color: '#0e7490'
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
    color: '#b3a99e',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e5e0d8'
  },
  tableCell: {
    paddingBlock: '9px',
    paddingInline: '10px',
    color: '#786e63',
    verticalAlign: 'top',
    lineHeight: 1.5,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#f7f4ef'
  }
});

function C({ children }: { children: React.ReactNode }) {
  return <code {...stylex.props(styles.inlineCode)}>{children}</code>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p {...stylex.props(styles.paragraph)}>{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 {...stylex.props(styles.subTitle)}>{children}</h3>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div {...stylex.props(styles.callout)}>{children}</div>;
}

function A(props: React.ComponentProps<'a'>) {
  return <a {...props} {...stylex.props(styles.link)} />;
}

function Sec({ id, num, title, children }: {
  id: string,
  num?: string,
  title: string,
  children?: React.ReactNode
}) {
  return (
    <section id={id} {...stylex.props(styles.section)}>
      {num && <div {...stylex.props(styles.sectionNumber)}>{num}</div>}
      <h2 {...stylex.props(styles.sectionTitle)}>{title}</h2>
      {children}
    </section>
  );
}

export function DocsContent() {
  return (
    <div {...stylex.props(styles.main)}>
      <Sec id="intro" num="00" title="Introduction">
        <P>
          <strong {...stylex.props(styles.strong)}>tayori</strong> (便り, <em>news from afar</em>) composites Ky, SWR, Zod, and Hey API
          into a minimal, type-safe React data-fetching layer. Call the factory once — typed to your
          Hey API SDK — and every hook downstream is fully aware of your API&apos;s type surface.
        </P>
        <Callout><strong {...stylex.props(styles.calloutStrong)}>Early stage:</strong> running in production internally; pre-1.0 APIs may change.</Callout>
      </Sec>

      <Sec id="getting-started" num="01" title="Getting Started">
        <P>A complete walkthrough from a fresh project to your first typed data fetch.</P>
      </Sec>

      <section id="gs-install" {...stylex.props(styles.section)}>
        <H3>Install packages</H3>
        <P>Requires React 18+ and TypeScript 5+.</P>
        <CodeBlock lang="bash">npm install tayori ky swr zod
          pnpm add -D @hey-api/openapi-ts @hey-api/client-ky</CodeBlock>
      </section>

      <section id="gs-heyapi" {...stylex.props(styles.section)}>
        <H3>Generate the SDK</H3>
        <P>Hey API reads your OpenAPI spec and generates a fully-typed SDK:</P>
        <CodeBlock lang="bash">npx @hey-api/openapi-ts</CodeBlock>
      </section>

      <section id="gs-setup" {...stylex.props(styles.section)}>
        <H3>Create the instance</H3>
        <P>Pass your SDK&apos;s type parameters to the factory once. Import from this module everywhere.</P>
      </section>

      <section id="gs-provider" {...stylex.props(styles.section)}>
        <H3>Add the provider</H3>
        <P>
          Wrap your root with <C>TayoriProvider</C>. <C>initClient</C> runs inside the React tree
          so auth tokens or context values can be injected.
        </P>
      </section>

      <section id="gs-hook" {...stylex.props(styles.section)}>
        <H3>Write your first hook</H3>
        <P>
          Wrap a generated SDK function with <C>useData</C>. Response types are inferred automatically.
        </P>
      </section>

      <Sec id="api" num="02" title="API Reference">
        <P>
          Five hooks and a provider, all bound to the type parameters from <C>tayori()</C>.
          Full SWR config passes through as the optional last argument on every hook.
        </P>
      </Sec>

      <section id="use-data" {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionTitle)}>useData()</h2>
        <P>Wraps <C>useSWR</C>. Executes on mount, revalidates on focus and reconnect by default.</P>
        <table {...stylex.props(styles.table)}>
          <thead>
            <tr>
              <th {...stylex.props(styles.tableHeadCell)}>Param</th>
              <th {...stylex.props(styles.tableHeadCell)}>Type</th>
              <th {...stylex.props(styles.tableHeadCell)}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td {...stylex.props(styles.tableCell)}><C>fn</C></td>
              <td {...stylex.props(styles.tableCell)}><C>SdkFunction</C></td>
              <td {...stylex.props(styles.tableCell)}>A generated SDK function.</td>
            </tr>
            <tr>
              <td {...stylex.props(styles.tableCell)}><C>options</C></td>
              <td {...stylex.props(styles.tableCell)}><C>{'Partial<Options> | null'}</C></td>
              <td {...stylex.props(styles.tableCell)}>Pass <C>null</C> to disable fetching.</td>
            </tr>
            <tr>
              <td {...stylex.props(styles.tableCell)}><C>swrConfig</C></td>
              <td {...stylex.props(styles.tableCell)}><C>SWRConfiguration</C></td>
              <td {...stylex.props(styles.tableCell)}>Any SWR option.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section id="use-data-imm" {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionTitle)}>useDataImmutable()</h2>
        <P>
          Like <C>useData</C> but wraps <C>useSWRImmutable</C> — data is fetched once on mount and
          never revalidated on focus, reconnect, or interval. Ideal for static configuration, feature
          flags, or reference data that doesn&apos;t change at runtime.
        </P>
      </section>

      <section id="use-mutation" {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionTitle)}>useMutation()</h2>
        <P>
          Wraps <C>useSWRMutation</C>. Does not run on mount — call <C>trigger</C> imperatively.
          Works for both write operations <em>and</em> on-demand fetches (lazy GET).
        </P>
        <H3>Write operations</H3>
        <H3>On-demand fetch</H3>
        <P>
          Pass a query SDK function to perform a lazy fetch that only fires when <C>trigger</C> is called —
          useful for search, report generation, or anything you don&apos;t want running on mount.
        </P>
      </section>

      <section id="use-infinite" {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionTitle)}>useInfinite()</h2>
        <P>
          Wraps <C>useSWRInfinite</C>. The key resolver returns options for each page, or <C>null</C>
          to stop. <C>data</C> is an array of page responses.
        </P>
      </section>

      <section id="provider" {...stylex.props(styles.section)}>
        <h2 {...stylex.props(styles.sectionTitle)}>TayoriProvider</h2>
        <P>
          Mounts the Hey API client into context. <C>initClient</C> is called inside the React tree,
          so auth state or other hooks are accessible within it.
        </P>
      </section>

      <Sec id="typescript" num="03" title="TypeScript">
        <P>
          tayori is built for strict mode. Options are typed to each SDK function&apos;s input;
          responses are inferred from its return type. No generics at call sites, no <C>any</C>.
        </P>
        <P>
          Enable <C>strict: true</C> — null-based conditional fetching only types correctly in strict mode.
        </P>
      </Sec>

      <Sec id="hey-api" num="04" title="Hey API">
        <P>
          tayori pairs with{' '}
          <A href="https://heyapi.dev" target="_blank" rel="noopener noreferrer">Hey API</A>{' '}
          and requires the Ky client adapter (<C>@hey-api/client-ky</C>). The generated{' '}
          <C>Options</C> / <C>RequestResult</C> types become the factory&apos;s generics; generated
          service functions become <C>fn</C> in each hook.
        </P>
        <Callout>
          <strong {...stylex.props(styles.calloutStrong)}>Zod integration</strong> for runtime response validation is opt-in per hook.
          Documentation forthcoming.
        </Callout>
      </Sec>

      <Sec id="ssr" num="05" title="Server-Side Rendering">
        <P>
          Pass server-fetched data as SWR <C>fallback</C> to hydrate without a client-side request on first render.
        </P>
        <Callout>
          The fallback key must match what tayori generates internally. See the{' '}
          <A
            href="https://github.com/SukkaW/tayori/tree/master/packages/example-nextjs-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            example-nextjs-app
          </A>{' '}
          for tested patterns.
        </Callout>
      </Sec>
    </div>
  );
}
