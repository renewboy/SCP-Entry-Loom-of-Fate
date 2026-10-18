import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GlobalSettings } from '../../types';

const { loadMock, saveMock } = vi.hoisted(() => ({ loadMock: vi.fn(), saveMock: vi.fn() }));
vi.mock('../../services/indexedDBService', () => ({ loadGlobalSettings: loadMock, saveGlobalSettings: saveMock }));
vi.mock('../../services/aiService', () => ({ resetProvider: vi.fn() }));
vi.mock('../../services/aiConnectivityService', () => ({ testAIConnectivity: vi.fn() }));
vi.mock('../../services/bgmService', () => ({ setBgmVolume: vi.fn() }));
vi.mock('../../services/sfxService', () => ({ setSfxVolume: vi.fn() }));
vi.mock('../../services/aiConfigService', () => ({
  getDefaultAISettings: () => ({ providers: { gemini: {}, openai: {} }, routes: Object.fromEntries(['analysis', 'narration', 'image', 'assistant', 'embedding'].map(route => [route, { provider: 'gemini', model: 'model' }])) }),
  validateAISettings: vi.fn(), clearAISettingsCache: vi.fn(),
}));
vi.mock('../../utils/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../../utils/i18n')>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => actual.translate('zh', key) }) };
});
import GlobalSettingsModal from '../../components/GlobalSettingsModal';

describe('drawing style setting', () => {
  let saved: GlobalSettings;
  beforeEach(() => {
    saved = { enableSceneImages: false, enableBackgroundImages: true, enableEntityImages: true, enableNpcImages: true, imageStyle: 'original', difficulty: 'normal', bgmVolume: 0.8, sfxVolume: 1 };
    loadMock.mockReset().mockImplementation(async () => saved);
    saveMock.mockReset().mockImplementation(async settings => { saved = settings; });
  });
  afterEach(cleanup);

  it('saves the selected style and restores it when settings are reopened', async () => {
    const props = { isOpen: true, onClose: vi.fn() };
    const { rerender } = render(<GlobalSettingsModal {...props} />);
    fireEvent.click(await screen.findByText('默认（原版）'));
    fireEvent.click(screen.getByText('剪纸叙事'));
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ imageStyle: 'paper-cut', difficulty: 'normal', enableBackgroundImages: true })));
    rerender(<GlobalSettingsModal {...props} isOpen={false} />);
    rerender(<GlobalSettingsModal {...props} />);
    fireEvent.click(await screen.findByText('剪纸叙事'));
    fireEvent.click(screen.getByText('默认（原版）'));
    await waitFor(() => expect(saveMock).toHaveBeenLastCalledWith(expect.objectContaining({ imageStyle: 'original' })));
  });
});
