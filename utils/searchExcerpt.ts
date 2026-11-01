export interface ExcerptBlock {
  kind: 'heading' | 'item' | 'text';
  text: string;
}

/** Enough to read during a wait. Search results can run to several pages */
const DEFAULT_MAX_CHARS = 900;
const SENTENCE_END = /[。！？.!?；;](?=\s|$|[^\d])/g;

const LATEX_SYMBOLS: Record<string, string> = {
  rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', times: '×', approx: '≈', ge: '≥', le: '≤', neq: '≠',
};

const cleanInline = (source: string) => source
  // $\rightarrow$ and other inline maths
  .replace(/\$\\([a-zA-Z]+)\$/g, (_, name: string) => LATEX_SYMBOLS[name] ?? '')
  .replace(/\$([^$\n]*\\[^$\n]*)\$/g, '')
  // Images and links keep only their text
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  // Citation marks and bare addresses mean nothing here
  .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '')
  .replace(/https?:\/\/\S+/g, '')
  // Emphasis. An underscore only counts at a word edge, so snake_case survives
  .replace(/\*{1,3}/g, '')
  .replace(/(^|[\s(（])_{1,3}([^_\n]+)_{1,3}(?=[\s).,;:，。；：）]|$)/g, '$1$2')
  .replace(/`+/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const shorten = (text: string, room: number) => {
  if (text.length <= room) return text;
  const head = text.slice(0, room);
  const ends = [...head.matchAll(SENTENCE_END)];
  const last = ends[ends.length - 1];
  return last ? head.slice(0, (last.index ?? 0) + 1) : `${head.trimEnd()}…`;
};

/** Search results come back as Markdown. This keeps their structure and leaves plain text to show */
export const parseSearchExcerpt = (raw: string, maxChars = DEFAULT_MAX_CHARS): ExcerptBlock[] => {
  const blocks: ExcerptBlock[] = [];
  let used = 0;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Horizontal rules and the line under a table header
    if (/^([-*_=])(?:\s*\1){2,}$/.test(line) || /^\|?[\s:|-]+\|[\s:|-]*$/.test(line)) continue;

    let kind: ExcerptBlock['kind'] = 'text';
    let body = line;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^(?:[*\-+•]|\d+[.)])\s+(.*)$/);
    if (heading) {
      kind = 'heading';
      body = heading[1];
    } else if (bullet) {
      kind = 'item';
      body = bullet[1];
    } else if (line.startsWith('>')) {
      body = line.replace(/^>+\s*/, '');
    } else if (line.startsWith('|')) {
      body = line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()).filter(Boolean).join(' · ');
    }

    const text = cleanInline(body);
    if (!text) continue;
    const room = maxChars - used;
    if (room <= 0) break;
    const kept = shorten(text, room);
    blocks.push({ kind, text: kept });
    used += kept.length;
    if (kept.length < text.length) break;
  }
  // A heading with nothing under it reads as a mistake
  while (blocks.length && blocks[blocks.length - 1].kind === 'heading') blocks.pop();
  return blocks;
};
