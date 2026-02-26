import { AIService, NPCActionProposal } from "./ai/types";
import { GameState, Language } from "../types";
import { getEffectiveAIConfig } from "./aiConfigService";
import { GeminiProvider } from "./ai/providers/geminiProvider";
import { OpenAIProvider } from "./ai/providers/openaiProvider";
import { loadGlobalSettings } from "./indexedDBService";

// Store conversation history per NPC per Session
// Key: npcId, Value: Chat History array
export const npcSessionCache = new Map<string, any[]>();
let aiProvider: AIService | null = null;
let cachedProviderType: string | null = null;

const getProvider = async (): Promise<AIService> => {
    const effectiveConfig = await getEffectiveAIConfig();
    const providerType = effectiveConfig.provider;
    
    if (aiProvider && cachedProviderType === providerType) {
        return aiProvider;
    }
    
    // Reset cache if provider changes
    if (cachedProviderType !== providerType) {
        npcSessionCache.clear();
        console.log(`[NPCSessionManager] Provider changed to ${providerType}, cleared NPC caches.`);
    }

    cachedProviderType = providerType;
    console.log(`[NPCSessionManager] Initializing provider: ${providerType}`);

    if (providerType === 'openai') {
        aiProvider = new OpenAIProvider();
    } else {
        aiProvider = new GeminiProvider();
    }
    return aiProvider;
};

export const clearNPCSessionCache = () => {
    npcSessionCache.clear();
    console.log("[NPCSessionManager] Cleared all NPC session caches.");
};

export const npcSessionManager = {
    // Process NPC turn
    processNPCTurn: async (
        npcId: string,
        gameState: GameState,
        contextDelta: any, // The "Narrative Summary" + Context updates
        narratorOpening: string, // First turn narrator content
        language: Language
    ): Promise<NPCActionProposal | null> => {
        const npc = gameState.scpData?.mapBlueprint?.npcs.find(n => n.id === npcId);
        if (!npc) {
            console.warn(`[NPCSessionManager] NPC ${npcId} not found in blueprint.`);
            return null;
        }

        const role = gameState.role;
        const scpDesignation = gameState.scpData?.designation;
        const gameBackground = gameState.scpData?.storyDraft?.storyBackground;
        const settings = await loadGlobalSettings();
        const difficulty = settings.difficulty;

        // Retrieve or init history: Try memory cache first, then GameState persistence
        let history = npcSessionCache.get(npcId);
        if (!history) {
            // Check if we have persisted history in GameState (from load)
            if (gameState.npcHistories && gameState.npcHistories[npcId]) {
                history = gameState.npcHistories[npcId];
                console.log(`[NPCSessionManager] Restored history for ${npcId} from GameState.`);
            } else {
                history = [];
            }
            npcSessionCache.set(npcId, history);
        }
        
        try {
            const provider = await getProvider();
            const { proposal, history: newHistory } = await provider.getNPCAction(
                npc,
                role,
                scpDesignation,
                language,
                difficulty,
                gameBackground,
                narratorOpening,
                contextDelta,
                history
            );

            // Update cache
            npcSessionCache.set(npcId, newHistory);
            
            return proposal;

        } catch (error) {
            console.error(`[NPCSessionManager] Error processing turn for ${npcId}:`, error);
            return null;
        }
    },

    // Get current history for debugging/UI/Saving
    getHistory: (npcId: string) => {
        return npcSessionCache.get(npcId) || [];
    },

    // Get ALL histories for saving
    getAllHistories: () => {
        const histories: Record<string, any[]> = {};
        for (const [npcId, history] of npcSessionCache.entries()) {
            histories[npcId] = history;
        }
        return histories;
    },
    
    // Clear cache (on new game or load)
    clearCache: () => {
        npcSessionCache.clear();
    }
};
