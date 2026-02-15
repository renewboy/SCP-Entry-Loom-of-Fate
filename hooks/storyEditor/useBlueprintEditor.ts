import { useState } from 'react';
import { MapBlueprint, MapBlueprintNode, MapBlueprintEdge, MapBlueprintNPC, MapBlueprintObjective } from '../../types';
import { useHistory } from './useHistory';

export const useBlueprintEditor = (initialBlueprint: MapBlueprint) => {
    const { state: blueprintState, setState: setBlueprint, undo, redo, canUndo, canRedo } = useHistory<MapBlueprint>(initialBlueprint);
    const blueprint = blueprintState || initialBlueprint;
    const [selection, setSelection] = useState<{ type: 'node' | 'edge' | 'npc' | 'objective', id: string } | null>(null);

    const updateNode = (id: string, updates: Partial<MapBlueprintNode>) => {
        setBlueprint(prev => {
            if (updates.id && updates.id !== id) {
                const newId = updates.id;
                if (selection?.type === 'node' && selection.id === id) {
                    setSelection(s => s ? { ...s, id: newId } : null);
                }
                return {
                    ...prev,
                    nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
                    edges: prev.edges.map(e => ({
                        ...e,
                        from: e.from === id ? newId : e.from,
                        to: e.to === id ? newId : e.to
                    })),
                    npcs: prev.npcs.map(n => ({
                        ...n,
                        initialNodeId: n.initialNodeId === id ? newId : n.initialNodeId
                    })),
                    objectives: prev.objectives.map(o => ({
                        ...o,
                        nodeId: o.nodeId === id ? newId : o.nodeId
                    })),
                    startNodeId: prev.startNodeId === id ? newId : prev.startNodeId
                };
            }
            return {
                ...prev,
                nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
            };
        });
    };

    const updateEdge = (from: string, to: string, updates: Partial<MapBlueprintEdge>) => {
        setBlueprint(prev => ({
            ...prev,
            edges: prev.edges.map(e => (e.from === from && e.to === to) ? { ...e, ...updates } : e)
        }));
    };

    const updateNPC = (id: string, updates: Partial<MapBlueprintNPC>) => {
        setBlueprint(prev => {
            if (updates.id && updates.id !== id) {
                if (selection?.type === 'npc' && selection.id === id) {
                    setSelection(s => s ? { ...s, id: updates.id! } : null);
                }
            }
            return {
                ...prev,
                npcs: prev.npcs.map(n => n.id === id ? { ...n, ...updates } : n)
            };
        });
    };

    const updateObjective = (id: string, updates: Partial<MapBlueprintObjective>) => {
        setBlueprint(prev => {
            if (updates.id && updates.id !== id) {
                if (selection?.type === 'objective' && selection.id === id) {
                    setSelection(s => s ? { ...s, id: updates.id! } : null);
                }
            }
            return {
                ...prev,
                objectives: prev.objectives.map(o => o.id === id ? { ...o, ...updates } : o)
            };
        });
    };

    const addNode = () => {
        const id = `node_${Math.floor(Math.random() * 900) + 100}`;
        const newNode: MapBlueprintNode = {
            id,
            name: 'New Node',
            danger: 0,
            layout: { x: 100, y: 100 }
        };
        setBlueprint(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
        setSelection({ type: 'node', id });
    };

    const addEdge = (from: string, to: string) => {
        const exists = blueprint.edges.some(e => 
            (e.from === from && e.to === to) || (e.bidirectional && e.from === to && e.to === from)
        );
        if (exists) return;

        setBlueprint(prev => ({
            ...prev,
            edges: [...prev.edges, { from, to, bidirectional: true }]
        }));
    };

    const addNPC = () => {
        const id = `npc_${Math.floor(Math.random() * 900) + 100}`;
        const targetNodeId = (selection?.type === 'node' && selection.id) ? selection.id : blueprint.startNodeId;
        const newNPC: MapBlueprintNPC = {
            id,
            name: 'New NPC',
            archetype: 'Researcher',
            initialNodeId: targetNodeId
        };
        setBlueprint(prev => ({ ...prev, npcs: [...prev.npcs, newNPC] }));
        setSelection({ type: 'npc', id });
    };

    const addObjective = () => {
        const id = `obj_${Math.floor(Math.random() * 900) + 100}`;
        const targetNodeId = (selection?.type === 'node' && selection.id) ? selection.id : blueprint.startNodeId;
        const newObj: MapBlueprintObjective = {
            id,
            title: 'New Objective',
            type: 'MAIN',
            nodeId: targetNodeId
        };
        setBlueprint(prev => ({ ...prev, objectives: [...prev.objectives, newObj] }));
        setSelection({ type: 'objective', id });
    };

    const handleDeleteSelection = () => {
        if (!selection) return;

        if (selection.type === 'node') {
            setBlueprint(prev => ({
                ...prev,
                nodes: prev.nodes.filter(n => n.id !== selection.id),
                edges: prev.edges.filter(e => e.from !== selection.id && e.to !== selection.id),
                npcs: prev.npcs.filter(n => n.initialNodeId !== selection.id),
                objectives: prev.objectives.filter(o => o.nodeId !== selection.id)
            }));
        } else if (selection.type === 'edge') {
            const [from, to] = selection.id.split('-');
            setBlueprint(prev => ({
                ...prev,
                edges: prev.edges.filter(e => !(e.from === from && e.to === to))
            }));
        } else if (selection.type === 'npc') {
            setBlueprint(prev => ({ ...prev, npcs: prev.npcs.filter(n => n.id !== selection.id) }));
        } else if (selection.type === 'objective') {
            setBlueprint(prev => ({ ...prev, objectives: prev.objectives.filter(o => o.id !== selection.id) }));
        }
        setSelection(null);
    };

    return {
        blueprint,
        setBlueprint,
        undo,
        redo,
        canUndo,
        canRedo,
        selection,
        setSelection,
        updateNode,
        updateEdge,
        updateNPC,
        updateObjective,
        addNode,
        addEdge,
        addNPC,
        addObjective,
        handleDeleteSelection
    };
};
