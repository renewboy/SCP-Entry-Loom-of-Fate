import { Message } from '../types';

export interface ChatTurn {
  turnNumber: number;
  anchorId: string;
  messages: Message[];
}

export interface GroupedChatTurns {
  preludeMessages: Message[];
  turns: ChatTurn[];
}

export const groupMessagesByTurn = (messages: Message[]): GroupedChatTurns => {
  const preludeMessages: Message[] = [];
  const turns: ChatTurn[] = [];
  const turnMap = new Map<number, ChatTurn>();

  const getOrCreateTurn = (turnNumber: number): ChatTurn => {
    let turn = turnMap.get(turnNumber);
    if (!turn) {
      turn = {
        turnNumber,
        anchorId: `turn-${turnNumber}`,
        messages: []
      };
      turnMap.set(turnNumber, turn);
      turns.push(turn);
    }
    return turn;
  };

  for (const message of messages) {
    if (message.turnIndex <= 0) {
      preludeMessages.push(message);
      continue;
    }

    getOrCreateTurn(message.turnIndex).messages.push(message);
  }

  return { preludeMessages, turns };
};
