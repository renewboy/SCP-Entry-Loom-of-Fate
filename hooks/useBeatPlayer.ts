import { useCallback, useEffect, useRef, useState } from 'react';
import { Beat, dwellFor, lastTextIndex, ParsedTurn } from '../utils/beats';

export type StagePhase = 'waiting' | 'title' | 'beats' | 'choosing' | 'ending';

const START_DELAY_MS = 400;
const ENDING_HOLD_MS = 1500;

interface UseBeatPlayerOptions {
  turnId: string | null;
  turn: ParsedTurn;
  /** The message has finished streaming, so no more beats will arrive */
  settled: boolean;
  /** This turn ends the game; only known once it has settled */
  hasEnding: boolean;
  /** Overlays are open: auto-advance holds still */
  paused: boolean;
  autoAdvance: boolean;
  /** Earliest time the first beat may appear, so a location title card can finish */
  holdUntilRef: React.MutableRefObject<number>;
  /** Watching a finished turn again: it plays from the start instead of opening on its end */
  replaying?: boolean;
  /** The opening of a new run. It can finish streaming behind the door, and still has to be read from the start */
  fromStart?: boolean;
}

export interface BeatPlayer {
  phase: StagePhase;
  index: number;
  beat: Beat | undefined;
  /** Show the current beat without the typing reveal */
  instant: boolean;
  revealed: boolean;
  waitingNext: boolean;
  /** The current turn was already complete when it arrived (loaded from a save) */
  restored: boolean;
  auto: boolean;
  fast: boolean;
  /** How long the current beat stays before moving on by itself, when it does */
  dwellMs: number | null;
  setAuto: (value: boolean) => void;
  setFast: (value: boolean) => void;
  advance: () => void;
  back: () => void;
  skip: () => void;
  markRevealed: () => void;
  /** Set by the reveal while typing; calling it completes the current line */
  finishTypingRef: React.MutableRefObject<(() => void) | null>;
}

/**
 * Plays one turn beat by beat. Beats are derived from the message text, so the
 * player only tracks where the reader is and never touches the message itself.
 */
export function useBeatPlayer(options: UseBeatPlayerOptions): BeatPlayer {
  const { turnId, turn, settled, hasEnding, paused, autoAdvance, holdUntilRef, replaying = false, fromStart = false } = options;
  const { beats } = turn;

  const endPhase = (ending: boolean): StagePhase => (ending ? 'ending' : 'choosing');
  const [activeTurn, setActiveTurn] = useState(turnId);
  const [phase, setPhase] = useState<StagePhase>(() => (settled && !fromStart ? endPhase(hasEnding) : 'waiting'));
  const [restored, setRestored] = useState(settled && !fromStart);
  const [index, setIndex] = useState(-1);
  const [instant, setInstant] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [waitingNext, setWaitingNext] = useState(false);
  const [auto, setAuto] = useState(autoAdvance);
  const [fast, setFast] = useState(false);
  const furthestRef = useRef(-1);
  const finishTypingRef = useRef<(() => void) | null>(null);

  if (activeTurn !== turnId) {
    setActiveTurn(turnId);
    setPhase(settled && !replaying ? endPhase(hasEnding) : 'waiting');
    setRestored(settled && !replaying);
    setIndex(-1);
    setInstant(false);
    setRevealed(false);
    setWaitingNext(false);
  }

  useEffect(() => {
    furthestRef.current = -1;
    finishTypingRef.current = null;
  }, [turnId]);

  useEffect(() => {
    setAuto(autoAdvance);
  }, [autoAdvance]);

  const show = useCallback((target: number, jump = false) => {
    finishTypingRef.current = null;
    setIndex(target);
    setInstant(jump || target <= furthestRef.current);
    furthestRef.current = Math.max(furthestRef.current, target);
    setRevealed(false);
    setWaitingNext(false);
    setPhase('beats');
  }, []);

  const finish = useCallback(() => {
    finishTypingRef.current = null;
    setWaitingNext(false);
    setPhase(endPhase(hasEnding));
  }, [hasEnding]);

  const next = useCallback(() => {
    if (index < beats.length - 1) {
      show(index + 1);
    } else if (settled) {
      finish();
    } else {
      setWaitingNext(true);
    }
  }, [index, beats.length, settled, show, finish]);

  useEffect(() => {
    if (phase !== 'waiting') return;
    if (beats.length > 0) setPhase('title');
    else if (settled) finish();
  }, [phase, beats.length, settled, finish]);

  useEffect(() => {
    if (phase !== 'title') return;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      const remaining = holdUntilRef.current - Date.now();
      if (remaining > 0) {
        timer = setTimeout(start, remaining);
      } else {
        show(0);
      }
    };
    timer = setTimeout(start, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, show, holdUntilRef]);

  useEffect(() => {
    if (!waitingNext) return;
    if (index + 1 < beats.length) show(index + 1);
    else if (settled) finish();
  }, [waitingNext, index, beats.length, settled, show, finish]);

  // An errored stream replaces the message, which can leave fewer beats than were shown
  useEffect(() => {
    if (phase !== 'beats' || index < beats.length) return;
    if (beats.length > 0) show(beats.length - 1, true);
    else finish();
  }, [phase, index, beats.length, show, finish]);

  const beat = phase === 'beats' ? beats[index] : undefined;
  const lastBeat = index >= beats.length - 1;
  const closesGame = lastBeat && settled && hasEnding;
  let dwellMs: number | null = null;
  if (beat && revealed && !paused && (auto || fast || beat.kind === 'system' || closesGame)) {
    dwellMs = dwellFor(beat, fast);
    if (closesGame && !fast) dwellMs = Math.max(ENDING_HOLD_MS, dwellMs);
  }

  useEffect(() => {
    if (dwellMs === null) return;
    const timer = setTimeout(next, dwellMs);
    return () => clearTimeout(timer);
  }, [dwellMs, next]);

  const advance = useCallback(() => {
    if (phase === 'title') {
      if (beats.length > 0) show(0);
    } else if (phase === 'beats') {
      if (finishTypingRef.current) finishTypingRef.current();
      else next();
    }
  }, [phase, beats.length, show, next]);

  const back = useCallback(() => {
    if (phase === 'choosing') {
      const last = lastTextIndex(beats);
      if (last >= 0) show(Math.max(0, last - 1), true);
    } else if (phase === 'beats' && index > 0) {
      let target = index - 1;
      while (target > 0 && beats[target].kind === 'system') target -= 1;
      show(target, true);
    }
  }, [phase, beats, index, show]);

  const skip = useCallback(() => {
    if (phase !== 'title' && phase !== 'beats') return;
    if (settled) finish();
    else if (beats.length > 0) show(beats.length - 1, true);
  }, [phase, settled, beats.length, finish, show]);

  const markRevealed = useCallback(() => {
    finishTypingRef.current = null;
    setRevealed(true);
  }, []);

  return {
    phase,
    index,
    beat,
    instant,
    revealed,
    waitingNext,
    restored,
    auto,
    fast,
    dwellMs,
    setAuto,
    setFast,
    advance,
    back,
    skip,
    markRevealed,
    finishTypingRef
  };
}
