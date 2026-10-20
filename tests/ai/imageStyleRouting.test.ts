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
    getReferenceMock.mockReset().mockReturnValue({ mimeType: 'image/webp', data: 'shared-abstract-pixels' });
    loadSettingsMock.mockReset().mockResolvedValue({ imageStyle: 'original' });
  });

  it.each(['background', 'entity', 'npc', 'scene'] as const)('uses the original %s prompt without a style reference by default', async kind => {
    await expect(generateImage('ivory walls, red status light', '16:9', 'b64_json', kind)).resolves.toBe('image.png');
    expect(getReferenceMock).not.toHaveBeenCalled();
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.stringContaining('ivory walls, red status light'), '16:9', 'b64_json', []
    );
    const prompt = generateImageMock.mock.calls[0][0];
    expect(prompt).toContain('NOT illustration');
    expect(prompt).not.toContain('paper-cut');
  });

  it.each(['background', 'entity', 'npc', 'scene'] as const)('uses the narrative print %s prompt and shared abstract reference when selected', async kind => {
    loadSettingsMock.mockResolvedValue({ imageStyle: 'narrative-print' });
    await expect(generateImage('ivory walls, red status light', '16:9', 'b64_json', kind)).resolves.toBe('image.png');
    expect(getReferenceMock).toHaveBeenCalledWith();
    expect(generateImageMock).toHaveBeenCalledWith(expect.stringContaining('narrative print illustration'), '16:9', 'b64_json', [{ mimeType: 'image/webp', data: 'shared-abstract-pixels' }]);
    expect(generateImageMock.mock.calls[0][0]).toContain('ivory walls, red status light');
    expect(generateImageMock.mock.calls[0][0]).not.toContain('paper-cut');
  });

  it.each(['background', 'entity', 'npc', 'scene'] as const)('uses the gothic ink %s prompt without the print reference', async kind => {
    loadSettingsMock.mockResolvedValue({ imageStyle: 'gothic-ink' });
    await expect(generateImage('ivory walls, red status light', '16:9', 'b64_json', kind)).resolves.toBe('image.png');
    expect(getReferenceMock).not.toHaveBeenCalled();
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.stringContaining('hand-drawn 2D illustration'), '16:9', 'b64_json', []
    );
    const prompt = generateImageMock.mock.calls[0][0];
    expect(prompt).toContain('ivory walls, red status light');
    expect(prompt).toContain('scp foundation style');
    expect(prompt).toMatch(/clinical|scp foundation record illustration/);
    expect(prompt).toMatch(/cold muted tones|desaturated/);
    expect(prompt).not.toMatch(/abstract reference|parallel hatching/);
  });

  it('reads the saved style for each generation and isolates reference images when switching styles', async () => {
    loadSettingsMock.mockResolvedValueOnce({ imageStyle: 'narrative-print' })
      .mockResolvedValueOnce({ imageStyle: 'gothic-ink' }).mockResolvedValueOnce({ imageStyle: 'original' });
    await generateImage('statue', '1:1', 'url', 'entity');
    await generateImage('statue', '1:1', 'url', 'entity');
    await generateImage('statue', '1:1', 'url', 'entity');
    expect(generateImageMock.mock.calls[0][3]).toHaveLength(1);
    expect(generateImageMock.mock.calls[1][3]).toEqual([]);
    expect(generateImageMock.mock.calls[1][0]).toContain('hand-drawn 2D illustration');
    expect(generateImageMock.mock.calls[2][3]).toEqual([]);
    expect(generateImageMock.mock.calls[2][0]).toContain('photorealistic');
    expect(getReferenceMock).toHaveBeenCalledTimes(1);
  });

  describe.each(['original', 'narrative-print', 'gothic-ink'])('%s canvas instructions', style => {
    it.each(['16:9', '9:16', '3:4', '1:1'] as const)('includes the requested %s ratio', async ratio => {
      loadSettingsMock.mockResolvedValue({ imageStyle: style });
      await generateImage('two guards inspect a concrete corridor', ratio, 'url', 'scene');
      expect(generateImageMock).toHaveBeenCalledWith(
        expect.stringContaining(`image with a ${ratio} aspect ratio.`), ratio, 'url', expect.any(Array)
      );
    });
  });

  it('preserves the print style for an existing saved selection', async () => {
    loadSettingsMock.mockResolvedValue({ imageStyle: 'paper-cut' });
    await generateImage('statue', '1:1', 'url', 'entity');
    expect(generateImageMock).toHaveBeenCalledWith(
      expect.stringContaining('narrative print illustration'), '1:1', 'url', [{ mimeType: 'image/webp', data: 'shared-abstract-pixels' }]
    );
  });

  it('uses the original style for settings saved without a style choice', async () => {
    loadSettingsMock.mockResolvedValue({});
    await generateImage('statue', '1:1', 'url', 'entity');
    expect(generateImageMock.mock.calls[0][0]).toContain('photorealistic');
    expect(getReferenceMock).not.toHaveBeenCalled();
  });
});
