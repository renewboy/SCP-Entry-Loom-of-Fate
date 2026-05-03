import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadGlobalSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/indexedDBService', () => ({
  loadGlobalSettings: loadGlobalSettingsMock,
}));

vi.mock('../../services/ai/providers/backendClient', () => ({
  getRequestHeaders: vi.fn().mockResolvedValue({}),
}));

describe('aiConfigService', () => {
  beforeEach(async () => {
    vi.resetModules();
    loadGlobalSettingsMock.mockReset();
    loadGlobalSettingsMock.mockResolvedValue({});
  });

  it('creates default model-route settings', async () => {
    const { getDefaultAISettings } = await import('../../services/aiConfigService');
    const settings = getDefaultAISettings();

    expect(settings.routes.analysis.model).toBeTruthy();
    expect(settings.routes.assistant.model).toBeTruthy();
    expect(settings.routes.narration.model).toBeTruthy();
    expect(settings.routes.image.model).toBeTruthy();
    expect(settings.routes.embedding).toEqual({
      provider: 'gemini',
      model: 'gemini-embedding-001',
    });
  });

  it('resolves provider credentials and route model', async () => {
    loadGlobalSettingsMock.mockResolvedValue({
      aiSettings: {
        providers: {
          gemini: { apiKey: 'gemini-key' },
          openai: { apiKey: 'openai-key', baseUrl: 'https://api.example.test/v1' },
        },
        routes: {
          analysis: { provider: 'openai', model: 'analysis-model' },
          assistant: { provider: 'openai', model: 'assistant-model' },
          narration: { provider: 'gemini', model: 'narration-model' },
          image: { provider: 'openai', model: 'image-model' },
          embedding: { provider: 'gemini', model: 'gemini-embedding-001' },
        },
      },
    });

    const { resolveAIModelConfig } = await import('../../services/aiConfigService');
    await expect(resolveAIModelConfig('analysis')).resolves.toMatchObject({
      provider: 'openai',
      apiKey: 'openai-key',
      baseUrl: 'https://api.example.test/v1',
      model: 'analysis-model',
    });
    await expect(resolveAIModelConfig('narration')).resolves.toMatchObject({
      provider: 'gemini',
      apiKey: 'gemini-key',
      model: 'narration-model',
    });
    await expect(resolveAIModelConfig('assistant')).resolves.toMatchObject({
      provider: 'openai',
      apiKey: 'openai-key',
      baseUrl: 'https://api.example.test/v1',
      model: 'assistant-model',
    });
  });

  it('validates only providers referenced by routes', async () => {
    const { getDefaultAISettings, validateAISettings } = await import('../../services/aiConfigService');
    const settings = getDefaultAISettings();
    settings.providers.gemini.apiKey = 'gemini-key';

    expect(validateAISettings(settings).valid).toBe(true);

    settings.routes.analysis = { provider: 'openai', model: 'analysis-model' };
    const validation = validateAISettings(settings);
    expect(validation.valid).toBe(false);
    expect(validation.missingFields).toContain('providers.openai.apiKey');
    expect(validation.missingFields).toContain('providers.openai.baseUrl');
  });
});
