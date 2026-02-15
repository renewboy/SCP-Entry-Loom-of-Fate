import { useCallback } from 'react';
import { GameState, ItemState, RuntimeNPCState, ObjectiveState, ObjectiveStatus } from '../types';

export interface MapUpdate {
    addAccessTokens?: string[];
    moveNPCs?: Array<{ id: string; nodeId?: string; alive?: boolean }>;
    objectives?: Array<{ id: string; status?: string; progress?: number }>;
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

        const objUpdates: Array<{ id: string; status?: string; progress?: number }> = Array.isArray(update.objectives) ? update.objectives : [];
        objUpdates.forEach(u => {
            const idx = objectives.findIndex(o => o.id === u.id);
            if (idx === -1) return;
            const current = objectives[idx];
            const nextStatus = (typeof u.status === 'string' ? u.status : current.status) as ObjectiveStatus;
            objectives[idx] = {
                ...current,
                status: nextStatus,
                progress: typeof u.progress === 'number' ? u.progress : current.progress
            };
            if (current.status !== 'COMPLETED' && nextStatus === 'COMPLETED') {
                applyReward(current.reward);
            }
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
