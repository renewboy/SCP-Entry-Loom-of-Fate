import type { ImageDrawingStyle } from '../../types';
import type { ImageStyleKind } from './types';

/** Drawing treatment used by the paper-cut style. */
const NARRATIVE_ILLUSTRATION_STYLE = [
    'A refined flat 2D illustrated story-PV still matching the supplied drawings, delicate silhouette-based paper-cut and printed-collage aesthetics with elegant hand-drawn anime proportions',
    'interlocking flat illustrated shapes with crisp slender edges, long flowing tapered silhouettes and fine locally colored contours; the paper-cut quality comes from shape design and overlapping picture planes',
    'hair formed from broad tapered ribbon shapes, cloth from sweeping angular panels, adult faces with slender angular profiles and economical precise features, architecture and scenery composed of simplified silhouette layers',
    'large matte flat painted areas, two or three graphic value planes per form, restrained flat highlights, sparse soft painted transitions',
    'fine closely spaced parallel hatching following the shape, delicate printed-paper grain inside selected areas, tiny dry-brush marks; smooth flat shapes remain dominant',
    'foreground, middle distance and background separated through overlapping silhouettes, simplified distant shapes and restrained atmospheric softness',
    'light drawn as composed flat value shapes and translucent painted veils',
    'Preserve the described SCP subjects, anatomy, clothing, equipment and setting; the reference defines drawing technique only',
    'Use supplied reference images for silhouette-based paper-cut drawing, fine contour work, planar shading, delicate parallel hatching and layered illustrated space only; create the described new subject and framing, with its own palette and lighting',
    'Choose palette, saturation, light color and overall tone from the described materials, scene light sources and narrative mood; preserve explicitly described colors',
    'Apply the drawing treatment even when the subject description contains a different rendering style',
    'No visible paper thickness, raised cutout edges, bevels, cast shadows between physical paper sheets, cardboard craft, paper sculpture or diorama, photography, realistic material modeling, 3D or CGI rendering, glossy reflections, rounded cartoon faces, heavy airbrush rendering, impasto, all-over distressed texture, grunge or film grain',
    'Physical wear only where explicitly described on the subject; no text, labels, logos or watermarks'
].join('. ');

/**
 * Builds an atmospheric SCP background prompt in the selected drawing style.
 * @param description The core visual description of the scene
 * @returns The enhanced prompt string
 */
export const enhanceBackgroundPrompt = (description: string, style: ImageDrawingStyle = 'original'): string => {
    if (style === 'original') {
        return `Atmospheric, cinematic lighting, abstract horror background representing ${description}, gritty film grain texture, scp foundation style, clinical, dark moody, shot on 35mm film, raw photograph, desaturated, NOT 3d render, NOT video game, NOT CGI, NOT illustration`;
    }
    return `${NARRATIVE_ILLUSTRATION_STYLE}. Background subject: ${description}. Atmospheric SCP Foundation backdrop, simplified environmental or abstract material shapes, negative space and unobtrusive detail suitable for a game backdrop. Render every part with the drawing treatment above.`;
};

/**
 * Builds an SCP entity prompt in the selected drawing style.
 * @param description The core visual description of the entity
 * @returns The enhanced prompt string
 */
export const enhanceEntityPrompt = (description: string, style: ImageDrawingStyle = 'original'): string => {
    if (style === 'original') {
        return `Close up full body shot of ${description}. highly detailed, photorealistic, RAW photo, containment cell, scp foundation record photo, film grain, clinical observation, NOT 3d render, NOT video game, NOT CGI, NOT illustration, no SCP designation numbers, no fictional classification labels`;
    }
    return `${NARRATIVE_ILLUSTRATION_STYLE}. Entity subject: ${description}. Full-body or complete-object composition, readable silhouette and distinctive anomalous features, restrained containment setting appropriate to the entity. Preserve unsettling or nonhuman anatomy. Render every part with the drawing treatment above.`;
};

/**
 * Builds an SCP character portrait prompt in the selected drawing style.
 * @param description The core visual description of the NPC
 * @returns The enhanced prompt string
 */
export const enhanceNpcPrompt = (description: string, style: ImageDrawingStyle = 'original'): string => {
    if (style === 'original') {
        return `${description}, close up portrait, scp foundation record photo, highly detailed, photorealistic, RAW photo, cinematic lighting, dark atmosphere, film grain, cold muted tones, NOT 3d render, NOT video game, NOT CGI, NOT illustration, no SCP designation numbers, no fictional classification labels`;
    }
    return `${NARRATIVE_ILLUSTRATION_STYLE}. Character subject: ${description}. Close-up portrait, expressive economical facial linework and delicate angular profiles, sculpted hair and clothing shapes, recognizable identity and story-appropriate equipment, simple supporting background. Render every part with the drawing treatment above.`;
};

/**
 * Builds a narrative scene prompt in the selected drawing style.
 * @param description The core visual description of the action or event
 * @returns The enhanced prompt string
 */
export const enhanceScenePrompt = (description: string, style: ImageDrawingStyle = 'original'): string => {
    if (style === 'original') {
        return `${description}, dark aesthetic, scp foundation style, cinematic lighting, photorealistic, RAW photo, film grain, clinical, desaturated, NOT 3d render, NOT video game, NOT CGI, NOT illustration`;
    }
    return `${NARRATIVE_ILLUSTRATION_STYLE}. Scene subject: ${description}. SCP Foundation narrative keyframe, deliberate cinematic framing, clear focal action and character gestures, environmental tension grounded in the described event. Render every part with the drawing treatment above.`;
};

const promptBuilders = {
    background: enhanceBackgroundPrompt,
    entity: enhanceEntityPrompt,
    npc: enhanceNpcPrompt,
    scene: enhanceScenePrompt,
};

export const buildImagePrompt = (description: string, kind: ImageStyleKind, style: ImageDrawingStyle): string =>
    promptBuilders[kind](description, style);
