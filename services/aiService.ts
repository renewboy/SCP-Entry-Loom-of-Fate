import { Content } from "@google/genai";
import { ContextPromptAnchors, ImageAspectRatio } from "./ai/types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from "../types";
import { extractVisualPrompt, extractStability, extractEnding, extractLoc, extractMapUpdate, extractNarrativeMedia } from "./ai/utils";
import { getEmbeddings } from "./ai/providers/embeddingProvider";
import { hasLocalMemories, searchLocalMemories } from "./indexedDBService";
import { hasStagedRagMemories, searchStagedRagMemories } from "./ragStaging";
import { getAnalysisProvider, getAssistantProvider, getImageProvider, getNarrationProvider, resetProviderRouter } from "./ai/providerRouter";
import { AgentStreamEvent } from "./ai/streamProtocol";
import { EditorChatMessage } from "./ai/editorAssistantTypes";

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

let mapContextProvider: ((enhanced?: boolean) => string) | null = null;
let contextPromptAnchorProvider: (() => ContextPromptAnchors | undefined) | null = null;

export const resetProvider = () => {
    resetProviderRouter();
};

export const setProviderCallbacks = async (callbacks: { onTokenUpdate?: (count: number) => void; onStatusUpdate?: (status: 'idle' | 'generating' | 'summarizing') => void }) => {
    (await getNarrationProvider()).setCallbacks(callbacks);
};

export const analyzeSCPUrl = async (input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData, profile?: EntityProfile): Promise<SCPData> => {
    return (await getAnalysisProvider()).analyzeSCPUrl(input, language, role, difficulty, legacyData, profile);
};

export const generateProfileCandidates = async (role: string, scpDesignation: string, language: Language = 'zh', legacyData?: LegacyData): Promise<EntityProfile[]> => {
    return (await getAnalysisProvider()).generateProfileCandidates(role, scpDesignation, language, legacyData);
};

export const initializeGameChatStream = async (scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData, difficulty: GameDifficulty = 'normal'): Promise<AsyncGenerator<string>> => {
    return (await getNarrationProvider()).initializeGameChatStream(scp, role, language, legacyData, difficulty);
};

export const getSummaryContext = async (): Promise<string> => {
    return (await getNarrationProvider()).getSummaryContext();
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

    const provider = await getNarrationProvider();
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
    return (await getNarrationProvider()).getChatHistory();
};

export const restoreChatSession = async (options: { history: Content[]; role: string; language?: Language; tokenCount?: number; summaryContext?: string }): Promise<void> => {
    return (await getNarrationProvider()).restoreChatSession(options);
};

export const generateAudioDramaScript = async (messages: Message[], role: string, scpDesignation: string, language: Language = 'zh'): Promise<AudioDramaScript | null> => {
    return (await getNarrationProvider()).generateAudioDramaScript(messages, role, scpDesignation, language);
};

export const generateGameReview = async (role: string, ending: EndingType, language: Language): Promise<GameReviewData> => {
    return (await getNarrationProvider()).generateGameReview(role, ending, language);
};

export async function* askNarratorQuestion(question: string, language: Language): AsyncGenerator<string> {
    const provider = await getNarrationProvider();
    yield* provider.askNarratorQuestion(question, language);
}

export const generateLegacyData = async (
    ending: string, 
    role: string, 
    language: Language,
    timelineId?: string,
    scpDesignation?: string
): Promise<LegacyGenerationResult> => {
    return (await getNarrationProvider()).generateLegacyData(ending, role, language);
};

export const generateImage = async (prompt: string, aspectRatio: ImageAspectRatio = "1:1", responseFormat: "url" | "b64_json" = "url"): Promise<string | null> => {
    return (await getImageProvider()).generateImage(prompt, aspectRatio, responseFormat);
};

export async function* streamEditorAssistant(
    messages: EditorChatMessage[],
    scpData: SCPData,
    language: Language,
    onToolCall: (toolName: string, args: any) => Promise<any>,
    difficulty?: GameDifficulty,
    legacyData?: LegacyData
): AsyncGenerator<AgentStreamEvent> {
    const provider = await getAssistantProvider();
    yield* provider.streamEditorAssistant(messages, scpData, language, onToolCall, difficulty, legacyData);
};

export { getEmbeddings };
