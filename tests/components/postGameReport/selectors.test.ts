import { describe, expect, it } from 'vitest';
import { EndingType, type LegacyData, type Message } from '../../../types';
import { mergeLegacyData } from '../../../components/postGameReport/selectors/legacy';
import {
  buildStabilityHistory,
  buildTimelineEvents,
  getEndingDisplayConfig,
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
});
