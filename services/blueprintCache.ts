import { MapBlueprint } from '../types';

let editingBlueprintCache: MapBlueprint | null = null;

export const setEditingBlueprintCache = (blueprint: MapBlueprint | null) => {
    editingBlueprintCache = blueprint ? { ...blueprint } : null;
};

export const getEditingBlueprintCache = () => {
    return editingBlueprintCache;
};

export const clearEditingBlueprintCache = () => {
    editingBlueprintCache = null;
};
