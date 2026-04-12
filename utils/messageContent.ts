import { RuntimeNPCState } from '../types';
import { hasNarrativeMedia, splitByNarrativeMedia } from './narrativeMedia';

const CONTROL_TAG_PATTERNS = [
  /\[(?:VISUAL|VISIBILITY|VISABILITY)\s*:[^\]]*\]/g,
  /\[STABILITY\s*:\s*\d+\]/g,
  /\[ENDING\s*:\s*[^\]]+\]/g,
  /\[LOC\s*:\s*[^\]]+\]/g,
];

const normalizeWhitespace = (text: string): string =>
  text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const stripMapUpdateTags = (text: string): string => {
  let nextText = text;
  let searchStart = 0;

  while (searchStart < nextText.length) {
    const tagStart = nextText.indexOf('[MAP_UPDATE', searchStart);
    if (tagStart === -1) {
      break;
    }

    const colon = nextText.indexOf(':', tagStart);
    const jsonStart = nextText.indexOf('{', colon);
    if (colon === -1 || jsonStart === -1) {
      searchStart = tagStart + '[MAP_UPDATE'.length;
      continue;
    }

    let depth = 0;
    let jsonEnd = -1;
    let inString = false;
    let escaped = false;

    for (let index = jsonStart; index < nextText.length; index += 1) {
      const char = nextText[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          jsonEnd = index;
          break;
        }
      }
    }

    if (jsonEnd === -1) {
      break;
    }

    const tagEnd = nextText.indexOf(']', jsonEnd);
    if (tagEnd === -1) {
      break;
    }

    nextText = `${nextText.slice(0, tagStart)}${nextText.slice(tagEnd + 1)}`;
    searchStart = tagStart;
  }

  return nextText;
};

export const stripMessageControlTags = (text: string): string => {
  const withoutMapUpdate = stripMapUpdateTags(text);
  const withoutControlTags = CONTROL_TAG_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, ''),
    withoutMapUpdate
  );

  return normalizeWhitespace(withoutControlTags);
};

const getNpcDisplayName = (npcId: string, npcs?: RuntimeNPCState[]): string =>
  npcs?.find((npc) => npc.id === npcId)?.name || npcId;

const flattenNpcDialogue = (text: string, npcs?: RuntimeNPCState[]): string =>
  text.replace(/\[@([^\]:：]+)[:：]\s*([\s\S]*?)\]/g, (_match, npcId: string, content: string) => {
    const displayName = getNpcDisplayName(npcId.trim(), npcs);
    return `${displayName}: ${content.trim()}`;
  });

const flattenNarrativeMedia = (
  mediaType: string,
  attrs: Record<string, string>,
  content: string
): string => {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return '';
  }

  switch (mediaType) {
    case 'DOC': {
      const title = attrs.title?.trim();
      return title ? `${title}\n${trimmedContent}` : trimmedContent;
    }
    case 'COMM': {
      const source = attrs.source?.trim();
      const time = attrs.time?.trim();
      const prefix = [source, time].filter(Boolean).join(' ');
      return prefix ? `${prefix}\n${trimmedContent}` : trimmedContent;
    }
    default:
      return trimmedContent;
  }
};

export const toReadableMessageText = (text: string, npcs?: RuntimeNPCState[]): string => {
  const cleanedText = stripMessageControlTags(text);
  const segments = hasNarrativeMedia(cleanedText)
    ? splitByNarrativeMedia(cleanedText)
    : [{ type: 'text' as const, content: cleanedText }];

  const flattened = segments
    .map((segment) => {
      if (segment.type === 'media' && segment.mediaType) {
        return flattenNarrativeMedia(segment.mediaType, segment.attrs || {}, segment.content);
      }

      return flattenNpcDialogue(segment.content, npcs).trim();
    })
    .filter(Boolean)
    .join('\n\n');

  return normalizeWhitespace(flattened);
};
