import React from 'react';
import { GameState } from '../../types';

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  isProcessing: boolean;
  gameState: GameState;
  t: (key: string) => string;
  inputRef: React.RefObject<HTMLInputElement>;
}

const InputArea: React.FC<InputAreaProps> = ({ 
    input, setInput, handleSend, isProcessing, gameState, t, inputRef 
}) => {
  return (
      <div className="p-4 bg-black/50 border-t border-scp-gray/30">
        <div className="flex gap-2 relative">
          <span className="absolute left-3 top-3 text-scp-term font-mono pointer-events-none"></span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isProcessing || !!gameState.endingType}
            placeholder={!!gameState.endingType ? t('game.input_placeholder_ended') : t('game.input_placeholder')}
            className="w-full bg-scp-gray/30 border border-scp-gray/40 text-scp-text pl-8 pr-4 py-3 font-mono focus:outline-none focus:border-scp-term focus:ring-1 focus:ring-scp-term/50 transition-all disabled:opacity-50 placeholder-gray-500 backdrop-blur-sm"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim() || !!gameState.endingType}
            className="px-6 py-2 bg-scp-text text-black font-bold font-mono hover:bg-scp-term disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {t('game.btn_execute')}
          </button>
        </div>
      </div>
  );
};

export default InputArea;
