import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { stageAsset } from '../../utils/stageAssets';

export type LoomShot = 'wide' | 'close';

export interface LoomSceneHandle {
  /** A band of light running along the fibers. Positions are percentages of the frame */
  pulse: (options?: { from?: number; to?: number; ms?: number; peak?: number }) => void;
  /** Lights every fiber; 0 puts them out again */
  setGlow: (level: number) => void;
  /** The lights-off render over the normal one, for the entry */
  setDark: (level: number) => void;
  flickerLights: (ms: number) => Animation | null;
  /** Where the wide frame sits on screen, for pointing things at the machine */
  frameRect: () => DOMRect | null;
}

interface LoomSceneProps {
  shot: LoomShot;
  /** 0 to 1, darkens the machine behind text */
  scrim?: number;
  /** The run's own background fades in over the machine once it exists */
  background?: string | null;
  /** Runs every animation frame, after the parallax has moved */
  onFrame?: () => void;
}

const SOURCES: Record<LoomShot, { still: string; video: string; glow: string; dark?: string }> = {
  wide: { still: 'loom_idle.jpg', video: 'loom_loop.mp4', glow: 'loom_glow.jpg', dark: 'loom_dark.jpg' },
  close: { still: 'loom_close.jpg', video: 'loom_pass.mp4', glow: 'loom_close_glow.jpg' },
};
const GRAIN_SIZE = 220;
const LIT_MS = 2200;
const TUBE_FLICKER_MIN_MS = 14000;
const TUBE_FLICKER_SPREAD_MS = 26000;

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const makeGrain = () => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRAIN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.random() * 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
};

const Plate: React.FC<{ shot: LoomShot; on: boolean; plateRef: (el: HTMLDivElement | null) => void; videoOk: boolean }> = ({ shot, on, plateRef, videoOk }) => {
  const source = SOURCES[shot];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (on) video.play().catch(() => null);
    else video.pause();
  }, [on, ready]);

  return (
    <div ref={plateRef} className={`loom-plate loom-${shot} ${on ? 'on' : ''}`}>
      <div className="loom-drift">
        <img className="loom-still" src={stageAsset(source.still)} alt="" />
        {videoOk && <video ref={videoRef} className={`loom-video ${ready ? 'ready' : ''}`} src={stageAsset(source.video)} muted loop playsInline preload="auto" onCanPlay={() => setReady(true)} />}
        {source.dark && <img className="loom-dark" src={stageAsset(source.dark)} alt="" />}
        <img className="loom-glow hover" src={stageAsset(source.glow)} alt="" />
        <img className="loom-glow band" src={stageAsset(source.glow)} alt="" />
        <img className="loom-glow all" src={stageAsset(source.glow)} alt="" />
      </div>
    </div>
  );
};

/** The containment chamber behind the start and wait screens: the same camera rendered in layers, so it can react to the player */
const LoomScene = React.forwardRef<LoomSceneHandle, LoomSceneProps>(({ shot, scrim = 0, background, onFrame }, ref) => {
  const plates = useRef<Partial<Record<LoomShot, HTMLDivElement | null>>>({});
  const shotRef = useRef(shot);
  shotRef.current = shot;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [seen, setSeen] = useState<Record<LoomShot, boolean>>({ wide: shot === 'wide', close: shot === 'close' });
  const [grain] = useState(makeGrain);
  const [videoOk] = useState(() => !reducedMotion());

  useEffect(() => {
    setSeen(current => (current[shot] ? current : { ...current, [shot]: true }));
  }, [shot]);

  const active = useCallback(() => plates.current[shotRef.current] ?? null, []);

  useImperativeHandle(ref, () => ({
    pulse: ({ from = 90, to = 30, ms = 1100, peak = 0.9 } = {}) => {
      const band = active()?.querySelector<HTMLElement>('.loom-glow.band');
      if (!band || typeof band.animate !== 'function') return;
      band.style.visibility = 'visible';
      const run = band.animate([
        { opacity: 0, maskPosition: `${from}% 0`, WebkitMaskPosition: `${from}% 0` },
        { opacity: peak, offset: 0.25 },
        { opacity: 0, maskPosition: `${to}% 0`, WebkitMaskPosition: `${to}% 0` },
      ] as Keyframe[], { duration: ms, easing: 'cubic-bezier(.3,0,.5,1)' });
      run.onfinish = () => {
        if (!band.getAnimations().length) band.style.visibility = '';
      };
    },
    setGlow: level => {
      const plate = active();
      if (!plate) return;
      plate.style.setProperty('--glow-all', String(level));
      plate.classList.toggle('glowing', level > 0);
    },
    setDark: level => {
      const dark = plates.current.wide?.querySelector<HTMLElement>('.loom-dark');
      if (dark) dark.style.opacity = String(level);
    },
    flickerLights: ms => {
      const dark = plates.current.wide?.querySelector<HTMLElement>('.loom-dark');
      if (!dark || typeof dark.animate !== 'function') return null;
      return dark.animate([
        { opacity: 1 }, { opacity: 1, offset: 0.12 }, { opacity: 0.35, offset: 0.16 }, { opacity: 1, offset: 0.22 },
        { opacity: 1, offset: 0.46 }, { opacity: 0.2, offset: 0.5 }, { opacity: 0.85, offset: 0.56 },
        { opacity: 0.4, offset: 0.66 }, { opacity: 0.92, offset: 0.72 }, { opacity: 0 },
      ], { duration: ms, easing: 'linear', fill: 'forwards' });
    },
    frameRect: () => plates.current.wide?.getBoundingClientRect() ?? null,
  }), [active]);

  // Light parallax, and the fibers lighting up around the pointer. Nothing is written while the pointer rests
  useEffect(() => {
    const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, clientX: -1, clientY: -1 };
    let drawnX = -2;
    let drawnY = -2;
    let shiftX = '';
    let shiftY = '';
    let litTimer: number | undefined;
    let frame = 0;
    const still = reducedMotion();
    const onMove = (event: PointerEvent) => {
      pointer.targetX = event.clientX / window.innerWidth;
      pointer.targetY = event.clientY / window.innerHeight;
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
      const plate = active();
      if (!plate) return;
      plate.classList.add('lit');
      window.clearTimeout(litTimer);
      litTimer = window.setTimeout(() => plate.classList.remove('lit'), LIT_MS);
    };
    const tick = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.045;
      pointer.y += (pointer.targetY - pointer.y) * 0.045;
      const plate = active();
      if (plate) {
        if (!still) {
          const nextX = `${((0.5 - pointer.x) * 1.1).toFixed(2)}vw`;
          const nextY = `${((0.5 - pointer.y) * 0.7).toFixed(2)}vh`;
          if (nextX !== shiftX || nextY !== shiftY) {
            plate.style.setProperty('--shift-x', nextX);
            plate.style.setProperty('--shift-y', nextY);
            shiftX = nextX;
            shiftY = nextY;
          }
        }
        if (pointer.clientX !== drawnX || pointer.clientY !== drawnY) {
          const box = plate.getBoundingClientRect();
          plate.style.setProperty('--mouse-x', `${(((pointer.clientX - box.left) / box.width) * 100).toFixed(1)}%`);
          plate.style.setProperty('--mouse-y', `${(((pointer.clientY - box.top) / box.height) * 100).toFixed(1)}%`);
          drawnX = pointer.clientX;
          drawnY = pointer.clientY;
        }
      }
      onFrameRef.current?.();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(litTimer);
      window.removeEventListener('pointermove', onMove);
    };
  }, [active]);

  // Now and then a tube stutters
  useEffect(() => {
    if (reducedMotion()) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const dark = shotRef.current === 'wide' ? plates.current.wide?.querySelector<HTMLElement>('.loom-dark') : null;
        dark?.animate?.([{ opacity: 0 }, { opacity: 0.3, offset: 0.12 }, { opacity: 0, offset: 0.3 }, { opacity: 0.16, offset: 0.46 }, { opacity: 0 }], { duration: 300 + Math.random() * 160, easing: 'steps(6)' });
        schedule();
      }, TUBE_FLICKER_MIN_MS + Math.random() * TUBE_FLICKER_SPREAD_MS);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`loom-scene shot-${shot}`} aria-hidden="true">
      {seen.wide && <Plate shot="wide" on={shot === 'wide'} videoOk={videoOk} plateRef={el => { plates.current.wide = el; }} />}
      {seen.close && <Plate shot="close" on={shot === 'close'} videoOk={videoOk} plateRef={el => { plates.current.close = el; }} />}
      <div className={`loom-run-bg ${background ? 'on' : ''}`} style={background ? { backgroundImage: `url(${background})` } : undefined} />
      <div className="loom-shade" />
      <div className="loom-scrim" style={{ background: `rgba(4,4,5,${scrim})` }} />
      <div className="loom-vignette" />
      {grain && <div className="loom-grain" style={{ backgroundImage: `url(${grain})` }} />}
    </div>
  );
});
LoomScene.displayName = 'LoomScene';

export default LoomScene;
