import { EndingType, type Message, type SCPData } from '../../../types';
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

export const buildTimelineEvents = (messages: Message[]): TimelineEvent[] => {
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
      response: message.content,
      image: message.imageUrl,
      id: message.id,
      stability: message.stabilitySnapshot,
    });
  }

  return timelineEvents;
};

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
