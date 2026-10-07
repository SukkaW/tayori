import type { DescMessage, Message, MessageShape } from '@bufbuild/protobuf';
import { clone, create, isMessage } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import type { HandlerContext, Interceptor, Transport } from '@connectrpc/connect';
import { Code, ConnectError, createRouterTransport } from '@connectrpc/connect';

import { BookSchema, BookService, Genre } from './gen/library/catalog/v1/book_pb';
import type { Book } from './gen/library/catalog/v1/book_pb';
import { LoanSchema, LoanService, LoanStatus } from './gen/library/lending/v1/loan_pb';
import type { Loan } from './gen/library/lending/v1/loan_pb';

/** The only member that may create, update and delete books, and the only one that sees every loan */
export const LIBRARIAN = 'root';

export interface LibraryCall {
  service: string,
  method: string,
  /** The member the call was authenticated as, `undefined` for anonymous calls */
  member: string | undefined,
  /** The decoded request message, `undefined` for streaming calls */
  request: Message | undefined
}

export interface Library {
  /**
   * A new transport to the library, optionally authenticated as `member` (`'ada'`, `'grace'` or
   * `LIBRARIAN`). Every call returns a distinct transport object over the same state, which is what
   * different identities in a real app look like.
   */
  connect(member?: string): Transport,
  /** Every call that reached the server, in order */
  calls: LibraryCall[],
  /** The decoded requests of the given message type that reached the server, in order */
  requests<Desc extends DescMessage>(schema: Desc): Array<MessageShape<Desc>>
}

const RE_BEARER = /^Bearer (.+)$/;

function fail(message: string, code: Code): never {
  throw new ConnectError(message, code);
}

function bearer(header: Headers): string | undefined {
  return RE_BEARER.exec(header.get('authorization') ?? '')?.[1];
}

function authenticate(context: HandlerContext): string {
  return bearer(context.requestHeader) ?? fail('credentials required', Code.Unauthenticated);
}

function authenticateLibrarian(context: HandlerContext): void {
  if (authenticate(context) !== LIBRARIAN) {
    fail('librarians only', Code.PermissionDenied);
  }
}

function authenticateAs(member: string): Interceptor {
  return (next) => (request) => {
    request.header.set('authorization', `Bearer ${member}`);
    return next(request);
  };
}

/** Page tokens are plain offsets, an empty `nextPageToken` marks the last page */
function paginate<T>(items: T[], pageSize: number, pageToken: string) {
  const start = pageToken ? Number(pageToken) : 0;
  const end = pageSize > 0 ? start + pageSize : items.length;
  return { page: items.slice(start, end), nextPageToken: end < items.length ? String(end) : '' };
}

function seedBooks(): Book[] {
  return [
    create(BookSchema, {
      id: 'b1',
      title: 'The Long Orbit',
      subtitle: 'A Novel',
      authors: ['Mira Voss'],
      genre: Genre.FICTION,
      priceCents: 1299n,
      publishedAt: timestampFromDate(new Date('2019-03-01T00:00:00Z')),
      labels: { shelf: 'a', language: 'en' },
      cover: { case: 'coverUrl', value: 'https://covers.example.invalid/long-orbit.png' }
    }),
    create(BookSchema, {
      id: 'b2',
      title: 'Salt and Iron',
      authors: ['Tomas Reyes', 'Ines Walker'],
      genre: Genre.HISTORY,
      priceCents: 2450n,
      publishedAt: timestampFromDate(new Date('2011-09-15T00:00:00Z')),
      labels: { shelf: 'b' },
      cover: { case: 'coverImage', value: new Uint8Array([1, 2, 3]) }
    }),
    create(BookSchema, {
      id: 'b3',
      title: 'Small Machines',
      subtitle: '',
      authors: ['Ravi Patel'],
      genre: Genre.SCIENCE,
      priceCents: 3100n,
      labels: { shelf: 'a' }
    }),
    create(BookSchema, { id: 'b4', title: 'Harbor Lights', genre: Genre.FICTION, priceCents: 999n, labels: { shelf: 'c' } }),
    create(BookSchema, { id: 'b5', title: 'The Quiet Garden', genre: Genre.FICTION, priceCents: 1500n, labels: { shelf: 'a' } })
  ];
}

/**
 * A small in-memory library server for integration tests: two services over `createRouterTransport`,
 * authenticated by a `Bearer <member>` header, with Connect error codes, page tokens and a server stream.
 * Ada has borrowed book `b1`, Grace book `b2`.
 */
export function createLibrary(): Library {
  const books = seedBooks();
  const loans: Loan[] = [
    create(LoanSchema, { id: 'l1', book: books[0], memberId: 'ada', dueAt: timestampFromDate(new Date('2030-01-15T00:00:00Z')), status: LoanStatus.ACTIVE }),
    create(LoanSchema, { id: 'l2', book: books[1], memberId: 'grace', dueAt: timestampFromDate(new Date('2030-01-15T00:00:00Z')), status: LoanStatus.ACTIVE })
  ];
  const calls: LibraryCall[] = [];
  let nextBookId = books.length + 1;
  let nextLoanId = loans.length + 1;

  const findBook = (id: string) => books.find((candidate) => candidate.id === id) ?? fail(`book ${id} not found`, Code.NotFound);
  const findLoan = (id: string) => loans.find((candidate) => candidate.id === id) ?? fail(`loan ${id} not found`, Code.NotFound);
  const visibleLoans = (member: string) => loans.filter((loan) => member === LIBRARIAN || loan.memberId === member);

  const record: Interceptor = (next) => (request) => {
    calls.push({
      service: request.service.typeName,
      method: request.method.name,
      member: bearer(request.header),
      request: request.stream ? undefined : request.message
    });
    return next(request);
  };

  return {
    calls,
    requests: (schema) => calls.flatMap(({ request }) => (isMessage(request, schema) ? [request] : [])),
    connect: (member) => createRouterTransport(({ service }) => {
      service(BookService, {
        getBook(request, context) {
          authenticate(context);
          return { book: findBook(request.id) };
        },
        listBooks(request, context) {
          authenticate(context);
          const matching = books.filter((book) => (request.genre === Genre.UNSPECIFIED || book.genre === request.genre)
            && (request.titleContains === undefined || book.title.includes(request.titleContains))
            && Object.entries(request.labels).every(([key, value]) => book.labels[key] === value));
          const { page, nextPageToken } = paginate(matching, request.pageSize, request.pageToken);
          return { books: page, nextPageToken, total: BigInt(matching.length) };
        },
        createBook(request, context) {
          authenticateLibrarian(context);
          const draft = request.book ?? fail('book is required', Code.InvalidArgument);
          if (books.some((book) => book.title === draft.title)) {
            fail('a book with this title already exists', Code.AlreadyExists);
          }
          const book = clone(BookSchema, draft);
          book.id = `b${nextBookId++}`;
          books.push(book);
          return { book };
        },
        updateBook(request, context) {
          authenticateLibrarian(context);
          const book = findBook(request.id);
          // only the fields that are present are changed
          if (request.title !== undefined) book.title = request.title;
          if (request.priceCents !== undefined) book.priceCents = request.priceCents;
          return { book };
        },
        deleteBook(request, context) {
          authenticateLibrarian(context);
          books.splice(books.indexOf(findBook(request.id)), 1);
          return {};
        }
      });
      service(LoanService, {
        listLoans(request, context) {
          const matching = visibleLoans(authenticate(context)).filter((loan) => request.status === LoanStatus.UNSPECIFIED || loan.status === request.status);
          const { page, nextPageToken } = paginate(matching, request.pageSize, request.pageToken);
          return { loans: page, nextPageToken };
        },
        checkOut(request, context) {
          const memberId = authenticate(context);
          const book = findBook(request.bookId);
          if (loans.some((loan) => loan.book?.id === book.id && loan.status === LoanStatus.ACTIVE)) {
            fail('the book is already checked out', Code.FailedPrecondition);
          }
          const loan = create(LoanSchema, { id: `l${nextLoanId++}`, book, memberId, dueAt: timestampFromDate(new Date('2030-01-15T00:00:00Z')), status: LoanStatus.ACTIVE });
          loans.push(loan);
          return { loan };
        },
        returnBook(request, context) {
          const member = authenticate(context);
          const loan = findLoan(request.loanId);
          if (member !== LIBRARIAN && loan.memberId !== member) {
            fail('not your loan', Code.PermissionDenied);
          }
          loan.status = LoanStatus.RETURNED;
          loan.returnedAt = timestampFromDate(new Date('2030-01-10T00:00:00Z'));
          return { loan };
        },
        // eslint-disable-next-line @typescript-eslint/require-await -- an async generator is how a server stream is implemented
        async *watchLoans(_request, context) {
          const visible = visibleLoans(authenticate(context));
          for (let i = 0, len = visible.length; i < len; i++) {
            yield { loan: visible[i] };
          }
        }
      });
    }, {
      router: { interceptors: [record] },
      transport: { interceptors: member ? [authenticateAs(member)] : [] }
    })
  };
}
