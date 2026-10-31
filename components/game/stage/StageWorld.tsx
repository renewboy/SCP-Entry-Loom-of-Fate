import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Beat } from '../../../utils/beats';
import { StageFxLevel } from '../../../types';
import { useGlitchEffect } from '../../../hooks/useGlitchEffect';
import { prefersReducedMotion } from './BeatText';

export const phaseIndex = (stability: number) => (stability > 70 ? 0 : stability > 30 ? 1 : stability > 0 ? 2 : 3);

const FX_STRENGTH: Record<StageFxLevel, number> = { full: 1, reduced: 0.45, off: 0 };
const GLITCH_BANDS = ['rgba(224,70,70,.34)', 'rgba(70,200,224,.28)', 'rgba(120,255,160,.2)'];

export interface StandinSlot {
  npcId: string | null;
  on: boolean;
  dim: boolean;
}

export interface StandinSlots {
  left: StandinSlot;
  right: StandinSlot;
}

const EMPTY_SLOT: StandinSlot = { npcId: null, on: false, dim: false };
const EMPTY_SLOTS: StandinSlots = { left: EMPTY_SLOT, right: EMPTY_SLOT };

/** Up to two speakers stand left and right by order of appearance; whoever is talking is lit */
export function useStandins(beats: Beat[], index: number, active: boolean, images?: Record<string, string>): StandinSlots {
  const [slots, setSlots] = useState<StandinSlots>(EMPTY_SLOTS);
  const beat = active ? beats[index] : undefined;
  const nextBeat = active ? beats[index + 1] : undefined;
  const hideAll = !beat || beat.kind === 'media' || beat.kind === 'psi';

  useEffect(() => {
    const clear = () => setSlots(prev => ({ left: { ...prev.left, on: false, dim: false }, right: { ...prev.right, on: false, dim: false } }));
    if (hideAll || !beat) {
      clear();
      return;
    }
    if (beat.kind !== 'npc') {
      // Narration between two lines keeps the speakers on stage, dimmed, so they do not pop in and out
      if (nextBeat?.kind === 'npc') {
        setSlots(prev => ({ left: { ...prev.left, dim: prev.left.on }, right: { ...prev.right, dim: prev.right.on } }));
      } else {
        clear();
      }
      return;
    }
    const url = beat.npcId ? images?.[beat.npcId] : undefined;
    if (!url || !beat.npcId) {
      clear();
      return;
    }
    const speakers: string[] = [];
    beats.forEach(item => {
      if (item.kind === 'npc' && item.npcId && !speakers.includes(item.npcId)) speakers.push(item.npcId);
    });
    const side: keyof StandinSlots = speakers.indexOf(beat.npcId) % 2 ? 'right' : 'left';
    const otherSide: keyof StandinSlots = side === 'left' ? 'right' : 'left';
    setSlots(prev => ({
      ...prev,
      [side]: { npcId: beat.npcId as string, on: true, dim: false },
      [otherSide]: { ...prev[otherSide], dim: prev[otherSide].on }
    }));
  }, [beat?.id, nextBeat?.kind, hideAll, images, beats]);

  return slots;
}

export interface StageWorldHandle {
  tearBurst: (power?: number, duration?: number) => void;
  shake: () => void;
}

interface StageWorldProps {
  sceneUrl: string | null;
  slots: StandinSlots;
  images?: Record<string, string>;
  stability: number;
  fxLevel: StageFxLevel;
  /** Stability effects stop once the ending plays */
  active: boolean;
  memoryEcho: boolean;
}

const StageWorld = React.forwardRef<StageWorldHandle, StageWorldProps>(({ sceneUrl, slots, images, stability, fxLevel, active, memoryEcho }, ref) => {
  const worldRef = useRef<HTMLDivElement>(null);
  const glitchRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(sceneUrl);
  const fxRef = useRef(fxLevel);
  sceneRef.current = sceneUrl;
  fxRef.current = fxLevel;

  const [layers, setLayers] = useState<[string | null, string | null]>([sceneUrl, null]);
  const [activeLayer, setActiveLayer] = useState(0);

  useEffect(() => {
    if (sceneUrl === layers[activeLayer]) return;
    if (!sceneUrl) {
      setLayers([null, null]);
      return;
    }
    let cancelled = false;
    const image = new Image();
    const crossfade = () => {
      if (cancelled) return;
      const nextLayer = 1 - activeLayer;
      setLayers(prev => {
        const next: [string | null, string | null] = [prev[0], prev[1]];
        next[nextLayer] = sceneUrl;
        return next;
      });
      setActiveLayer(nextLayer);
    };
    image.onload = crossfade;
    image.onerror = crossfade;
    image.src = sceneUrl;
    return () => {
      cancelled = true;
    };
  }, [sceneUrl]);

  useImperativeHandle(ref, () => ({
    tearBurst: (power = 1, duration = 170) => {
      const host = glitchRef.current;
      const url = sceneRef.current;
      if (!host || fxRef.current === 'off' || prefersReducedMotion()) return;
      const height = window.innerHeight;
      const count = url ? 3 + Math.round(power * 4) : 0;
      host.innerHTML = '';
      for (let i = 0; i < 1 + Math.round(power * 2); i += 1) {
        const band = document.createElement('div');
        band.className = 'tear-band';
        band.style.top = `${(Math.random() * 92).toFixed(1)}%`;
        band.style.height = `${(1 + Math.random() * 9).toFixed(1)}%`;
        band.style.background = GLITCH_BANDS[i % GLITCH_BANDS.length];
        host.appendChild(band);
      }
      for (let i = 0; i < count; i += 1) {
        const top = Math.random() * height * 0.92;
        const stripe = (0.015 + Math.random() * 0.07) * height;
        const tear = document.createElement('div');
        tear.className = 'tear';
        tear.style.backgroundImage = `url("${url}")`;
        tear.style.clipPath = `inset(${top.toFixed(0)}px 0 ${Math.max(0, height - top - stripe).toFixed(0)}px 0)`;
        tear.style.transform = `translateX(${((Math.random() * 2 - 1) * 60 * power).toFixed(0)}px)`;
        host.appendChild(tear);
      }
      setTimeout(() => {
        if (glitchRef.current) glitchRef.current.innerHTML = '';
      }, duration);
    },
    shake: () => {
      const world = worldRef.current;
      if (!world || fxRef.current === 'off' || prefersReducedMotion()) return;
      world.classList.remove('shaking');
      void world.offsetWidth;
      world.classList.add('shaking');
    }
  }), []);

  const strength = active ? FX_STRENGTH[fxLevel] : 0;
  const phase = phaseIndex(stability);
  let tone = '';
  if (strength && phase === 1) tone = `saturate(${1 - 0.18 * strength}) contrast(${1 + 0.04 * strength})`;
  if (strength && phase === 2) tone = `saturate(${1 - 0.42 * strength}) contrast(${1 + 0.1 * strength}) brightness(${1 - 0.1 * strength})`;

  // Every 2-9s at or below 70 stability, more often the lower it goes; the hook also plays the glitch sample
  const isGlitching = useGlitchEffect(stability, active && fxLevel !== 'off');
  useEffect(() => {
    if (!isGlitching || !ref || !('current' in ref)) return;
    ref.current?.tearBurst(fxLevel === 'full' ? 0.8 : 0.4, 150);
    if (fxLevel === 'full') ref.current?.shake();
  }, [isGlitching]);

  const standin = (side: keyof StandinSlots) => {
    const slot = slots[side];
    const url = slot.npcId ? images?.[slot.npcId] : undefined;
    return (
      <div className={`standin ${side} ${slot.on && url ? 'on' : ''} ${slot.dim ? 'dim' : ''}`}>
        {url && <img src={url} alt="" />}
      </div>
    );
  };

  return (
    <>
      <div id="world" ref={worldRef} aria-hidden="true" style={{ filter: tone }}>
        <div id="backdrop">
          <div className="bd-fallback" />
          {layers.map((url, index) => (
            <div
              key={index}
              className={`bd-layer ${url && sceneUrl && index === activeLayer ? 'on' : ''}`}
              style={url ? { backgroundImage: `url("${url}")` } : undefined}
            />
          ))}
        </div>
        <div id="fx-glitch" ref={glitchRef} />
        {standin('left')}
        {standin('right')}
      </div>
      <div className="scrim scrim-bottom" aria-hidden="true" />
      <div className="scrim scrim-top" aria-hidden="true" />
      <div id="choice-scrim" aria-hidden="true" />
      <div id="fx" className={strength > 0 && phase === 2 ? 'critical' : ''} aria-hidden="true">
        <div id="fx-alert" />
        <div id="fx-noise" style={{ opacity: active ? (Math.max(0, Math.min(0.5, (70 - stability) / 140)) * strength * 0.4).toFixed(3) : 0 }} />
        {memoryEcho && <div id="fx-memory" />}
      </div>
    </>
  );
});

export default StageWorld;
