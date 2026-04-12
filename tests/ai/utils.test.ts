import { describe, it, expect } from 'vitest';
import {
  extractEnding,
  extractLoc,
  extractMapUpdate,
  extractNarrativeMedia,
  extractStability,
  extractVisualPrompt,
  normalizeAnalyzeScpData,
  safeParseJson
} from '../../services/ai/utils';
import { EndingType } from '../../types';

describe('ai utils', () => {
  it('解析STABILITY并清理标签', () => {
    const { cleanText, newStability } = extractStability('Hello [STABILITY: 85]');
    expect(cleanText).toBe('Hello');
    expect(newStability).toBe(85);
  });

  it('解析ENDING并识别未知类型', () => {
    const known = extractEnding('Done [ENDING: CONTAINED]');
    expect(known.endingType).toBe(EndingType.CONTAINED);

    const unknown = extractEnding('Done [ENDING: WHAT]');
    expect(unknown.endingType).toBe(EndingType.UNKNOWN);
  });

  it('解析VISUAL标签并清理文本', () => {
    const { cleanText, visualPrompt } = extractVisualPrompt('A [VISIBILITY: dark room]');
    expect(cleanText).toBe('A');
    expect(visualPrompt).toBe('dark room');
  });

  it('解析LOC标签并清理文本', () => {
    const { cleanText, locId } = extractLoc('At [LOC: node_alpha]');
    expect(cleanText).toBe('At');
    expect(locId).toBe('node_alpha');
  });

  it('safeParseJson可容错解析尾逗号与```json包裹', () => {
    const parsed = safeParseJson('```json\n{ "a": 1, }\n```');
    expect(parsed).toEqual({ a: 1 });
  });

  it('normalizeAnalyzeScpData会把分析阶段误生成为字符串的数组字段修正为数组', () => {
    const normalized = normalizeAnalyzeScpData({
      designation: 'SCP-XXX',
      name: 'Test',
      containmentClass: 'Safe',
      role: '研究员',
      mapBlueprint: {
        id: 'map_test',
        title: 'Test Map',
        startNodeId: 'node_a',
        nodes: [
          {
            id: 'node_a',
            name: 'A',
            discoverables: '扭曲能量核心',
            interactables: '终端, 门禁面板',
            requires: ['level_2']
          }
        ],
        edges: [],
        npcs: [
          {
            id: 'npc_a',
            name: 'Npc',
            initialNodeId: 'node_a',
            secretTags: 'keycard_alpha',
            dialogueGoals: '稳定局势，隐瞒异常'
          }
        ],
        objectives: [
          {
            id: 'obj_main',
            title: 'Main',
            type: 'MAIN',
            nodeId: 'node_a',
            reward: {
              accessTokens: 'power_restored'
            }
          }
        ]
      }
    });

    expect(normalized.mapBlueprint?.nodes[0].discoverables).toEqual(['扭曲能量核心']);
    expect(normalized.mapBlueprint?.nodes[0].interactables).toEqual(['终端', '门禁面板']);
    expect(normalized.mapBlueprint?.npcs[0].secretTags).toEqual(['keycard_alpha']);
    expect(normalized.mapBlueprint?.npcs[0].dialogueGoals).toEqual(['稳定局势', '隐瞒异常']);
    expect(normalized.mapBlueprint?.objectives[0].reward?.accessTokens).toEqual(['power_restored']);
  });

  it('extractMapUpdate可提取JSON并移除标签', () => {
    const input = 'Hi [MAP_UPDATE: {"addAccessTokens":["k1"]}] tail';
    const { cleanText, update } = extractMapUpdate(input);
    expect(cleanText).not.toContain('[MAP_UPDATE');
    expect(cleanText).toContain('Hi');
    expect(cleanText).toContain('tail');
    expect(update).toEqual({ addAccessTokens: ['k1'] });
  });

  it('extractMapUpdate在JSON不完整时保持原文', () => {
    const input = 'Hi [MAP_UPDATE: {"addAccessTokens": ["k1"]}';
    const { cleanText, update } = extractMapUpdate(input);
    expect(cleanText).toBe(input.trim());
    expect(update).toBeNull();
  });

  it('extractNarrativeMedia兼容部分错误的闭合介质标签', () => {
    const input = '[#COMM: source="Iota-20 频道" time="02:22"]现实浓度跌至45%以下。[/＃COMM]';
    const { cleanText, media } = extractNarrativeMedia(input);

    expect(cleanText).toBe('');
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      type: 'COMM',
      attrs: {
        source: 'Iota-20 频道',
        time: '02:22'
      },
      content: '现实浓度跌至45%以下。'
    });
  });
});
