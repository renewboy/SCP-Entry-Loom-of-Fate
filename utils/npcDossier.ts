import { Language, Message, RuntimeNPCState } from '../types';
import { parseTurn } from './beats';

export interface NpcQuote {
  turn: number;
  text: string;
}

export interface NpcDossier {
  npc: RuntimeNPCState;
  /** 说过话，或者此刻和玩家在同一个区域 */
  met: boolean;
  quotes: NpcQuote[];
}

interface DossierOptions {
  currentNodeId?: string;
  language?: Language;
  /** 正在阅读的回合，读完之前不算数，免得提前剧透 */
  skipMessageId?: string;
}

export const buildNpcDossiers = (
  messages: Message[],
  npcs: RuntimeNPCState[],
  { currentNodeId, language, skipMessageId }: DossierOptions = {},
): NpcDossier[] => {
  const quotes = new Map<string, NpcQuote[]>(npcs.map(npc => [npc.id, []]));
  const idOf = new Map<string, string>(npcs.flatMap(npc => [[npc.id, npc.id], [npc.name, npc.id]] as Array<[string, string]>));
  let narratorIndex = -1;
  messages.forEach(message => {
    if (message.sender !== 'narrator') return;
    narratorIndex += 1;
    if (message.id === skipMessageId || message.isTyping) return;
    const { blocks } = parseTurn(message.content, { id: message.id, intro: message.id === 'intro', language });
    blocks.forEach(block => {
      if (block.kind !== 'npc') return;
      const id = idOf.get(block.npcId);
      if (id) quotes.get(id)?.push({ turn: message.turnIndex ?? narratorIndex, text: block.text });
    });
  });
  return npcs.map(npc => {
    const lines = quotes.get(npc.id) || [];
    return { npc, quotes: lines, met: lines.length > 0 || (npc.alive && !!currentNodeId && npc.nodeId === currentNodeId) };
  });
};
