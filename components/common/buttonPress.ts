import type React from 'react';
import { playButtonPress, playLightPress } from '../../services/sfxService';

/** On a container: `.weave-btn`, which moves the run forward, gives the full press and any other enabled button the light one */
export const pressOnButtonClick = (event: React.MouseEvent) => {
  const button = (event.target as Element).closest?.('button:not(:disabled)');
  if (!button) return;
  if (button.classList.contains('weave-btn')) playButtonPress();
  else playLightPress();
};
