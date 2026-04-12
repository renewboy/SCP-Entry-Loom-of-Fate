import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GameState } from '../../types';
import Typewriter from '../Typewriter';
import TurnTimeline from './TurnTimeline';
import { groupMessagesByTurn } from '../../utils/chatTurns';

interface ChatAreaProps {
  gameState: GameState;
  t: (key: string) => string;
  isProcessing: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onUserScrollIntent: (forceDisable?: boolean) => void;
  shouldAutoScroll: boolean;
  onOptionClick: (text: string) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  gameState,
  t,
  isProcessing,
  scrollRef,
  onScroll,
  onUserScrollIntent,
  shouldAutoScroll,
  onOptionClick
}) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [mobileTimelineOpen, setMobileTimelineOpen] = useState(false);
  const [desktopTimelineCollapsed, setDesktopTimelineCollapsed] = useState(false);
  const [activeTurn, setActiveTurn] = useState<number | null>(null);
  const turnAnchorRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { preludeMessages, turns } = useMemo(
    () => groupMessagesByTurn(gameState.messages),
    [gameState.messages]
  );

  useEffect(() => {
    if (turns.length > 0) {
      setActiveTurn(turns[turns.length - 1].turnNumber);
    } else {
      setActiveTurn(null);
    }
  }, [turns]);

  useEffect(() => {
    if (turns.length === 0) {
      setMobileTimelineOpen(false);
      setDesktopTimelineCollapsed(false);
    }
  }, [turns.length]);

  const jumpToTurn = (turnNumber: number) => {
    const container = scrollRef.current;
    const anchor = turnAnchorRefs.current[turnNumber];

    if (!container || !anchor) {
      return;
    }

    setActiveTurn(turnNumber);
    setMobileTimelineOpen(false);
    onUserScrollIntent(true);

    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const nextTop = container.scrollTop + (anchorRect.top - containerRect.top) - 20;

      container.scrollTo({
        top: Math.max(nextTop, 0),
        behavior: 'smooth'
      });
    });
  };

  const handleGeneratedImageLoad = () => {
    const container = scrollRef.current;
    if (!container || !shouldAutoScroll) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });
  };

  const renderMessage = (msg: GameState['messages'][number]) => (
    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[95%] sm:max-w-[85%] ${msg.sender === 'user' ? 'bg-scp-gray/60 border border-scp-text/20 backdrop-blur-sm' : ''} p-4 rounded-sm`}>
        {msg.sender === 'user' && (
          <p className="font-mono text-xs text-scp-term mb-1 opacity-70">{t('game.action_log')}</p>
        )}

        <Typewriter
          content={msg.content}
          t={t}
          isStreaming={!!msg.isTyping}
          shouldAutoScroll={shouldAutoScroll}
          scrollContainerRef={scrollRef}
          onOptionClick={onOptionClick}
          npcs={gameState.npcs}
          npcImages={gameState.scpData?.npcImages}
          onNpcImageClick={setLightboxImage}
          stability={gameState.stability}
        />

        {msg.imageUrl && (
          <div
            className="mt-4 border-2 border-scp-gray/50 p-1 animate-pulse-slow bg-black/90 shadow-lg cursor-zoom-in"
            onClick={() => setLightboxImage(msg.imageUrl)}
          >
            <img
              src={msg.imageUrl}
              alt="Generated visual"
              className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700"
              onLoad={handleGeneratedImageLoad}
            />
            <p className="text-[10px] text-center text-scp-gray mt-1 font-mono">{t('game.visual_log')}_{msg.id.slice(-4)}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
      <>
        <div className="relative flex flex-1 min-h-0">
          {turns.length > 0 && desktopTimelineCollapsed && (
            <button
              type="button"
              onClick={() => setDesktopTimelineCollapsed(false)}
              className="absolute right-0 top-1/2 z-30 hidden h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l border bg-black/85 text-sm transition-colors hover:bg-black md:flex"
              style={{ borderColor: 'var(--theme-accent-underline)', color: 'var(--theme-accent)' }}
              aria-label="Expand turn timeline"
            >
              ‹
            </button>
          )}

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setMobileTimelineOpen((open) => !open)}
              className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center border border-scp-term/40 bg-black/80 text-scp-term/70 shadow-lg backdrop-blur-sm transition-colors hover:border-scp-term/70 hover:text-scp-term md:hidden"
              aria-label="Open turn timeline"
            >
              <span className="text-lg leading-none">◉</span>
            </button>
          )}

          <div
            id="chat-area"
            ref={scrollRef}
            onScroll={onScroll}
            onWheel={() => onUserScrollIntent()}
            onTouchStart={() => onUserScrollIntent()}
            onPointerDown={() => onUserScrollIntent()}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth text-shadow-sm scp-ui"
          >
            {gameState.stability < 30 && (
               <div className="sticky top-0 z-50 bg-red-900/80 backdrop-blur border-l-4 border-red-600 p-2 text-red-300 font-mono text-xs animate-pulse shadow-lg mb-4 scp-alert">
                  {t('game.alert_integrity')}
               </div>
            )}

            {preludeMessages.map(renderMessage)}

            {turns.map((turn) => (
              <section key={turn.anchorId} className="space-y-6">
                <div
                  ref={(node) => {
                    turnAnchorRefs.current[turn.turnNumber] = node;
                  }}
                  id={turn.anchorId}
                  className="scroll-mt-6"
                />
                <div className="relative flex items-center gap-3 py-1">
                  <div
                    className="h-px flex-1"
                    style={{ background: 'linear-gradient(to right, transparent, var(--theme-accent), transparent)' }}
                  />
                  <div
                    className="shrink-0 bg-black/60 px-2 py-1 font-mono text-[10px] tracking-[0.35em]"
                    style={{
                      border: '1px solid var(--theme-accent-underline)',
                      color: 'var(--theme-accent)',
                      boxShadow: '0 0 12px var(--theme-accent-soft)'
                    }}
                  >
                    {t('game.turn')} {String(turn.turnNumber).padStart(2, '0')}
                  </div>
                  <div
                    className="h-px flex-1"
                    style={{ background: 'linear-gradient(to right, transparent, var(--theme-accent), transparent)' }}
                  />
                </div>

                {turn.messages.map(renderMessage)}
              </section>
            ))}

            {isProcessing && gameState.messages[gameState.messages.length-1]?.sender === 'user' && (
               <div className="text-scp-term/70 text-xs font-mono animate-pulse pl-4 bg-black/40 inline-block p-1 rounded">{t('game.generating')}</div>
            )}
          </div>

          {!desktopTimelineCollapsed && (
            <TurnTimeline
              turns={turns}
              activeTurn={activeTurn}
              onJump={jumpToTurn}
              t={t}
              onCollapse={() => setDesktopTimelineCollapsed(true)}
            />
          )}

          <TurnTimeline
            turns={turns}
            activeTurn={activeTurn}
            onJump={jumpToTurn}
            t={t}
            isMobile
            isOpen={mobileTimelineOpen}
            onClose={() => setMobileTimelineOpen(false)}
          />

          {gameState.aiState === 'summarizing' && (
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-black/80 border border-scp-term p-4 backdrop-blur shadow-[0_0_20px_rgba(0,255,0,0.2)] flex items-center gap-3 animate-pulse">
                <div className="w-3 h-3 bg-scp-term rounded-full animate-ping"></div>
                <span className="text-scp-term font-mono text-sm tracking-widest uppercase">{t('game.summarizing_memory')}</span>
            </div>
          )}
        </div>
        {lightboxImage && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
            onClick={() => setLightboxImage(null)}
          >
            <img src={lightboxImage} alt="Lightbox" className="max-w-full max-h-full object-contain border border-scp-gray/50 shadow-2xl" />
          </div>,
          document.body
        )}
      </>
  );
};

export default ChatArea;
