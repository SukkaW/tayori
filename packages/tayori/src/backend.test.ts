import { describe, it } from 'mocha';
import { expect } from 'earl';

import { heyApiBackend } from './backend';
import type { HeyAPIClientLike } from './backend';

const client: HeyAPIClientLike = { buildUrl: undefined, getConfig: undefined, request: undefined, setConfig: undefined };

describe('heyApiBackend', () => {
  it('forces kyOptions.throwHttpErrors on the fetch path without mutating the caller\'s options', async () => {
    const kyOptions = { retry: 0 };
    const argKey = { query: { id: 1 }, kyOptions };
    let received: Record<string, unknown> | undefined;
    const sdk = (options: Record<string, unknown>) => {
      received = options;
      return Promise.resolve({ data: 'ok', request: new Request('https://example.com'), response: new Response() });
    };

    expect(await heyApiBackend.fetch(client, sdk, argKey, undefined)).toEqual('ok');
    expect(received?.kyOptions).toEqual({ retry: 0, throwHttpErrors: true });
    expect(received?.throwOnError).toEqual(true);
    expect(received?.responseStyle).toEqual('fields');
    // the objects that are part of the SWR key are untouched
    expect(kyOptions).toEqual({ retry: 0 });
    expect(argKey).toEqual({ query: { id: 1 }, kyOptions: { retry: 0 } });
  });

  it('leaves kyOptions alone on the mutation path and strips cacheTags', async () => {
    let received: Record<string, unknown> | undefined;
    const sdk = (options: Record<string, unknown>) => {
      received = options;
      return Promise.resolve({ data: 'ok', request: new Request('https://example.com'), response: new Response() });
    };

    await heyApiBackend.call(client, sdk, { body: { a: 1 }, kyOptions: { retry: 0 }, cacheTags: ['#t'] }, undefined);
    expect(received?.kyOptions).toEqual({ retry: 0 });
    expect('cacheTags' in received!).toEqual(false);
  });
});
