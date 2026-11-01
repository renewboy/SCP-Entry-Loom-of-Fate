import React, { useEffect, useRef } from 'react';
import { ShatterOptions, ShatterText } from '../utils/shatterText';

interface ParticleTextProps extends ShatterOptions {
  text: string;
  id?: string;
  className?: string;
  /** Hands over the engine once the text is laid out, for the entry animation */
  onReady?: (engine: ShatterText) => void;
}

/** Text that shatters into dust under the pointer and flies back */
const ParticleText: React.FC<ParticleTextProps> = ({ text, id, className = '', onReady, ...options }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !document.createElement('canvas').getContext('2d')) return;
    let cancelled = false;
    const engine = new ShatterText(host, optionsRef.current);
    engine.setText(text).then(() => {
      if (!cancelled) readyRef.current?.(engine);
    });
    return () => {
      cancelled = true;
      engine.destroy();
    };
  }, [text]);

  return <div ref={hostRef} id={id} className={className} />;
};

export default ParticleText;
