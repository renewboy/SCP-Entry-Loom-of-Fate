import type { Language } from '../types';

const LINK_ID = 'report-font-cn';

/**
 * Special Elite has no Chinese, so this stylesheet adds worn Kai glyphs under the same font family.
 * Japanese is left out for now: the font has only part of its kanji and kana, and mixing them would look broken.
 */
export const syncReportFont = (language: Language) => {
  const existing = document.getElementById(LINK_ID);
  if (language === 'ja') {
    existing?.remove();
    return;
  }
  if (existing) return;
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = `${import.meta.env.BASE_URL}fonts/typewriter-cn/font.css`;
  document.head.appendChild(link);
};

/** The same stylesheet for a document opened in another window; its address has to be absolute there */
export const reportFontLinkTag = () => {
  const link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  return link ? `<link href="${link.href}" rel="stylesheet">` : '';
};
