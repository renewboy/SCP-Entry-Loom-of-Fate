import { Content } from "@google/genai";
import { AIService } from "./ai/types";
import { GeminiProvider } from "./ai/providers/geminiProvider";
import { OpenAIProvider } from "./ai/providers/openaiProvider";
import { aiConfig } from "../config/aiConfig";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty } from "../types";
import { extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate } from "./ai/utils";
import { archiveMemories, searchMemories } from './supabaseService';
import { getEmbeddings } from "./ai/providers/embeddingProvider";

// Re-export utils for consumers
export { extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate };

// Memory Cache for Deduplication
interface RecentMemory {
    id: string;
    turnUsed: number;
}
// Map<timelineId, RecentMemory[]>
const recentMemoriesMap = new Map<string, RecentMemory[]>();

export const clearMemoryCache = (timelineId?: string) => {
    if (timelineId) {
        recentMemoriesMap.delete(timelineId);
        console.log(`[AIService] Cleared memory cache for timeline: ${timelineId}`);
    } else {
        recentMemoriesMap.clear();
        console.log(`[AIService] Cleared all memory cache`);
    }
};

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
export const analyzeSCPUrl = async (input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData): Promise<SCPData> => {
    return getProvider().analyzeSCPUrl(input, language, role, difficulty, legacyData);
};

export const initializeGameChatStream = (scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData, difficulty: GameDifficulty = 'normal'): AsyncGenerator<string> => {
    return getProvider().initializeGameChatStream(scp, role, language, legacyData, difficulty);
};

export const retrieveRelevantMemories = async (
    action: string,
    timelineId: string,
    turnCount: number
): Promise<string> => {
    if (!timelineId) return "";
    
    // Clean up cache for this timeline
    const recentMemories = recentMemoriesMap.get(timelineId) || [];
    // Keep memories used within last 3 turns (so they are skipped if turnCount - turnUsed <= 3)
    const validRecentMemories = recentMemories.filter(m => turnCount - m.turnUsed <= 3);
    recentMemoriesMap.set(timelineId, validRecentMemories);
    console.log(`[Turn ${turnCount}] valid memories:`, validRecentMemories);

    try {
        const embeddings = await getEmbeddings([action]);
        if (!embeddings || embeddings.length === 0) return "";
        
        const { data } = await searchMemories(embeddings[0], timelineId);
        
        if (!data || data.length === 0) return "";
        
        // Filter out recently used memories
        const recentIds = new Set(validRecentMemories.map(m => m.id));
        const newMemories = data.filter((m: any) => !recentIds.has(m.id));
        console.log(`[Turn ${turnCount}] new memories:`, newMemories);

        if (newMemories.length === 0) return "";

        // Update cache with newly selected memories
        const updatedRecentMemories = [
            ...validRecentMemories,
            ...newMemories.map((m: any) => ({ id: m.id, turnUsed: turnCount }))
        ];
        recentMemoriesMap.set(timelineId, updatedRecentMemories);
        console.log(`[Turn ${turnCount}] recent memories:`, updatedRecentMemories);
        return newMemories.map((m: any) => `[Memory Echo]: "${m.content}" (Role: ${m.role}, SCP: ${m.scp_number})`).join('\n');
    } catch (e) {
        console.error("Failed to retrieve memories", e);
        return "";
    }
};

export const sendAction = async function* (action: string, currentStability: number, turnCount: number, language: Language = 'zh', timelineId?: string, mapContext?: string): AsyncGenerator<string> {
    let ragContext = "";
    if (timelineId) {
        ragContext = await retrieveRelevantMemories(action, timelineId, turnCount);
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

    const generator = getProvider().sendAction(action, currentStability, turnCount, language, ragContext, mapContext);
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

export const generateGameReview = async (role: string, ending: EndingType, language: Language): Promise<GameReviewData> => {
    return getProvider().generateGameReview(role, ending, language);
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

// Image Generation (Always uses Gemini Provider via Facade.)
const imageProvider = new GeminiProvider();

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> => {
    return imageProvider.generateImage(prompt, aspectRatio);
};

export { getEmbeddings };
