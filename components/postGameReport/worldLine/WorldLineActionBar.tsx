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
    <div className="wl-actions">
      {showGenerateReview && (
        <button type="button" className="rp-btn review" onClick={onGenerateReview} disabled={isGeneratingReview}>
          {isGeneratingReview ? <><span className="rp-spin" />{generatingReviewLabel}</> : <><Sparkles size={15} strokeWidth={1.75} />{generateReviewLabel}</>}
        </button>
      )}
      <button type="button" className="rp-btn legacy" onClick={onGenerateLegacy} disabled={isGeneratingLegacy || isLegacyModalOpen}>
        {isGeneratingLegacy ? <><span className="rp-spin" />{generatingLegacyLabel}</> : <><RotateCcw size={15} strokeWidth={1.75} />{newGamePlusLabel}</>}
      </button>
    </div>
  );
};

export default WorldLineActionBar;
