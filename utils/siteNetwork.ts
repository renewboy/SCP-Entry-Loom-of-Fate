import { ItemState, MapBlueprint, MapBlueprintNode, Message } from '../types';
import { buildLayout } from './mapLayout';

export interface NetworkPoint {
  x: number;
  y: number;
}

/** wide 用于全屏，从左到右排，标签在节点上下；tall 用于抽屉和手机，从上到下排，标签在节点右侧 */
export const NETWORK_GEOMETRY = {
  wide: { gapX: 268, gapY: 300, ring: 24, hit: 50, main: 32, mark: 1, reticle: [33, 24], start: 46, side: [21, 16, 9], face: 13, bulge: 9, rings: [190, 380, 570], padLeft: 130, padRight: 130, padY: 120 },
  tall: { gapX: 160, gapY: 62, ring: 14, hit: 30, main: 19, mark: 0.6, reticle: [20, 14], start: 26, side: [11, 9, 6], face: 8, bulge: 5, rings: [95, 190, 285], padLeft: 34, padRight: 150, padY: 26 },
} as const;

export const buildNetworkLayout = (blueprint: MapBlueprint, tall: boolean): Record<string, NetworkPoint> => {
  const geometry = tall ? NETWORK_GEOMETRY.tall : NETWORK_GEOMETRY.wide;
  const { levels } = buildLayout(blueprint);
  const positions: Record<string, NetworkPoint> = {};
  Array.from(levels.entries()).sort((a, b) => a[0] - b[0]).forEach(([, ids], rank) => {
    ids.forEach((id, index) => {
      const offset = index - (ids.length - 1) / 2;
      positions[id] = tall
        ? { x: offset * geometry.gapX, y: rank * geometry.gapY }
        : { x: rank * geometry.gapX, y: offset * geometry.gapY };
    });
  });
  return positions;
};

export const networkCurve = (a: NetworkPoint, b: NetworkPoint, tall: boolean, bulge = 0) => {
  if (tall) {
    const handle = Math.abs(b.y - a.y) < 1 ? 40 : (b.y - a.y) * 0.5;
    return `C ${a.x + bulge} ${a.y + handle}, ${b.x + bulge} ${b.y - handle}, ${b.x} ${b.y}`;
  }
  const handle = Math.abs(b.x - a.x) < 1 ? 70 : (b.x - a.x) * 0.5;
  return `C ${a.x + handle} ${a.y + bulge}, ${b.x - handle} ${b.y + bulge}, ${b.x} ${b.y}`;
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
export const buildRoutePath = (route: string[], positions: Record<string, NetworkPoint>, tall: boolean) => {
  const stops = route.filter(id => positions[id]);
  if (stops.length < 2) return '';
  const bulge = (tall ? NETWORK_GEOMETRY.tall : NETWORK_GEOMETRY.wide).bulge;
  const passes = new Map<string, number>();
  const segments = stops.slice(1).map((id, index) => {
    const from = stops[index];
    const key = [from, id].sort().join('|');
    const count = passes.get(key) || 0;
    passes.set(key, count + 1);
    return networkCurve(positions[from], positions[id], tall, count * bulge * (count % 2 ? 1 : -1));
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
