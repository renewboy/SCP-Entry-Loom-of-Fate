import { Content } from "@google/genai";
import { AIService, ContextPromptAnchors, ImageAspectRatio } from "./ai/types";
import { GeminiProvider } from "./ai/providers/geminiProvider";
import { OpenAIProvider } from "./ai/providers/openaiProvider";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from "../types";
import { extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate, extractNarrativeMedia } from "./ai/utils";
import { getEmbeddings } from "./ai/providers/embeddingProvider";
import { hasLocalMemories, searchLocalMemories } from "./indexedDBService";
import { hasStagedRagMemories, searchStagedRagMemories } from "./ragStaging";
import { getEffectiveAIConfig } from "./aiConfigService";

export { extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate, extractNarrativeMedia };

interface RecentMemory {
    id: string;
    turnUsed: number;
}
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

let aiProvider: AIService | null = null;
let cachedProviderType: string | null = null;
let mapContextProvider: ((enhanced?: boolean) => string) | null = null;
let contextPromptAnchorProvider: (() => ContextPromptAnchors | undefined) | null = null;

const getProvider = async (): Promise<AIService> => {
    const effectiveConfig = await getEffectiveAIConfig();
    const providerType = effectiveConfig.provider;
    
    if (aiProvider && cachedProviderType === providerType) {
        return aiProvider;
    }

    console.log(`[AIService] Initializing provider: ${providerType}`);
    cachedProviderType = providerType;
    
    if (providerType === 'openai') {
        aiProvider = new OpenAIProvider();
    } else {
        aiProvider = new GeminiProvider();
    }
    return aiProvider;
};

export const resetProvider = () => {
    aiProvider = null;
    cachedProviderType = null;
};

export const setProviderCallbacks = async (callbacks: { onTokenUpdate?: (count: number) => void; onStatusUpdate?: (status: 'idle' | 'generating' | 'summarizing') => void }) => {
    (await getProvider()).setCallbacks(callbacks);
};

export const analyzeSCPUrl = async (input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData, profile?: EntityProfile): Promise<SCPData> => {
    return (await getProvider()).analyzeSCPUrl(input, language, role, difficulty, legacyData, profile);
};

export const generateProfileCandidates = async (role: string, scpDesignation: string, language: Language = 'zh', legacyData?: LegacyData): Promise<EntityProfile[]> => {
    return (await getProvider()).generateProfileCandidates(role, scpDesignation, language, legacyData);
};

export const initializeGameChatStream = async (scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData, difficulty: GameDifficulty = 'normal'): Promise<AsyncGenerator<string>> => {
    return (await getProvider()).initializeGameChatStream(scp, role, language, legacyData, difficulty);
};

export const getSummaryContext = async (): Promise<string> => {
    return (await getProvider()).getSummaryContext();
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
        const hasStaged = hasStagedRagMemories(timelineId);
        const hasLocal = await hasLocalMemories(timelineId);
        if (!hasStaged && !hasLocal) return "";

        const embeddings = await getEmbeddings([action]);
        if (!embeddings || embeddings.length === 0) return "";
        
        const { data } = await searchLocalMemories(embeddings[0], timelineId);
        
        // Filter out recently used memories
        const recentIds = new Set(validRecentMemories.map(m => m.id));
        const stagedHits = searchStagedRagMemories(embeddings[0], timelineId, recentIds);
        const localHits = (data || []).filter((m: any) => !recentIds.has(m.id));
        const merged = [
            ...stagedHits.map(h => ({ id: h.id, content: h.content, role: h.role, scp_number: h.scp_number })),
            ...localHits
        ];
        if (merged.length === 0) return "";
        const newMemories = merged;
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

export const setMapContextProvider = (provider: ((enhanced?: boolean) => string) | null) => {
    mapContextProvider = provider;
};

export const setContextPromptAnchorProvider = (provider: (() => ContextPromptAnchors | undefined) | null) => {
    contextPromptAnchorProvider = provider;
};

export const sendAction = async function* (
    action: string, 
    currentStability: number, 
    turnCount: number, 
    language: Language = 'zh', 
    timelineId?: string,
    signal?: AbortSignal
): AsyncGenerator<string> {
    let ragContext = "";
    console.log("timelineId:", timelineId);
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
        yield "[MEMORY_ACTIVE]"; 
    }

    const provider = await getProvider();
    const generator = provider.sendAction(
        action, 
        currentStability, 
        turnCount, 
        language, 
        ragContext, 
        mapContextProvider || undefined,
        contextPromptAnchorProvider?.(),
        signal
    );
    for await (const chunk of generator) {
        yield chunk;
    }
};


export const getChatHistory = async (): Promise<Content[]> => {
    return (await getProvider()).getChatHistory();
};

export const restoreChatSession = async (options: { history: Content[]; role: string; language?: Language; tokenCount?: number; summaryContext?: string }): Promise<void> => {
    return (await getProvider()).restoreChatSession(options);
};

export const generateAudioDramaScript = async (messages: Message[], role: string, scpDesignation: string, language: Language = 'zh'): Promise<AudioDramaScript | null> => {
    return (await getProvider()).generateAudioDramaScript(messages, role, scpDesignation, language);
};

export const generateGameReview = async (role: string, ending: EndingType, language: Language): Promise<GameReviewData> => {
    return (await getProvider()).generateGameReview(role, ending, language);
};

export async function* askNarratorQuestion(question: string, language: Language): AsyncGenerator<string> {
    const provider = await getProvider();
    yield* provider.askNarratorQuestion(question, language);
}

export const generateLegacyData = async (
    ending: string, 
    role: string, 
    language: Language,
    timelineId?: string,
    scpDesignation?: string
): Promise<LegacyGenerationResult> => {
    return (await getProvider()).generateLegacyData(ending, role, language);
};

export const generateImage = async (prompt: string, aspectRatio: ImageAspectRatio = "1:1", responseFormat: "url" | "b64_json" = "url"): Promise<string | null> => {
    return (await getProvider()).generateImage(prompt, aspectRatio, responseFormat);
};

export { getEmbeddings };
