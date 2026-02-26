import { Content } from "@google/genai";
import { AIService, RouterOutput, NPCActionProposal } from "./ai/types";
import { GeminiProvider } from "./ai/providers/geminiProvider";
import { OpenAIProvider } from "./ai/providers/openaiProvider";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, MapBlueprint, MapBlueprintNPC } from "../types";
import { extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate } from "./ai/utils";
import { getEmbeddings } from "./ai/providers/embeddingProvider";
import { searchLocalMemories } from "./indexedDBService";
import { searchStagedRagMemories } from "./ragStaging";
import { getEffectiveAIConfig } from "./aiConfigService";

export { extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate };

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

export const analyzeSCPUrl = async (input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData): Promise<SCPData> => {
    return (await getProvider()).analyzeSCPUrl(input, language, role, difficulty, legacyData);
};

export const initializeGameChatStream = async (scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData, difficulty: GameDifficulty = 'normal'): Promise<AsyncGenerator<string>> => {
    return (await getProvider()).initializeGameChatStream(scp, role, language, legacyData, difficulty);
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

export const sendAction = async function* (action: string, currentStability: number, turnCount: number, language: Language = 'zh', timelineId?: string, mapContext?: string, npcContext?: string): AsyncGenerator<string> {
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
        yield "[MEMORY_ACTIVE]"; 
    }

    const provider = await getProvider();
    const generator = provider.sendAction(action, currentStability, turnCount, language, ragContext, mapContext, npcContext);
    for await (const chunk of generator) {
        yield chunk;
    }
};


export const getChatHistory = async (): Promise<Content[]> => {
    return (await getProvider()).getChatHistory();
};

export const restoreChatSession = async (history: Content[], role: string, language: Language = 'zh'): Promise<void> => {
    return (await getProvider()).restoreChatSession(history, role, language);
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

export const generateImage = async (prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> => {
    return (await getProvider()).generateImage(prompt, aspectRatio);
};

export const sendRouterDecision = async (
    mapBlueprint: MapBlueprint,
    playerAction: string,
    narrativeOutput: string,
    currentLoc: string,
    allNpcs: { id: string, nodeId: string }[],
    npcContext: any,
    language: Language
): Promise<RouterOutput> => {
    return (await getProvider()).getRouterDecision(mapBlueprint, playerAction, narrativeOutput, currentLoc, allNpcs, npcContext, language);
};

export const getNPCAction = async (npc: MapBlueprintNPC, role: string, scpDesignation: string, language: Language, difficulty: GameDifficulty, gameBackground: string, narratorOpening: string, contextDelta: any, history?: any[]): Promise<{ proposal: NPCActionProposal, history: any[] }> => {
    return (await getProvider()).getNPCAction(npc, role, scpDesignation, language, difficulty, gameBackground, narratorOpening, contextDelta, history);
};

export { getEmbeddings };
