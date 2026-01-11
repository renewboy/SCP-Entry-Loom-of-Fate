import { Content } from "@google/genai";
import { AudioDramaScript, EndingType, GameReviewData, Language, Message, SCPData, ResourceState } from "../../types";

export interface AIService {
    analyzeSCPUrl(input: string, language: Language): Promise<SCPData>;
    initializeGameChatStream(scp: SCPData, role: string, language: Language): AsyncGenerator<string>;
    sendAction(action: string, currentState: ResourceState & { stability: number }, turnCount: number, language: Language): AsyncGenerator<string>;
    getChatHistory(): Promise<Content[]>;
    restoreChatSession(history: Content[], role: string, language: Language): Promise<void>;
    generateAudioDramaScript(messages: Message[], role: string, scpDesignation: string, language: Language): Promise<AudioDramaScript | null>;
    generateGameReview(scpData: SCPData, role: string, ending: EndingType, language: Language, messages: Message[], stabilityHistory: number[]): Promise<GameReviewData>;
    askNarratorQuestion(question: string, language: Language): AsyncGenerator<string>;
}
