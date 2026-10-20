import type { ImageStyleDefinition } from './types';

const GOTHIC_INK_STYLE = [
    'hand-drawn 2D illustration',
    'clean tapering dark ink contours, simplified graphic silhouettes and sparse expressive interior strokes',
    'matte flat color fields, one or two graphic shadow planes per form, soft painted ambient gradients and diffuse glow',
    'crisp subject linework, soft tonal separation of distant forms, quiet eerie melancholy',
    'apply the drawing technique to the supplied subject only, without invented characters or scenery',
    'NOT photography, NOT 3d render, NOT CGI, no text, labels, logos or watermarks',
].join(', ');

const GOTHIC_CHARACTER_STYLE = 'compact stylized character shapes, gently enlarged simple head shapes, existing facial features reduced to plain dark oval eyes and very few ink marks, preserve the described anatomy and identifying features';

export const gothicInkStyle: ImageStyleDefinition = {
    labelKey: 'settings.image_style_gothic_ink',
    templates: {
        background: description => `Atmospheric, cinematic lighting, abstract horror background representing ${description}, scp foundation style, clinical, dark moody, desaturated, ${GOTHIC_INK_STYLE}, environmental and material forms only, no people or creatures`,
        entity: description => `Close up full body shot of ${description}. scp foundation style, scp foundation record illustration, clinical observation, cold muted tones, ${GOTHIC_INK_STYLE}, ${GOTHIC_CHARACTER_STYLE}, no SCP designation numbers, no fictional classification labels`,
        npc: description => `${description}, close up portrait, scp foundation style, scp foundation record illustration, cinematic lighting, dark atmosphere, cold muted tones, ${GOTHIC_INK_STYLE}, ${GOTHIC_CHARACTER_STYLE}, no SCP designation numbers, no fictional classification labels`,
        scene: description => `${description}, dark aesthetic, scp foundation style, cinematic lighting, clinical, desaturated, ${GOTHIC_INK_STYLE}, simplify the anatomy and facial marks of any described characters without adding participants`,
    },
    loadReferences: async () => [],
};
