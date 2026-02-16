import { EndingType, GameReviewData } from '../../types';

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

export const extractLoc = (text: string): { cleanText: string, locId: string | null } => {
  const match = text.match(/\[LOC\s*:\s*([^\]]+)\]/);
  let cleanText = text;
  let locId: string | null = null;

  if (match) {
    cleanText = cleanText.replace(match[0], '');
    locId = match[1].trim();
  }

  return { cleanText: cleanText.trim(), locId };
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

export const extractMapUpdate = (text: string): { cleanText: string, update: any | null } => {
  const tagStart = text.indexOf('[MAP_UPDATE');
  if (tagStart === -1) return { cleanText: text.trim(), update: null };

  const bracketStart = text.indexOf('[', tagStart);
  const colon = text.indexOf(':', tagStart);
  if (bracketStart === -1 || colon === -1) return { cleanText: text.trim(), update: null };

  const jsonStart = text.indexOf('{', colon);
  if (jsonStart === -1) return { cleanText: text.trim(), update: null };

  let depth = 0;
  let jsonEnd = -1;
  for (let i = jsonStart; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        jsonEnd = i;
        break;
      }
    }
  }

  if (jsonEnd === -1) return { cleanText: text.trim(), update: null };

  const afterJsonBracket = text.indexOf(']', jsonEnd);
  if (afterJsonBracket === -1) return { cleanText: text.trim(), update: null };

  const jsonText = text.slice(jsonStart, jsonEnd + 1);
  const update = safeParseJson(jsonText);

  const tagFull = text.slice(bracketStart, afterJsonBracket + 1);
  const cleanText = text.replace(tagFull, '');

  return { cleanText: cleanText.trim(), update };
};

export const imageSizeFromAspectRatio = (aspectRatio: "1:1" | "16:9" | "3:4") => {
  if (aspectRatio === "16:9") return "2560x1440";
  if (aspectRatio === "3:4") return "1728x2304";
  return "1024x1024";
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
