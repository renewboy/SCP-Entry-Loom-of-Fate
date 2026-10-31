import React from 'react';
import GameButton from '../../common/GameButton';

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
        <GameButton variant="primary" loading={isGeneratingReview} onClick={onGenerateReview}>
          {isGeneratingReview ? generatingReviewLabel : generateReviewLabel}
        </GameButton>
      )}
      <GameButton
        variant={showGenerateReview ? 'secondary' : 'primary'}
        loading={isGeneratingLegacy}
        disabled={isLegacyModalOpen}
        onClick={onGenerateLegacy}
      >
        {isGeneratingLegacy ? generatingLegacyLabel : newGamePlusLabel}
      </GameButton>
    </div>
  );
};

export default WorldLineActionBar;
