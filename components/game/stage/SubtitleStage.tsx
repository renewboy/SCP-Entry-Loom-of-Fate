import React, { useRef } from 'react';
import { Beat, isTextBeat, lastTextIndex } from '../../../utils/beats';
import { BeatPlayer } from '../../../hooks/useBeatPlayer';
import { StageTextSpeed } from '../../../types';
import { BeatLine, renderBold, useReveal } from './BeatText';

const ECHO_MAX_CHARS = 46;
const ECHO_BEATS = 2;

interface SubtitleStageProps {
  beats: Beat[];
  player: BeatPlayer;
  command: string | null;
  /** Shown under the command while the model is writing */
  loadingText: string | null;
  speed: StageTextSpeed;
  speakerName: (npcId?: string) => string;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const SubtitleStage: React.FC<SubtitleStageProps> = ({ beats, player, command, loadingText, speed, speakerName, t }) => {
  const { phase, index, beat, instant, fast, revealed, waitingNext, dwellMs, auto, markRevealed, finishTypingRef } = player;
  const lineRef = useRef<HTMLDivElement>(null);

  // A system line appears over the text it follows, so that text stays on screen
  let textIndex = -1;
  if (phase === 'beats') textIndex = beat?.kind === 'system' ? lastTextIndex(beats, index - 1) : index;
  else if (phase === 'choosing') textIndex = lastTextIndex(beats);
  const textBeat = isTextBeat(beats[textIndex]) ? beats[textIndex] : null;
  const previousIndex = textBeat && textBeat.kind !== 'psi' ? lastTextIndex(beats, textIndex - 1) : -1;
  const previous = previousIndex >= 0 ? beats[previousIndex] : null;
  const isLive = phase === 'beats' && textIndex === index;

  useReveal(lineRef, {
    revealKey: textBeat?.id ?? null,
    speed,
    instant: instant || !isLive,
    fast,
    onDone: isLive ? markRevealed : () => {},
    finishRef: finishTypingRef
  });

  const showEcho = !!command && (phase === 'waiting' || phase === 'title' || (phase === 'beats' && index < ECHO_BEATS));
  const clippedCommand = command && command.length > ECHO_MAX_CHARS ? `${command.slice(0, ECHO_MAX_CHARS)}…` : command;
  const showHint = phase === 'beats' && (waitingNext || (beat?.kind !== 'system' && revealed));

  return (
    <section id="stage" aria-live="polite">
      <div id="cmd-echo" className={showEcho ? 'on' : ''}>
        {clippedCommand && <><b>&gt;</b>{clippedCommand}</>}
      </div>
      {loadingText && (
        <div id="loading">
          <div className="thread"><span /></div>
          <div className="meta-line dim">{loadingText}</div>
        </div>
      )}
      <div id="beat-prev">
        {previous && (previous.kind === 'npc'
          ? <>{speakerName(previous.npcId)}：「{renderBold(previous.text)}」</>
          : renderBold(previous.text))}
      </div>
      <div id="beat-cur" ref={lineRef}>
        {textBeat && (
          <div key={textBeat.id} className="beat-in">
            <BeatLine beat={textBeat} speakerName={speakerName(textBeat.npcId)} psiLabel={t('stage.psi_label')} />
          </div>
        )}
      </div>
      <div id="advance-hint" className={`${showHint ? 'on' : ''} ${waitingNext ? 'wait' : ''}`} aria-hidden="true">
        <span className="tri">▾</span>
        {auto && dwellMs !== null && (
          <span key={beat?.id} className="bar" style={{ '--dwell': `${dwellMs}ms` } as React.CSSProperties} />
        )}
        <span className="wait-thread"><i /></span>
      </div>
    </section>
  );
};

export default SubtitleStage;
