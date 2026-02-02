import { Content } from "@google/genai";
import { AIService } from "./ai/types";
import { GeminiProvider } from "./ai/providers/geminiProvider";
import { OpenAIProvider } from "./ai/providers/openaiProvider";
import { aiConfig } from "../config/aiConfig";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData } from "../types";
import { extractVisualPrompt, extractStability, extractEnding } from "./ai/utils";

// Re-export utils for consumers
export { extractVisualPrompt, extractStability, extractEnding };

// Singleton instance
let aiProvider: AIService | null = null;

const getProvider = (): AIService => {
    if (aiProvider) return aiProvider;

    console.log(`[AIService] Initializing provider: ${aiConfig.provider}`);
    if (aiConfig.provider === 'openai') {
        aiProvider = new OpenAIProvider();
    } else {
        aiProvider = new GeminiProvider();
    }
    return aiProvider;
};

// Facade methods
export const analyzeSCPUrl = async (input: string, language: Language = 'zh'): Promise<SCPData> => {
    return getProvider().analyzeSCPUrl(input, language);
};

export const initializeGameChatStream = (scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData): AsyncGenerator<string> => {
    return getProvider().initializeGameChatStream(scp, role, language, legacyData);
};

export const sendAction = (action: string, currentStability: number, turnCount: number, language: Language = 'zh'): AsyncGenerator<string> => {
    return getProvider().sendAction(action, currentStability, turnCount, language);
};

export const getChatHistory = async (): Promise<Content[]> => {
    return getProvider().getChatHistory();
};

export const restoreChatSession = async (history: Content[], role: string, language: Language = 'zh'): Promise<void> => {
    return getProvider().restoreChatSession(history, role, language);
};

export const generateAudioDramaScript = async (messages: Message[], role: string, scpDesignation: string, language: Language = 'zh'): Promise<AudioDramaScript | null> => {
    return getProvider().generateAudioDramaScript(messages, role, scpDesignation, language);
};

export const generateGameReview = async (scpData: SCPData, role: string, ending: EndingType, language: Language, messages: Message[], stabilityHistory: number[]): Promise<GameReviewData> => {
    return getProvider().generateGameReview(scpData, role, ending, language, messages, stabilityHistory);
};

export const askNarratorQuestion = (question: string, language: Language): AsyncGenerator<string> => {
    return getProvider().askNarratorQuestion(question, language);
};

export const generateLegacyData = async (ending: string, role: string, language: Language): Promise<Partial<LegacyData>> => {
    return getProvider().generateLegacyData(ending, role, language);
};

// Image Generation (Always uses Gemini Provider directly or via Facade if we wanted, 
// but here we can just use GeminiProvider specifically or let the main provider handle it if it supported it.
// Since OpenAI provider doesn't support it, we instantiate a GeminiProvider just for images if needed,
// OR we assume the user wants Gemini for images regardless of Chat Provider.)
// The prompt says: "Image generation still uses Gemini".
const imageProvider = new GeminiProvider();

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> => {
    return imageProvider.generateImage(prompt, aspectRatio);
};
