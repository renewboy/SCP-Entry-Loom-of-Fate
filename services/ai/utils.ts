import { EndingType, GameReviewData, ResourceState } from '../../types';

export const extractVisualPrompt = (text: string): { cleanText: string, visualPrompt: string | null } => {
  const match = text.match(/\[(VISUAL|VISIBILITY|VISABILITY):(.*?)\]/);
  let cleanText = text;
  let visualPrompt = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    visualPrompt = match[2].trim();
  }
  return { cleanText: cleanText.trim(), visualPrompt };
};

export const extractStability = (text: string): { cleanText: string, newStability: number | null } => {
  const match = text.match(/\[STABILITY\s*:\s*(\d+)\]/);
  let cleanText = text;
  let newStability = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    newStability = parseInt(match[1], 10);
  }
  return { cleanText: cleanText.trim(), newStability };
};

export const extractEnding = (text: string): { cleanText: string, endingType: EndingType | null } => {
  const match = text.match(/\[ENDING\s*:\s*(\w+)\]/);
  let cleanText = text;
  let endingType = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    const typeStr = match[1].toUpperCase();
    if (Object.values(EndingType).includes(typeStr as EndingType)) {
      endingType = typeStr as EndingType;
    } else {
      endingType = EndingType.UNKNOWN;
    }
  }

  return { cleanText: cleanText.trim(), endingType };
};

export const extractResources = (text: string): { cleanText: string, resources: Partial<ResourceState> } => {
  let cleanText = text;
  const resources: Partial<ResourceState> = {};

  const numberTags: Array<{ key: keyof ResourceState; label: string }> = [
    { key: 'health', label: 'HEALTH' },
    { key: 'cognition', label: 'COGNITION' },
    { key: 'containmentIntegrity', label: 'INTEGRITY' },
    { key: 'reputation', label: 'REPUTATION' }
  ];

  numberTags.forEach(({ key, label }) => {
    const regex = new RegExp(`\\[${label}\\s*:\\s*(\\d+)\\]`, 'gi');
    const matches = [...cleanText.matchAll(regex)];
    if (matches.length) {
      const last = matches[matches.length - 1];
      resources[key] = parseInt(last[1], 10);
      cleanText = cleanText.replace(regex, '');
    }
  });

  const inventoryRegex = /\[INVENTORY\s*:\s*([^\]]*)\]/gi;
  const inventoryMatches = [...cleanText.matchAll(inventoryRegex)];
  if (inventoryMatches.length) {
    const last = inventoryMatches[inventoryMatches.length - 1];
    const raw = last[1].trim();
    const normalized = raw.replace(/^none$/i, '').trim();
    resources.inventory = normalized
      ? normalized.split(/[|,]/).map(item => item.trim()).filter(Boolean)
      : [];
    cleanText = cleanText.replace(inventoryRegex, '');
  }

  return { cleanText: cleanText.trim(), resources };
};

export const extractJsonObject = (text: string) => {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
};

export const safeParseJson = (text: string): any | null => {
  const raw = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const candidates = [raw, extractJsonObject(raw)].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleaned);
      } catch {
        continue;
      }
    }
  }
  return null;
};

export const normalizeGameReviewData = (value: any): GameReviewData => {
  const fallback: GameReviewData = {
    operationName: 'OPERATION [ERROR]',
    clearanceLevel: 'LEVEL 0',
    evaluation: { rank: 'F', score: 0, verdict: 'PARSING ERROR' },
    summary: 'The analyst failed to compile the report correctly.',
    timelineAnalysis: [],
    psychProfile: 'N/A',
    strategicAdvice: 'Contact IT.',
    perspectiveEvaluations: [],
    achievements: []
  };

  if (!value || typeof value !== 'object') return fallback;

  const { highlights: _highlights, professionalTakeaways: _professionalTakeaways, ...rest } = value;
  const evaluation = value.evaluation && typeof value.evaluation === 'object' ? value.evaluation : {};

  return {
    ...fallback,
    ...rest,
    evaluation: {
      ...fallback.evaluation,
      ...evaluation
    },
    timelineAnalysis: Array.isArray(value.timelineAnalysis) ? value.timelineAnalysis : [],
    objectiveBreakdown: Array.isArray(value.objectiveBreakdown) ? value.objectiveBreakdown : undefined,
    riskAssessment: value.riskAssessment && typeof value.riskAssessment === 'object' ? value.riskAssessment : undefined,
    tacticsMatrix: Array.isArray(value.tacticsMatrix) ? value.tacticsMatrix : undefined,
    counterfactuals: Array.isArray(value.counterfactuals) ? value.counterfactuals : undefined,
    perspectiveEvaluations: Array.isArray(value.perspectiveEvaluations) ? value.perspectiveEvaluations : [],
    achievements: Array.isArray(value.achievements) ? value.achievements : []
  };
};
