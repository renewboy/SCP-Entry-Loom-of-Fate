import { ItemState, MapBlueprint, MapBlueprintNode, Message } from '../types';
import { visualLength } from './beats';
import { buildLayout } from './mapLayout';

export interface NetworkPoint {
  x: number;
  y: number;
}

/** 大小地图都从左到右排。wide 用于全屏，compact 用于抽屉、手机和小地图，节点更小更紧凑 */
export const NETWORK_GEOMETRY = {
  wide: { gapX: 268, gapY: 300, ring: 24, hit: 50, main: 32, mark: 1, reticle: [33, 24], start: 46, side: [21, 16, 9], face: 13, faceGap: 20, faceAt: [46, -28], bulge: 9, rings: [190, 380, 570], padLeft: 130, padRight: 130, padTop: 120, padBottom: 120, nameGap: 26, dangerGap: 30, lineHeight: 22 },
  compact: { gapX: 100, gapY: 104, ring: 12, hit: 24, main: 17, mark: 0.52, reticle: [18, 12], start: 20, side: [9, 7, 5], face: 7, faceGap: 11, faceAt: [18, -7], bulge: 4, rings: [90, 180, 270], padLeft: 50, padRight: 50, padTop: 50, padBottom: 30, nameGap: 5, dangerGap: 12, lineHeight: 13 },
} as const;

export const buildNetworkLayout = (blueprint: MapBlueprint, compact: boolean): Record<string, NetworkPoint> => {
  const geometry = compact ? NETWORK_GEOMETRY.compact : NETWORK_GEOMETRY.wide;
  const { levels } = buildLayout(blueprint);
  const positions: Record<string, NetworkPoint> = {};
  Array.from(levels.entries()).sort((a, b) => a[0] - b[0]).forEach(([, ids], rank) => {
    ids.forEach((id, index) => {
      positions[id] = { x: rank * geometry.gapX, y: (index - (ids.length - 1) / 2) * geometry.gapY };
    });
  });
  return positions;
};

export const networkCurve = (a: NetworkPoint, b: NetworkPoint, bulge = 0) => {
  const handle = Math.abs(b.x - a.x) < 1 ? 70 : (b.x - a.x) * 0.5;
  return `C ${a.x + handle} ${a.y + bulge}, ${b.x - handle} ${b.y + bulge}, ${b.x} ${b.y}`;
};

/** 紧凑布局的节点间距小，长名字折成两行，优先在空格和括号处断开 */
export const wrapNodeName = (name: string, limit = 7): string[] => {
  if (visualLength(name) <= limit) return [name];
  const chars = Array.from(name);
  const half = visualLength(name) / 2;
  let bestBreak = -1;
  let bestDistance = Infinity;
  chars.forEach((char, index) => {
    if (!index || !/[\s（(·—]/.test(char)) return;
    const at = /\s/.test(char) ? index + 1 : index;
    const distance = Math.abs(visualLength(chars.slice(0, at).join('')) - half);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestBreak = at;
    }
  });
  if (bestBreak < 0 || bestDistance > half * 0.6) {
    let width = 0;
    bestBreak = chars.findIndex(char => {
      width += visualLength(char);
      return width >= half;
    }) + 1;
  }
  return [chars.slice(0, bestBreak).join('').trim(), chars.slice(bestBreak).join('').trim()].filter(Boolean);
};

/**
 * 玩家走过的路线，来自每回合记录的地点。老存档没有这个字段，返回空路线。
 * 中途才开始记录的存档不补起点，免得画出一段没走过的路。
 */
export const buildVisitedRoute = (messages: Message[], startNodeId: string, currentNodeId?: string): string[] => {
  const narrators = messages.filter(message => message.sender === 'narrator');
  const firstRecorded = narrators.findIndex(message => !!message.nodeId);
  if (firstRecorded < 0) return [];
  const route = firstRecorded <= 1 && narrators[firstRecorded].nodeId !== startNodeId ? [startNodeId] : [];
  [...narrators.slice(firstRecorded).map(message => message.nodeId), currentNodeId].forEach(id => {
    if (id && route[route.length - 1] !== id) route.push(id);
  });
  return route.length > 1 ? route : [];
};

/** 来回走过同一条路时，每一趟错开一点，看得出是两股线 */
export const buildRoutePath = (route: string[], positions: Record<string, NetworkPoint>, compact: boolean) => {
  const stops = route.filter(id => positions[id]);
  if (stops.length < 2) return '';
  const bulge = (compact ? NETWORK_GEOMETRY.compact : NETWORK_GEOMETRY.wide).bulge;
  const passes = new Map<string, number>();
  const segments = stops.slice(1).map((id, index) => {
    const from = stops[index];
    const key = [from, id].sort().join('|');
    const count = passes.get(key) || 0;
    passes.set(key, count + 1);
    return networkCurve(positions[from], positions[id], count * bulge * (count % 2 ? 1 : -1));
  });
  const start = positions[stops[0]];
  return `M ${start.x} ${start.y} ${segments.join(' ')}`;
};

export const missingRequirements = (node: MapBlueprintNode | undefined, inventory: ItemState[] = []) => {
  const owned = new Set(inventory.flatMap(item => [item.id, ...(item.tags || [])]));
  return (Array.isArray(node?.requires) ? node.requires : []).filter(token => !owned.has(token));
};

export const neighborsOf = (blueprint: MapBlueprint, nodeId: string) =>
  blueprint.edges
    .filter(edge => edge.from === nodeId || (edge.bidirectional && edge.to === nodeId))
    .map(edge => (edge.from === nodeId ? edge.to : edge.from));

export const dangerColor = (danger: number) => (danger > 70 ? '#ef4444' : danger > 30 ? '#f59e0b' : '#33ff00');
