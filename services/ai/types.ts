import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty } from '../../types';

export interface AIService {
    analyzeSCPUrl(input: string, language: Language, role: string, difficulty: GameDifficulty, legacyData?: LegacyData): Promise<SCPData>;
    initializeGameChatStream(scp: SCPData, role: string, language: Language, legacyData: LegacyData | undefined, difficulty: GameDifficulty): AsyncGenerator<string>;
    sendAction(action: string, currentStability: number, turnCount: number, language: Language, ragContext?: string, mapContext?: string): AsyncGenerator<string>;
    getChatHistory(): Promise<any[]>;
    restoreChatSession(history: any[], role: string, language: Language): Promise<void>;
    generateAudioDramaScript(messages: Message[], role: string, scpDesignation: string, language: Language): Promise<AudioDramaScript | null>;
    generateGameReview(role: string, ending: EndingType, language: Language): Promise<GameReviewData>;
    askNarratorQuestion(question: string, language: Language): AsyncGenerator<string>;
    generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult>;
}
