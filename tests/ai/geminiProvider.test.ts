import { beforeEach, describe, expect, it, vi } from 'vitest';

const postJsonMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/ai/providers/backendClient', () => ({
  postJson: postJsonMock,
  streamSse: vi.fn(),
}));

import { GeminiProvider } from '../../services/ai/providers/geminiProvider';

describe('GeminiProvider', () => {
  beforeEach(() => {
    postJsonMock.mockReset();
  });

  it('passes the provider base URL to image generation requests', async () => {
    postJsonMock.mockResolvedValue({
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              mimeType: 'image/png',
              data: 'aW1hZ2U=',
            },
          }],
        },
      }],
    });

    const provider = new GeminiProvider({
      apiKey: 'gemini-key',
      baseUrl: 'https://gemini.example.test',
      chatModel: 'gemini-text',
      imageModel: 'gemini-image',
    });

    await expect(provider.generateImage('draw it')).resolves.toBe('data:image/png;base64,aW1hZ2U=');
    expect(postJsonMock).toHaveBeenCalledWith('/api/ai/gemini/generate-image', expect.objectContaining({
      apiKey: 'gemini-key',
      baseUrl: 'https://gemini.example.test',
      model: 'gemini-image',
    }));
  });
});
