
export enum GameStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Analyzing the SCP URL
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum EndingType {
  COLLAPSE = 'COLLAPSE',   // Stability 0, World ends
  CONTAINED = 'CONTAINED', // Good ending, SCP contained/Neutralized
  DEATH = 'DEATH',         // Bad ending, Player died
  ESCAPED = 'ESCAPED',     // Mixed ending, Player escaped
  UNKNOWN = 'UNKNOWN'      // Fallback
}

export type Language = 'zh' | 'en';

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
  ADMINISTRATOR = '管理员（The Administrator）',

  // —— 基金会主要部门 ——
  SECURITY = '安保部人员',
  INTELLIGENCE = '情报部人员',
  MEDICAL = '医疗部/医务官',
  ENGINEER = '工程师/技术员',
  MEMETIC_SPECIALIST = '模因/信息haz研究员',
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
}

export interface SCPData {
  designation: string; // e.g. SCP-173
  name: string; // e.g. The Sculpture
  description: string | null;
  containmentClass: string;
  visualDescription?: string; // Description for background image generation
  entityDescription?: string; // Description for main entity image generation
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
  chatHistory?: any[]; // Raw chat history from Gemini model
  language?: Language; // Language setting at the time of save
  gameReview?: GameReviewData | null; // Persisted game review
  qaHistory?: QAPair[]; // Persisted Q&A history
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
