import { EndingType, GameReviewData, NarrativeMedium, NarrativeMediumType, SCPData } from '../../types';
import { ImageAspectRatio } from './types';

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
  // Try to find array first
  const firstArray = text.indexOf('[');
  const lastArray = text.lastIndexOf(']');
  
  // Try to find object
  const firstObj = text.indexOf('{');
  const lastObj = text.lastIndexOf('}');

  // Determine which comes first and is valid
  let candidate = null;

  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
     candidate = text.slice(firstArray, lastArray + 1);
  }
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      // If object is found, check if it's "better" (longer or the only one)
      // Or if we need to decide based on context. 
      // For now, let's just return the one that looks like a valid JSON structure.
      const objCandidate = text.slice(firstObj, lastObj + 1);
      
      // If we found an array but it's inside the object, prefer object.
      // If we found an object but it's inside the array, prefer array.
      if (candidate) {
          if (firstObj < firstArray && lastObj > lastArray) {
              candidate = objCandidate;
          }
      } else {
          candidate = objCandidate;
      }
  }
  return candidate;
};

export const safeParseJson = (text: string): any | null => {
  const candidates: string[] = [];

  // 1. Priority: Look for ```json ... ``` blocks
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    candidates.push(jsonBlockMatch[1].trim());
  }
  // 2. Fallback: Raw text stripped of markdown
  const raw = text.replace(/```json/g, '').replace(/```/g, '').trim();
  candidates.push(raw);
  // 3. Fallback: Heuristic extraction
  const extracted = extractJsonObject(raw);
  if (extracted) {
    candidates.push(extracted);
  }

  const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);

  for (const candidate of uniqueCandidates) {
    try {
      let json = JSON.parse(candidate);
      return json;
    } catch {
      try {
        // Try to fix trailing commas
        const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleaned);
      } catch {
        continue;
      }
    }
  }
  return null;
};

const normalizeGeneratedStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,\n，、]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
};

export const normalizeAnalyzeScpData = (value: any): SCPData => {
  if (!value || typeof value !== 'object') {
    return value as SCPData;
  }

  const mapBlueprint = value.mapBlueprint && typeof value.mapBlueprint === 'object'
    ? value.mapBlueprint
    : undefined;

  return {
    ...value,
    mapBlueprint: mapBlueprint ? {
      ...mapBlueprint,
      nodes: Array.isArray(mapBlueprint.nodes)
        ? mapBlueprint.nodes.map((node: any) => ({
            ...node,
            discoverables: normalizeGeneratedStringArray(node?.discoverables),
            interactables: normalizeGeneratedStringArray(node?.interactables),
            requires: normalizeGeneratedStringArray(node?.requires),
          }))
        : [],
      edges: Array.isArray(mapBlueprint.edges) ? mapBlueprint.edges : [],
      npcs: Array.isArray(mapBlueprint.npcs)
        ? mapBlueprint.npcs.map((npc: any) => ({
            ...npc,
            secretTags: normalizeGeneratedStringArray(npc?.secretTags),
            dialogueGoals: normalizeGeneratedStringArray(npc?.dialogueGoals),
          }))
        : [],
      objectives: Array.isArray(mapBlueprint.objectives)
        ? mapBlueprint.objectives.map((objective: any) => ({
            ...objective,
            reward: objective?.reward && typeof objective.reward === 'object'
              ? {
                  ...objective.reward,
                  accessTokens: normalizeGeneratedStringArray(objective.reward.accessTokens),
                }
              : objective?.reward,
          }))
        : [],
    } : undefined,
  };
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

export const isMobileViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};

export const getBackgroundAspectRatio = (): ImageAspectRatio => (
  isMobileViewport() ? "9:16" : "16:9"
);

export const getSceneAspectRatio = (): ImageAspectRatio => (
  isMobileViewport() ? "9:16" : "16:9"
);

export const imageSizeFromAspectRatio = (aspectRatio: ImageAspectRatio) => {
  if (aspectRatio === "16:9") return "2560x1440";
  if (aspectRatio === "9:16") return "1440x2560";
  if (aspectRatio === "3:4") return "1728x2304";
  return "2048x2048";
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

export const cleanHistoryText = (text: string): string => {
    return text
        .replace(/\[VISUAL:.*?\]/g, '')
        .replace(/\[地图状态\][\s\S]*?\[地图状态结束\]/g, '')
        .replace(/【常规回合任务说明】[\s\S]*?【常规回合任务说明结束】/g, '')
        .trim();
};

// ---- Narrative Medium Extraction ----
// Be tolerant of partially malformed media tags such as `[/＃COMM]`.
const MEDIUM_BLOCK_REGEX = /\[(?:#|＃)(DOC|COMM|ENV|PSI)(?::([^\]]*))?\]\n?([\s\S]*?)\[(?:\/|／)\s*(?:#|＃)\s*\1\s*\]/g;

const parseAttrs = (attrStr: string | undefined): Record<string, string> => {
    const attrs: Record<string, string> = {};
    if (!attrStr) return attrs;
    for (const m of attrStr.matchAll(/(\w+)="([^"]*)"/g)) {
        attrs[m[1]] = m[2];
    }
    return attrs;
};

export const extractNarrativeMedia = (text: string): {
    cleanText: string;
    media: NarrativeMedium[];
} => {
    const media: NarrativeMedium[] = [];
    let cleanText = text;

    for (const match of text.matchAll(MEDIUM_BLOCK_REGEX)) {
        const [raw, typeStr, attrStr, content] = match;
        media.push({
            type: typeStr as NarrativeMediumType,
            attrs: parseAttrs(attrStr),
            content: content.trim(),
            raw,
        });
        cleanText = cleanText.replace(raw, '');
    }

    return { cleanText: cleanText.trim(), media };
};
