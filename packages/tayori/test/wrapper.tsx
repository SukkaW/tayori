import type { SWRConfiguration } from 'swr';
import { SWRConfig } from 'swr';

import type { TayoriProviderProps } from '../src';
import type { HeyAPIClientLike } from '../src/backend';

interface CreateWrapperOptions {
  TayoriProvider: (props: TayoriProviderProps) => React.ReactNode,
  initClient: () => HeyAPIClientLike,
  /** Extra SWR config merged inside the tayori provider (an isolated cache + no dedupe by default) */
  swr?: SWRConfiguration
}

/**
 * Wrap a hook / component in `<TayoriProvider />` plus an isolated SWR cache, so tests never
 * share cache entries or dedupe each other's requests.
 */
export function createWrapper({ TayoriProvider, initClient, swr }: CreateWrapperOptions) {
  const swrConfig: SWRConfiguration = {
    provider: () => new Map(),
    dedupingInterval: 0,
    ...swr
  };
  return function Wrapper({ children }: React.PropsWithChildren) {
    return (
      <TayoriProvider initClient={initClient}>
        <SWRConfig value={swrConfig}>
          {children}
        </SWRConfig>
      </TayoriProvider>
    );
  };
}
