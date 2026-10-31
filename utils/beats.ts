import { Language, SCPData } from '../types';
import { stripMessageControlTags } from './messageContent';
import { splitByNarrativeMedia } from './narrativeMedia';

/**
 * 把一条叙事消息切成按节拍播放的片段。
 * 纯函数：只依赖消息原文，所以旧存档不需要迁移。流式输出时只放出已经写完整的片段，
 * 同一条消息后续变长时，已放出的节拍不会再变化。
 */
export type BeatKind = 'narr' | 'npc' | 'psi' | 'media' | 'system';

export interface DossierEntry {
  label: string;
  value: string;
}

/** The mission brief from the analysis step, with labels already localized */
export interface BriefingContent {
  fields: DossierEntry[];
  sections: DossierEntry[];
}

export interface StageMedia {
  type: 'DOC' | 'COMM' | 'ENV' | 'DOSSIER';
  attrs: Record<string, string>;
  body: string;
  /** Bullet lines parsed out of the text of older saves */
  items?: string[];
  fields?: DossierEntry[];
  sections?: DossierEntry[];
}

type MediaTranslate = (key: string, params?: Record<string, string | number>) => any;

const ENV_KINDS = ['screen', 'sign', 'graffiti', 'carving'];

/** What the player is looking at and where it came from. The mission brief prints its own title, so it has none */
export const mediaCaption = (media: StageMedia, t: MediaTranslate, place = ''): { kind: string; details: string[] } | null => {
  if (media.type === 'DOC') {
    const kind = media.attrs.style === 'handwritten' ? 'doc_note' : media.attrs.style === 'damaged' ? 'doc_damaged' : 'doc_found';
    return { kind: t(`stage.media.${kind}`), details: [media.attrs.title].filter(Boolean) };
  }
  if (media.type === 'COMM') {
    return { kind: t('stage.media.comm'), details: [media.attrs.source || t('stage.media.comm_unknown'), media.attrs.time].filter(Boolean) };
  }
  if (media.type === 'ENV') {
    const type = ENV_KINDS.includes(media.attrs.type) ? media.attrs.type : 'sign';
    return { kind: t(`stage.media.env_${type}`), details: [place].filter(Boolean) };
  }
  return null;
};

export interface Beat {
  id: string;
  kind: BeatKind;
  text: string;
  /** Index of the log block this beat was cut from */
  block: number;
  npcId?: string;
  media?: StageMedia;
}

export type LogBlock =
  | { kind: 'p'; text: string }
  | { kind: 'npc'; npcId: string; text: string }
  | { kind: 'system'; text: string }
  | { kind: 'psi'; text: string }
  | { kind: 'media'; media: StageMedia };

export interface ChoiceOption {
  title: string;
  detail: string;
  fill: string;
}

export interface ParsedTurn {
  beats: Beat[];
  blocks: LogBlock[];
  options: ChoiceOption[];
}

interface ParseOptions {
  id?: string;
  intro?: boolean;
  streaming?: boolean;
  language?: Language;
  /** Played ahead of the opening text; only for the intro turn */
  briefing?: BriefingContent;
}

const NARR_LIMIT = 62;
const SPEECH_LIMIT = 58;
const LIMIT_SLACK = 6;
const DOSSIER_PAGE_LIMIT = 420;
const BRIEFING_FIELDS_BUDGET = 120;
const BRIEFING_LABEL_BUDGET = 24;
const SYSTEM_LINE = /^\*\*([^*]*(?:任务|任務|已激活|已完成|获得|獲得|已更新|Objective|Mission|Task|Acquired|Updated)[^*]*)\*\*$/;

const isWide = (ch: string) => /[⺀-鿿가-힯豈-﫿＀-￯　-ヿ]/.test(ch);

export const plainText = (text: string) => text.replace(/\*\*/g, '');

/** 字幕占用的宽度：全角字符算 1，半角算 0.55，空白不计 */
export const visualLength = (text: string) => {
  let total = 0;
  for (const ch of plainText(text)) {
    if (/\s/.test(ch)) continue;
    total += isWide(ch) ? 1 : 0.55;
  }
  return total;
};

const curlyQuotes = (text: string) => text.replace(/"([^"\n]*)"/g, '“$1”');

const sentences = (text: string, language?: Language): string[] => {
  if (language === 'en') {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
      return Array.from(segmenter.segment(text), part => part.segment);
    }
    return text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
  }
  return text.match(/[^。！？!?…]+[。！？!?…]+[」”"）)]*|[^。！？!?…]+$/g) || [text];
};

/** 超过两行字幕的文本按句切开，单句仍然过长时再按逗号切 */
export const splitForSubtitle = (text: string, limit = NARR_LIMIT, language?: Language): string[] => {
  if (visualLength(text) <= limit + LIMIT_SLACK) return [text];
  const atoms = sentences(text, language).flatMap(part =>
    visualLength(part) <= limit ? [part] : (part.match(/[^，；：,;:]+[，；：,;:]*\s*/g) || [part])
  );
  const out: string[] = [];
  let current = '';
  for (const atom of atoms) {
    if (current && visualLength(current) + visualLength(atom) > limit) {
      out.push(current.trim());
      current = atom;
    } else {
      current += atom;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
};

/** 长简报分成几页，每页点一下翻过去，字号不用压到读不清 */
const paginateDossier = (items: string[]): string[][] => {
  const pages: string[][] = [];
  let current: string[] = [];
  let used = 0;
  items.forEach(item => {
    const length = visualLength(item);
    if (current.length && used + length > DOSSIER_PAGE_LIMIT) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += length;
  });
  if (current.length) pages.push(current);
  return pages;
};

/** 字段表放在第一页开头，过长的段落按句子断到下一页 */
const paginateBriefing = ({ fields, sections }: BriefingContent, language?: Language): BriefingContent[] => {
  const pages: BriefingContent[] = [];
  let current: BriefingContent = { fields, sections: [] };
  let used = fields.length ? BRIEFING_FIELDS_BUDGET : 0;
  sections.forEach(section => {
    splitForSubtitle(section.value, DOSSIER_PAGE_LIMIT, language).forEach((part, index) => {
      const length = visualLength(part) + BRIEFING_LABEL_BUDGET;
      // 第一段总和字段表同页，第一页不会只剩一张表
      if (current.sections.length && used + length > DOSSIER_PAGE_LIMIT) {
        pages.push(current);
        current = { fields: [], sections: [] };
        used = 0;
      }
      current.sections.push({ label: index === 0 ? section.label : '', value: part });
      used += length;
    });
  });
  if (current.fields.length || current.sections.length) pages.push(current);
  return pages;
};

export const buildBriefingContent = (scp: SCPData | null | undefined, t: (key: string) => string): BriefingContent | undefined => {
  if (!scp?.briefing) return undefined;
  const { briefing } = scp;
  const filled = (entries: DossierEntry[]) => entries.filter(entry => entry.value?.trim());
  return {
    fields: filled([
      { label: t('stage.briefing.target'), value: [scp.designation, scp.name].filter(Boolean).join(' · ') },
      { label: t('stage.briefing.class'), value: scp.containmentClass },
      { label: t('stage.briefing.disruption'), value: briefing.disruptionClass },
      { label: t('stage.briefing.risk'), value: briefing.riskClass },
    ]),
    sections: filled([
      { label: t('stage.briefing.procedures'), value: briefing.containmentProcedures },
      { label: t('stage.briefing.description'), value: briefing.description },
      { label: t('stage.briefing.role'), value: scp.storyDraft?.roleDetails ?? '' },
    ]),
  };
};

/** The same brief as Markdown, for the report and its PDF export */
export const briefingToMarkdown = ({ fields, sections }: BriefingContent) =>
  [...fields, ...sections].map(entry => `- **${entry.label}**：${entry.value}`).join('\n\n');

const parseOption = (body: string): ChoiceOption => {
  const text = curlyQuotes(body);
  const bold = text.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  const title = bold ? bold[1].trim() : (text.split(/(?<=[。！？.!?])\s*/)[0] || text);
  const detail = bold ? bold[2].trim() : text.slice(title.length).trim();
  return { title: plainText(title), detail: plainText(detail), fill: plainText(`${title} ${detail}`).trim() };
};

/** 流式时把还没收尾的标签和它后面的内容先拿掉 */
const cutUnfinishedTag = (text: string) => {
  const markers = [
    text.search(/\[(?:#|＃)(?:DOC|COMM|ENV|PSI)/),
    text.indexOf('[MAP_UPDATE'),
    text.search(/\[(?:@|[A-Z_]{3,}\s*[:：])[^\]]*$/),
  ].filter(index => index >= 0);
  return markers.length ? text.slice(0, Math.min(...markers)) : text;
};

/**
 * 开局第一条分隔线之前如果只是模型的过程文字，就从分隔线之后开始。
 * 分隔线后面只有选项时，它只是选项分隔线，前面才是正文。流式时判断不出来就先不放出。
 */
const dropPreamble = (source: string, streaming: boolean): string | null => {
  const divider = source.match(/^[ \t]*-{3,}[ \t]*$/m);
  if (!divider) {
    return streaming && !/^\s*(?:#{1,6}\s|[-*]\s+\*\*)/m.test(source) ? null : source;
  }
  const head = source.slice(0, divider.index);
  if (/^\s*(?:#{1,6}\s|[-*]\s+\*\*)/m.test(head)) return source;
  const rest = source.slice(divider.index! + divider[0].length);
  const hasBody = rest.split(/\n\s*\n/).some(part => {
    const line = part.trim();
    return line && !/^(?:#{1,6}\s|\d+[.、)）]\s|\[|-{1,3}$)/.test(line);
  });
  if (hasBody) return rest;
  return streaming ? null : source;
};

const MEDIA_MARK = (index: number) => `\u0001M${index}\u0001`;
const NPC_MARK = (index: number) => `\u0001N${index}\u0001`;
const STRUCT_MARK = '\u0001X\u0001';

export const parseTurn = (raw: string, options: ParseOptions = {}): ParsedTurn => {
  const { id = 'turn', intro = false, streaming = false, language, briefing } = options;
  let source = raw.replace(/\r/g, '');

  if (intro) {
    const body = dropPreamble(source, streaming);
    if (body === null && !briefing) return { beats: [], blocks: [], options: [] };
    source = body ?? '';
  }

  // 收尾状态要在清理前判断：清理会去掉结尾空白
  let endsClosed = /\n[ \t]*\n[ \t]*$/.test(source);
  let text = stripMessageControlTags(source).replace(/\[MEMORY_ACTIVE\]/g, '');

  const media: Array<{ type: string; attrs: Record<string, string>; body: string }> = [];
  text = splitByNarrativeMedia(text).map(segment => {
    if (segment.type !== 'media' || !segment.mediaType) return segment.content;
    media.push({ type: segment.mediaType, attrs: segment.attrs || {}, body: curlyQuotes(segment.content) });
    return `\n\n${MEDIA_MARK(media.length - 1)}\n\n`;
  }).join('\n\n');

  if (streaming) {
    const cut = cutUnfinishedTag(text);
    // 标签前面的段落已经写完了
    if (cut.length < text.length) endsClosed = true;
    text = cut;
  } else {
    // 定稿时还没收尾的标签只留下正文，不把标记露给玩家
    text = text
      .replace(/\[MAP_UPDATE[\s\S]*$/, '')
      .replace(/\[(?:#|＃)(?:DOC|COMM|ENV|PSI)[^\]]*\]/g, '')
      .replace(/\[(?:\/|／)\s*(?:#|＃)\s*(?:DOC|COMM|ENV|PSI)\s*\]/g, '')
      .replace(/\[@[^\]:：]+[:：]\s*([^\]]*)$/, '$1');
  }

  const npcLines: Array<{ npcId: string; text: string }> = [];
  text = text.replace(/\[@([^\]:：]+)[:：]\s*([\s\S]*?)\]/g, (_match, npcId: string, line: string) => {
    npcLines.push({ npcId: npcId.trim(), text: curlyQuotes(line.trim()) });
    return `\n\n${NPC_MARK(npcLines.length - 1)}\n\n`;
  });

  // 标题、分隔线和选项留一个占位段落，这样流式时能知道它前面的段落已经写完
  text = text.replace(/^#{1,6}[^\n]*$/gm, `\n\n${STRUCT_MARK}\n\n`).replace(/^[ \t]*-{3,}[ \t]*$/gm, `\n\n${STRUCT_MARK}\n\n`);

  const parsedOptions: ChoiceOption[] = [];
  text = text.replace(/^\s*\d+[.、)）]\s+(.+)$/gm, (_match, body: string) => {
    parsedOptions.push(parseOption(body));
    return `\n\n${STRUCT_MARK}\n\n`;
  });

  let paragraphs = curlyQuotes(text).split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  if (streaming && paragraphs.length && !endsClosed) {
    const last = paragraphs[paragraphs.length - 1];
    if (!last.startsWith('\u0001')) paragraphs.pop();
  }
  paragraphs = paragraphs.filter(part => part !== STRUCT_MARK);

  const blocks: LogBlock[] = [];
  if (intro && briefing) {
    const body = [...briefing.fields, ...briefing.sections].map(entry => entry.value).join('\n');
    blocks.push({ kind: 'media', media: { type: 'DOSSIER', attrs: {}, body, ...briefing } });
  }
  const lineBreak = language === 'en' ? ' ' : '';
  const dossier: string[] = [];
  const flushDossier = () => {
    if (!dossier.length) return;
    blocks.push({ kind: 'media', media: { type: 'DOSSIER', attrs: {}, body: dossier.join('\n'), items: [...dossier] } });
    dossier.length = 0;
  };

  // 要点之间不一定有空行，只换一行时也要拆开
  for (const paragraph of paragraphs.flatMap(part => part.split(/\n(?=[-*]\s+)/))) {
    const mediaMatch = paragraph.match(/^\u0001M(\d+)\u0001$/);
    const npcMatch = paragraph.match(/^\u0001N(\d+)\u0001$/);
    if (/^[-*]\s+/.test(paragraph)) {
      const item = paragraph.replace(/^[-*]\s+/, '').replace(/\n+/g, lineBreak);
      if (!intro) blocks.push({ kind: 'p', text: item });
      // 已有结构化简报时，模型再写一遍也不显示
      else if (!briefing) dossier.push(item);
      continue;
    }
    flushDossier();
    if (mediaMatch) {
      const item = media[Number(mediaMatch[1])];
      if (item.type === 'PSI') blocks.push({ kind: 'psi', text: item.body });
      else blocks.push({ kind: 'media', media: { type: item.type as StageMedia['type'], attrs: item.attrs, body: item.body } });
    } else if (npcMatch) {
      const line = npcLines[Number(npcMatch[1])];
      blocks.push({ kind: 'npc', npcId: line.npcId, text: line.text });
    } else {
      const systemLine = paragraph.match(SYSTEM_LINE);
      if (systemLine) blocks.push({ kind: 'system', text: systemLine[1] });
      else blocks.push({ kind: 'p', text: paragraph.replace(/\n+/g, lineBreak) });
    }
  }
  // 简报块写完才放出来，否则流式时它的条目数还会变
  if (!streaming) flushDossier();

  const beats: Beat[] = [];
  blocks.forEach((block, blockIndex) => {
    const push = (beat: Omit<Beat, 'id' | 'block'>) => beats.push({ ...beat, block: blockIndex, id: `${id}:${beats.length}` });
    if (block.kind === 'p') splitForSubtitle(block.text, NARR_LIMIT, language).forEach(part => push({ kind: 'narr', text: part }));
    else if (block.kind === 'npc') splitForSubtitle(block.text, SPEECH_LIMIT, language).forEach(part => push({ kind: 'npc', text: part, npcId: block.npcId }));
    else if (block.kind === 'psi') splitForSubtitle(block.text, SPEECH_LIMIT, language).forEach(part => push({ kind: 'psi', text: part }));
    else if (block.kind === 'system') push({ kind: 'system', text: block.text });
    else if (block.media.sections) {
      const pages = paginateBriefing({ fields: block.media.fields || [], sections: block.media.sections }, language);
      pages.forEach((page, index) => {
        const body = [...page.fields, ...page.sections].map(entry => entry.value).join('\n');
        const attrs = pages.length > 1 ? { page: `${index + 1}/${pages.length}` } : {};
        push({ kind: 'media', text: body, media: { ...block.media, attrs, body, ...page } });
      });
    } else if (block.media.items) {
      const pages = paginateDossier(block.media.items);
      pages.forEach((items, page) => {
        const body = items.join('\n');
        const attrs = pages.length > 1 ? { page: `${page + 1}/${pages.length}` } : {};
        push({ kind: 'media', text: body, media: { ...block.media, attrs, body, items } });
      });
    } else push({ kind: 'media', text: block.media.body, media: block.media });
  });

  return { beats, blocks, options: parsedOptions };
};

/** 阅读停留时长（毫秒），自动推进和结局前的停顿都用它 */
export const dwellFor = (beat: Pick<Beat, 'kind' | 'text'>, fast = false) => {
  if (fast) return 140;
  if (beat.kind === 'media') return 2600 + visualLength(beat.text) * 45;
  if (beat.kind === 'system') return 900;
  return Math.max(1600, Math.min(6500, 1100 + visualLength(beat.text) * 55));
};

export const isTextBeat = (beat?: Beat) => !!beat && (beat.kind === 'narr' || beat.kind === 'npc' || beat.kind === 'psi');

export const lastTextIndex = (beats: Beat[], from = beats.length - 1) => {
  for (let index = from; index >= 0; index -= 1) {
    if (isTextBeat(beats[index])) return index;
  }
  return -1;
};

/** 把 **粗体** 拆成逐字显示用的片段 */
export const toCharTokens = (text: string): Array<{ ch: string; bold: boolean }> => {
  const tokens: Array<{ ch: string; bold: boolean }> = [];
  let bold = false;
  const marked = text.replace(/\*\*/g, '\u0002');
  for (const ch of marked) {
    if (ch === '\u0002') { bold = !bold; continue; }
    tokens.push({ ch, bold });
  }
  return tokens;
};

/** Players may type only an option's number: show the option it stands for, from the turn that offered it */
export const restoreChoiceNumber = (command: string, offeringTurn: string | undefined, language?: Language) => {
  const trimmed = command.trim();
  if (!offeringTurn || !/^\d+$/.test(trimmed)) return command;
  const picked = parseTurn(offeringTurn, { language }).options[Number(trimmed) - 1];
  return picked ? plainText(picked.fill) : command;
};
