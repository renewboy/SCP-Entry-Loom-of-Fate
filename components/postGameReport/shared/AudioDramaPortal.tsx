import React from 'react';
import { createPortal } from 'react-dom';
import type { AudioDramaScript, Message } from '../../../types';
import DebugAudioPlayer from '../../game/DebugAudioPlayer';

interface AudioDramaPortalProps {
  open: boolean;
  isEnabled: boolean;
  isGenerating: boolean;
  dramaScript: AudioDramaScript | null;
  messages: Message[];
  backgroundImage: string | null;
  onClose: () => void;
}

const AudioDramaPortal: React.FC<AudioDramaPortalProps> = ({
  open,
  isEnabled,
  isGenerating,
  dramaScript,
  messages,
  backgroundImage,
  onClose,
}) => {
  if (!isEnabled || !open || isGenerating) {
    return null;
  }

  return createPortal(
    <DebugAudioPlayer
      initialJson={dramaScript ? JSON.stringify(dramaScript, null, 2) : ''}
      messages={messages}
      onClose={onClose}
      fallbackImage={backgroundImage}
    />,
    document.body,
  );
};

export default AudioDramaPortal;
