import { SCPData } from '../types';

let editingStoryCache: SCPData | null = null;

export const setEditingStoryCache = (data: SCPData | null) => {
    editingStoryCache = data ? { ...data } : null;
};

export const getEditingStoryCache = () => {
    return editingStoryCache;
};

export const clearEditingStoryCache = () => {
    editingStoryCache = null;
};
