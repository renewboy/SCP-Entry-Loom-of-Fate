import type { ImageStyleDefinition } from './types';

const NARRATIVE_PRINT_STYLE = [
    'Flat 2D narrative print illustration with flowing tapered contours, interlocking angular planes and stylized hand-drawn forms',
    'Use matte color blocks, two or three value planes, fine engraving-like parallel hatching and subtle printed-paper grain. Create depth through overlapping silhouettes and simplified distant layers',
    'The abstract reference supplies linework, texture and shading only. Do not copy its shapes, layout or grayscale palette into the subject',
    'The current subject description takes priority: follow its character appearance, clothing, equipment, colors and lighting. Invent unspecified details to suit that subject without borrowing reference content',
    'No photorealism, 3D, physical paper thickness, glossy reflections, heavy paint, grunge, text, labels, logos or watermarks',
].join('. ');

export const narrativePrintStyle: ImageStyleDefinition = {
    labelKey: 'settings.image_style_narrative_print',
    templates: {
        background: description => `${NARRATIVE_PRINT_STYLE}. Background subject: ${description}. Atmospheric SCP Foundation backdrop, simplified environmental or abstract material shapes, negative space and unobtrusive detail.`,
        entity: description => `${NARRATIVE_PRINT_STYLE}. Entity subject: ${description}. Full-body or complete-object composition, readable silhouette and distinctive anomalous features, restrained containment setting appropriate to the described entity. Preserve unsettling or nonhuman anatomy.`,
        npc: description => `${NARRATIVE_PRINT_STYLE}. Character subject: ${description}. Close-up portrait, expressive economical facial linework and delicate angular profiles, sculpted hair and clothing shapes, the described appearance and equipment, simple supporting background.`,
        scene: description => `${NARRATIVE_PRINT_STYLE}. Scene subject: ${description}. SCP Foundation narrative keyframe, deliberate cinematic framing, clear focal action and character gestures, environmental tension grounded in the described event.`,
    },
    loadReferences: async () => {
        const { getImageStyleReference } = await import('../imageStyleReferences');
        return [getImageStyleReference()];
    },
};
