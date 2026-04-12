import type {
  AudioDramaScript,
  EndingType,
  GameReviewData,
  LegacyData,
  LegacyItem,
  Message,
  QAPair,
  RuntimeNPCState,
  SCPData,
  Trait,
} from '../../types';

export interface WorldLineTreeProps {
  messages: Message[];
  scpData: SCPData | null;
  onRestart: () => void;
  onNewGamePlus: (legacyData: LegacyData) => void;
  onMinimize: () => void;
  backgroundImage: string | null;
  endingType: EndingType;
  role: string;
  gameReview: GameReviewData | null;
  qaHistory: QAPair[] | undefined;
  onReviewUpdate: (review: GameReviewData) => void;
  onQAUpdate: (qa: QAPair) => void;
  currentLegacyData?: LegacyData;
  saveId?: string;
}

export interface TimelineEvent {
  trigger: string;
  response: string;
  image?: string;
  id: string;
  stability?: number;
}

export interface EndingDisplayConfig {
  title: string;
  text: string;
  color: string;
  border: string;
  bg: string;
}

export type PrintableNpc = RuntimeNPCState;

export interface LegacySelectionState {
  traits: Trait[];
  items: LegacyItem[];
}

export interface SessionPhaseStats {
  stablePct: number;
  fluctuatingPct: number;
  criticalPct: number;
  stableCount: number;
  fluctuatingCount: number;
  criticalCount: number;
}

export interface SessionEngagementStats {
  turns: number;
  userMessages: number;
  narratorMessages: number;
  userTotalChars: number;
  narratorTotalChars: number;
  visualsCount: number;
  avgUserCharsPerTurn: number;
  avgNarratorCharsPerTurn: number;
  userCharsPerTurn: number[];
  narratorCharsPerTurn: number[];
}

export interface SessionStats {
  stability: number[];
  deltas: number[];
  stabilityMin: number;
  stabilityMax: number;
  stabilityAvg: number;
  largestDrop: number;
  largestRecovery: number;
  volatility: number;
  phase: SessionPhaseStats;
  engagement: SessionEngagementStats;
}

export interface ReviewSectionProps {
  gameReview: GameReviewData;
}

export interface AudioDramaState {
  isAudioDramaEnabled: boolean;
  showAudioDrama: boolean;
  dramaScript: AudioDramaScript | null;
  isGeneratingDrama: boolean;
  generateDrama: () => Promise<void>;
  closeDrama: () => void;
}

export type TranslateFn = (key: string) => string;
