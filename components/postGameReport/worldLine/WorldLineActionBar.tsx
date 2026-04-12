import React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';

interface WorldLineActionBarProps {
  showGenerateReview: boolean;
  isGeneratingReview: boolean;
  onGenerateReview: () => void;
  isGeneratingLegacy: boolean;
  isLegacyModalOpen: boolean;
  onGenerateLegacy: () => void;
  generateReviewLabel: string;
  generatingReviewLabel: string;
  newGamePlusLabel: string;
  generatingLegacyLabel: string;
}

const WorldLineActionBar: React.FC<WorldLineActionBarProps> = ({
  showGenerateReview,
  isGeneratingReview,
  onGenerateReview,
  isGeneratingLegacy,
  isLegacyModalOpen,
  onGenerateLegacy,
  generateReviewLabel,
  generatingReviewLabel,
  newGamePlusLabel,
  generatingLegacyLabel,
}) => {
  return (
    <div className="flex gap-4 flex-wrap justify-center">
      {showGenerateReview && (
        <button
          onClick={onGenerateReview}
          disabled={isGeneratingReview}
          className="group relative px-8 py-3 bg-scp-dark border border-scp-accent/50 hover:border-scp-accent transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-scp-accent/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span className="relative font-mono font-bold text-scp-accent text-sm flex items-center gap-2">
            {isGeneratingReview ? (
              <>
                <span className="w-3 h-3 border-2 border-scp-accent border-t-transparent rounded-full animate-spin"></span>
                {generatingReviewLabel}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> {generateReviewLabel}
              </>
            )}
          </span>
        </button>
      )}

      <button
        onClick={onGenerateLegacy}
        disabled={isGeneratingLegacy || isLegacyModalOpen}
        className="group relative px-8 py-3 bg-scp-dark border border-amber-500/50 hover:border-amber-500 transition-all overflow-hidden"
      >
        <div className="absolute inset-0 bg-amber-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        <span className="relative font-mono font-bold text-amber-500 text-sm flex items-center gap-2">
          {isGeneratingLegacy ? (
            <>
              <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
              {generatingLegacyLabel}
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4" /> {newGamePlusLabel}
            </>
          )}
        </span>
      </button>
    </div>
  );
};

export default WorldLineActionBar;
