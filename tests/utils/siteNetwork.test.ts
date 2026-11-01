import { describe, expect, it } from 'vitest';
import type { MapBlueprint, Message } from '../../types';
import { NETWORK_GEOMETRY, buildNetworkLayout, buildRoutePath, buildVisitedRoute, clearManualLayout, dangerColor, fitNetworkView, missingRequirements, neighborsOf, networkCurve, pinNetworkLayout, wrapNodeName } from '../../utils/siteNetwork';

const blueprint: MapBlueprint = {
  id: 'map',
  title: 'Site',
  startNodeId: 'a',
  nodes: [
    { id: 'a', name: 'A', danger: 10 },
    { id: 'b', name: 'B', danger: 40 },
    { id: 'c', name: 'C', danger: 60, requires: ['key'] },
    { id: 'd', name: 'D', danger: 90, requires: ['key', 'tag:hazmat'] },
  ],
  edges: [
    { from: 'a', to: 'b', bidirectional: true },
    { from: 'a', to: 'c', bidirectional: true },
    { from: 'c', to: 'd', bidirectional: false },
  ],
  npcs: [],
  objectives: [],
};

const narrator = (id: string, nodeId?: string): Message => ({ id, sender: 'narrator', content: id, timestamp: 0, turnIndex: 0, nodeId });

describe('siteNetwork', () => {
  it('全屏和抽屉都从左到右排，抽屉更紧凑', () => {
    const wide = buildNetworkLayout(blueprint, false);
    const compact = buildNetworkLayout(blueprint, true);
    [wide, compact].forEach(positions => {
      expect(positions.a.x).toBeLessThan(positions.b.x);
      expect(positions.b.x).toBe(positions.c.x);
      expect(positions.b.y).not.toBe(positions.c.y);
      expect(positions.c.x).toBeLessThan(positions.d.x);
    });
    expect(compact.b.x - compact.a.x).toBeLessThan(wide.b.x - wide.a.x);
  });

  it('长名字折成两行，优先在括号和空格处断开', () => {
    expect(wrapNodeName('荒漠掩体入口')).toEqual(['荒漠掩体入口']);
    expect(wrapNodeName('人员宿舍区（废弃）')).toEqual(['人员宿舍区', '（废弃）']);
    expect(wrapNodeName('反模因工程实验室')).toEqual(['反模因工', '程实验室']);
    expect(wrapNodeName('Antimemetic Engineering Lab')).toEqual(['Antimemetic', 'Engineering Lab']);
    expect(wrapNodeName('Decon Bay')).toEqual(['Decon Bay']);
    expect(wrapNodeName('Site-5作战指挥中心')).toEqual(['Site-5作战', '指挥中心']);
  });

  it('老存档没有逐回合地点，路线为空', () => {
    expect(buildVisitedRoute([narrator('intro'), narrator('n1')], 'a', 'c')).toEqual([]);
  });

  it('按回合记录的地点还原路线，连续重复的地点只算一次', () => {
    const messages = [narrator('intro', 'a'), narrator('n1', 'b'), narrator('n2', 'b'), narrator('n3', 'a')];
    expect(buildVisitedRoute(messages, 'a', 'c')).toEqual(['a', 'b', 'a', 'c']);
  });

  it('开局没有记录地点时从起点开始', () => {
    expect(buildVisitedRoute([narrator('intro'), narrator('n1', 'b')], 'a', 'b')).toEqual(['a', 'b']);
  });

  it('中途才开始记录的老存档不补起点', () => {
    const messages = [narrator('intro'), narrator('n1'), narrator('n2'), narrator('n3', 'c'), narrator('n4', 'd')];
    expect(buildVisitedRoute(messages, 'a', 'd')).toEqual(['c', 'd']);
  });

  it('只到过一个地点时没有线可画', () => {
    expect(buildVisitedRoute([narrator('intro', 'a')], 'a', 'a')).toEqual([]);
  });

  it('来回走同一条路时，两趟的线错开', () => {
    const positions = buildNetworkLayout(blueprint, false);
    const once = buildRoutePath(['a', 'b'], positions, false);
    const twice = buildRoutePath(['a', 'b', 'a'], positions, false);
    expect(once).toBe(`M ${positions.a.x} ${positions.a.y} ${networkCurve(positions.a, positions.b)}`);
    expect(twice).toContain(networkCurve(positions.b, positions.a, 9));
    expect(twice).not.toContain(networkCurve(positions.b, positions.a));
    expect(buildRoutePath(['a'], positions, false)).toBe('');
  });

  it('门禁同时认物品 id 和标签', () => {
    const node = blueprint.nodes[3];
    expect(missingRequirements(node, [])).toEqual(['key', 'tag:hazmat']);
    expect(missingRequirements(node, [{ id: 'key', name: 'Key' }])).toEqual(['tag:hazmat']);
    expect(missingRequirements(node, [{ id: 'key', name: 'Key' }, { id: 'suit', name: 'Suit', tags: ['tag:hazmat'] }])).toEqual([]);
    expect(missingRequirements(blueprint.nodes[0], [])).toEqual([]);
  });

  it('相邻关系遵守单向边', () => {
    expect(neighborsOf(blueprint, 'c')).toEqual(['a', 'd']);
    expect(neighborsOf(blueprint, 'd')).toEqual([]);
  });

  it('危险度颜色分三档', () => {
    expect(dangerColor(30)).toBe('#33ff00');
    expect(dangerColor(70)).toBe('#f59e0b');
    expect(dangerColor(71)).toBe('#ef4444');
  });
});

describe('手动布局', () => {
  const blueprint = {
    id: 'm',
    title: 'M',
    startNodeId: 'a',
    nodes: [{ id: 'a', name: 'A', danger: 0 }, { id: 'b', name: 'B', danger: 0 }],
    edges: [{ from: 'a', to: 'b', bidirectional: true }],
    npcs: [],
    objectives: [],
  };

  it('没拖过的地图忽略节点上的 layout，继续自动排布', () => {
    const withLayout = { ...blueprint, nodes: blueprint.nodes.map(node => ({ ...node, layout: { x: 900, y: 900 } })) };
    expect(buildNetworkLayout(withLayout, false)).toEqual(buildNetworkLayout(blueprint, false));
  });

  it('拖动后所有节点都固定下来，只有被拖的节点变位置', () => {
    const auto = buildNetworkLayout(blueprint, false);
    const pinned = pinNetworkLayout(blueprint, { b: { x: 40, y: 500 } });
    expect(pinned.manualLayout).toBe(true);
    expect(buildNetworkLayout(pinned, false)).toEqual({ a: auto.a, b: { x: 40, y: 500 } });
  });

  it('小地图按间距比例缩小手动位置', () => {
    const pinned = pinNetworkLayout(blueprint, { b: { x: 268, y: 300 } });
    const { gapX, gapY } = NETWORK_GEOMETRY.compact;
    expect(buildNetworkLayout(pinned, true).b).toEqual({ x: gapX, y: gapY });
  });

  it('手动布局下新节点没有 layout 时落在自动位置', () => {
    const pinned = pinNetworkLayout(blueprint, {});
    const withNew = { ...pinned, nodes: [...pinned.nodes, { id: 'c', name: 'C', danger: 0 }], edges: [...pinned.edges, { from: 'b', to: 'c', bidirectional: true }] };
    expect(buildNetworkLayout(withNew, false).c).toEqual(buildNetworkLayout({ ...blueprint, nodes: withNew.nodes, edges: withNew.edges }, false).c);
  });

  it('恢复自动排布后清掉标记和位置', () => {
    const restored = clearManualLayout(pinNetworkLayout(blueprint, { b: { x: 1, y: 2 } }));
    expect(restored.manualLayout).toBeUndefined();
    expect(restored.nodes.every(node => !node.layout)).toBe(true);
    expect(buildNetworkLayout(restored, false)).toEqual(buildNetworkLayout(blueprint, false));
  });
});

describe('fitNetworkView', () => {
  it('没有节点或容器没有尺寸时不给视图', () => {
    expect(fitNetworkView({}, 800, 600)).toBeNull();
    expect(fitNetworkView({ a: { x: 0, y: 0 } }, 0, 600)).toBeNull();
  });

  it('整张图都落在容器里', () => {
    const view = fitNetworkView({ a: { x: 0, y: 0 }, b: { x: 1000, y: 400 } }, 800, 600)!;
    expect(view.k).toBeLessThan(1);
    expect(0 * view.k + view.x).toBeGreaterThan(0);
    expect(1000 * view.k + view.x).toBeLessThan(800);
  });
});
