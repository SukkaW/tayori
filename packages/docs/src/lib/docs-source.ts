import { DOCS_SLUGS } from './docs';
import type { DocsSlug } from './docs';

/**
 * The documentation is one source with one outline. What differs between the backends sits in
 * blocks written on their own lines, between the headings:
 *
 * ```
 * <docs-switch backend="hey-api">
 *
 * markdown...
 *
 * </docs-switch>
 *
 * <docs-switch backend="connect">
 *
 * markdown...
 *
 * </docs-switch>
 * ```
 *
 * Blocks that follow each other are the variants of one tab card. Blocks cannot be nested and
 * cannot hold headings, so the table of contents is the same for every backend.
 *
 * What only makes sense on the page itself (it talks about the switch, for instance) goes between
 * `<docs-page-only>` lines the same way, and is left out of the plain text for LLMs.
 */
const SWITCH_BLOCK = /^<docs-switch backend="([^"]*)">\n\n([\s\S]*?)\n\n<\/docs-switch>(?:\n\n|\n?$)/gm;
const PAGE_ONLY_BLOCK = /^<docs-page-only>\n\n([\s\S]*?)\n\n<\/docs-page-only>(?:\n\n|\n?$)/gm;
const RE_HEADING = /^(#{1,6}) /;
const RE_SECTION_HEADING = /^#{2,3} /;
const RE_SECTION_LINK = /\[([^\]]+)\]\(#[^)]*\)/g;
const RE_BLANK_LINES = /\n{3,}/g;

export type DocsVariants = Partial<Record<DocsSlug, string>>;

function isDocsSlug(backend: string): backend is DocsSlug {
  return (DOCS_SLUGS as readonly string[]).includes(backend);
}

/** Whether a markdown has a heading outside of code fences */
function hasHeading(markdown: string) {
  let fence = false;
  return markdown.split('\n').some(line => {
    if (line.startsWith('```')) fence = !fence;
    return !fence && RE_HEADING.test(line);
  });
}

/** Whether a markdown is nothing but fenced code blocks */
export function isCodeOnly(markdown: string) {
  let fence = false;
  return markdown.split('\n').every(line => {
    if (line.startsWith('```')) {
      fence = !fence;
      return true;
    }
    return fence || line.trim() === '';
  });
}

function assertBlock(backend: string, body: string): asserts backend is DocsSlug {
  if (!isDocsSlug(backend)) {
    throw new Error(`[docs] unknown backend "${backend}" in a <docs-switch> block, expected one of ${DOCS_SLUGS.join(', ')}`);
  }
  if (hasHeading(body)) {
    throw new Error(`[docs] a <docs-switch backend="${backend}"> block holds a heading, headings belong to the shared outline`);
  }
}

function assertNoLeftover(source: string) {
  if (source.includes('docs-switch') || source.includes('docs-page-only')) {
    throw new Error('[docs] malformed or nested <docs-switch> / <docs-page-only> block, a block needs its own opening and closing lines separated from its content by blank lines');
  }
}

/**
 * Splits the source into the shared markdown, with a `<docs-tabs index="n">` placeholder (a lone
 * opening tag, which is a block of its own for markdown) where a group of variants goes, and the
 * variants of every group.
 */
export function splitDocs(pageSource: string) {
  const source = pageSource.replaceAll(PAGE_ONLY_BLOCK, '$1\n\n');
  const groups: DocsVariants[] = [];
  let skeleton = '';
  let consumed = 0;

  for (const match of source.matchAll(SWITCH_BLOCK)) {
    const [block, backend, body] = match;
    assertBlock(backend, body);

    const group = groups.at(-1);
    if (group && match.index === consumed) {
      if (backend in group) {
        throw new Error(`[docs] two <docs-switch backend="${backend}"> blocks in a row`);
      }
      group[backend] = body;
    } else {
      skeleton += `${source.slice(consumed, match.index)}<docs-tabs index="${groups.length}">\n\n`;
      groups.push({ [backend]: body });
    }
    consumed = match.index + block.length;
  }

  skeleton += source.slice(consumed);
  assertNoLeftover(skeleton);

  return { skeleton, groups };
}

/** The headings of a section that has nothing in it for one backend would only be noise in plain text */
function dropEmptySections(text: string) {
  const lines = text.split('\n');
  const dropped = new Set<number>();
  let fence = false;
  let open: { level: number, line: number } | undefined;

  lines.forEach((line, index) => {
    if (line.startsWith('```')) fence = !fence;
    if (fence || line.startsWith('```')) {
      open = undefined;
      return;
    }
    const heading = RE_HEADING.exec(line);
    if (heading && heading[1].length >= 2) {
      // the previous heading had nothing before this one, unless this one is nested in it
      if (open && heading[1].length <= open.level) dropped.add(open.line);
      open = { level: heading[1].length, line: index };
    } else if (line.trim() !== '') {
      open = undefined;
    }
  });
  if (open) dropped.add(open.line);

  return lines.filter((_, index) => !dropped.has(index)).join('\n').replaceAll(RE_BLANK_LINES, '\n\n');
}

/** The document of one backend as markdown: what is shared and the variants of `slug` */
export function selectBackend(source: string, slug: DocsSlug): string {
  const selected = source.replaceAll(PAGE_ONLY_BLOCK, '').replaceAll(SWITCH_BLOCK, (_, backend: string, body: string) => {
    assertBlock(backend, body);
    return backend === slug ? `${body}\n\n` : '';
  });
  assertNoLeftover(selected);

  return `${dropEmptySections(selected).trimEnd()}\n`;
}

/**
 * Names the backend in every section heading, so a section can be told apart when it is read on
 * its own, and points links to a section of the page at that heading, since there are no anchors
 * in plain text.
 */
export function labelHeadings(markdown: string, label: string) {
  let fence = false;
  return markdown.split('\n').map(line => {
    if (line.startsWith('```')) fence = !fence;
    if (fence) return line;
    return RE_SECTION_HEADING.test(line)
      ? `${line} (${label})`
      : line.replaceAll(RE_SECTION_LINK, `"$1 (${label})"`);
  }).join('\n');
}
