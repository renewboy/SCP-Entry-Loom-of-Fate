import abstractStyle from '../../assets/imageStyles/abstract.webp?inline';
import type { ImageReference } from './types';

export const getImageStyleReference = (): ImageReference => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(abstractStyle);
    if (!match) throw new Error('Invalid abstract image style reference');
    return { mimeType: match[1] as ImageReference['mimeType'], data: match[2] };
};
