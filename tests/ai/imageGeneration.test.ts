import { describe, expect, it, vi } from 'vitest';
import { buildGeminiImageRequest, generateOpenAIImage } from '../../supabase/functions/api/imageGeneration.js';

const reference = { mimeType: 'image/png', data: 'aW1hZ2U=' };

describe('image generation reference transport', () => {
  it('includes reference pixels beside the prompt in Gemini content', () => {
    expect(buildGeminiImageRequest({ model: 'gemini-image', prompt: 'new subject', aspectRatio: '16:9', referenceImages: [reference] })).toEqual({
      model: 'gemini-image',
      contents: { parts: [{ text: 'new subject' }, { inlineData: reference }] },
      config: { imageConfig: { aspectRatio: '16:9' } },
    });
  });

  it('sends Seedream reference images as data URLs on the generations endpoint', async () => {
    const generate = vi.fn().mockResolvedValue({ data: [] });
    const edit = vi.fn();
    await generateOpenAIImage({ images: { generate, edit } }, {
      apiKey: 'secret', baseUrl: 'https://provider.test', model: 'doubao-seedream-4-5-251128',
      prompt: 'new subject', size: '2048x2048', referenceImages: [reference], extra_body: { watermark: false },
    }, '', vi.fn());
    expect(generate).toHaveBeenCalledWith({ model: 'doubao-seedream-4-5-251128', prompt: 'new subject', size: '2048x2048', watermark: false, image: ['data:image/png;base64,aW1hZ2U='] });
    expect(edit).not.toHaveBeenCalled();
  });

  it('uploads real reference bytes to GPT Image edits and excludes generation-only fields', async () => {
    const generate = vi.fn();
    const edit = vi.fn().mockResolvedValue({ data: [] });
    const file = new File(['image'], 'style.png', { type: 'image/png' });
    const toFile = vi.fn().mockResolvedValue(file);
    await generateOpenAIImage({ images: { generate, edit } }, {
      model: 'gpt-image-2', prompt: 'new subject', size: '2048x2048', response_format: 'b64_json', referenceImages: [reference], extra_body: { watermark: false },
    }, '', toFile);
    expect(toFile.mock.calls[0][0]).toEqual(new Uint8Array([105, 109, 97, 103, 101]));
    expect(edit).toHaveBeenCalledWith({ model: 'gpt-image-2', prompt: 'new subject', size: '2048x2048', image: [file] });
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects malformed references instead of silently dropping them', async () => {
    const generate = vi.fn();
    await expect(generateOpenAIImage({ images: { generate } }, { model: 'gpt-image-2', referenceImages: [{ mimeType: 'image/png', data: '' }] }, '', vi.fn())).rejects.toThrow('Invalid image reference data');
    expect(generate).not.toHaveBeenCalled();
  });
});
