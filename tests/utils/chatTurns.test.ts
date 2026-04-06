import { describe, expect, it } from 'vitest';
import { groupMessagesByTurn } from '../../utils/chatTurns';
import type { Message } from '../../types';

const createMessage = (overrides: Partial<Message> = {}): Message => ({
  id: overrides.id ?? 'msg',
  sender: overrides.sender ?? 'narrator',
  content: overrides.content ?? 'msg',
  timestamp: overrides.timestamp ?? Date.now(),
  turnIndex: overrides.turnIndex ?? 1,
  imageUrl: overrides.imageUrl,
  isTyping: overrides.isTyping,
  stabilitySnapshot: overrides.stabilitySnapshot
});

describe('groupMessagesByTurn', () => {
  it('按 turnIndex 聚合聊天消息', () => {
    const messages: Message[] = [
      createMessage({ id: 'intro', content: 'intro', turnIndex: 0 }),
      createMessage({ id: 'u1', sender: 'user', content: 'action-1', turnIndex: 1 }),
      createMessage({ id: 'n1', sender: 'narrator', content: 'reply-1', turnIndex: 1 }),
      createMessage({ id: 'u2', sender: 'user', content: 'action-2', turnIndex: 2 }),
      createMessage({ id: 'n2', sender: 'narrator', content: 'reply-2', turnIndex: 2 })
    ];

    const grouped = groupMessagesByTurn(messages);

    expect(grouped.preludeMessages.map((msg) => msg.id)).toEqual(['intro']);
    expect(grouped.turns).toHaveLength(2);
    expect(grouped.turns[0]?.turnNumber).toBe(1);
    expect(grouped.turns[0]?.messages.map((msg) => msg.id)).toEqual(['u1', 'n1']);
    expect(grouped.turns[1]?.turnNumber).toBe(2);
    expect(grouped.turns[1]?.messages.map((msg) => msg.id)).toEqual(['u2', 'n2']);
  });

  it('同一回合的多条消息保持顺序', () => {
    const messages: Message[] = [
      createMessage({ id: 'u1', sender: 'user', turnIndex: 3 }),
      createMessage({ id: 'n1', sender: 'narrator', content: 'chunk-1', turnIndex: 3 }),
      createMessage({ id: 'n2', sender: 'narrator', content: 'chunk-2', turnIndex: 3 })
    ];

    const grouped = groupMessagesByTurn(messages);

    expect(grouped.preludeMessages).toHaveLength(0);
    expect(grouped.turns).toHaveLength(1);
    expect(grouped.turns[0]?.messages.map((msg) => msg.id)).toEqual(['u1', 'n1', 'n2']);
  });
});
