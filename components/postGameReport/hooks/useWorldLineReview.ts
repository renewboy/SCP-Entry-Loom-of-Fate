import { useState } from 'react';
import type { EndingType, GameReviewData, Language, SCPData } from '../../../types';
import { generateGameReview } from '../../../services/aiService';

interface UseWorldLineReviewOptions {
  scpData: SCPData | null;
  role: string;
  endingType: EndingType;
  language: Language;
  onReviewUpdate: (review: GameReviewData) => void;
  onGenerated?: () => void;
}

export const useWorldLineReview = ({
  scpData,
  role,
  endingType,
  language,
  onReviewUpdate,
  onGenerated,
}: UseWorldLineReviewOptions) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReview = async () => {
    if (!scpData || isGenerating) {
      return;
    }

    setIsGenerating(true);
    try {
      const review = await generateGameReview(role, endingType, language);
      onReviewUpdate(review);
      window.setTimeout(() => {
        onGenerated?.();
      }, 100);
    } catch (error) {
      console.error('Review generation failed', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generateReview,
  };
};
