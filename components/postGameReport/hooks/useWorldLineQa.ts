import { useState } from 'react';
import type { Language, QAPair } from '../../../types';
import { askNarratorQuestion } from '../../../services/aiService';

interface UseWorldLineQaOptions {
  language: Language;
  qaHistory: QAPair[];
  onQAUpdate: (qa: QAPair) => void;
}

const QA_LIMIT = 3;

export const useWorldLineQa = ({ language, qaHistory, onQAUpdate }: UseWorldLineQaOptions) => {
  const [qaInput, setQaInput] = useState('');
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');

  const qaCount = qaHistory.length;
  const qaRemaining = Math.max(0, QA_LIMIT - qaCount);
  const canAskMore = qaCount < QA_LIMIT;

  const submitQuestion = async () => {
    if (!qaInput.trim() || isQaLoading || !canAskMore) {
      return;
    }

    const question = qaInput;
    const timestamp = Date.now();
    setQaInput('');
    setIsQaLoading(true);

    try {
      const stream = askNarratorQuestion(question, language);
      let fullAnswer = '';

      for await (const chunk of stream) {
        fullAnswer += chunk;
        setStreamingAnswer(fullAnswer);
      }

      onQAUpdate({
        question,
        answer: fullAnswer,
        timestamp,
      });
      setStreamingAnswer('');
    } catch (error) {
      console.error('Q&A Error:', error);
    } finally {
      setIsQaLoading(false);
    }
  };

  return {
    qaInput,
    setQaInput,
    isQaLoading,
    streamingAnswer,
    qaCount,
    qaRemaining,
    canAskMore,
    submitQuestion,
  };
};
