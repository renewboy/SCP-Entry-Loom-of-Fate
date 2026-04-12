import { NarrativeMediumType } from '../types';

export interface NarrativeMediaSegment {
  type: 'text' | 'media';
  content: string;
  mediaType?: NarrativeMediumType;
  attrs?: Record<string, string>;
}

// Be tolerant of partially malformed tags such as `[/＃COMM]` while keeping
// the accepted media types limited to the known set.
const MEDIUM_BLOCK_REGEX = /\[(?:#|＃)(DOC|COMM|ENV|PSI)(?::([^\]]*))?\]\n?([\s\S]*?)\[(?:\/|／)\s*(?:#|＃)\s*\1\s*\]/g;

const parseAttrs = (attrStr: string | undefined): Record<string, string> => {
  const attrs: Record<string, string> = {};
  if (!attrStr) return attrs;
  for (const m of attrStr.matchAll(/(\w+)="([^"]*)"/g)) {
    attrs[m[1]] = m[2];
  }
  return attrs;
};

/**
 * Split text into interleaved text/media segments.
 * Text segments keep their content intact (including markdown);
 * media segments carry parsed type + attrs for the renderer.
 */
export const splitByNarrativeMedia = (text: string): NarrativeMediaSegment[] => {
  const segments: NarrativeMediaSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MEDIUM_BLOCK_REGEX)) {
    const [raw, typeStr, attrStr, content] = match;
    const startIndex = match.index!;

    if (startIndex > lastIndex) {
      const before = text.slice(lastIndex, startIndex).trim();
      if (before) {
        segments.push({ type: 'text', content: before });
      }
    }

    segments.push({
      type: 'media',
      content: content.trim(),
      mediaType: typeStr as NarrativeMediumType,
      attrs: parseAttrs(attrStr),
    });

    lastIndex = startIndex + raw.length;
  }

  if (lastIndex < text.length) {
    const after = text.slice(lastIndex).trim();
    if (after) {
      segments.push({ type: 'text', content: after });
    }
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
};

/** Quick check to avoid unnecessary splitting */
export const hasNarrativeMedia = (text: string): boolean =>
  /\[(?:#|＃)(DOC|COMM|ENV|PSI)/.test(text);
