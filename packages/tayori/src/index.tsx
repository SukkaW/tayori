'use client';

import { useStableHandler } from 'foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired';
import { useStateWithDeps } from 'foxact/use-state-with-deps';
import { createContext, startTransition, use, useCallback, useRef, useTransition } from 'react';
import { stableHash } from 'stable-hash';

import type { SWRConfiguration, Key as SWRKey, Middleware as SWRMiddleware, SWRResponse } from 'swr';
import type { SWRInfiniteConfiguration, SWRInfiniteKeyLoader, SWRInfiniteResponse } from 'swr/infinite';

import useSWR, { mutate, SWRConfig, useSWRConfig } from 'swr';
import useSWRInfinite from 'swr/infinite';
import { nullthrow } from 'foxact/nullthrow';
import { useSingleton } from 'foxact/use-singleton';

import type { ZodError } from 'zod';
import type { Options as KyOptions } from 'ky';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this has to be any for TypeScript to proper infer type
type GeneralSdkMethod = (arg: any) => any;
type SdkReturn<SdkMethod extends GeneralSdkMethod> = Awaited<ReturnType<SdkMethod>>;
type SdkData<SdkMethod extends GeneralSdkMethod> =
  SdkReturn<SdkMethod> extends { data: infer D, request: Request, response: Response } ? NonNullable<D> : never;

type OriginalSdkArg<SdkMethod extends GeneralSdkMethod> = Omit<
  NonNullable<Parameters<SdkMethod>[0]>,
  'responseStyle' | 'throwOnError'
>;

export type TayoriSdkArg<SdkMethod extends GeneralSdkMethod> = OriginalSdkArg<SdkMethod> & {
  cacheTags?: Array<`#${string}`>
};

type InternalSWRKey<SdkArg = unknown> = [GeneralSdkMethod, SdkArg, cacheTags: Array<`#${string}`> | undefined];

// SWR doesn't export this type, so I just copy this from SWR impl
// This types ensures that if user indeed provides the "fallbackData"
// the "data" response will be non-nullable, vice versa, replicating
// SWR's types and runtime behavior regarding "fallbackData"
type SWRConfigurationWithOptionalFallback<SWROptions> = SWROptions extends SWRConfiguration
  & Required<Pick<SWRConfiguration, 'fallbackData'>>
  ? Omit<SWROptions, 'fallbackData'> & Pick<Partial<SWROptions>, 'fallbackData'>
  : SWROptions;
// Similar to above but for SWRInfiniteConfiguration
type SWRInfiniteConfigurationWithOptionalFallback<SWROptions> = SWROptions extends SWRInfiniteConfiguration
  & Required<Pick<SWRInfiniteConfiguration, 'fallbackData'>>
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

// tayori is just a dummy function, its only purpose is to accept and carry the generic type parameters
export function tayori<
  SDKOptions extends { client?: unknown, meta?: unknown, kyOptions?: unknown } = any,
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
  ): SWRResponse<SdkData<SdkMethod>, unknown, SWROptions> {
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
    return useSWR(swrKey, null, config!);
  }

  // ---------- useInfinite ----------
  function useInfinite<
    SdkMethod extends GeneralSdkMethod,
    SWROptions extends SWRInfiniteConfiguration<SdkData<SdkMethod>> = SWRInfiniteConfiguration<SdkData<SdkMethod>>
  >(
    sdkMethod: SdkMethod,
    getSdkArg: SWRInfiniteKeyLoader<
      SdkData<SdkMethod>,
      TayoriSdkArg<SdkMethod> | null | undefined | false
    >,
    config?: SWRInfiniteConfigurationWithOptionalFallback<SWROptions>
  ): SWRInfiniteResponse<SdkData<SdkMethod>, unknown> {
    const getKey = withKUseDataSwrKey(
      (pageIndex: number, previousPageData: SdkData<SdkMethod> | null): InternalSWRKey<OriginalSdkArg<SdkMethod>> | null => {
        const result = getSdkArg(pageIndex, previousPageData);
        if (!result) {
          return null;
        }
        const { cacheTags, ...restSdkArg } = result;
        const _restSdkArg = restSdkArg as SDKOptions;
        return [sdkMethod, _restSdkArg, cacheTags] satisfies InternalSWRKey<OriginalSdkArg<SdkMethod>>;
      }
    );

    return useSWRInfinite(getKey, null, config);
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
      error: unknown | undefined
    }>({
      data: undefined,
      error: undefined
    });

    // Our trigger may be called within startTransition or <form action /> prop
    //
    // In that case, if we store `isMutating` as a state (no matter useState or useStateWithDeps),
    // React will always schedule that `isMutating` update after the transition (by the time
    // submission already finished), which makes `isMutating` always false during the mutation.
    //
    // So we can't store `isMutating` in a state. Instead we use `useTransition` to track async
    // function state. `isPending` is always urgent.
    //
    // But startTransition returns void instead of the promise, where ourselves can't track the
    // state anymore.
    // So we hoist promise variable and await twice, one for startTransition and one for the actual
    // promise result
    const [isMutating, startMutating] = useTransition();

    const trigger = useCallback(
      async (sdkArg: OriginalSdkArg<SdkMethod>) => {
        const mutationStartedAt = Date.now();
        ditchMutationsUntilRef.current = mutationStartedAt;

        const serializedKey = stableHash([sdkMethod, sdkArg]);

        const promise = sdkMethod({
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

        // we await promise to ensure React can track the promise status
        startMutating(async () => {
          try {
            await promise;
          } catch {
            // ignore error in the transition
          }
        });

        try {
          // here we actually await and get the result
          const result: Awaited<SDKRequestResult> = await promise;

          if (ditchMutationsUntilRef.current <= mutationStartedAt) {
            startTransition(() => {
              setState({
                data: result.data as SdkData<SdkMethod>,
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
                error: e
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
        error: undefined
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
      isMutating
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
            kyOptions: {
              ...(sdkArg.kyOptions as KyOptions | undefined),
              throwHttpErrors: true
            } satisfies KyOptions,
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

      if (isZodError(swr.error)) {
        swr.error.cause ??= {
          key
        };
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

  return { useData, useInfinite, TayoriProvider, useMutation };
}

const kUseDataSwrKey = Symbol('tayori SWR key');

function withKUseDataSwrKey<T extends SWRKey>(key: T): T & { [kUseDataSwrKey]: true } {
  return Object.defineProperty(key, kUseDataSwrKey, {
    value: true,
    enumerable: false
  }) as T & { [kUseDataSwrKey]: true };
}

/**
 * This is an internal function for distinguishing SWR requests is either from useData
 * or other userland useSWR calls.
 *
 * If you also write your own SWR middleware, you can use this function to check if the SWR
 * request is from tayori or not.
 */
export function isInternalSWRKey(key: unknown): key is InternalSWRKey {
  return !!(key && (typeof key === 'function' || Array.isArray(key)) && kUseDataSwrKey in key && key[kUseDataSwrKey]);
}

/**
 * This is an internal function for distinguishing Zod errors that came from Hey API
 * client (by Hey API's request and response validation). This function uses duck typing.
 *
 * You can re-use this function as you wish, this might be useful when implementing your own
 * error handling logic.
 */
export function isZodError(e: unknown): e is ZodError {
  return e != null && typeof e === 'object' && 'issues' in e && Array.isArray(e.issues);
}

function mutateWithTags(cacheTags: Array<`#${string}`>) {
  return mutate((key) => {
    if (!isInternalSWRKey(key)) {
      return false;
    }
    const cacheTagsFromKey = key[2];
    if (!cacheTagsFromKey?.length) {
      return false;
    }
    return cacheTags.some((tag) => cacheTagsFromKey.includes(tag));
  });
}

export { mutateWithTags as unstable_mutateWithTags };
