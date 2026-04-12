import { describe, expect, it } from 'vitest';
import type { RuntimeNPCState } from '../../types';
import { stripMessageControlTags, toReadableMessageText } from '../../utils/messageContent';

const npcs: RuntimeNPCState[] = [
  {
    id: 'npc_doctor',
    name: 'Dr. Ada',
    archetype: 'Scientist',
    nodeId: 'lab',
    alive: true
  }
];

describe('messageContent utils', () => {
  it('只移除控制标签，保留叙事介质与 NPC 标签供后续渲染', () => {
    const content = [
      '你听到门后传来金属摩擦声。',
      '[#DOC: title="值班记录"]记录残页[/#DOC]',
      '[@npc_doctor: 不要开门。]',
      '[VISUAL: dark corridor]',
      '[STABILITY: 82]',
      '[ENDING: DEATH]',
      '[LOC: node_lab]'
    ].join('\n');

    const cleaned = stripMessageControlTags(content);

    expect(cleaned).toContain('[#DOC: title="值班记录"]记录残页[/#DOC]');
    expect(cleaned).toContain('[@npc_doctor: 不要开门。]');
    expect(cleaned).not.toContain('[VISUAL: dark corridor]');
    expect(cleaned).not.toContain('[STABILITY: 82]');
    expect(cleaned).not.toContain('[ENDING: DEATH]');
    expect(cleaned).not.toContain('[LOC: node_lab]');
  });

  it('将特殊块提炼为可读摘要文本', () => {
    const content = [
      '你在桌上翻到一页纸。',
      '[#DOC: title="值班记录"]凌晨三点，门外有人敲击。[/#DOC]',
      '[@npc_doctor: 先退后，别碰门把手。]',
      '[MAP_UPDATE: {"inventoryAdded":[{"id":"keycard"}]}]',
      '[STABILITY: 77]'
    ].join('\n\n');

    const readable = toReadableMessageText(content, npcs);

    expect(readable).toContain('值班记录');
    expect(readable).toContain('凌晨三点，门外有人敲击。');
    expect(readable).toContain('Dr. Ada: 先退后，别碰门把手。');
    expect(readable).not.toContain('[MAP_UPDATE');
    expect(readable).not.toContain('[STABILITY: 77]');
  });

  it('兼容部分错误的介质闭合标签并保留可读内容', () => {
    const content = [
      '警报短暂静默。',
      '[#COMM: source="Iota-20 频道" time="02:22"]现实浓度跌至45%以下。[/＃COMM]',
      '[STABILITY: 45]'
    ].join('\n\n');

    const readable = toReadableMessageText(content, npcs);

    expect(readable).toContain('Iota-20 频道 02:22');
    expect(readable).toContain('现实浓度跌至45%以下。');
    expect(readable).not.toContain('[/＃COMM]');
    expect(readable).not.toContain('[STABILITY: 45]');
  });
});
