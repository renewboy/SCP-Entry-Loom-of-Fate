import type { Language as SupportedLanguage } from './utils/i18n/languages';
export enum GameStatus {
  IDLE = 'IDLE',
  ENTITY_PROFILE = 'ENTITY_PROFILE', // Entity Profile Augmentation
  ANALYZING = 'ANALYZING', // Analyzing the SCP URL
  TACTICAL_PREVIEW = 'TACTICAL_PREVIEW', // Pre-game preview and edit
  STORY_EDITOR = 'STORY_EDITOR', // Creating/Editing Map Blueprint
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface EntityProfile {
  name: string;
  age: string;
  abilities: string[];
  background: string;
  keywords: string[];
}

export enum EndingType {
  COLLAPSE = 'COLLAPSE',   // Stability 0, World ends
  CONTAINED = 'CONTAINED', // Good ending, SCP contained/Neutralized
  DEATH = 'DEATH',         // Bad ending, Player died
  ESCAPED = 'ESCAPED',     // Mixed ending, Player escaped
  UNKNOWN = 'UNKNOWN'      // Fallback
}

export type Language = SupportedLanguage;

export enum Role {
  RESEARCHER = '研究员',
  D_CLASS = 'D级人员',
  MTF = '机动特遣队(MTF)',
  CIVILIAN = '平民',
  SCP = 'SCP项目本身',

  // —— 基金会核心管理与职能 ——
  SITE_DIRECTOR = '站点主管',
  O5 = 'O5议会成员',
  ETHICS_COMMITTEE = '伦理委员会成员',
  ADMINISTRATOR = '管理员',

  // —— 基金会主要部门 ——
  SECURITY = '安保部人员',
  INTELLIGENCE = '情报部人员',
  MEDICAL = '医疗部/医务官',
  ENGINEER = '工程师/技术员',
  MEMETIC_SPECIALIST = '模因/信息危害研究员',
  TEMPORAL_AGENT = '时间异常特工（时序部）',
  INTERNAL_AFFAIRS = '内部事务部(IA)调查员',

  // —— GOI 主要阵营角色 ——
  GOC_AGENT = 'GOC（全球超自然联盟）特工',
  SERPENTS_HAND = '蛇之手成员',
  BROKEN_GOD = '破碎之神教会信徒',
  MC_DARK = 'MC&D成员',
  ANDERSON_ROBOTICS = '安德森机器人技师',
  FACTORY_OPERATIVE = '加工厂成员',
  SKARLET_KING_CULTIST = '深红之王教派成员',

  // —— 异常类别角色 ——
  REALITY_BENDER = '现实扭曲者',
  ANOMALOUS_HUMAN = '异常人类',
  NARRATIVE_ENTITY = '叙事层级实体',
  INFOHAZARD_ENTITY = '信息危害实体',

  // —— 故事中常见的功能性角色 ——
  WITNESS = '异常事件目击者',
  JOURNALIST = '记者/调查员',
  GOVERNMENT_AGENT = '政府特勤/合作机构',
  MERCENARY = '私人武装/佣兵',

  CUSTOM = '自定义'
}

export interface Message {
  id: string;
  sender: 'user' | 'system' | 'narrator';
  content: string;
  timestamp: number;
  imageUrl?: string; // If the message comes with an illustration
  isTyping?: boolean; // For stream effect
  stabilitySnapshot?: number; // Snapshot of stability at this message, used for history chart
  turnIndex: number; // Explicit turn number for timeline navigation
}

export interface StoryDraft {
  roleDetails?: string;
  storyBackground?: string;
  narrativeConstraints?: string;
  openingPrompt?: string;
  backgroundImage?: string; // Data URL or Remote URL
  entityImage?: string;     // Data URL or Remote URL
}

export interface SCPData {
  designation: string; // e.g. SCP-173
  name: string; // e.g. The Sculpture
  containmentClass: string;
  role: string; // Player role name/title
  visualDescription?: string; // Description for background image generation
  entityDescription?: string; // Description for main entity image generation
  npcVisuals?: Record<string, string>; // Map of NPC ID to visual prompt
  npcImages?: Record<string, string>; // Map of NPC ID to image URL/DataURL
  mapBlueprint?: MapBlueprint;
  storyDraft?: StoryDraft;
}

export interface MapBlueprintNode {
  id: string;
  name: string;
  danger: number; // 0-100
  tags?: string[];
  discoverables?: string[];
  interactables?: string[];
  visualHint?: string;
  requires?: string[];
  blockedText?: string;
  layout?: { x: number; y: number }; // Optional: normalized coordinates (0-100) for editor/custom maps
}

export interface MapBlueprintEdge {
  from: string;
  to: string;
  bidirectional: boolean;
}

export interface MapBlueprintNPC {
  id: string;
  name: string;
  archetype: string;
  initialNodeId: string;
  secretTags?: string[];
  dialogueGoals?: string[];
}

export type ObjectiveType = 'MAIN' | 'SIDE';
export type ObjectiveStatus = 'LOCKED' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface ObjectiveReward {
  accessTokens?: string[];
  stabilityDelta?: number;
}

export interface MapBlueprintObjective {
  id: string;
  title: string;
  type: ObjectiveType;
  nodeId: string;
  progress?: number;
  detail?: string;
  reward?: ObjectiveReward;
}

export interface MapBlueprint {
  id: string;
  title: string;
  startNodeId: string;
  nodes: MapBlueprintNode[];
  edges: MapBlueprintEdge[];
  npcs: MapBlueprintNPC[];
  objectives: MapBlueprintObjective[];
}

export interface RuntimeMapState {
  id: string;
  title: string;
  currentNodeId: string;
  discoveredNodeIds: string[];
}

export interface RuntimeNPCState {
  id: string;
  name: string;
  archetype: string;
  nodeId: string;
  alive: boolean;
  secretTags?: string[];
  dialogueGoals?: string[];
}

export interface ObjectiveState {
  id: string;
  title: string;
  type: ObjectiveType;
  nodeId: string;
  status: ObjectiveStatus;
  progress: number;
  detail?: string;
  reward?: ObjectiveReward;
}

export interface ItemState {
  id: string;
  name: string;
  tags?: string[];
}

export interface PerspectiveEvaluation {
  sourceName: string; // e.g., "GOC High Command", "O5-Council", "Chaos Insurgency"
  stance: string; // e.g., "Hostile", "Neutral", "Approving"
  comment: string;
}

export interface GameReviewObjective {
  objective: string;
  completion: number;
  evidence: string;
  missedOpportunity: string;
}

export interface GameReviewRiskByTurn {
  turn: number;
  risk: number;
  reason: string;
  betterMove: string;
}

export interface GameReviewRiskAssessment {
  overall: number;
  volatilityComment: string;
  riskByTurn: GameReviewRiskByTurn[];
}

export interface GameReviewTacticStat {
  tactic: string;
  count: number;
  effectiveness: 'HIGH' | 'MEDIUM' | 'LOW';
  note: string;
}

export interface GameReviewCounterfactual {
  title: string;
  change: string;
  expectedOutcome: string;
  tradeoff: string;
}

export interface NarrativeQuality {
  worldConsistency: number;  // 0-100: Internal logic, SCP lore accuracy, world-building coherence
  imagery: number;           // 0-100: Sensory descriptions, metaphors, visual language richness
  npcDepth: number;          // 0-100: NPC distinct voices, emotional arcs, believable motivations
  pacing: number;            // 0-100: Narrative rhythm matching stability phases, tension escalation
  interactivity: number;     // 0-100: Responsiveness to player's creative inputs and strategies
  equivalentExchange: number; // 0-100: Consistency of proportional cost for every major success
  comment: string;           // Brief overall narrative assessment
}

export interface GameReviewData {
  operationName: string;
  clearanceLevel: string;
  evaluation: {
    rank: string; // S, A, B, C, D, F
    score: number;
    verdict: string;
  };
  summary: string;
  timelineAnalysis: {
    turn: number;
    event: string;
    analysis: string;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  }[];
  objectiveBreakdown?: GameReviewObjective[];
  riskAssessment?: GameReviewRiskAssessment;
  tacticsMatrix?: GameReviewTacticStat[];
  counterfactuals?: GameReviewCounterfactual[];
  narrativeQuality?: NarrativeQuality;
  psychProfile: string;
  strategicAdvice: string;
  perspectiveEvaluations: PerspectiveEvaluation[];
  achievements: {
    title: string;
    description: string;
  }[];
}

export interface QAPair {
  question: string;
  answer: string;
  timestamp: number;
}

export interface Trait {
  id: string;
  name: string;
  description: string;
  effectType: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  icon: string; // Emoji
}

export interface LegacyItem {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji
}

export interface WorldEcho {
  id: string;
  title: string;
  summary: string;
  endingType: EndingType;
  timestamp: number;
  roleName: string; // The role/character name who experienced this echo
}

export interface MemoryRecord {
  turn: number;
  summary: string | null;
  keywords: string[];
}

export interface LegacyGenerationResult extends Partial<LegacyData> {
    memoryRecords?: MemoryRecord[];
}

export interface LegacyData {
  traits: Trait[];
  items: LegacyItem[];
  echoes: WorldEcho[];
  runCount: number;
}

export interface GameState {
  status: GameStatus;
  scpData: SCPData | null;
  role: string;
  messages: Message[];
  backgroundImage: string | null;
  mainImage: string | null;
  stability: number; // 0-100, Hume Field Stability
  turnCount: number;
  endingType: EndingType | null; // The type of ending reached
  map?: RuntimeMapState;
  npcs?: RuntimeNPCState[];
  objectives?: ObjectiveState[];
  inventory?: ItemState[];
  chatHistory?: any[]; // Raw chat history from Gemini model
  summaryContext?: string; // Compressed summary context
  language?: Language; // Language setting at the time of save
  gameReview?: GameReviewData | null; // Persisted game review
  qaHistory?: QAPair[]; // Persisted Q&A history
  legacy?: LegacyData; // New Game+ Legacy Data
  saveId?: string; // The UUID of the save slot this game belongs to (for RAG context)
  returnFromEditor?: boolean; // Transient flag to indicate return from Story Editor
  tokenCount?: number; // Current context token count
  aiState?: 'idle' | 'generating' | 'summarizing'; // Current AI state
}

export interface SaveGameMetadata {
  id: string;
  created_at: string;
  summary?: string;
  turn_count?: number;
  background_thumbnail?: string;
  is_cloud_synced?: boolean;
  user_id?: string;
}

export interface SaveGame extends SaveGameMetadata {
  game_state: GameState;
}

export interface AudioDramaLine {
  id: string;
  speaker: string; // Name of the character or "NARRATOR"
  text: string;
  emotion?: string; // e.g. "whispering", "shouting", "calm"
  sfx?: string; // Sound effect cue, e.g., "footsteps", "alarm"
}

export interface AudioDramaScene {
  id: number;
  location: string;
  originalMessageId?: string; // ID of the original message to link image
  lines: AudioDramaLine[];
}

export interface AudioDramaCast {
  name: string;
  role: string;
  voiceDesc: string; // Description for TTS selection
  gender: 'male' | 'female' | 'neutral' | 'robot';
}

export interface AudioDramaScript {
  title: string;
  cast: AudioDramaCast[];
  scenes: AudioDramaScene[];
}

export type GameDifficulty = 'easy' | 'normal' | 'hard' | 'insane';

export type AIProvider = 'gemini' | 'openai';

export interface GeminiSettings {
  apiKey?: string;
  chatModel?: string;
  imageModel?: string;
}

export interface OpenAISettings {
  apiKey?: string;
  baseUrl?: string;
  chatModel?: string;
  imageModel?: string;
}

export interface AISettings {
  provider: AIProvider;
  gemini: GeminiSettings;
  openai: OpenAISettings;
}

export interface GlobalSettings {
  enableSceneImages: boolean;
  enableBackgroundImages: boolean;
  enableEntityImages: boolean;
  enableNpcImages: boolean;
  difficulty: GameDifficulty;
  bgmVolume: number;
  sfxVolume: number;
  skipTacticalPrep?: boolean;
  skipEntityProfile?: boolean;
  skipBootSequence?: boolean; // Skip the boot sequence animation
  aiSettings?: AISettings;
}

export interface Memory {
  id?: string;
  user_id?: string;
  timeline_id: string;
  content: string;
  role: string;
  turn_number: number;
  tags?: any;
  similarity?: number;
}

// ---- Narrative Medium System ----
export type NarrativeMediumType = 'DOC' | 'COMM' | 'ENV' | 'PSI';

export interface NarrativeMedium {
  type: NarrativeMediumType;
  attrs: Record<string, string>; // title, style, source, time, type, etc.
  content: string;               // Inner text of the block
  raw: string;                   // Original matched text, used to strip from narrative
}
