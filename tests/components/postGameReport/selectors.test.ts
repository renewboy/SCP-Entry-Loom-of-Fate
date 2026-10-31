import { describe, expect, it } from 'vitest';
import { EndingType, type LegacyData, type Message } from '../../../types';
import { mergeLegacyData } from '../../../components/postGameReport/selectors/legacy';
import {
  buildStabilityHistory,
  buildTimelineEvents,
  buildWorldLineTurns,
  getEndingDisplayConfig,
  instability,
} from '../../../components/postGameReport/selectors/worldLine';

const messages: Message[] = [
  {
    id: 'intro',
    sender: 'narrator',
    content: 'Containment started. [STABILITY: 95]',
    timestamp: 1,
    turnIndex: 0,
  },
  {
    id: 'u1',
    sender: 'user',
    content: 'Open the blast door.',
    timestamp: 2,
    turnIndex: 1,
  },
  {
    id: 'n1',
    sender: 'narrator',
    content: 'The corridor floods with static.',
    timestamp: 3,
    turnIndex: 1,
    stabilitySnapshot: 63,
  },
];

describe('postGameReport selectors', () => {
  it('构建稳定度历史时优先使用 snapshot，缺失时回退到标签解析', () => {
    expect(buildStabilityHistory(messages)).toEqual([95, 63]);
    expect(buildStabilityHistory([])).toEqual([100]);
  });

  it('开局卡片带上结构化简报，其他回合不带', () => {
    const events = buildTimelineEvents(messages, '- **目标**：SCP-173');
    expect(events[0].response).toBe('- **目标**：SCP-173\n\nContainment started. [STABILITY: 95]');
    expect(events[1].response).not.toContain('SCP-173');
  });

  it('从消息流构建世界线时间轴事件', () => {
    expect(buildTimelineEvents(messages)).toEqual([
      {
        id: 'intro',
        trigger: 'INITIAL CONTAINMENT',
        response: 'Containment started. [STABILITY: 95]',
        image: undefined,
        stability: undefined,
      },
      {
        id: 'n1',
        trigger: 'Open the blast door.',
        response: 'The corridor floods with static.',
        image: undefined,
        stability: 63,
      },
    ]);
  });

  it('根据结局生成展示配置并在缺失翻译时回退', () => {
    const translations: Record<string, string> = {
      'endings.unknown.title': 'Unknown Title',
      'endings.unknown.subtitle': 'Unknown Subtitle',
      [`report.outcome_titles.${EndingType.CONTAINED}`]: 'Contained',
      [`report.outcome_texts.${EndingType.CONTAINED}`]: 'Facility secured',
    };
    const t = (key: string) => translations[key] || key;

    expect(getEndingDisplayConfig(EndingType.CONTAINED, t)).toMatchObject({
      title: 'Contained',
      text: 'Facility secured',
      color: 'text-scp-term_fix',
    });

    expect(getEndingDisplayConfig(EndingType.UNKNOWN, t)).toMatchObject({
      title: 'Unknown Title',
      text: 'Unknown Subtitle',
      color: 'text-red-500',
    });
  });

  it('合并 Legacy 数据时按名称去重并累加 runCount', () => {
    const current: LegacyData = {
      traits: [
        { id: 't1', name: 'Veteran', description: 'old', effectType: 'POSITIVE', icon: 'V' },
      ],
      items: [
        { id: 'i1', name: 'Keycard', description: 'old', icon: 'K' },
      ],
      echoes: [],
      runCount: 2,
    };

    const merged = mergeLegacyData(current, {
      traits: [
        { id: 't2', name: 'Veteran', description: 'new', effectType: 'POSITIVE', icon: 'N' },
        { id: 't3', name: 'Cold Blood', description: 'desc', effectType: 'NEUTRAL', icon: 'C' },
      ],
      items: [
        { id: 'i2', name: 'Keycard', description: 'new', icon: 'N' },
        { id: 'i3', name: 'Anchor', description: 'desc', icon: 'A' },
      ],
      echoes: [{ id: 'e1', title: 'Echo', summary: 'summary', endingType: EndingType.ESCAPED, timestamp: 1, roleName: 'MTF' }],
    });

    expect(merged.traits?.map((trait) => trait.name)).toEqual(['Veteran', 'Cold Blood']);
    expect(merged.items?.map((item) => item.name)).toEqual(['Keycard', 'Anchor']);
    expect(merged.runCount).toBe(3);
    expect(merged.echoes).toHaveLength(1);
  });

  describe('buildWorldLineTurns', () => {
    const narrator = (id: string, content: string, extra: Partial<Message> = {}): Message =>
      ({ id, sender: 'narrator', content, timestamp: 0, ...extra } as Message);
    const user = (id: string, content: string): Message => ({ id, sender: 'user', content, timestamp: 0 } as Message);

    const options = '正文。\n\n1. **冲进去**：不管不顾\n2. **撤退**：先离开';

    it('跳过超时和空消息，回合号仍按全部叙述消息计数，和复盘一致', () => {
      const turns = buildWorldLineTurns([
        narrator('intro', '开场。', { stabilitySnapshot: 100 }),
        user('u1', '前往 观察点'),
        narrator('t1', '⚠️ [连接超时] 响应时间过长。'),
        user('u2', '前往 观察点'),
        narrator('t2', ''),
        user('u3', '前往 观察点'),
        narrator('n1', '你到了。', { stabilitySnapshot: 90 }),
      ]);
      expect(turns.map(turn => turn.id)).toEqual(['intro', 'n1']);
      expect(turns[1].turn).toBe(3);
    });

    it('新存档直接用消息上的回合号', () => {
      const turns = buildWorldLineTurns([narrator('intro', '开场。', { turnIndex: 0 }), user('u', '走'), narrator('n', '好。', { turnIndex: 7 })]);
      expect(turns[1].turn).toBe(7);
    });

    it('序号指令还原成上一回合的选项，其余选项记为没走的路', () => {
      const [, turn] = buildWorldLineTurns([narrator('intro', options), user('u', '2'), narrator('n', '你撤退了。')]);
      expect(turn.choice).toEqual({ title: '撤退', detail: '先离开' });
      expect(turn.unchosen).toEqual(['冲进去']);
    });

    it('选项全文也能对应到选项', () => {
      const [, turn] = buildWorldLineTurns([narrator('intro', options), user('u', '冲进去：不管不顾'), narrator('n', '好。')]);
      expect(turn.choice?.title).toBe('冲进去');
      expect(turn.unchosen).toEqual(['撤退']);
    });

    it('自由输入保留原文，所有选项都算没走的路', () => {
      const [, turn] = buildWorldLineTurns([narrator('intro', options), user('u', '我点燃了档案架'), narrator('n', '火光四起。')]);
      expect(turn.choice).toEqual({ title: '我点燃了档案架', detail: '' });
      expect(turn.unchosen).toEqual(['冲进去', '撤退']);
    });

    it('序号超出选项范围时按自由输入处理', () => {
      const [, turn] = buildWorldLineTurns([narrator('intro', options), user('u', '9'), narrator('n', '好。')]);
      expect(turn.choice?.title).toBe('9');
      expect(turn.unchosen).toEqual(['冲进去', '撤退']);
    });

    it('计算稳定度变化，缺快照时读标签或沿用上一回合', () => {
      const turns = buildWorldLineTurns([
        narrator('intro', '开场。', { stabilitySnapshot: 100 }),
        narrator('a', '一。[STABILITY: 90]'),
        narrator('b', '二。'),
        narrator('c', '三。', { stabilitySnapshot: 70 }),
      ]);
      expect(turns.map(turn => [turn.stability, turn.delta])).toEqual([[100, 0], [90, -10], [90, 0], [70, -20]]);
    });

    it('正文不带控制标签和选项，记录说话的人', () => {
      const [turn] = buildWorldLineTurns([narrator('n', '[LOC: node_a]\n\n你穿过长廊到了这间屋子里。还有别的。\n\n[@npc_a: 站住]\n\n[@npc_a: 别动]\n\n1. **走**\n\n[STABILITY: 80]\n[MAP_UPDATE: {}]', { turnIndex: 2 })]);
      const text = JSON.stringify(turn.blocks);
      expect(text).not.toMatch(/\[LOC|\[STABILITY|\[MAP_UPDATE|\[@/);
      expect(text).not.toContain('走');
      expect(turn.speakers).toEqual(['npc_a']);
      expect(turn.summary).toBe('你穿过长廊到了这间屋子里。');
    });

    it('开局回合带上结构化简报', () => {
      const briefing = { fields: [{ label: '目标', value: 'SCP-1' }], sections: [] };
      const [turn] = buildWorldLineTurns([narrator('intro', '---\n开场。', { turnIndex: 0 })], { briefing });
      expect(turn.choice).toBeNull();
      expect(turn.blocks[0].kind).toBe('media');
    });
  });

  it('稳定度越低线抖得越厉害', () => {
    expect(instability(100)).toBe(0);
    expect(instability(50)).toBeLessThan(instability(10));
    expect(instability(0)).toBe(1);
    expect(instability(-20)).toBe(1);
  });
});
