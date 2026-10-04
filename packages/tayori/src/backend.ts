import type { CacheTag, TayoriBackend, TayoriTypes, TypeFn } from 'tayori-core';

/* eslint-disable @typescript-eslint/no-explicit-any -- Hey API's generated types are generic over throwOnError / responseStyle, `any` is what lets TypeScript infer from them */

export type GeneralSdkMethod = (arg: any) => any;

/**
 * Structural stand-in for Hey API's `Client` (`@hey-api/client-fetch`, `@hey-api/client-ky`, ...).
 * tayori never calls these itself, it only hands the client to the generated SDK functions.
 */
export interface HeyAPIClientLike {
  buildUrl: any,
  getConfig: any,
  request: any,
  setConfig: any
}

/** The `Options` type of a generated SDK, as far as tayori relies on it */
export type GeneralSdkOptions = { client?: unknown };
/** What a generated SDK function returns, as far as tayori relies on it: the `RequestResult` type of the generated client */
export type GeneralSdkRequestResult = Promise<any>;
export type DefaultSdkRequestResult = Promise<{
  data: unknown,
  request: Request,
  response: Response
}>;

export const HEY_API_BACKEND_NAME = 'tayori';

// ---------- per-method types, inferred from the SDK function a hook receives ----------
// Deliberately unconstrained (`SdkMethod` instead of `SdkMethod extends GeneralSdkMethod`): the hooks
// already constrain the method, and an unconstrained alias keeps its name in the hooks' signatures
// (`SdkData<M>` rather than an inlined conditional type) when TypeScript prints them.
type SdkReturn<SdkMethod> = SdkMethod extends (...args: any) => infer R ? Awaited<R> : never;
export type SdkData<SdkMethod> =
  SdkReturn<SdkMethod> extends { data: infer D, request?: Request, response?: Response } ? NonNullable<D> : never;

type OriginalSdkArg<SdkMethod> = SdkMethod extends (...args: infer P) => any
  ? Omit<NonNullable<P[0]>, 'responseStyle' | 'throwOnError'>
  : never;

export type TayoriSdkArg<SdkMethod> = OriginalSdkArg<SdkMethod> & {
  cacheTags?: CacheTag[]
};

/* eslint-enable @typescript-eslint/no-explicit-any */

/** `SdkMethod` → `TayoriSdkArg<SdkMethod>` */
export interface TayoriSdkArgOf extends TypeFn {
  readonly output: TayoriSdkArg<this['input']>
}
/** `SdkMethod` → `SdkData<SdkMethod>` */
export interface SdkDataOf extends TypeFn {
  readonly output: SdkData<this['input']>
}

// ---------- runtime types, provided by the user: `tayori<Options, RequestResult>()` ----------
/**
 * The runtime shape of a Hey API SDK argument as tayori sees it: the generated request options
 * (`SDKOptions`), plus tayori's own `cacheTags`.
 */
export type HeyApiSdkArg<SDKOptions extends GeneralSdkOptions = any> = SDKOptions & { cacheTags?: CacheTag[] };

/**
 * What a Hey API SDK function resolves to. Hey API's `RequestResult` is a conditional type over
 * `throwOnError` / `responseStyle` (and differs between client plugins and versions), so this cannot
 * be inferred from a method: it is the `RequestResult` type the user passes to `tayori<Options, RequestResult>()`.
 */
export type HeyApiSdkResult<SDKRequestResult extends GeneralSdkRequestResult = DefaultSdkRequestResult> = Awaited<SDKRequestResult>;
export type HeyApiSdkData<SDKRequestResult extends GeneralSdkRequestResult = DefaultSdkRequestResult> =
  HeyApiSdkResult<SDKRequestResult> extends { data: infer D } ? D : never;

export interface HeyApiTypes<
  SDKOptions extends GeneralSdkOptions = any,
  SDKRequestResult extends GeneralSdkRequestResult = DefaultSdkRequestResult
> extends TayoriTypes {
  readonly Method: GeneralSdkMethod,
  readonly Arg: HeyApiSdkArg<SDKOptions>,
  readonly Data: HeyApiSdkData<SDKRequestResult>,
  readonly ArgOf: TayoriSdkArgOf,
  readonly MutationArgOf: TayoriSdkArgOf,
  readonly DataOf: SdkDataOf
}

export type HeyApiBackend<
  SDKOptions extends GeneralSdkOptions = any,
  SDKRequestResult extends GeneralSdkRequestResult = DefaultSdkRequestResult
> = TayoriBackend<HeyApiTypes<SDKOptions, SDKRequestResult>, HeyAPIClientLike>;

/**
 * `SDKOptions` and `SDKRequestResult` are the `Options` / `RequestResult` types of the user's generated
 * SDK and client (see `tayori()`): they type what tayori spreads into every SDK call and what it reads
 * the response `data` from.
 */
export function createHeyApiBackend<
  SDKOptions extends GeneralSdkOptions = any,
  SDKRequestResult extends GeneralSdkRequestResult = DefaultSdkRequestResult
>(): HeyApiBackend<SDKOptions, SDKRequestResult> {
  async function callSdk(
    client: HeyAPIClientLike,
    sdkMethod: GeneralSdkMethod,
    sdkArg: HeyApiSdkArg<SDKOptions>
  ): Promise<HeyApiSdkData<SDKRequestResult>> {
    // Strip cacheTags before forwarding to the SDK, it is tayori's
    const { cacheTags: _unusedCacheTags, ...restSdkArg } = sdkArg;

    const options = {
      // default method options
      client,
      ...restSdkArg,
      // allows errors to be catched by SWR / useMutation
      // TODO: we might wanna use throwOnError: false once Hey API actually respects the option
      // see https://github.com/hey-api/openapi-ts/pull/3814
      throwOnError: true,
      // https://github.com/hey-api/openapi-ts/issues/2319
      //
      // TLDR: currently Hey API's responseStyle setting is only runtime and
      // not reflected in typescript types, so we just force it to 'fields' here
      // to make sure the typescript types align with the runtime behavior
      responseStyle: 'fields'
    };

    // When using @hey-api/client-ky, ensure HTTPError is thrown.
    // Copy instead of mutating in place: `options.kyOptions` is still the caller's object (and part of
    // the SWR key), so writing into it would change the key's hash after the first request.
    if (
      'kyOptions' in options
      && options.kyOptions
      && typeof options.kyOptions === 'object'
    ) {
      options.kyOptions = { ...options.kyOptions, throwHttpErrors: true };
    }

    const result: HeyApiSdkResult<SDKRequestResult> = await sdkMethod(options);

    // Though we force responseStyle to 'fields' above to ensure the typescript types align with runtime behavior,
    // We only really need the "data", so we only return it.
    //
    // We could return more fields in the future if needed, like response, request, etc.
    return result.data;
  }

  return {
    name: HEY_API_BACKEND_NAME,
    // The SDK function itself identifies the request. SWR hashes functions by identity.
    methodKey: (sdkMethod) => sdkMethod,
    // Strip cacheTags before forwarding to the SDK, but keep them in the key
    argKey(_sdkMethod, sdkArg) {
      const { cacheTags, ...restSdkArg } = sdkArg;
      return [restSdkArg, cacheTags];
    },
    call: callSdk
  };
}
