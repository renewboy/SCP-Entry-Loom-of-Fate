import { useState } from 'react';
import type { Language, Message, SCPData } from '../../../types';
import { generateAudioDramaScript } from '../../../services/aiService';

interface UseWorldLineAudioDramaOptions {
  messages: Message[];
  role: string;
  scpData: SCPData | null;
  language: Language;
}

export const useWorldLineAudioDrama = ({
  messages,
  role,
  scpData,
  language,
}: UseWorldLineAudioDramaOptions) => {
  const isAudioDramaEnabled = false;
  const [showAudioDrama, setShowAudioDrama] = useState(false);
  const [dramaScript, setDramaScript] = useState<Awaited<ReturnType<typeof generateAudioDramaScript>>>(null);
  const [isGeneratingDrama, setIsGeneratingDrama] = useState(false);

  const generateDrama = async () => {
    if (!isAudioDramaEnabled || isGeneratingDrama) {
      return;
    }

    setIsGeneratingDrama(true);
    try {
      const result = await generateAudioDramaScript(
        messages,
        role,
        scpData?.designation || 'Unknown SCP',
        language,
      );
      setDramaScript(result);
      setShowAudioDrama(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingDrama(false);
    }
  };

  const closeDrama = () => {
    setShowAudioDrama(false);
    setDramaScript(null);
  };

  return {
    isAudioDramaEnabled,
    showAudioDrama,
    dramaScript,
    isGeneratingDrama,
    generateDrama,
    closeDrama,
  };
};
