import React from 'react';
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
  return (
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth text-shadow-sm"
      >
        {gameState.stability < 30 && (
           <div className="sticky top-0 z-50 bg-red-900/80 backdrop-blur border-l-4 border-red-600 p-2 text-red-300 font-mono text-xs animate-pulse shadow-lg mb-4">
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
              />

              {msg.imageUrl && (
                <div className="mt-4 border-2 border-scp-gray/50 p-1 animate-pulse-slow bg-black/90 shadow-lg">
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
      </div>
  );
};

export default ChatArea;
