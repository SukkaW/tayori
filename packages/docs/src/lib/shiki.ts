import { codeToHtml } from 'shiki';
import { transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers';

const SHIKI_THEME = 'nord';
const SHIKI_TRANSFORMERS = [
  transformerNotationDiff(),
  transformerNotationHighlight()
];

export function highlight(code: string, lang = 'tsx') {
  return codeToHtml(code.trim(), {
    lang,
    theme: SHIKI_THEME,
    transformers: SHIKI_TRANSFORMERS
  });
}
