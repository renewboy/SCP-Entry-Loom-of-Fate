/**
 * Utility functions for enhancing image generation prompts to ensure consistent style across the game.
 */

/**
 * Enhances a background image prompt with SCP Foundation atmospheric style.
 * @param description The core visual description of the scene
 * @returns The enhanced prompt string
 */
export const enhanceBackgroundPrompt = (description: string): string => {
    return `Atmospheric, cinematic lighting, abstract horror background representing ${description}, gritty film grain texture, scp foundation style, dark moody, shot on 35mm film, raw photograph, desaturated, NOT 3d render, NOT video game, NOT CGI, NOT illustration`;
};

/**
 * Enhances an entity image prompt with SCP Foundation record style.
 * @param description The core visual description of the entity
 * @returns The enhanced prompt string
 */
export const enhanceEntityPrompt = (description: string): string => {
    return `Close up full body shot of ${description}. highly detailed, photorealistic, RAW photo, containment cell, scp foundation record photo, film grain, clinical observation, NOT 3d render, NOT video game, NOT CGI, NOT illustration, no SCP designation numbers, no fictional classification labels`;
};

/**
 * Enhances an NPC image prompt with SCP Foundation portrait style.
 * @param description The core visual description of the NPC
 * @returns The enhanced prompt string
 */
export const enhanceNpcPrompt = (description: string): string => {
    return `${description}, close up portrait, scp foundation record photo, highly detailed, photorealistic, RAW photo, cinematic lighting, dark atmosphere, film grain, cold muted tones, NOT 3d render, NOT video game, NOT CGI, NOT illustration, no SCP designation numbers, no fictional classification labels`;
};

/**
 * Enhances a scene illustration prompt with SCP Foundation cinematic style.
 * @param description The core visual description of the action or event
 * @returns The enhanced prompt string
 */
export const enhanceScenePrompt = (description: string): string => {
    return `${description}, dark aesthetic, scp foundation style, cinematic lighting, photorealistic, RAW photo, film grain, desaturated, NOT 3d render, NOT video game, NOT CGI, NOT illustration`;
};