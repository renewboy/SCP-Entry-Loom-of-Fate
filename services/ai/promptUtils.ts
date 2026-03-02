/**
 * Utility functions for enhancing image generation prompts to ensure consistent style across the game.
 */

/**
 * Enhances a background image prompt with SCP Foundation atmospheric style.
 * @param description The core visual description of the scene
 * @returns The enhanced prompt string
 */
export const enhanceBackgroundPrompt = (description: string): string => {
    return `Atmospheric, cinematic lighting, abstract horror background representing ${description}, subtle, texture, scp foundation style, dark moody`;
};

/**
 * Enhances an entity image prompt with SCP Foundation record style.
 * @param description The core visual description of the entity
 * @returns The enhanced prompt string
 */
export const enhanceEntityPrompt = (description: string): string => {
    return `Close up full body shot of ${description}. detailed, photorealistic, containment cell, scp foundation record photo`;
};

/**
 * Enhances an NPC image prompt with SCP Foundation portrait style.
 * @param description The core visual description of the NPC
 * @returns The enhanced prompt string
 */
export const enhanceNpcPrompt = (description: string): string => {
    return `${description}, close up portrait, scp foundation record photo, detailed, photorealistic, cinematic lighting, dark atmosphere`;
};

/**
 * Enhances a scene illustration prompt with SCP Foundation cinematic style.
 * @param description The core visual description of the action or event
 * @returns The enhanced prompt string
 */
export const enhanceScenePrompt = (description: string): string => {
    return `${description}, dark aesthetic, scp foundation style, cinematic lighting`;
};
