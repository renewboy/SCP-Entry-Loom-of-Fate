import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AISettings } from '../../types';

const postJsonMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/ai/providers/backendClient', () => ({
  postJson: postJsonMock,
}));

import { testAIConnectivity } from '../../services/aiConnectivityService';

describe('testAIConnectivity', () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    postJsonMock.mockResolvedValue({});
  });

  it('uses the configured Gemini image model when no text route uses Gemini', async () => {
    const settings: AISettings = {
      providers: {
        gemini: {
          apiKey: 'gemini-key',
          baseUrl: 'http://127.0.0.1:8317',
        },
        openai: {
          apiKey: 'openai-key',
          baseUrl: 'https://openai.example.test/v1',
        },
      },
      routes: {
        analysis: { provider: 'openai', model: 'analysis-model' },
        assistant: { provider: 'openai', model: 'assistant-model' },
        narration: { provider: 'openai', model: 'narration-model' },
        image: { provider: 'gemini', model: 'gemini-image-model' },
        embedding: { provider: 'gemini', model: 'gemini-embedding-001' },
      },
    };

    await testAIConnectivity(settings);

    expect(postJsonMock).toHaveBeenCalledWith('/api/ai/gemini/count-tokens', expect.objectContaining({
      apiKey: 'gemini-key',
      baseUrl: 'http://127.0.0.1:8317',
      model: 'gemini-image-model',
    }));
  });
});
