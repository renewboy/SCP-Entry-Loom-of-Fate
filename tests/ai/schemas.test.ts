import { describe, expect, it } from 'vitest';
import { repairAnalyzeScpData, validateAnalyzeScpData } from '../../services/ai/schemas';
import { normalizeAnalyzeScpData } from '../../services/ai/utils';

describe('analyze SCP schema validation', () => {
  it('原始分析结果数组字段为字符串时先校验失败，修复后通过', () => {
    const rawScpData = {
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
            requires: 'level_2'
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
    };

    const beforeRepair = validateAnalyzeScpData(rawScpData);
    expect(beforeRepair.valid).toBe(false);
    expect(beforeRepair.errors.length).toBeGreaterThan(0);

    const repairedScpData = normalizeAnalyzeScpData(rawScpData);
    const afterRepair = validateAnalyzeScpData(repairedScpData);
    expect(afterRepair).toEqual({ valid: true, errors: [] });
  });

  it('repairAnalyzeScpData可供开始流程与编辑器导入共享复用', () => {
    const rawScpData = {
      designation: 'SCP-YYY',
      name: 'Test',
      containmentClass: 'Euclid',
      role: '特工',
      mapBlueprint: {
        id: 'map_test',
        title: 'Test Map',
        startNodeId: 'node_a',
        nodes: [{ id: 'node_a', name: 'A', discoverables: '异常样本' }],
        edges: [],
        npcs: [],
        objectives: []
      }
    };

    const result = repairAnalyzeScpData(rawScpData);
    expect(result.valid).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.initialErrors.length).toBeGreaterThan(0);
    expect(result.finalErrors).toEqual([]);
    expect(result.data.mapBlueprint?.nodes[0].discoverables).toEqual(['异常样本']);
  });
});
