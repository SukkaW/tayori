import { describe, it } from 'mocha';
import { expect } from 'earl';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { setTimeout as delay } from 'node:timers/promises';
import { SWRConfig, useSWRConfig } from 'swr';
import type { DescMethod } from '@bufbuild/protobuf';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import type { Transport } from '@connectrpc/connect';

import { isTayoriConnectKey, tayoriConnect } from '.';
import { BookService, Genre, GetBookRequestSchema, ListBooksRequestSchema } from '../test/gen/library/catalog/v1/book_pb';
import { LoanService } from '../test/gen/library/lending/v1/loan_pb';
import { createLibrary, LIBRARIAN } from '../test/library';
import { createWrapper } from '../test/wrapper';

// These tests wire tayori-connect the way an application does: generated code for several services
// in several files, one transport per identity, Connect error codes, page tokens and a server stream.
// See `test/library.ts` for the in-memory server and `proto/library` for the schema.
const { useData, useInfinite, useMutation, useTransport, TayoriProvider } = tayoriConnect();

function setup(member?: string) {
  const library = createLibrary();
  const wrapper = createWrapper({ TayoriProvider, initTransport: () => library.connect(member) });
  return { library, wrapper };
}

function Loans() {
  const { data } = useData(LoanService.method.listLoans, { message: {} });
  return <output>{data ? data.loans.map((loan) => loan.book?.title).join(',') : 'loading'}</output>;
}

/** Let pending fetches settle */
function settle(ms = 20) {
  // eslint-disable-next-line sukka/prefer-foxts-wait -- foxts is not a dependency of this package
  return act(() => delay(ms));
}

/** The `routeByService` sketch from connect.md: one transport, some services served by another server */
function routeByService(main: Transport, other: Transport, otherServices: Set<string>): Transport {
  const pick = (method: DescMethod) => (otherServices.has(method.parent.typeName) ? other : main);
  return {
    unary: (method, ...rest) => pick(method).unary(method, ...rest),
    stream: (method, ...rest) => pick(method).stream(method, ...rest)
  };
}

/** Run `trigger`, returning what it rejected with */
async function rejection(trigger: () => Promise<unknown>) {
  let caught: unknown;
  await act(async () => {
    try {
      await trigger();
    } catch (error) {
      caught = error;
    }
  });
  return ConnectError.from(caught);
}

describe('several services', () => {
  it('keeps same-shaped requests of different services apart', async () => {
    const { library, wrapper } = setup('ada');

    // both requests are `{ message: {} }`: only the service / method tells them apart
    const { result } = renderHook(() => ({
      books: useData(BookService.method.listBooks, { message: {} }),
      loans: useData(LoanService.method.listLoans, { message: {} })
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.books.data?.books.length).toEqual(5);
      expect(result.current.loans.data?.loans.map((loan) => loan.id)).toEqual(['l1']);
    });
    expect(library.calls.map(({ service, method }) => `${service}/${method}`).sort()).toEqual([
      'library.catalog.v1.BookService/ListBooks',
      'library.lending.v1.LoanService/ListLoans'
    ]);
  });

  it('shares one transport between the hooks and a Connect client for the methods tayori-connect does not cover', async () => {
    const { library, wrapper } = setup('grace');

    const { result } = renderHook(() => ({
      loans: useData(LoanService.method.listLoans, { message: {} }),
      transport: useTransport()
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.loans.data?.loans.length).toEqual(1);
    });

    // server streaming is not supported by the hooks, the same transport serves a plain Connect client
    const titles: string[] = [];
    for await (const { loan } of createClient(LoanService, result.current.transport).watchLoans({})) {
      titles.push(loan?.book?.title ?? '');
    }
    expect(titles).toEqual(['Salt and Iron']);
    expect(library.calls.map(({ method, member }) => [method, member])).toEqual([['ListLoans', 'grace'], ['WatchLoans', 'grace']]);
  });
});

describe('identities', () => {
  it('never shares a cache entry between nested providers with different transports', async () => {
    const library = createLibrary();

    // ONE SWR cache above both providers: only the transport in the key keeps the members apart
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <TayoriProvider initTransport={() => library.connect('ada')}>
          <Loans />
          <TayoriProvider initTransport={() => library.connect('grace')}>
            <Loans />
          </TayoriProvider>
        </TayoriProvider>
      </SWRConfig>
    );

    await screen.findByText('The Long Orbit');
    await screen.findByText('Salt and Iron');
    expect(library.calls.map(({ member }) => member).sort()).toEqual(['ada', 'grace']);
  });

  it('maps Connect error codes of reads to SWR errors', async () => {
    const anonymous = renderHook(() => useData(BookService.method.getBook, { message: { id: 'b1' } }, { shouldRetryOnError: false }), { wrapper: setup().wrapper });
    const missing = renderHook(() => useData(BookService.method.getBook, { message: { id: 'nope' } }, { shouldRetryOnError: false }), { wrapper: setup('ada').wrapper });

    // SWR only re-renders a hook for the fields that were read, so read `error` of both hooks before
    // waiting: the second hook's error may arrive while the first one is still being awaited
    expect(anonymous.result.current.error).toEqual(undefined);
    expect(missing.result.current.error).toEqual(undefined);
    await waitFor(() => {
      expect(ConnectError.from(anonymous.result.current.error).code).toEqual(Code.Unauthenticated);
    });
    await waitFor(() => {
      expect(ConnectError.from(missing.result.current.error).code).toEqual(Code.NotFound);
    });
    expect(anonymous.result.current.data).toEqual(undefined);
  });

  it('maps Connect error codes of writes to rejections of trigger()', async () => {
    const member = renderHook(() => useMutation(BookService.method.createBook), { wrapper: setup('ada').wrapper });
    const librarian = renderHook(() => useMutation(BookService.method.createBook), { wrapper: setup(LIBRARIAN).wrapper });

    expect((await rejection(() => member.result.current.trigger({ message: { book: { title: 'Nope' } } }))).code).toEqual(Code.PermissionDenied);
    expect(ConnectError.from(member.result.current.error).code).toEqual(Code.PermissionDenied);

    expect((await rejection(() => librarian.result.current.trigger({ message: { book: { title: 'The Long Orbit' } } }))).code).toEqual(Code.AlreadyExists);
    expect((await rejection(() => librarian.result.current.trigger({ message: {} }))).code).toEqual(Code.InvalidArgument);
  });
});

describe('lists', () => {
  it('passes a page token along as a plain request parameter', async () => {
    const { library, wrapper } = setup('ada');

    const { result, rerender } = renderHook(
      ({ pageToken }: { pageToken: string }) => useData(BookService.method.listBooks, { message: { pageSize: 2, pageToken } }),
      { wrapper, initialProps: { pageToken: '' } }
    );

    await waitFor(() => {
      expect(result.current.data?.books.map((book) => book.id)).toEqual(['b1', 'b2']);
    });
    rerender({ pageToken: result.current.data!.nextPageToken });
    await waitFor(() => {
      expect(result.current.data?.books.map((book) => book.id)).toEqual(['b3', 'b4']);
    });
    expect(library.requests(ListBooksRequestSchema).map((request) => request.pageToken)).toEqual(['', '2']);
  });

  it('pages through useInfinite, 64-bit integers and timestamps included', async () => {
    const { wrapper } = setup('ada');

    const { result } = renderHook(() => useInfinite(BookService.method.listBooks, (_pageIndex, previous) => {
      if (previous && !previous.nextPageToken) return null; // reached the end
      return { message: { pageSize: 2, pageToken: previous?.nextPageToken } };
    }, { revalidateFirstPage: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.length).toEqual(1);
    });
    await act(async () => {
      await result.current.setSize(3);
    });
    await waitFor(() => {
      expect(result.current.data?.length).toEqual(3);
    });

    const pages = result.current.data!;
    const books = pages.flatMap((page) => page.books);
    expect(books.map((book) => book.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    expect(pages[0].total).toEqual(5n);
    expect(books[0].priceCents).toEqual(1299n);
    expect(timestampDate(books[0].publishedAt!).toISOString()).toEqual('2019-03-01T00:00:00.000Z');
  });

  it('serves a view that needs only the first page from the cache entry of useInfinite\'s first page', async () => {
    const { library, wrapper } = setup('ada');

    const { result, rerender } = renderHook(({ firstPageOnly }: { firstPageOnly: boolean }) => ({
      pages: useInfinite(BookService.method.listBooks, (_pageIndex, previous) => {
        if (previous && !previous.nextPageToken) return null; // reached the end
        return { message: { pageSize: 2, pageToken: previous?.nextPageToken } };
      }).data,
      // the same request as the first page: `pageToken` left out is the same message as `pageToken: undefined`
      first: useData(BookService.method.listBooks, firstPageOnly && { message: { pageSize: 2 } }, { revalidateIfStale: false }).data
    }), { wrapper, initialProps: { firstPageOnly: false } });

    await waitFor(() => {
      expect(result.current.pages?.length).toEqual(1);
    });
    rerender({ firstPageOnly: true });

    // available on the very first render, without a request of its own
    expect(result.current.first?.books.map((book) => book.id)).toEqual(['b1', 'b2']);
    await settle();
    expect(library.requests(ListBooksRequestSchema).length).toEqual(1);
  });

  it('revalidates a list tagged through the SWR options after a mutation created a new entry', async () => {
    const { library, wrapper } = setup(LIBRARIAN);

    const { result } = renderHook(() => ({
      list: useData(BookService.method.listBooks, { message: {} }, { tags: ['books'] }),
      create: useMutation(BookService.method.createBook),
      swr: useSWRConfig()
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.list.data?.total).toEqual(5n);
    });
    await act(async () => {
      await result.current.create.trigger({ message: { book: { title: 'Fresh Ink', priceCents: 500n } } });
      await result.current.swr.revalidateTag('books');
    });
    await waitFor(() => {
      expect(result.current.list.data?.total).toEqual(6n);
    });
    expect(result.current.list.data?.books.at(-1)?.title).toEqual('Fresh Ink');
    expect(library.requests(ListBooksRequestSchema).length).toEqual(2);
  });

  it('clears one entry without refetching it through a filtered mutate over tayori keys, e.g. after a delete', async () => {
    const { library, wrapper } = setup(LIBRARIAN);
    const getBook = `${BookService.typeName}/${BookService.method.getBook.name}`;

    const { result } = renderHook(() => ({
      book: useData(BookService.method.getBook, { message: { id: 'b1' } }).data,
      remove: useMutation(BookService.method.deleteBook),
      swr: useSWRConfig()
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.book?.book?.title).toEqual('The Long Orbit');
    });
    await act(async () => {
      await result.current.remove.trigger({ message: { id: 'b1' } });
      // revalidating a deleted book would only yield a NotFound error: clear its entry instead
      await result.current.swr.mutate(
        (key) => isTayoriConnectKey(key) && Array.isArray(key) && key[1] === getBook && (key[2].message as { id?: string }).id === 'b1',
        undefined,
        { revalidate: false }
      );
    });
    expect(result.current.book).toEqual(undefined);
    expect(library.requests(GetBookRequestSchema).length).toEqual(1);
  });
});

describe('accounts and servers', () => {
  it('drops every cached response on sign-out with the scoped unload, useInfinite lists included', async () => {
    const { library, wrapper } = setup('ada');

    const { result } = renderHook(() => ({
      loans: useData(LoanService.method.listLoans, { message: {} }).data,
      books: useInfinite(BookService.method.listBooks, (_pageIndex, previous) => {
        if (previous && !previous.nextPageToken) return null; // reached the end
        return { message: { pageSize: 2, pageToken: previous?.nextPageToken } };
      }).data,
      swr: useSWRConfig()
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.loans?.loans.length).toEqual(1);
      expect(result.current.books?.length).toEqual(1);
    });
    const requests = library.calls.length;

    // a filter `mutate`, even `mutate(() => true)`, skips useInfinite's entry: unload drops everything
    act(() => result.current.swr.unload({ revalidate: false }));

    expect(result.current.loans).toEqual(undefined);
    expect(result.current.books).toEqual(undefined);
    await settle();
    expect(library.calls.length).toEqual(requests);
  });

  it('routes the services of a second server through one composed transport', async () => {
    const catalog = createLibrary();
    const lending = createLibrary();
    const transport = routeByService(catalog.connect('ada'), lending.connect('ada'), new Set([LoanService.typeName]));
    const wrapper = createWrapper({ TayoriProvider, initTransport: () => transport });

    const { result } = renderHook(() => ({
      books: useData(BookService.method.listBooks, { message: {} }).data,
      loans: useData(LoanService.method.listLoans, { message: {} }).data
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.books?.total).toEqual(5n);
      expect(result.current.loans?.loans.length).toEqual(1);
    });
    expect(catalog.calls.map(({ method }) => method)).toEqual(['ListBooks']);
    expect(lending.calls.map(({ method }) => method)).toEqual(['ListLoans']);
  });
});

describe('message shapes', () => {
  it('derives the SWR key from the canonical message: presence and defaults, not spelling', async () => {
    const { library, wrapper } = setup('ada');

    renderHook(() => ({
      plain: useData(BookService.method.listBooks, { message: {} }),
      // an explicit default is the same message as an unset field
      explicitDefault: useData(BookService.method.listBooks, { message: { genre: Genre.UNSPECIFIED, pageSize: 0 } }),
      // an optional field has presence: set to '' it is a different message than unset
      emptyOptional: useData(BookService.method.listBooks, { message: { titleContains: '' } }),
      // map entries have no order
      labels: useData(BookService.method.listBooks, { message: { labels: { shelf: 'a', language: 'en' } } }),
      labelsReordered: useData(BookService.method.listBooks, { message: { labels: { language: 'en', shelf: 'a' } } })
    }), { wrapper });

    await waitFor(() => {
      expect(library.calls.length).toEqual(3);
    });
    expect(library.requests(ListBooksRequestSchema).map((request) => request.titleContains)).toInclude('');
  });

  it('round-trips every field kind through a mutation', async () => {
    const { wrapper } = setup(LIBRARIAN);
    const { result } = renderHook(() => useMutation(BookService.method.createBook), { wrapper });

    const published = new Date('2024-02-29T12:30:00Z');
    const created = await act(() => result.current.trigger({
      message: {
        book: {
          title: 'Everything',
          // present but empty: stays an empty string instead of becoming unset
          subtitle: '',
          authors: ['A', 'B'],
          genre: Genre.SCIENCE,
          // beyond Number.MAX_SAFE_INTEGER
          priceCents: 9_007_199_254_740_993n,
          publishedAt: timestampFromDate(published),
          labels: { k: 'v' },
          cover: { case: 'coverImage', value: new Uint8Array([0, 255]) },
          isbn: 'deprecated-but-working'
        }
      }
    }));

    const book = created.book!;
    expect(book.id).toEqual('b6');
    expect(book.subtitle).toEqual('');
    expect(book.authors).toEqual(['A', 'B']);
    expect(book.genre).toEqual(Genre.SCIENCE);
    expect(book.priceCents).toEqual(9_007_199_254_740_993n);
    expect(timestampDate(book.publishedAt!)).toEqual(published);
    expect(book.labels).toEqual({ k: 'v' });
    expect(book.cover).toEqual({ case: 'coverImage', value: new Uint8Array([0, 255]) });
    expect(book.isbn).toEqual('deprecated-but-working');
  });

  it('only changes the fields that are present in a partial update', async () => {
    const { wrapper } = setup(LIBRARIAN);
    const { result } = renderHook(() => useMutation(BookService.method.updateBook), { wrapper });

    const priceOnly = await act(() => result.current.trigger({ message: { id: 'b1', priceCents: 1000n } }));
    const emptyTitle = await act(() => result.current.trigger({ message: { id: 'b1', title: '' } }));

    expect(priceOnly.book).toEqual(expect.subset({ title: 'The Long Orbit', priceCents: 1000n }));
    expect(emptyTitle.book).toEqual(expect.subset({ title: '', priceCents: 1000n }));
  });
});

// Compiled by `tsc` (part of `pnpm run typecheck`), never executed
function useTypeChecks() {
  const { data } = useData(BookService.method.getBook, { message: { id: 'b1' } });
  const price: bigint | undefined = data?.book?.priceCents;
  const genre: Genre | undefined = data?.book?.genre;
  const cover: 'coverUrl' | 'coverImage' | undefined = data?.book?.cover.case;
  // @ts-expect-error -- int64 is a bigint
  const rejectedPrice: number | undefined = data?.book?.priceCents;
  // @ts-expect-error -- `nope` is not a field of GetBookRequest
  useData(BookService.method.getBook, { message: { nope: 1 } });

  const { trigger } = useMutation(BookService.method.createBook);
  void trigger({ message: { book: { cover: { case: 'coverUrl', value: 'https://example.invalid/cover.png' } } } });
  // @ts-expect-error -- a oneof case takes the value type of that case
  void trigger({ message: { book: { cover: { case: 'coverUrl', value: new Uint8Array() } } } });
  // @ts-expect-error -- `priceCents` is a bigint
  void trigger({ message: { book: { priceCents: 'free' } } });

  // @ts-expect-error -- streaming methods are not unary methods
  useData(LoanService.method.watchLoans, { message: {} });

  return [price, genre, cover, rejectedPrice] as const;
}

describe('type-level checks', () => {
  it('compiles', () => {
    expect(typeof useTypeChecks).toEqual('function');
  });
});
