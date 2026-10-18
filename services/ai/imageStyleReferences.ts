import background from '../../assets/imageStyles/background.webp?inline';
import entity from '../../assets/imageStyles/entity.webp?inline';
import npc from '../../assets/imageStyles/npc.webp?inline';
import scene from '../../assets/imageStyles/scene.webp?inline';
import type { ImageReference, ImageStyleKind } from './types';

const references: Record<ImageStyleKind, string> = { background, entity, npc, scene };

export const getImageStyleReference = (kind: ImageStyleKind): ImageReference => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(references[kind]);
    if (!match) throw new Error(`Invalid image style reference: ${kind}`);
    return { mimeType: match[1] as ImageReference['mimeType'], data: match[2] };
};
