import React, { useEffect, useRef, useState } from 'react';
import { playSfx, preloadSfx } from '../../../services/sfxService';
import { stageAsset } from '../../../utils/stageAssets';
import '../../../styles/tactical.css';

const OPEN_AT_MS = 900;
const REVEAL_AT_MS = 4300;
const FADE_AT_MS = 4800;
const DONE_AT_MS = 5800;

interface StageEntryDoorProps {
  /** The stage can mount behind the door now, so its opening starts as the door clears */
  onReveal: () => void;
  onDone: () => void;
}

/** The blast door opening on the way into a new run. Saves loaded from the menu skip it */
const StageEntryDoor: React.FC<StageEntryDoorProps> = ({ onReveal, onDone }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fading, setFading] = useState(false);
  const callbacks = useRef({ onReveal, onDone });
  callbacks.current = { onReveal, onDone };

  useEffect(() => {
    preloadSfx();
    const timers = [
      setTimeout(() => {
        playSfx('gateOpen');
        videoRef.current?.play().catch(() => null);
      }, OPEN_AT_MS),
      setTimeout(() => callbacks.current.onReveal(), REVEAL_AT_MS),
      setTimeout(() => setFading(true), FADE_AT_MS),
      setTimeout(() => callbacks.current.onDone(), DONE_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={`stage-entry-door ${fading ? 'out' : ''}`} aria-hidden="true">
      <video ref={videoRef} src={stageAsset('door_open.mp4')} poster={stageAsset('door_closed.jpg')} muted playsInline preload="auto" />
    </div>
  );
};

export default StageEntryDoor;
