import { useCallback } from 'react';
import { GameState } from '../types';

export function useMapContext(gameState: GameState): (enhanced?: boolean) => string {
    const buildMapContext = useCallback((enhanced: boolean = false): string => {
        const blueprint = gameState.scpData?.mapBlueprint;
        const runtime = gameState.map;
        if (!blueprint || !runtime) return '';

        const currentNode = blueprint.nodes.find(n => n.id === runtime.currentNodeId);
        const inventoryIds = new Set((gameState.inventory || []).map(i => i.id));
        const inventoryTags = new Set((gameState.inventory || []).flatMap(i => i.tags || []));
        const hasToken = (token: string) =>
            inventoryIds.has(token) || inventoryTags.has(token);

        const edges = blueprint.edges.filter(e =>
            e.from === runtime.currentNodeId || (e.bidirectional && e.to === runtime.currentNodeId)
        );

        const neighbors = edges.map(e => {
            const neighborId = e.from === runtime.currentNodeId ? e.to : e.from;
            const neighbor = blueprint.nodes.find(n => n.id === neighborId);
            const req = Array.isArray(neighbor?.requires) ? neighbor?.requires : [];
            const missing = req.filter(token => !hasToken(token));
            const blocked = missing.length > 0;
            const reason = blocked ? (neighbor?.blockedText || `缺少通行token:${missing.join(',')}`) : '';
            return {
                id: neighborId,
                name: neighbor?.name || neighborId,
                blocked,
                reason: reason || neighbor?.blockedText || ''
            };
        });

        const npcsHere = (gameState.npcs || []).filter(n => n.alive && n.nodeId === runtime.currentNodeId);
        const allNpcs = gameState.npcs || [];
        const currentObj = (gameState.objectives || []).find(o => o.nodeId === runtime.currentNodeId);
        const allObjectives = gameState.objectives || [];
        const lines: string[] = [];
        lines.push(`当前位置: ${currentNode?.name || runtime.currentNodeId} (${runtime.currentNodeId})`);
        if (currentNode) lines.push(`危险度: ${currentNode.danger}/100`);
        if (currentNode?.discoverables?.length) lines.push(`可发现物品: ${currentNode.discoverables.join(', ')}`);
        if (currentNode?.interactables?.length) lines.push(`可互动物品: ${currentNode.interactables.join(', ')}`);
        if (neighbors.length) {
            lines.push(`可达邻接地点:`);
            neighbors.forEach(n => lines.push(`- ${n.name} (${n.id})${n.blocked ? ` [门禁: ${n.reason || '阻挡'}]` : ''}`));
        }
        if ((gameState.inventory || []).length) lines.push(`已持有: ${(gameState.inventory || []).map(i => i.id).join(', ')}`);
        if (npcsHere.length) lines.push(`同地点NPC: ${npcsHere.map(n => `${n.name}(${n.id}), 对话目标: ${n.dialogueGoals}, 秘密标签: ${n.secretTags?.join(',') || '无'}`).join(', ')}`);
        if (currentObj) {
            const progressText = `${Math.max(0, Math.min(100, Math.round(currentObj.progress)))}%`;
            lines.push(`当前地点任务: ${currentObj.title}；进度: ${progressText}`);
            if (!enhanced && currentObj.detail) lines.push(`任务详情: ${currentObj.detail}`);
        }

        if (enhanced && allObjectives.length) {
            const otherObjectives = allObjectives.filter(obj => obj.nodeId !== runtime.currentNodeId);
            if (otherObjectives.length) {
                lines.push(`其他任务总览:`);
                otherObjectives.forEach(obj => {
                const progressText = `${Math.max(0, Math.min(100, Math.round(obj.progress)))}%`;
                lines.push(`- ${obj.title} (${obj.id})；状态: ${obj.status}；进度: ${progressText}`);
                });
            }
        }

        if (enhanced && allNpcs.length) {
            const otherNpcs = allNpcs.filter(n => n.nodeId !== runtime.currentNodeId);
            if (otherNpcs.length) {
                lines.push(`其他NPC总览:`);
                otherNpcs.forEach(n => {
                lines.push(`- ${n.name}(${n.id}) @ ${n.nodeId}；状态: ${n.alive ? '存活' : '死亡'}`);
                });
            }
        }

        lines.push(`规则: 若行动涉及移动，移动成功时输出[LOC: node_id]。`);
        return lines.join('\n');
    }, [gameState]);

    return buildMapContext;
}
