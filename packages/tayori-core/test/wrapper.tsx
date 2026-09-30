import type { SWRConfiguration } from 'swr';
import { SWRConfig } from 'swr';

import type { TayoriProviderProps } from '../src/types';

interface CreateWrapperOptions<Client> {
  Provider: (props: TayoriProviderProps<Client>) => React.ReactNode,
  initClient: () => Client,
  /** Extra SWR config merged inside the tayori provider (an isolated cache + no dedupe by default) */
  swr?: SWRConfiguration
}

/**
 * Wrap a hook / component in `<TayoriProvider />` plus an isolated SWR cache, so tests never
 * share cache entries or dedupe each other's requests.
 */
export function createWrapper<Client>({ Provider, initClient, swr }: CreateWrapperOptions<Client>) {
  const swrConfig: SWRConfiguration = {
    provider: () => new Map(),
    dedupingInterval: 0,
    ...swr
  };
  return function Wrapper({ children }: React.PropsWithChildren) {
    return (
      <Provider initClient={initClient}>
        <SWRConfig value={swrConfig}>
          {children}
        </SWRConfig>
      </Provider>
    );
  };
}
