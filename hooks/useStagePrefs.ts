import { useCallback, useEffect, useState } from 'react';
import { GlobalSettings, StageFxLevel, StageTextSpeed } from '../types';
import { loadGlobalSettings, saveGlobalSettings } from '../services/indexedDBService';

export interface StagePrefs {
  textSpeed: StageTextSpeed;
  autoAdvance: boolean;
  fontScale: number;
  fxLevel: StageFxLevel;
}

const DEFAULT_PREFS: StagePrefs = { textSpeed: 2, autoAdvance: false, fontScale: 1, fxLevel: 'full' };

const pickPrefs = (settings: GlobalSettings): StagePrefs => ({
  textSpeed: settings.textSpeed ?? DEFAULT_PREFS.textSpeed,
  autoAdvance: settings.autoAdvance ?? DEFAULT_PREFS.autoAdvance,
  fontScale: settings.fontScale ?? DEFAULT_PREFS.fontScale,
  fxLevel: settings.fxLevel ?? DEFAULT_PREFS.fxLevel
});

export function useStagePrefs() {
  const [prefs, setPrefs] = useState<StagePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    loadGlobalSettings().then(settings => setPrefs(pickPrefs(settings))).catch(() => {});
  }, []);

  const updatePrefs = useCallback((patch: Partial<StagePrefs>) => {
    setPrefs(prev => ({ ...prev, ...patch }));
    loadGlobalSettings()
      .then(settings => saveGlobalSettings({ ...settings, ...patch }))
      .catch(error => console.error('Failed to save reading preferences', error));
  }, []);

  return { prefs, updatePrefs };
}
