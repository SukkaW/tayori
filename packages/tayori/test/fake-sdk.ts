import type { HeyAPIClientLike } from '../src/backend';

/**
 * The request options a Hey API generated SDK function accepts (the subset tayori cares about).
 * `throwOnError` / `responseStyle` are what tayori forces, `kyOptions` is only used by `@hey-api/client-ky`.
 */
export interface FakeSdkOptions {
  client?: HeyAPIClientLike,
  query?: Record<string, unknown>,
  path?: Record<string, unknown>,
  body?: unknown,
  kyOptions?: Record<string, unknown> & { throwHttpErrors?: boolean },
  throwOnError?: boolean,
  responseStyle?: 'data' | 'fields'
}

/** What a Hey API SDK function resolves to with `responseStyle: 'fields'` and `throwOnError: true` */
export interface FakeSdkResult<Data> {
  data: Data,
  request: Request,
  response: Response
}

export type FakeSdkMethod<Data> = (options: FakeSdkOptions) => Promise<FakeSdkResult<Data>>;

export interface FakeSdk<Data> {
  /** The "generated" SDK function to hand to tayori hooks */
  sdk: FakeSdkMethod<Data>,
  /** The exact options object every call received, in order */
  calls: FakeSdkOptions[]
}

/**
 * A typed stand-in for a Hey API generated SDK function. `respond` produces `data` (return a rejected
 * promise / throw to simulate errors), every call is recorded in `calls`.
 */
export function createFakeSdk<Data>(respond: (options: FakeSdkOptions) => Data | Promise<Data>): FakeSdk<Data> {
  const calls: FakeSdkOptions[] = [];
  const sdk: FakeSdkMethod<Data> = async (options) => {
    calls.push(options);
    return {
      data: await respond(options),
      request: new Request('https://x'),
      response: new Response()
    };
  };
  return { sdk, calls };
}

/** A structural Hey API client. tayori never calls it, it only hands it to the SDK function. */
export function createFakeClient(): HeyAPIClientLike {
  return {
    buildUrl: () => 'https://x',
    getConfig: () => ({}),
    request: () => Promise.resolve({}),
    setConfig: () => ({})
  };
}
