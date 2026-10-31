import { describe, expect, it } from 'vitest';
import type { Message, RuntimeNPCState } from '../../types';
import { buildNpcDossiers } from '../../utils/npcDossier';

const npc = (id: string, name: string, nodeId: string, alive = true): RuntimeNPCState => ({ id, name, archetype: 'x', nodeId, alive });

const npcs = [npc('npc_a', '甲', 'n1'), npc('npc_b', '乙', 'n2'), npc('npc_c', '丙', 'n3', false)];

const turn = (id: string, content: string, turnIndex?: number, isTyping = false): Message =>
  ({ id, sender: 'narrator', content, timestamp: 0, turnIndex, isTyping } as Message);

describe('buildNpcDossiers', () => {
  it('说过话的人算接触过，并按回合记录台词', () => {
    const [a, b] = buildNpcDossiers([turn('t1', '[@npc_a: 第一句]', 3), turn('t2', '叙述。\n\n[@npc_a: 第二句]', 4)], npcs);
    expect(a.met).toBe(true);
    expect(a.quotes).toEqual([{ turn: 3, text: '第一句' }, { turn: 4, text: '第二句' }]);
    expect(b.met).toBe(false);
    expect(b.quotes).toEqual([]);
  });

  it('模型用姓名代替 id 时也能对应', () => {
    const [a] = buildNpcDossiers([turn('t1', '[@甲: 是我]', 1)], npcs);
    expect(a.quotes).toHaveLength(1);
  });

  it('老存档没有回合号时按叙述消息的顺序计数', () => {
    const [a] = buildNpcDossiers([turn('intro', '开场。'), turn('t1', '[@npc_a: 你好]')], npcs);
    expect(a.quotes[0].turn).toBe(1);
  });

  it('和玩家在同一区域的活人算接触过，死人不算', () => {
    const [, b, c] = buildNpcDossiers([], npcs, { currentNodeId: 'n2' });
    expect(b.met).toBe(true);
    expect(c.met).toBe(false);
    expect(buildNpcDossiers([], npcs, { currentNodeId: 'n3' })[2].met).toBe(false);
  });

  it('正在阅读的回合和还在生成的回合不计入', () => {
    const messages = [turn('t1', '[@npc_a: 读过]', 1), turn('t2', '[@npc_b: 没读]', 2), turn('t3', '[@npc_b: 生成中]', 3, true)];
    const [a, b] = buildNpcDossiers(messages, npcs, { skipMessageId: 't2' });
    expect(a.met).toBe(true);
    expect(b.met).toBe(false);
  });
});
