import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateImageMock, getReferenceMock, loadSettingsMock } = vi.hoisted(() => ({
  generateImageMock: vi.fn(),
  getReferenceMock: vi.fn(),
  loadSettingsMock: vi.fn(),
}));
vi.mock('../../services/ai/providerRouter', () => ({ getImageProvider: vi.fn(async () => ({ generateImage: generateImageMock })) }));
vi.mock('../../services/ai/imageStyleReferences', () => ({ getImageStyleReference: getReferenceMock }));
vi.mock('../../services/ai/providers/embeddingProvider', () => ({ getEmbeddings: vi.fn() }));
vi.mock('../../services/indexedDBService', () => ({ hasLocalMemories: vi.fn(), searchLocalMemories: vi.fn(), loadGlobalSettings: loadSettingsMock }));
vi.mock('../../services/ragStaging', () => ({ hasStagedRagMemories: vi.fn(), searchStagedRagMemories: vi.fn() }));
import { generateImage } from '../../services/aiService';

describe('image style routing', () => {
  beforeEach(() => {
    generateImageMock.mockReset().mockResolvedValue('image.png');
    getReferenceMock.mockReset().mockImplementation(kind => ({ mimeType: 'image/png', data: `${kind}-pixels` }));
    loadSettingsMock.mockReset().mockResolvedValue({ imageStyle: 'original' });
  });

  it.each(['background', 'entity', 'npc', 'scene'] as const)('uses the original %s prompt without a paper-cut reference by default', async kind => {
    await expect(generateImage('ivory walls, red status light', '16:9', 'b64_json', kind)).resolves.toBe('image.png');
    expect(getReferenceMock).not.toHaveBeenCalled();
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.stringContaining('ivory walls, red status light'), '16:9', 'b64_json', []
    );
    const prompt = generateImageMock.mock.calls[0][0];
    expect(prompt).toContain('NOT illustration');
    expect(prompt).not.toContain('paper-cut');
  });

  it.each(['background', 'entity', 'npc', 'scene'] as const)('uses the paper-cut %s prompt and matching reference when selected', async kind => {
    loadSettingsMock.mockResolvedValue({ imageStyle: 'paper-cut' });
    await expect(generateImage('ivory walls, red status light', '16:9', 'b64_json', kind)).resolves.toBe('image.png');
    expect(getReferenceMock).toHaveBeenCalledWith(kind);
    expect(generateImageMock).toHaveBeenCalledWith(expect.stringContaining('paper-cut'), '16:9', 'b64_json', [{ mimeType: 'image/png', data: `${kind}-pixels` }]);
    expect(generateImageMock.mock.calls[0][0]).toContain('ivory walls, red status light');
  });

  it('reads the saved style for each generation so switching back removes the reference', async () => {
    loadSettingsMock.mockResolvedValueOnce({ imageStyle: 'paper-cut' }).mockResolvedValueOnce({ imageStyle: 'original' });
    await generateImage('statue', '1:1', 'url', 'entity');
    await generateImage('statue', '1:1', 'url', 'entity');
    expect(generateImageMock.mock.calls[0][3]).toHaveLength(1);
    expect(generateImageMock.mock.calls[1][3]).toEqual([]);
    expect(generateImageMock.mock.calls[1][0]).toContain('photorealistic');
    expect(getReferenceMock).toHaveBeenCalledTimes(1);
  });

  it('uses the original style for settings saved without a style choice', async () => {
    loadSettingsMock.mockResolvedValue({});
    await generateImage('statue', '1:1', 'url', 'entity');
    expect(generateImageMock.mock.calls[0][0]).toContain('photorealistic');
    expect(getReferenceMock).not.toHaveBeenCalled();
  });
});
