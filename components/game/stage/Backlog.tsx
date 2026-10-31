import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Language, Message } from '../../../types';
import { BriefingContent, LogBlock, parseTurn, ParsedTurn } from '../../../utils/beats';
import LogBlockView from './LogBlockView';

/** Only what the player has already read of the current turn, so the log cannot spoil the rest */
const readBlocks = (parsed: ParsedTurn, beatIndex: number, language: Language): LogBlock[] => {
  const currentBeat = parsed.beats[beatIndex];
  if (!currentBeat) return [];
  const blocks = parsed.blocks.slice(0, currentBeat.block + 1);
  const last = blocks[blocks.length - 1];
  if (last && (last.kind === 'p' || last.kind === 'npc' || last.kind === 'psi')) {
    const text = parsed.beats
      .slice(0, beatIndex + 1)
      .filter(beat => beat.block === currentBeat.block)
      .map(beat => beat.text)
      .join(language === 'en' ? ' ' : '');
    blocks[blocks.length - 1] = { ...last, text };
  }
  return blocks;
};

interface BacklogProps {
  open: boolean;
  /** Opened over the ending sequence, so it has to stack above it */
  overEnding: boolean;
  messages: Message[];
  /** Id of the turn being read and the beat reached; null once the turn has been read */
  reading: { messageId: string; beatIndex: number } | null;
  language: Language;
  sceneUrl: string | null;
  nodeName: (nodeId?: string) => string;
  speakerName: (npcId?: string) => string;
  npcImages?: Record<string, string>;
  briefing?: BriefingContent;
  onZoom: (url: string) => void;
  /** Clicking an SCP designation fills the command; absent once the game has ended */
  onReference?: (designation: string) => void;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const Backlog: React.FC<BacklogProps> = ({ open, overEnding, messages, reading, language, sceneUrl, nodeName, speakerName, npcImages, briefing, onZoom, onReference, onClose, t }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null);
  const turnRefs = useRef(new Map<string, HTMLDivElement>());
  const [ticksHeight, setTicksHeight] = useState(600);

  const turns = useMemo(() => {
    if (!open) return [];
    let command: string | null = null;
    const list: Array<{ message: Message; command: string | null; parsed: ParsedTurn; blocks: LogBlock[]; nextCommand: string | null }> = [];
    messages.forEach(message => {
      if (message.sender === 'user') {
        command = message.content;
        if (list.length) list[list.length - 1].nextCommand = message.content;
        return;
      }
      if (message.sender !== 'narrator') return;
      const intro = message.id === 'intro' || message.turnIndex === 0;
      const parsed = parseTurn(message.content, {
        id: message.id,
        intro,
        streaming: !!message.isTyping,
        language,
        briefing: intro ? briefing : undefined
      });
      const blocks = reading?.messageId === message.id ? readBlocks(parsed, reading.beatIndex, language) : parsed.blocks;
      list.push({ message, command, parsed, blocks, nextCommand: null });
      command = null;
    });
    return list;
  }, [open, messages, reading, language, briefing]);

  useLayoutEffect(() => {
    if (!open) return;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (ticksRef.current) setTicksHeight(ticksRef.current.clientHeight || 600);
  }, [open]);

  const trail = turns.map(turn => turn.message.stabilitySnapshot ?? 100);
  const count = turns.length;
  const position = (index: number) => (index / Math.max(1, count - 1));
  const sparkPoints = trail.map((value, index) => `${(value / 100 * 30).toFixed(1)},${(position(index) * ticksHeight).toFixed(1)}`).join(' ');

  return (
    <section id="log" className={open ? 'open' : ''} style={overEnding ? { zIndex: 95 } : undefined} aria-label={t('stage.log.title')} role="log">
      <div id="log-bg" style={sceneUrl ? { backgroundImage: `url("${sceneUrl}")` } : undefined} />
      <header className="log-head">
        <div className="meta-line">{t('stage.log.title')}</div>
        <button type="button" className="drawer-close" onClick={onClose}>✕ {t('stage.log.close')} <kbd>L</kbd></button>
      </header>
      <div id="log-scroll" ref={scrollRef}>
        <div id="log-body">
          {turns.map((turn, turnIndex) => {
            const { message } = turn;
            const place = nodeName(message.nodeId);
            const isCurrent = turnIndex === count - 1;
            return (
              <div
                key={message.id}
                className="log-turn"
                ref={element => {
                  if (element) turnRefs.current.set(message.id, element);
                  else turnRefs.current.delete(message.id);
                }}
              >
                <div className={`log-div ${isCurrent ? 'current' : ''}`}>
                  <span className="ln" />
                  <span className="lbl">— {t('stage.turn_label', { n: message.turnIndex + 1 })}{place ? ` · ${place}` : ''} —</span>
                  {message.imageUrl && <button type="button" className="log-thumb" onClick={() => onZoom(message.imageUrl as string)}><img src={message.imageUrl} alt="" /></button>}
                  <span className="ln" />
                </div>
                {turn.command && (
                  <div className="log-cmd">
                    <span className="l">&gt; {t('stage.log.command')}</span>
                    <p>{turn.command}</p>
                  </div>
                )}
                {turn.blocks.map((block, blockIndex) => (
                  <LogBlockView key={blockIndex} block={block} speakerName={speakerName} npcImages={npcImages} onZoom={onZoom} onReference={onReference} t={t} />
                ))}
                {!isCurrent && turn.parsed.options.length > 0 && (
                  <ul className="log-opts">
                    {turn.parsed.options.map((option, index) => (
                      <li key={index} className={turn.nextCommand?.startsWith(option.title.slice(0, 6)) ? 'chosen' : ''}>{option.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div id="log-scrubber">
        <svg id="log-spark" viewBox={`0 0 34 ${ticksHeight}`} aria-hidden="true">
          <line x1="21" y1="0" x2="21" y2={ticksHeight} stroke="rgba(226,232,240,.08)" strokeDasharray="2 4" />
          <line x1="9" y1="0" x2="9" y2={ticksHeight} stroke="rgba(195,46,46,.2)" strokeDasharray="2 4" />
          <polyline points={sparkPoints} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="1.4" />
        </svg>
        <div id="log-ticks" ref={ticksRef}>
          {turns.map((turn, index) => (
            <button
              type="button"
              key={turn.message.id}
              className={index === count - 1 ? 'cur' : ''}
              style={{ top: `${position(index) * 100}%` }}
              onClick={() => turnRefs.current.get(turn.message.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {String(turn.message.turnIndex + 1).padStart(2, '0')}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Backlog;
