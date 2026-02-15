import { describe, it, expect } from 'vitest';
import {
  extractEnding,
  extractLoc,
  extractMapUpdate,
  extractStability,
  extractVisualPrompt,
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
});
