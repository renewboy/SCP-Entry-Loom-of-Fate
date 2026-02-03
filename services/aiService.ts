import { Content } from "@google/genai";
import { AIService } from "./ai/types";
import { GeminiProvider } from "./ai/providers/geminiProvider";
import { OpenAIProvider } from "./ai/providers/openaiProvider";
import { aiConfig } from "../config/aiConfig";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult } from "../types";
import { extractVisualPrompt, extractStability, extractEnding } from "./ai/utils";
import { archiveMemories, searchMemories } from './supabaseService';

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

export const retrieveRelevantMemories = async (
    action: string,
    timelineId: string
): Promise<string> => {
    if (!timelineId) return "";
    
    try {
        const embeddings = await getEmbeddings([action]);
        if (!embeddings || embeddings.length === 0) return "";
        
        const { data } = await searchMemories(embeddings[0], timelineId);
        
        if (!data || data.length === 0) return "";
        
        return data.map((m: any) => `[Memory Echo]: "${m.content}" (Role: ${m.role})`).join('\n');
    } catch (e) {
        console.error("Failed to retrieve memories", e);
        return "";
    }
};

export const sendAction = async function* (action: string, currentStability: number, turnCount: number, language: Language = 'zh', timelineId?: string): AsyncGenerator<string> {
    let ragContext = "";
    if (timelineId) {
        ragContext = await retrieveRelevantMemories(action, timelineId);
        if (ragContext) {
             console.log(`[AIService] Injected RAG Context (${ragContext.length} chars)`);
        }
    }
    
    // We pass ragContext to provider. 
    // The Provider interface needs to be updated to accept this optional parameter.
    
    // Inject special token if RAG is active so frontend knows to trigger effect
    // Using a cleaner token strategy: Yield it as a separate chunk FIRST
    if (ragContext) {
        // Use a standard marker that frontend can easily regex out
        yield "[MEMORY_ACTIVE]"; 
    }

    const generator = getProvider().sendAction(action, currentStability, turnCount, language, ragContext);
    for await (const chunk of generator) {
        yield chunk;
    }
};


export const getChatHistory = async (): Promise<Content[]> => {
// ...
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

export const generateLegacyData = async (
    ending: string, 
    role: string, 
    language: Language,
    timelineId?: string,
    scpDesignation?: string
): Promise<LegacyGenerationResult> => {
    const result = await getProvider().generateLegacyData(ending, role, language);
    
    // Asynchronous Memory Archival
    if (timelineId && result.memoryRecords && result.memoryRecords.length > 0) {
        // We process this in background or await it? 
        // Better to await to ensure data integrity before user leaves, 
        // but 'generateLegacyData' is usually called in UI with a loading state.
        
        // Filter out null summaries
        const validMemories = result.memoryRecords.filter(m => m.summary && m.summary.trim().length > 0);
        
        if (validMemories.length > 0) {
            console.log(`[AIService] Archiving ${validMemories.length} summarized memories for timeline ${timelineId}...`);
            try {
                const summaries = validMemories.map(m => m.summary as string);
                const embeddings = await getEmbeddings(summaries);
                
                const memoryPayload = validMemories.map((m, i) => ({
                    timeline_id: timelineId,
                    scp_number: scpDesignation || 'UNKNOWN',
                    content: m.summary as string,
                    embedding: embeddings[i],
                    role: role,
                    turn_number: m.turn,
                    tags: { keywords: m.keywords, source: 'ai_summary' }
                }));
                
                await archiveMemories(memoryPayload);
                console.log(`[AIService] Successfully archived memories.`);
            } catch (e) {
                console.error("[AIService] Failed to archive summarized memories:", e);
            }
        }
    }
    
    return result;
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

export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
    return getProvider().getEmbeddings(texts);
};
