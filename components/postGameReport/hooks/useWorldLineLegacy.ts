import { useState } from 'react';
import type {
  EndingType,
  Language,
  LegacyData,
  LegacyItem,
  LegacyGenerationResult,
  SCPData,
  Trait,
} from '../../../types';
import { generateLegacyData } from '../../../services/aiService';
import { stageRagMemories } from '../../../services/ragStaging';
import {
  buildDefaultLegacySelectionState,
  buildFinalLegacyData,
  mergeLegacyData,
  toggleSelectableByName,
} from '../selectors/legacy';

interface UseWorldLineLegacyOptions {
  endingType: EndingType;
  role: string;
  language: Language;
  saveId?: string;
  scpData: SCPData | null;
  currentLegacyData?: LegacyData;
  onNewGamePlus: (legacyData: LegacyData) => void;
}

const LEGACY_SELECTION_LIMIT = 5;

export const useWorldLineLegacy = ({
  endingType,
  role,
  language,
  saveId,
  scpData,
  currentLegacyData,
  onNewGamePlus,
}: UseWorldLineLegacyOptions) => {
  const [isGeneratingLegacy, setIsGeneratingLegacy] = useState(false);
  const [newLegacyData, setNewLegacyData] = useState<Partial<LegacyData> | null>(null);
  const [showLegacyModal, setShowLegacyModal] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState<Trait[]>([]);
  const [selectedItems, setSelectedItems] = useState<LegacyItem[]>([]);

  const generateLegacy = async () => {
    if (isGeneratingLegacy) {
      return;
    }

    setIsGeneratingLegacy(true);
    try {
      const generated = await generateLegacyData(
        endingType || 'UNKNOWN',
        role,
        language,
        saveId,
        scpData?.designation,
      );

      await maybeStageMemories(generated, saveId, scpData?.designation, role);

      const mergedLegacyData = mergeLegacyData(currentLegacyData, generated);
      const defaults = buildDefaultLegacySelectionState(mergedLegacyData, LEGACY_SELECTION_LIMIT);

      setNewLegacyData(mergedLegacyData);
      setSelectedTraits(defaults.traits);
      setSelectedItems(defaults.items);
      setShowLegacyModal(true);
    } catch (error) {
      console.error('Legacy generation failed', error);
    } finally {
      setIsGeneratingLegacy(false);
    }
  };

  const confirmLegacy = () => {
    if (!newLegacyData) {
      return;
    }

    onNewGamePlus(buildFinalLegacyData(newLegacyData, selectedTraits, selectedItems));
  };

  const toggleTraitSelection = (trait: Trait) => {
    setSelectedTraits((currentTraits) => (
      toggleSelectableByName(currentTraits, trait, LEGACY_SELECTION_LIMIT)
    ));
  };

  const toggleItemSelection = (item: LegacyItem) => {
    setSelectedItems((currentItems) => (
      toggleSelectableByName(currentItems, item, LEGACY_SELECTION_LIMIT)
    ));
  };

  const closeLegacyModal = () => {
    setShowLegacyModal(false);
  };

  return {
    isGeneratingLegacy,
    newLegacyData,
    showLegacyModal,
    selectedTraits,
    selectedItems,
    generateLegacy,
    confirmLegacy,
    toggleTraitSelection,
    toggleItemSelection,
    closeLegacyModal,
  };
};

const maybeStageMemories = async (
  generated: LegacyGenerationResult,
  saveId: string | undefined,
  designation: string | undefined,
  role: string,
) => {
  if (!generated.memoryRecords || generated.memoryRecords.length === 0) {
    return;
  }

  await stageRagMemories(saveId, {
    scp_number: designation || 'UNKNOWN',
    role,
    records: generated.memoryRecords,
  });
};
