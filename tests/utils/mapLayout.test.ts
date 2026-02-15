import { describe, it, expect } from 'vitest';
import { applyLayoutToBlueprint, buildLayout } from '../../utils/mapLayout';
import type { MapBlueprint } from '../../types';

const createBlueprint = (): MapBlueprint => ({
  id: 'map_1',
  title: 'Test Map',
  startNodeId: 'node_a',
  nodes: [
    { id: 'node_a', name: 'A', danger: 10 },
    { id: 'node_b', name: 'B', danger: 20 },
    { id: 'node_c', name: 'C', danger: 30 }
  ],
  edges: [
    { from: 'node_a', to: 'node_b', bidirectional: true },
    { from: 'node_b', to: 'node_c', bidirectional: true }
  ],
  npcs: [],
  objectives: []
});

describe('mapLayout', () => {
  it('buildLayout为节点生成分层与位置', () => {
    const blueprint = createBlueprint();
    const { positionById, levels } = buildLayout(blueprint, { width: 200, height: 200 });

    expect(levels.get(0)).toContain('node_a');
    expect(levels.get(1)).toContain('node_b');
    expect(levels.get(2)).toContain('node_c');

    const posA = positionById.get('node_a');
    const posB = positionById.get('node_b');
    const posC = positionById.get('node_c');

    expect(posA).toBeDefined();
    expect(posB).toBeDefined();
    expect(posC).toBeDefined();
    expect((posB?.x ?? 0) > (posA?.x ?? 0)).toBe(true);
    expect((posC?.x ?? 0) > (posB?.x ?? 0)).toBe(true);
  });

  it('applyLayoutToBlueprint保持已有布局并补齐缺失布局', () => {
    const blueprint = createBlueprint();
    blueprint.nodes[0].layout = { x: 10, y: 20 };

    const updated = applyLayoutToBlueprint(blueprint, { width: 200, height: 200 });
    const nodeA = updated.nodes.find(node => node.id === 'node_a');
    const nodeB = updated.nodes.find(node => node.id === 'node_b');

    expect(nodeA?.layout).toEqual({ x: 10, y: 20 });
    expect(nodeB?.layout).toBeDefined();
    expect(typeof nodeB?.layout?.x).toBe('number');
    expect(typeof nodeB?.layout?.y).toBe('number');
  });
});
