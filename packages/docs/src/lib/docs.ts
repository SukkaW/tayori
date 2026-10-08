/**
 * The registry of documentation backends. Plain data only (no markdown imports), so that light
 * consumers do not pull the whole markdown pipeline in.
 */
export type DocsSlug = 'hey-api' | 'connect';

export interface DocsPage {
  slug: DocsSlug,
  /** Short name of the mode, used in navigation */
  label: string,
  /** The npm package of this mode */
  packageName: string,
  /** When to read this documentation, for llms-full.txt */
  llmsWhen: string
}

export const DOCS_SLUGS = ['hey-api', 'connect'] as const satisfies readonly DocsSlug[];

export const DOCS: Record<DocsSlug, DocsPage> = {
  'hey-api': {
    slug: 'hey-api',
    label: 'Hey API',
    packageName: 'tayori',
    llmsWhen: 'the project calls an HTTP API through the SDK that Hey API (`@hey-api/openapi-ts`) generates from an OpenAPI specification'
  },
  connect: {
    slug: 'connect',
    label: 'ConnectRPC',
    packageName: 'tayori-connect',
    llmsWhen: 'the project calls ConnectRPC services (`@connectrpc/connect` v2) with the service descriptors that `@bufbuild/protobuf` v2 generates from Protobuf schemas'
  }
};
