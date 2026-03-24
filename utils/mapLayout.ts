import { MapBlueprint } from '../types';

type LayoutOptions = {
    width?: number;
    height?: number;
    paddingX?: number;
    paddingY?: number;
    useExistingLayout?: boolean;
};

export const buildLayout = (blueprint: MapBlueprint, options: LayoutOptions = {}) => {
    const width = options.width ?? 200;
    const height = options.height ?? 200;
    const paddingX = options.paddingX ?? 24;
    const paddingY = options.paddingY ?? 24;
    const useExistingLayout = options.useExistingLayout ?? true;

    const nodes = blueprint.nodes;
    const adjacency = new Map<string, Set<string>>();
    nodes.forEach(node => adjacency.set(node.id, new Set()));
    blueprint.edges.forEach(edge => {
        adjacency.get(edge.from)?.add(edge.to);
        if (edge.bidirectional) adjacency.get(edge.to)?.add(edge.from);
    });

    const startId = blueprint.startNodeId;
    const levelById = new Map<string, number>();
    const queue: string[] = [];
    if (startId && adjacency.has(startId)) {
        levelById.set(startId, 0);
        queue.push(startId);
    } else if (nodes.length > 0) {
        levelById.set(nodes[0].id, 0);
        queue.push(nodes[0].id);
    }

    while (queue.length) {
        const current = queue.shift() as string;
        const level = levelById.get(current) ?? 0;
        const neighbors = Array.from(adjacency.get(current) || []);
        neighbors.forEach(next => {
            if (!levelById.has(next)) {
                levelById.set(next, level + 1);
                queue.push(next);
            }
        });
    }

    let maxLevel = 0;
    levelById.forEach(value => {
        if (value > maxLevel) maxLevel = value;
    });
    const fallbackLevel = maxLevel + 1;

    const levels = new Map<number, string[]>();
    nodes.forEach(node => {
        const level = levelById.get(node.id) ?? fallbackLevel;
        if (!levels.has(level)) levels.set(level, []);
        levels.get(level)?.push(node.id);
    });

    const levelCount = Math.max(1, levels.size);
    const levelGap = levelCount > 1 ? (width - paddingX * 2) / (levelCount - 1) : 0;

    const positionById = new Map<string, { x: number; y: number }>();
    Array.from(levels.entries()).sort((a, b) => a[0] - b[0]).forEach(([level, ids]) => {
        const count = ids.length;
        const gap = count > 1 ? (height - paddingY * 2) / (count - 1) : 0;
        ids.forEach((id, index) => {
            const x = paddingX + levelGap * level;
            const y = paddingY + (count > 1 ? gap * index : (height - paddingY * 2) / 2);
            positionById.set(id, { x, y });
        });
    });

    if (useExistingLayout) {
        nodes.forEach(node => {
            if (node.layout) {
                positionById.set(node.id, { x: node.layout.x, y: node.layout.y });
            }
        });
    }

    return { positionById, levels };
};

export const applyLayoutToBlueprint = (blueprint: MapBlueprint, options: LayoutOptions = {}) => {
    const useExisting = options.useExistingLayout ?? true;
    const allHaveLayout = blueprint.nodes.every(node => !!node.layout);
    if (allHaveLayout && useExisting) return blueprint;
    const { positionById } = buildLayout(blueprint, options);
    return {
        ...blueprint,
        nodes: blueprint.nodes.map(node => ({
            ...node,
            layout: positionById.get(node.id) || node.layout || { x: 0, y: 0 }
        }))
    };
};
