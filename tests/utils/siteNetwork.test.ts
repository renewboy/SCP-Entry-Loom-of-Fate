import { describe, expect, it } from 'vitest';
import type { MapBlueprint, Message } from '../../types';
import {
  buildNetworkLayout,
  buildRoutePath,
  buildVisitedRoute,
  dangerColor,
  missingRequirements,
  neighborsOf,
  networkCurve,
  wrapNodeName,
} from '../../utils/siteNetwork';

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
