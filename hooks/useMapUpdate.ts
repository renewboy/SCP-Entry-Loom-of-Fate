import { useCallback } from 'react';
import { GameState, ItemState, RuntimeNPCState, ObjectiveState, ObjectiveStatus } from '../types';

export interface MapUpdate {
    addAccessTokens?: string[];
    moveNPCs?: Array<{ id: string; nodeId?: string; alive?: boolean }>;
    updateObjectives?: Array<{ id: string; status?: string; progress?: number }>;
    addObjectives?: Array<ObjectiveState>;
    deleteObjectives?: Array<{ id: string }>;
}

export function useMapUpdate(): (prev: GameState, update: MapUpdate | null | undefined) => GameState {
    const applyMapUpdate = useCallback((prev: GameState, update: MapUpdate | null | undefined): GameState => {
        if (!update || typeof update !== 'object') return prev;

        const next: GameState = { ...prev };
        const runtime = next.map ? { ...next.map } : undefined;
        const inventory = [...(next.inventory || [])] as ItemState[];
        const npcs = [...(next.npcs || [])] as RuntimeNPCState[];
        const objectives = [...(next.objectives || [])] as ObjectiveState[];
        let stability = next.stability;

        const applyReward = (reward?: { accessTokens?: string[]; stabilityDelta?: number }) => {
            if (!reward) return;
            if (Array.isArray(reward.accessTokens)) {
                reward.accessTokens.forEach(id => {
                    if (!inventory.some(i => i.id === id)) inventory.push({ id, name: id });
                });
            }
            if (typeof reward.stabilityDelta === 'number') {
                stability = Math.max(0, Math.min(100, stability + reward.stabilityDelta));
            }
        };

        const addAccessTokens: string[] = Array.isArray(update.addAccessTokens) ? update.addAccessTokens : [];
        addAccessTokens.forEach(id => {
            if (!inventory.some(i => i.id === id)) inventory.push({ id, name: id });
        });

        const npcMoves: Array<{ id: string; nodeId?: string; alive?: boolean }> = Array.isArray(update.moveNPCs) ? update.moveNPCs : [];
        npcMoves.forEach(m => {
            const idx = npcs.findIndex(n => n.id === m.id);
            if (idx === -1) return;
            const current = npcs[idx];
            npcs[idx] = {
                ...current,
                nodeId: typeof m.nodeId === 'string' ? m.nodeId : current.nodeId,
                alive: typeof m.alive === 'boolean' ? m.alive : current.alive
            };
        });

        const objUpdates: any[] = Array.isArray(update.updateObjectives) ? update.updateObjectives : [];
        objUpdates.forEach(u => {
        const idx = objectives.findIndex(o => o.id === u.id);
        if (idx === -1) return;
        const current = objectives[idx];
        const nextStatus = typeof u.status === 'string' ? u.status : current.status;
        const nextReward = u.reward && typeof u.reward === 'object'
            ? { ...current.reward, ...u.reward }
            : current.reward;
        const nextObjective = {
            ...current,
            title: typeof u.title === 'string' ? u.title : current.title,
            detail: typeof u.detail === 'string' ? u.detail : current.detail,
            nodeId: typeof u.nodeId === 'string' ? u.nodeId : current.nodeId,
            type: typeof u.type === 'string' ? u.type : current.type,
            reward: nextReward,
            status: nextStatus,
            progress: typeof u.progress === 'number' ? u.progress : current.progress
        };
        objectives[idx] = nextObjective;
        if (current.status !== 'COMPLETED' && nextStatus === 'COMPLETED') {
            applyReward(nextObjective.reward);
        }
        });

        const addObjectives: any[] = Array.isArray(update.addObjectives) ? update.addObjectives : [];
        addObjectives.forEach(obj => {
        if (!obj || typeof obj.id !== 'string') return;
        if (objectives.some(o => o.id === obj.id)) return;
        objectives.push({
            id: obj.id,
            title: typeof obj.title === 'string' ? obj.title : 'UNKNOWN',
            type: typeof obj.type === 'string' ? obj.type : 'SIDE',
            nodeId: typeof obj.nodeId === 'string' ? obj.nodeId : runtime?.currentNodeId || '',
            status: typeof obj.status === 'string' ? obj.status : 'ACTIVE',
            progress: typeof obj.progress === 'number' ? obj.progress : 0,
            detail: typeof obj.detail === 'string' ? obj.detail : undefined,
            reward: obj.reward && typeof obj.reward === 'object' ? obj.reward : undefined
        });
        });

        const deleteObjectives: Array<{ id: string }> = Array.isArray(update.deleteObjectives) ? update.deleteObjectives : [];
        deleteObjectives.forEach(id => {
        const idx = objectives.findIndex(o => o.id === id.id);
        if (idx !== -1) objectives.splice(idx, 1);
        });

        next.map = runtime;
        next.inventory = inventory;
        next.npcs = npcs;
        next.objectives = objectives;
        next.stability = stability;
        return next;
    }, []);

    return applyMapUpdate;
}
