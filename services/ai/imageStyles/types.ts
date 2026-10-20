import type { ImageReference, ImageStyleKind } from '../types';

export interface ImageStyleDefinition {
    labelKey: string;
    templates: Record<ImageStyleKind, (description: string) => string>;
    loadReferences: () => Promise<ImageReference[]>;
}
