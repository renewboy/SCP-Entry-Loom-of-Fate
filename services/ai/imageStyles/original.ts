import type { ImageStyleDefinition } from './types';

export const originalStyle: ImageStyleDefinition = {
    labelKey: 'settings.image_style_original',
    templates: {
        background: description => `Atmospheric, cinematic lighting, abstract horror background representing ${description}, gritty film grain texture, scp foundation style, clinical, dark moody, shot on 35mm film, raw photograph, desaturated, NOT 3d render, NOT video game, NOT CGI, NOT illustration`,
        entity: description => `Close up full body shot of ${description}. highly detailed, photorealistic, RAW photo, containment cell, scp foundation record photo, film grain, clinical observation, NOT 3d render, NOT video game, NOT CGI, NOT illustration, no SCP designation numbers, no fictional classification labels`,
        npc: description => `${description}, close up portrait, scp foundation record photo, highly detailed, photorealistic, RAW photo, cinematic lighting, dark atmosphere, film grain, cold muted tones, NOT 3d render, NOT video game, NOT CGI, NOT illustration, no SCP designation numbers, no fictional classification labels`,
        scene: description => `${description}, dark aesthetic, scp foundation style, cinematic lighting, photorealistic, RAW photo, film grain, clinical, desaturated, NOT 3d render, NOT video game, NOT CGI, NOT illustration`,
    },
    loadReferences: async () => [],
};
