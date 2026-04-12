import type { LegacyData, LegacyItem, LegacyGenerationResult, Trait } from '../../../types';
import type { LegacySelectionState } from '../types';

const dedupeByName = <T extends { name: string }>(items: T[]): T[] =>
  Array.from(new Map(items.map((item) => [item.name, item])).values());

export const mergeLegacyData = (
  currentLegacyData?: LegacyData,
  generatedLegacyData?: LegacyGenerationResult | null,
): Partial<LegacyData> => {
  return {
    traits: dedupeByName([...(currentLegacyData?.traits ?? []), ...(generatedLegacyData?.traits ?? [])]),
    items: dedupeByName([...(currentLegacyData?.items ?? []), ...(generatedLegacyData?.items ?? [])]),
    echoes: [...(currentLegacyData?.echoes ?? []), ...(generatedLegacyData?.echoes ?? [])],
    runCount: (currentLegacyData?.runCount ?? 0) + 1,
  };
};

export const toggleSelectableByName = <T extends { name: string }>(
  currentList: T[],
  item: T,
  limit: number,
): T[] => {
  if (currentList.some((entry) => entry.name === item.name)) {
    return currentList.filter((entry) => entry.name !== item.name);
  }

  if (currentList.length >= limit) {
    return currentList;
  }

  return [...currentList, item];
};

export const buildDefaultLegacySelectionState = (
  legacyData: Partial<LegacyData> | null,
  limit = 5,
): LegacySelectionState => ({
  traits: (legacyData?.traits ?? []).slice(0, limit),
  items: (legacyData?.items ?? []).slice(0, limit),
});

export const buildFinalLegacyData = (
  legacyData: Partial<LegacyData>,
  selectedTraits: Trait[],
  selectedItems: LegacyItem[],
): LegacyData => ({
  traits: selectedTraits,
  items: selectedItems,
  echoes: legacyData.echoes ?? [],
  runCount: legacyData.runCount ?? 1,
});
