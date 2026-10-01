import type { CacheTag, TayoriBackend } from 'tayori-core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this has to be any for TypeScript to proper infer type
export type GeneralSdkMethod = (arg: any) => any;

/**
 * Structural stand-in for Hey API's `Client` (`@hey-api/client-fetch`, `@hey-api/client-ky`, ...).
 * tayori never calls these itself, it only hands the client to the generated SDK functions.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- structural stand-in, tayori never calls these */
export interface HeyAPIClientLike {
  buildUrl: any,
  getConfig: any,
  request: any,
  setConfig: any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The runtime shape of a Hey API SDK argument as tayori sees it: the generated request options,
 * plus tayori's own `cacheTags`.
 */
export type HeyApiSdkArg = Record<string, unknown> & { cacheTags?: CacheTag[] };

async function callSdk(
  client: HeyAPIClientLike,
  sdkMethod: GeneralSdkMethod,
  sdkArg: Record<string, unknown>
): Promise<unknown> {
  const options = {
    // default method options
    client,
    ...sdkArg,
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

  const result: { data: unknown } = await sdkMethod(options);

  // Though we force responseStyle to 'fields' above to ensure the typescript types align with runtime behavior,
  // We only really need the "data", so we only return it.
  //
  // We could return more fields in the future if needed, like response, request, etc.
  return result.data;
}

export const heyApiBackend: TayoriBackend<GeneralSdkMethod, HeyApiSdkArg, unknown, HeyAPIClientLike> = {
  name: 'tayori',
  // The SDK function itself identifies the request. SWR hashes functions by identity.
  methodKey: (sdkMethod) => sdkMethod,
  // Strip cacheTags before forwarding to the SDK, but keep them in the key
  argKey(_sdkMethod, sdkArg) {
    const { cacheTags, ...restSdkArg } = sdkArg;
    return [restSdkArg, cacheTags];
  },
  call(client, sdkMethod, sdkArg) {
    const { cacheTags: _unusedCacheTags, ...restSdkArg } = sdkArg;
    return callSdk(client, sdkMethod, restSdkArg);
  }
};
