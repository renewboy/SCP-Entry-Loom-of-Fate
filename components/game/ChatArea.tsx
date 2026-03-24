import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { GameState } from '../../types';
import Typewriter from '../Typewriter';

interface ChatAreaProps {
  gameState: GameState;
  t: (key: string) => string;
  isProcessing: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onOptionClick: (text: string) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ gameState, t, isProcessing, scrollRef, onOptionClick }) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  return (
      <>
        <div 
          id="chat-area"
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth text-shadow-sm scp-ui"
        >
          {gameState.stability < 30 && (
             <div className="sticky top-0 z-50 bg-red-900/80 backdrop-blur border-l-4 border-red-600 p-2 text-red-300 font-mono text-xs animate-pulse shadow-lg mb-4 scp-alert">
                {t('game.alert_integrity')}
             </div>
          )}

          {gameState.messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[95%] sm:max-w-[85%] ${msg.sender === 'user' ? 'bg-scp-gray/60 border border-scp-text/20 backdrop-blur-sm' : ''} p-4 rounded-sm`}>
                
                {msg.sender === 'user' && (
                   <p className="font-mono text-xs text-scp-term mb-1 opacity-70">{t('game.action_log')}</p>
                )}
                
                <Typewriter 
                  content={msg.content} 
                  isStreaming={!!msg.isTyping}
                  onOptionClick={onOptionClick} 
                  npcs={gameState.npcs}
                  npcImages={gameState.scpData?.npcImages}
                  onNpcImageClick={setLightboxImage}
                />

                {msg.imageUrl && (
                  <div 
                    className="mt-4 border-2 border-scp-gray/50 p-1 animate-pulse-slow bg-black/90 shadow-lg cursor-zoom-in"
                    onClick={() => setLightboxImage(msg.imageUrl)}
                  >
                    <img src={msg.imageUrl} alt="Generated visual" className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700" />
                    <p className="text-[10px] text-center text-scp-gray mt-1 font-mono">{t('game.visual_log')}_{msg.id.slice(-4)}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isProcessing && gameState.messages[gameState.messages.length-1]?.sender === 'user' && (
             <div className="text-scp-term/70 text-xs font-mono animate-pulse pl-4 bg-black/40 inline-block p-1 rounded">{t('game.generating')}</div>
          )}
          
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
