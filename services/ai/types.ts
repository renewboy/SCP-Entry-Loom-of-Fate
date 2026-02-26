import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, MapBlueprint, MapBlueprintNPC } from '../../types';

export interface RouterOutput {
    relevantNpcIds: string[];
    encounteredNpcIds: string[];
    npcSummaries: Record<string, string>;
}

export interface NPCActionProposal {
    npcId: string;
    actions: { type: string; [key: string]: any }[];
}

export interface AIService {
    analyzeSCPUrl(input: string, language: Language, role: string, difficulty: GameDifficulty, legacyData?: LegacyData): Promise<SCPData>;
    generateImage(prompt: string, aspectRatio?: "1:1" | "16:9" | "3:4"): Promise<string | null>;
    initializeGameChatStream(scp: SCPData, role: string, language: Language, legacyData: LegacyData | undefined, difficulty: GameDifficulty): AsyncGenerator<string>;
    sendAction(action: string, currentStability: number, turnCount: number, language: Language, ragContext?: string, mapContext?: string, npcContext?: string): AsyncGenerator<string>;
    getChatHistory(): Promise<any[]>;
    restoreChatSession(history: any[], role: string, language: Language): Promise<void>;
    generateAudioDramaScript(messages: Message[], role: string, scpDesignation: string, language: Language): Promise<AudioDramaScript | null>;
    generateGameReview(role: string, ending: EndingType, language: Language): Promise<GameReviewData>;
    askNarratorQuestion(question: string, language: Language): AsyncGenerator<string>;
    generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult>;

    // Multi-Agent Methods
    getRouterDecision(mapBlueprint: MapBlueprint, playerAction: string, narrativeOutput: string, currentLoc: string, allNpcs: { id: string, nodeId: string }[], npcContext: any, language: Language): Promise<RouterOutput>;
    getNPCAction(npc: MapBlueprintNPC, role: string, scpDesignation: string, language: Language, difficulty: GameDifficulty, gameBackground: string, narratorOpening: string, contextDelta: any, history?: any[]): Promise<{ proposal: NPCActionProposal, history: any[] }>;
}
