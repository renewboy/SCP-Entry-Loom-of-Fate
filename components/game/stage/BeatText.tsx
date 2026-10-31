import React, { useLayoutEffect, useRef } from 'react';
import { Beat, toCharTokens } from '../../../utils/beats';
import { StageTextSpeed } from '../../../types';
import { playKeystroke } from '../../../services/sfxService';

const CHARS_PER_SECOND: Record<StageTextSpeed, number> = { 0: Infinity, 1: 18, 2: 32, 3: 60 };
const KEYSTROKE_GAP_MS = 50;
const KEYSTROKE_GAP_JITTER_MS = 40;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Touch screens can report stray mouse hovers after a tap or a scroll, so they never react to hover */
export const canHover = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches;

/** **bold** markup to React nodes */
export const renderBold = (text: string): React.ReactNode =>
  text.split('**').map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part));

const SCP_REFERENCE = /\b(SCP-\d+(?:-[A-Za-z0-9]+)*)\b/g;

/** Log text: bold plus SCP designations that fill the command when clicked, as the old chat view did */
export const renderLogText = (text: string, onReference?: (designation: string) => void): React.ReactNode =>
  text.split('**').map((part, boldIndex) => {
    const pieces = part.split(SCP_REFERENCE).map((piece, index) => (
      index % 2 && onReference
        ? <button type="button" key={index} className="log-ref" onClick={() => onReference(piece)}>{piece}</button>
        : piece
    ));
    return boldIndex % 2 ? <strong key={boldIndex}>{pieces}</strong> : <React.Fragment key={boldIndex}>{pieces}</React.Fragment>;
  });

export const CharSpans: React.FC<{ text: string }> = React.memo(({ text }) => (
  <>
    {toCharTokens(text).map((token, index) => {
      const char = <span key={index} className="ch">{token.ch}</span>;
      return token.bold ? <strong key={index}>{char}</strong> : char;
    })}
  </>
));

interface RevealOptions {
  revealKey: string | null;
  speed: StageTextSpeed;
  instant: boolean;
  fast: boolean;
  onDone: () => void;
  finishRef: React.MutableRefObject<(() => void) | null>;
}

/** Reveals the `.ch` spans inside `containerRef` one at a time without re-rendering them */
export function useReveal(containerRef: React.RefObject<HTMLElement>, options: RevealOptions) {
  const { revealKey, speed, instant, fast, onDone, finishRef } = options;
  const onDoneRef = useRef(onDone);
  const fastRef = useRef(fast);
  onDoneRef.current = onDone;
  fastRef.current = fast;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!revealKey || !element) return;
    const chars = Array.from(element.querySelectorAll<HTMLElement>('.ch'));
    const charsPerSecond = CHARS_PER_SECOND[speed];
    let raf = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      chars.forEach(char => char.classList.add('on'));
      onDoneRef.current();
    };

    if (instant || fastRef.current || charsPerSecond === Infinity || prefersReducedMotion() || chars.length === 0) {
      finish();
      return;
    }

    finishRef.current = finish;
    const step = 1000 / charsPerSecond;
    let shown = 0;
    let last = performance.now();
    let budget = 0;
    let nextKeystrokeAt = 0;
    const tick = (now: number) => {
      budget += now - last;
      last = now;
      const before = shown;
      while (budget >= step && shown < chars.length) {
        chars[shown].classList.add('on');
        shown += 1;
        budget -= step;
      }
      if (shown > before && now >= nextKeystrokeAt && !fastRef.current) {
        playKeystroke();
        nextKeystrokeAt = now + KEYSTROKE_GAP_MS + Math.random() * KEYSTROKE_GAP_JITTER_MS;
      }
      if (shown >= chars.length || fastRef.current) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      if (finishRef.current === finish) finishRef.current = null;
    };
  }, [revealKey, instant, speed, containerRef, finishRef]);
}

interface BeatLineProps {
  beat: Beat;
  speakerName?: string;
  psiLabel: string;
}

export const BeatLine: React.FC<BeatLineProps> = React.memo(({ beat, speakerName, psiLabel }) => {
  if (beat.kind === 'npc') {
    return (
      <>
        <div className="speaker">
          <span className="name">{speakerName}</span>
          <span className="rule" />
        </div>
        <div className="line-npc">
          <span className="q">「</span>
          <CharSpans text={beat.text} />
          <span className="q">」</span>
        </div>
      </>
    );
  }
  if (beat.kind === 'psi') {
    const ghost = beat.text.replace(/\*\*/g, '');
    return (
      <>
        <div className="psi-label">▸ {psiLabel}</div>
        <div className="psi-wrap">
          <div className="psi-ghost g1" aria-hidden="true">{ghost}</div>
          <div className="psi-ghost g2" aria-hidden="true">{ghost}</div>
          <div className="line-psi"><CharSpans text={beat.text} /></div>
        </div>
      </>
    );
  }
  return <div><CharSpans text={beat.text} /></div>;
});
