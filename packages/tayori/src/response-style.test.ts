import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, renderHook, waitFor } from '@testing-library/react';

import { tayori } from '.';
import { createWrapper } from '../test/wrapper';

// The same API generated twice by Hey API: once with `responseStyle: 'fields'` (SDK functions resolve
// to `{ data, request, response }`) and once with `responseStyle: 'data'` (SDK functions resolve to
// the response body itself). See `openapi-ts.config.ts`.
import * as fieldsSdk from '../test/gen/fields';
import * as fieldsClient from '../test/gen/fields/client';
import * as dataSdk from '../test/gen/data';
import * as dataClient from '../test/gen/data/client';

// The API types are identical in both fixtures, only the SDK functions differ
type Planet = fieldsSdk.Planet;
type PlanetPage = fieldsSdk.PlanetPage;

const MARS: Planet = { id: 1, name: 'Mars' };
const PAGE: PlanetPage = { data: [MARS], meta: { total: 1 } };

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** A `fetch` serving the fixture API: `GET /planets`, `POST /planets`, `GET /planets/{id}` (404 unless id is 1) */
function createFakeFetch() {
  const requests: string[] = [];
  async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : new Request(input, init);
    const { pathname } = new URL(request.url);
    requests.push(`${request.method} ${pathname}`);

    if (pathname === '/planets' && request.method === 'GET') return json(PAGE);
    if (pathname === '/planets' && request.method === 'POST') {
      const { name } = await request.json() as { name: string };
      return json({ id: 2, name }, 201);
    }
    if (pathname === '/planets/1') return json(MARS);
    return json({ message: 'Not found' }, 404);
  }
  return { fetch: fakeFetch, requests };
}

const configurations = [
  {
    responseStyle: 'fields',
    sdk: fieldsSdk,
    createClient: (fetch: typeof globalThis.fetch) => fieldsClient.createClient({ baseUrl: 'https://api.test', fetch, throwOnError: true })
  },
  {
    responseStyle: 'data',
    sdk: dataSdk,
    createClient: (fetch: typeof globalThis.fetch) => dataClient.createClient({ baseUrl: 'https://api.test', fetch, throwOnError: true })
  }
] as const;

for (let i = 0, len = configurations.length; i < len; i++) {
  const { responseStyle, sdk, createClient } = configurations[i];

  describe(`SDK generated with responseStyle: '${responseStyle}'`, () => {
    const { useData, useMutation, TayoriProvider } = tayori();

    function setup() {
      const fake = createFakeFetch();
      const wrapper = createWrapper({ TayoriProvider, initClient: () => createClient(fake.fetch) });
      return { ...fake, wrapper };
    }

    it('useData resolves to the response body', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useData(sdk.getPlanet, { path: { planetId: 1 } }).data, { wrapper });

      await waitFor(() => {
        expect(result.current).toEqual(MARS);
      });
    });

    it('useData resolves to the whole body when the body itself has a `data` field', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useData(sdk.listPlanets, { query: { limit: 10 } }).data, { wrapper });

      await waitFor(() => {
        expect(result.current).toEqual(PAGE);
      });
    });

    it('useData exposes error responses through SWR error', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useData(sdk.getPlanet, { path: { planetId: 404 } }, { shouldRetryOnError: false }).error, { wrapper });

      await waitFor(() => {
        expect(result.current).toEqual({ message: 'Not found' });
      });
    });

    it('useMutation().trigger() resolves to the response body', async () => {
      const { wrapper, requests } = setup();
      const { result } = renderHook(() => useMutation(sdk.createPlanet), { wrapper });

      let created: unknown;
      await act(async () => {
        created = await result.current.trigger({ body: { name: 'Venus' } });
      });
      expect(created).toEqual({ id: 2, name: 'Venus' });
      expect(requests).toEqual(['POST /planets']);
    });
  });
}

// ---------- type-level checks: compiled by `tsc` (part of `pnpm run typecheck`), never executed ----------

/** Exact type equality */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

/** Compiles only if `actual` has exactly the type `Expected`: `expectType<Expected>()(actual, true)` */
function expectType<Expected>() {
  return <Actual>(actual: Actual, isExact: Equal<Actual, Expected>) => [actual, isExact] as const;
}

/** Compiles only if `a` and `b` have exactly the same type */
function expectSameType<A, B>(a: A, b: B, isSame: Equal<A, B>) {
  return [a, b, isSame] as const;
}

function useFieldsTypeChecks() {
  const { useData, useDataImmutable, useInfinite, useMutation } = tayori<fieldsSdk.Options, fieldsClient.RequestResult>();

  return [
    expectType<Planet | undefined>()(useData(fieldsSdk.getPlanet, { path: { planetId: 1 } }).data, true),
    expectType<PlanetPage | undefined>()(useData(fieldsSdk.listPlanets, { query: { limit: 10 } }).data, true),
    expectType<PlanetPage | undefined>()(useDataImmutable(fieldsSdk.listPlanets, {}).data, true),
    expectType<PlanetPage[] | undefined>()(useInfinite(fieldsSdk.listPlanets, (pageIndex) => ({ query: { offset: pageIndex * 10 } })).data, true),
    expectType<Promise<Planet>>()(useMutation(fieldsSdk.createPlanet).trigger({ body: { name: 'Venus' } }), true)
  ] as const;
}

function useDataTypeChecks() {
  const { useData, useDataImmutable, useInfinite, useMutation } = tayori<dataSdk.Options, dataClient.RequestResult>();

  return [
    expectType<Planet | undefined>()(useData(dataSdk.getPlanet, { path: { planetId: 1 } }).data, true),
    // the body's own `data` field must not be mistaken for the `fields` style's `data`
    expectType<PlanetPage | undefined>()(useData(dataSdk.listPlanets, { query: { limit: 10 } }).data, true),
    expectType<PlanetPage | undefined>()(useDataImmutable(dataSdk.listPlanets, {}).data, true),
    expectType<PlanetPage[] | undefined>()(useInfinite(dataSdk.listPlanets, (pageIndex) => ({ query: { offset: pageIndex * 10 } })).data, true),
    expectType<Promise<Planet>>()(useMutation(dataSdk.createPlanet).trigger({ body: { name: 'Venus' } }), true)
  ] as const;
}

/**
 * The hook types come from the SDK function passed to each hook, so `tayori()` without type arguments
 * yields exactly the same hooks, in both response styles.
 */
function useTypeArgumentChecks() {
  const bare = tayori();
  const fields = tayori<fieldsSdk.Options, fieldsClient.RequestResult>();
  const data = tayori<dataSdk.Options, dataClient.RequestResult>();

  return [
    expectSameType(fields.useData(fieldsSdk.listPlanets, {}), bare.useData(fieldsSdk.listPlanets, {}), true),
    expectSameType(data.useData(dataSdk.listPlanets, {}), bare.useData(dataSdk.listPlanets, {}), true),
    expectSameType(fields.useMutation(fieldsSdk.createPlanet).trigger, bare.useMutation(fieldsSdk.createPlanet).trigger, true),
    expectSameType(data.useMutation(dataSdk.createPlanet).trigger, bare.useMutation(dataSdk.createPlanet).trigger, true)
  ] as const;
}

describe('response style type-level checks', () => {
  it('compiles', () => {
    expect(typeof useFieldsTypeChecks).toEqual('function');
    expect(typeof useDataTypeChecks).toEqual('function');
    expect(typeof useTypeArgumentChecks).toEqual('function');
  });
});
