import { describe, it } from 'mocha';
import { expect } from 'earl';

import { heyApiBackend } from './backend';
import type { HeyAPIClientLike } from './backend';

const client: HeyAPIClientLike = { buildUrl: undefined, getConfig: undefined, request: undefined, setConfig: undefined };

function createSdk() {
  const received: Array<Record<string, unknown>> = [];
  const sdk = (options: Record<string, unknown>) => {
    received.push(options);
    return Promise.resolve({ data: 'ok', request: new Request('https://example.com'), response: new Response() });
  };
  return { sdk, received };
}

describe('heyApiBackend', () => {
  it('forces throwOnError, responseStyle and kyOptions.throwHttpErrors without mutating the caller\'s options', async () => {
    const kyOptions = { retry: 0 };
    const sdkArg = { query: { id: 1 }, kyOptions };
    const { sdk, received } = createSdk();

    expect(await heyApiBackend.call(client, sdk, sdkArg)).toEqual('ok');
    expect(received.length).toEqual(1);
    expect(received[0].kyOptions).toEqual({ retry: 0, throwHttpErrors: true });
    expect(received[0].throwOnError).toEqual(true);
    expect(received[0].responseStyle).toEqual('fields');
    expect(received[0].client).toEqual(client);
    // the objects that are part of the SWR key are untouched
    expect(kyOptions).toEqual({ retry: 0 });
    expect(sdkArg).toEqual({ query: { id: 1 }, kyOptions: { retry: 0 } });
  });

  it('strips cacheTags before calling the SDK and keeps them for the key', async () => {
    const { sdk, received } = createSdk();

    await heyApiBackend.call(client, sdk, { body: { a: 1 }, cacheTags: ['#t'] });
    expect('cacheTags' in received[0]).toEqual(false);
    expect(received[0].body).toEqual({ a: 1 });

    expect(heyApiBackend.argKey(sdk, { body: { a: 1 }, cacheTags: ['#t'] })).toEqual([{ body: { a: 1 } }, ['#t']]);
  });
});
