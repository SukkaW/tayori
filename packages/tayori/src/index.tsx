'use client';

import { noSSR } from 'foxact/no-ssr';
import { useStableHandler } from 'foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired';
import { useStateWithDeps } from 'foxact/use-state-with-deps';
import { createContext, startTransition, use, useCallback, useRef } from 'react';
import { stableHash } from 'stable-hash';

import type { SWRConfiguration, Key as SWRKey, Middleware as SWRMiddleware, SWRResponse } from 'swr';

import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { nullthrow } from 'foxact/nullthrow';
import { useSingleton } from 'foxact/use-singleton';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this has to be any for TypeScript to proper infer type
type GeneralSdkMethod = (arg: any) => any;
type SdkReturn<SdkMethod extends GeneralSdkMethod> = Awaited<ReturnType<SdkMethod>>;
type SdkData<SdkMethod extends GeneralSdkMethod> =
  SdkReturn<SdkMethod> extends { data: infer D, request: Request, response: Response } ? NonNullable<D> : never;

type OriginalSdkArg<SdkMethod extends GeneralSdkMethod> = Omit<
  Parameters<SdkMethod>[0],
  'responseStyle' | 'throwOnError'
>;

export type TayoriSdkArg<SdkMethod extends GeneralSdkMethod> = OriginalSdkArg<SdkMethod> & {
  cacheTags?: Array<`#${string}`>
};

type InternalSWRKey<SdkArg> = [GeneralSdkMethod, SdkArg, cacheTags: Array<`#${string}`> | undefined];

// SWR doesn't export this type, so I just copy this from SWR impl
type SWRConfigurationWithOptionalFallback<SWROptions> = SWROptions extends SWRConfiguration
  & Required<Pick<SWRConfiguration, 'fallbackData'>>
  ? Omit<SWROptions, 'fallbackData'> & Pick<Partial<SWROptions>, 'fallbackData'>
  : SWROptions;

interface HeyAPIClientLike {
  buildUrl: any,
  getConfig: any,
  request: any,
  setConfig: any
};

export interface TayoriProviderProps extends React.PropsWithChildren {
  /**
     * @example
     *
     * ```
     * initClient: () => createClient({
     *   throwOnError: true,
     *   credentials: 'include',
     *   kyOptions: {}
     * })
     * ```
     */
  initClient: () => HeyAPIClientLike
}

export function tayori<
  SDKOptions extends { client?: unknown, meta?: unknown },
  SDKRequestResult extends Promise<any> = Promise<{
    data: unknown,
    request: Request,
    response: Response
  }>
>() {
  // ---------- useData ----------
  function useData<
    SdkMethod extends GeneralSdkMethod,
    SWROptions extends SWRConfiguration<SdkData<SdkMethod>> = SWRConfiguration<SdkData<SdkMethod>>
  >(
    sdkMethod: SdkMethod,
    sdkArg:
      | TayoriSdkArg<SdkMethod>
      | null
      | undefined
      | 0
      | false
      | (() => TayoriSdkArg<SdkMethod> | null | undefined | 0 | false),
    config?: SWRConfigurationWithOptionalFallback<SWROptions>
  ) {
    // Use foxact/no-ssr force opt-out any server-side rendering, opt-into client-side rendering
    // TODO-SUKKA: a way to add warning about using Suspense boundary?
    noSSR();

    let swrKey: InternalSWRKey<OriginalSdkArg<SdkMethod>> | (() => InternalSWRKey<OriginalSdkArg<SdkMethod>> | null) | null = null;
    if (sdkArg) {
      if (typeof sdkArg === 'function') {
        swrKey = withKUseDataSwrKey((): InternalSWRKey<SDKOptions> | null => {
          const result = sdkArg();
          if (!result) {
            return null;
          }
          const { cacheTags, ...restSdkArg } = result;
          const _restSdkArg = restSdkArg as any;
          return [sdkMethod, _restSdkArg, cacheTags] satisfies InternalSWRKey<OriginalSdkArg<SdkMethod>>;
        });
      } else {
        const { cacheTags, ...restSdkArg } = sdkArg;
        const _restSdkArg = restSdkArg as any;
        swrKey = withKUseDataSwrKey([sdkMethod, _restSdkArg, cacheTags] satisfies InternalSWRKey<OriginalSdkArg<SdkMethod>>);
      }
    }

    // This non-null assertion is only to make the types happy.
    // In the runtime useSWR accepts config as undefined as usual
    return useSWR(swrKey, null, config!) as SWRResponse<SdkData<SdkMethod>, unknown, SWROptions>;
  }

  // ---------- useMutation ----------
  /**
   * It should be noted that "useMutation" WILL NOT flush other useSWR/useData hooks' cache.
   * You WILL HAVE TO call mutate() manually if you want to flush the cache after mutation.
   */
  function useMutation<SdkMethod extends GeneralSdkMethod>(sdkMethod: SdkMethod) {
    const swrConfig = useSWRConfig();
    const { onError, onSuccess } = swrConfig;

    const handleError = useStableHandler(onError);
    const handleSuccess = useStableHandler(onSuccess);

    const client = useSdkClient();

    // Ditch all mutation results that happened earlier than this timestamp.
    // So if trigger is called multiple times in a short time, only the latest one will be applied.
    const ditchMutationsUntilRef = useRef(0);

    const [stateRef, stateDependenciesRef, setState] = useStateWithDeps<{
      data: SdkData<SdkMethod> | undefined,
      error: unknown | undefined,
      isMutating: boolean
    }>({
      isMutating: false,
      data: undefined,
      error: undefined
    });

    const trigger = useCallback(
      async (sdkArg: OriginalSdkArg<SdkMethod>) => {
        const mutationStartedAt = Date.now();
        ditchMutationsUntilRef.current = mutationStartedAt;

        setState({
          isMutating: true
        });

        const serializedKey = stableHash([sdkMethod, sdkArg]);

        try {
          // return await here is required to make sure error can be catched and finally will be called
          const result: Awaited<SDKRequestResult> = await sdkMethod({
            client,
            ...sdkArg,
            // allows to be catched by SWR
            throwOnError: true,
            // https://github.com/hey-api/openapi-ts/issues/2319
            //
            // TLDR: currently Hey API's responseStyle setting is only runtime and
            // not reflected in typescript types, so we just force it to 'fields' here
            // to make sure the typescript types align with the runtime behavior
            responseStyle: 'fields'
          });

          if (ditchMutationsUntilRef.current <= mutationStartedAt) {
            startTransition(() => {
              setState({
                data: result.data as SdkData<SdkMethod>,
                isMutating: false,
                error: undefined
              });
            });

            handleSuccess(result.data, serializedKey, swrConfig);
          }

          return result.data as SdkData<SdkMethod>;
        } catch (e) {
          // If it's reset after the mutation, we don't broadcast any state change
          // or throw because it's discarded.
          if (ditchMutationsUntilRef.current <= mutationStartedAt) {
            startTransition(() => {
              setState({
                error: e,
                isMutating: false
              });
            });

            // we are trying to re-use SWR's onError type, but we don't really have a key here
            // so let's generate one with stable-hash
            handleError(e, serializedKey, swrConfig);
          }

          throw e;
        }
      },
      [client, handleError, handleSuccess, sdkMethod, setState, swrConfig]
    );

    const reset = useCallback(() => {
      ditchMutationsUntilRef.current = Date.now();
      setState({
        data: undefined,
        error: undefined,
        isMutating: false
      });
    }, [setState]);

    return {
      trigger,
      reset,
      get data() {
        stateDependenciesRef.current.data = true;
        return stateRef.current.data;
      },
      get error() {
        stateDependenciesRef.current.error = true;
        return stateRef.current.error;
      },
      get isMutating() {
        stateDependenciesRef.current.isMutating = true;
        return stateRef.current.isMutating;
      }
    } as const;
  }

  // ---------- SWR Middleware and SWRConfig Provider ----------
  const fetchMiddleware: SWRMiddleware =
    (useSWRNext) => (key: SWRKey, customFetcher, config): SWRResponse => {
      if (!isInternalSWRKey(key)) {
        // Not from useData, fallback to default SWR behavior
        return useSWRNext(key, customFetcher, config);
      }

      const sdkClient = useSdkClient();

      const defaultFetcher = useCallback(
        async (key: InternalSWRKey<SDKOptions>) => {
          const [sdkMethod, sdkArg] = key;
          const result: Awaited<SDKRequestResult> = await sdkMethod({
            // default method options
            client: sdkClient,
            ...sdkArg,
            // TODO: we might wanna use throwOnError: false once Hey API actually respects the option
            // see https://github.com/hey-api/openapi-ts/pull/3814
            throwOnError: true,
            // https://github.com/hey-api/openapi-ts/issues/2319
            //
            // TLDR: currently Hey API's responseStyle setting is only runtime and
            // not reflected in typescript types, so we just force it to 'fields' here
            // to make sure the typescript types align with the runtime behavior
            responseStyle: 'fields'
          });

          // Though we force responseStyle to 'fields' above to ensure the typescript types align with runtime behavior,
          // We only really need the "data", so we only return it.
          //
          // We could return more fields in the future if needed, like response, request, etc.
          return result.data;
        },
        [sdkClient]
      );

      const swr = useSWRNext(key, customFetcher ?? defaultFetcher, config);

      // This needs to be synced with SWRConfig's onError logic
      /* if (isHTTP401Error(swr.error)) {
      needLogin(swr.error.message, 401);
    } else if (isNeedLoginError(swr.error)) {
      // needLogin invoked by sdk client directly (maybe missing auth token?) should be thrown directly
      // zod error should be thrown directly as well.
      //
      // They will be catched by the React Error Boundary

      throw swr.error;
    } else */
      if (isZodError(swr.error)) {
        swr.error.cause ??= key;
      } else {
        // We might be able to add extra information here once we use throwOnError: false
      }

      return swr;
    };

  // ---------- SDK Client Context and Provider ----------
  const SdkClientContext = createContext<HeyAPIClientLike | null>(null);

  function useSdkClient() {
    return nullthrow(use(SdkClientContext), '[tayori] useSdkClient must be used within a <SdkClientProvider />');
  }

  function TayoriProvider({ children, initClient }: TayoriProviderProps) {
    return (
      <SdkClientContext value={useSingleton(() => initClient()).current}>
        <SWRConfig
          value={{
            use: [fetchMiddleware],
            keepPreviousData: true
          }}
        >
          {children}
        </SWRConfig>
      </SdkClientContext>
    );
  }

  return { useData, TayoriProvider, useMutation };
}

const kUseDataSwrKey = Symbol('tayori SWR key');

function withKUseDataSwrKey<T extends SWRKey>(key: T): T & { [kUseDataSwrKey]: true } {
  return Object.defineProperty(key, kUseDataSwrKey, {
    value: true,
    enumerable: false
  }) as T & { [kUseDataSwrKey]: true };
}

function isInternalSWRKey(key: unknown): key is InternalSWRKey<any> {
  return !!(key && (typeof key === 'function' || Array.isArray(key)) && kUseDataSwrKey in key && key[kUseDataSwrKey]);
}

function isZodError(e: unknown): e is Error {
  return e != null && typeof e === 'object' && 'issues' in e && Array.isArray(e.issues);
}
