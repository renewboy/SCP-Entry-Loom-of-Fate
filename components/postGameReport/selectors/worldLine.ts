import { EndingType, type Language, type Message, type SCPData } from '../../../types';
import { type BriefingContent, type ChoiceOption, type LogBlock, parseTurn, plainText } from '../../../utils/beats';
import type { EndingDisplayConfig, PrintableNpc, TimelineEvent, TranslateFn } from '../types';

export const buildStabilityHistory = (messages: Message[]): number[] => {
  const history: number[] = [];

  messages.forEach((message) => {
    if (message.sender !== 'narrator') {
      return;
    }

    if (message.stabilitySnapshot !== undefined) {
      history.push(message.stabilitySnapshot);
      return;
    }

    const match = message.content.match(/\[STABILITY\s*:\s*(\d+)\]/);
    if (match) {
      history.push(Number.parseInt(match[1], 10));
    }
  });

  if (history.length === 0) {
    history.push(100);
  }

  return history;
};

export const buildTimelineEvents = (messages: Message[], briefingText = ''): TimelineEvent[] => {
  const timelineEvents: TimelineEvent[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.sender !== 'narrator') {
      continue;
    }

    const previousMessage = messages[index - 1];
    const trigger = previousMessage?.sender === 'user' ? previousMessage.content : 'INITIAL CONTAINMENT';

    timelineEvents.push({
      trigger,
      response: briefingText && (message.id === 'intro' || message.turnIndex === 0)
        ? `${briefingText}\n\n${message.content}`
        : message.content,
      image: message.imageUrl,
      id: message.id,
      stability: message.stabilitySnapshot,
    });
  }

  return timelineEvents;
};

export interface WorldLineChoice {
  title: string;
  detail: string;
}

export interface WorldLineTurn {
  id: string;
  /** 和复盘里的回合号一致；老存档按全部叙述消息计数，超时重试也占号 */
  turn: number;
  choice: WorldLineChoice | null;
  /** 当时给了但没有选的选项 */
  unchosen: string[];
  stability: number;
  delta: number;
  nodeId?: string;
  image?: string;
  summary: string;
  speakers: string[];
  blocks: LogBlock[];
  inputLength: number;
}

export const isFailedTurn = (message: Message) => {
  const content = message.content.trim();
  return !content || (content.startsWith('⚠️') && message.stabilitySnapshot === undefined);
};

const splitCommand = (command: string): WorldLineChoice => {
  const separator = command.search(/[：:]/);
  if (separator > 0 && separator <= 16) {
    return { title: command.slice(0, separator).trim(), detail: command.slice(separator + 1).trim() };
  }
  return { title: command, detail: '' };
};

/** 玩家可能只输入选项序号，也可能输入选项全文，都还原成选项本身 */
const resolveChoice = (rawCommand: string | null, options: ChoiceOption[]) => {
  if (!rawCommand) return { choice: null, unchosen: [] as string[] };
  const command = rawCommand.trim();
  const index = /^\d+$/.test(command)
    ? Number(command) - 1
    : options.findIndex((option) => command === option.fill || command.startsWith(option.title));
  const picked = options[index];
  return {
    choice: picked
      ? { title: plainText(picked.title), detail: plainText(picked.detail || '').replace(/^[：:]\s*/, '') }
      : splitCommand(command),
    unchosen: options.filter((_, optionIndex) => optionIndex !== index).map((option) => plainText(option.title)),
  };
};

const summarize = (blocks: LogBlock[]) => {
  const first = blocks.find((block) => block.kind === 'p');
  if (!first || first.kind !== 'p') return '';
  const text = plainText(first.text).trim();
  const sentence = text.match(/^[\s\S]{12,}?(?:[。！？!?…]+[」”"）)]*|\.(?=\s|$))/);
  const picked = sentence ? sentence[0] : text;
  return picked.length > 78 ? `${picked.slice(0, 76)}…` : picked;
};

export const buildWorldLineTurns = (
  messages: Message[],
  { language, briefing }: { language?: Language; briefing?: BriefingContent } = {},
): WorldLineTurn[] => {
  const turns: WorldLineTurn[] = [];
  let lastOptions: ChoiceOption[] = [];
  let previousStability = 100;
  let narratorIndex = -1;

  messages.forEach((message, index) => {
    if (message.sender !== 'narrator') return;
    narratorIndex += 1;
    if (isFailedTurn(message)) return;

    const before = messages[index - 1];
    const rawCommand = before?.sender === 'user' ? before.content : null;
    const intro = message.id === 'intro' || message.turnIndex === 0;
    const parsed = parseTurn(message.content, { id: message.id, intro, language, briefing: intro ? briefing : undefined });
    const tagged = message.content.match(/\[STABILITY\s*:\s*(\d+)\]/);
    const stability = message.stabilitySnapshot ?? (tagged ? Number.parseInt(tagged[1], 10) : previousStability);
    const { choice, unchosen } = resolveChoice(rawCommand, lastOptions);

    turns.push({
      id: message.id,
      turn: message.turnIndex ?? narratorIndex,
      choice,
      unchosen,
      stability,
      delta: stability - previousStability,
      nodeId: message.nodeId,
      image: message.imageUrl,
      summary: summarize(parsed.blocks),
      speakers: [...new Set(parsed.blocks.flatMap((block) => (block.kind === 'npc' ? [block.npcId] : [])))],
      blocks: parsed.blocks,
      inputLength: rawCommand ? rawCommand.length : 0,
    });
    previousStability = stability;
    lastOptions = parsed.options;
  });

  return turns;
};

/** 线条的抖动：几条不同频率的正弦叠加，稳定度越低振幅越大 */
export const threadNoise = (position: number, phase = 0) =>
  Math.sin(position * 0.035 + phase) * 0.55
  + Math.sin(position * 0.083 + 1.7 + phase * 1.3) * 0.3
  + Math.sin(position * 0.21 + 0.4 + phase * 0.7) * 0.15;

export const instability = (stability: number) => Math.pow((100 - Math.max(0, Math.min(100, stability))) / 100, 1.5);

export const buildPrintableNpcs = (scpData: SCPData | null): PrintableNpc[] | undefined => {
  return scpData?.mapBlueprint?.npcs.map((npc) => ({
    id: npc.id,
    name: npc.name,
    archetype: npc.archetype,
    nodeId: npc.initialNodeId,
    alive: true,
    secretTags: npc.secretTags,
    dialogueGoals: npc.dialogueGoals,
  }));
};

export const getEndingDisplayConfig = (
  endingType: EndingType,
  t: TranslateFn,
): EndingDisplayConfig => {
  const fallbackTitle = t('endings.unknown.title');
  const fallbackSubtitle = t('endings.unknown.subtitle');
  const typeKey = endingType ?? EndingType.UNKNOWN;

  let title = t(`report.outcome_titles.${typeKey}`);
  let text = t(`report.outcome_texts.${typeKey}`);

  if (!title || title === `report.outcome_titles.${typeKey}`) {
    title = fallbackTitle;
  }

  if (!text || text === `report.outcome_texts.${typeKey}`) {
    text = fallbackSubtitle;
  }

  switch (endingType) {
    case EndingType.CONTAINED:
      return { title, text, color: 'text-scp-term_fix', border: 'border-scp-term_fix', bg: 'bg-green-900/10' };
    case EndingType.DEATH:
      return { title, text, color: 'text-gray-400', border: 'border-gray-500', bg: 'bg-gray-900/10' };
    case EndingType.ESCAPED:
      return { title, text, color: 'text-yellow-500', border: 'border-yellow-500', bg: 'bg-yellow-900/10' };
    case EndingType.COLLAPSE:
    case EndingType.UNKNOWN:
    default:
      return { title, text, color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-900/10' };
  }
};
