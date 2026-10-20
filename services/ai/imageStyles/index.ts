import type { ImageDrawingStyle } from '../../../types';
import { gothicInkStyle } from './gothicInk';
import { narrativePrintStyle } from './narrativePrint';
import { originalStyle } from './original';
import type { ImageStyleDefinition } from './types';

export const DEFAULT_IMAGE_DRAWING_STYLE: ImageDrawingStyle = 'original';

export const IMAGE_DRAWING_STYLES = {
    original: originalStyle,
    'narrative-print': narrativePrintStyle,
    'gothic-ink': gothicInkStyle,
} satisfies Record<ImageDrawingStyle, ImageStyleDefinition>;

export const IMAGE_DRAWING_STYLE_OPTIONS = Object.entries(IMAGE_DRAWING_STYLES).map(([value, style]) => ({
    value: value as ImageDrawingStyle,
    labelKey: style.labelKey,
}));

const savedStyleIds = new Map<unknown, ImageDrawingStyle>([
    ...IMAGE_DRAWING_STYLE_OPTIONS.map(({ value }) => [value, value] as const),
    ['paper-cut', 'narrative-print'],
]);

export const normalizeImageDrawingStyle = (value: unknown): ImageDrawingStyle =>
    savedStyleIds.get(value) ?? DEFAULT_IMAGE_DRAWING_STYLE;

export const getImageStyleDefinition = (value: unknown): ImageStyleDefinition =>
    IMAGE_DRAWING_STYLES[normalizeImageDrawingStyle(value)];
