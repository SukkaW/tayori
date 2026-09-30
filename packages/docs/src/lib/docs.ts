/**
 * The registry of documentation pages. Plain data only (no markdown imports), so that light
 * consumers like the sitemap and the site header do not pull the whole markdown pipeline in.
 */
export type DocsSlug = 'hey-api' | 'connect';

export interface DocsPage {
  slug: DocsSlug,
  path: `/${DocsSlug}`,
  /** Short name of the mode, used in navigation */
  label: string,
  /** Human readable page title, e.g. "Hey API mode" */
  title: string,
  /** The npm package that implements this mode */
  packageName: string,
  /** One-liner shown as the lead of the page */
  description: string,
  /** Heading of this document inside llms-full.txt */
  llmsHeading: string
}

export const DOCS_SLUGS = ['hey-api', 'connect'] as const satisfies readonly DocsSlug[];

export const DOCS: Record<DocsSlug, DocsPage> = {
  'hey-api': {
    slug: 'hey-api',
    path: '/hey-api',
    label: 'Hey API',
    title: 'Hey API mode',
    packageName: 'tayori',
    description: 'SWR-powered React data fetching hooks for the SDK that Hey API generates from your OpenAPI specification.',
    llmsHeading: 'tayori — Hey API mode'
  },
  connect: {
    slug: 'connect',
    path: '/connect',
    label: 'ConnectRPC',
    title: 'ConnectRPC mode',
    packageName: 'tayori-connect',
    description: 'SWR-powered React data fetching hooks for ConnectRPC services, driven by the service descriptors that protobuf-es generates from your Protobuf schema.',
    llmsHeading: 'tayori-connect — ConnectRPC mode'
  }
};
