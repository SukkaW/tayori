import type { Transport } from '@connectrpc/connect';
import type { SWRConfiguration } from 'swr';
import { SWRConfig } from 'swr';

import type { TayoriConnectProviderProps } from '../src';

interface CreateWrapperOptions {
  TayoriProvider: (props: TayoriConnectProviderProps) => React.ReactNode,
  initTransport: () => Transport,
  /**
   * Extra SWR config merged inside the tayori provider (an isolated cache + no dedupe by default).
   * Pass `{ provider: undefined }` to use SWR's default global cache instead of an isolated one.
   */
  swr?: SWRConfiguration
}

/**
 * Wrap a hook / component in `<TayoriProvider />` plus an isolated SWR cache, so tests never
 * share cache entries or dedupe each other's requests.
 */
export function createWrapper({ TayoriProvider, initTransport, swr }: CreateWrapperOptions) {
  const swrConfig: SWRConfiguration = {
    provider: () => new Map(),
    dedupingInterval: 0,
    ...swr
  };
  return function Wrapper({ children }: React.PropsWithChildren) {
    return (
      <TayoriProvider initTransport={initTransport}>
        <SWRConfig value={swrConfig}>
          {children}
        </SWRConfig>
      </TayoriProvider>
    );
  };
}
