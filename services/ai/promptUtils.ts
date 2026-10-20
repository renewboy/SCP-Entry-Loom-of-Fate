import type { ImageDrawingStyle } from '../../types';
import { getImageStyleDefinition } from './imageStyles';
import type { ImageAspectRatio, ImageStyleKind } from './types';

const CANVAS_ORIENTATIONS: Record<ImageAspectRatio, string> = {
    '1:1': 'square',
    '16:9': 'landscape',
    '3:4': 'portrait',
    '9:16': 'portrait',
};

export const buildImagePrompt = (description: string, kind: ImageStyleKind, style: ImageDrawingStyle, aspectRatio?: ImageAspectRatio): string => {
    const definition = getImageStyleDefinition(style);
    return [
        definition.templates[kind](description),
        aspectRatio && `Output a ${CANVAS_ORIENTATIONS[aspectRatio]} image with a ${aspectRatio} aspect ratio.`,
    ].filter(Boolean).join(' ');
};
