import { AIService, RouterOutput } from "./ai/types";
import { MapBlueprint, Language, GameState } from "../types";
import { getEffectiveAIConfig } from "./aiConfigService";
import { GeminiProvider } from "./ai/providers/geminiProvider";
import { OpenAIProvider } from "./ai/providers/openaiProvider";

let aiProvider: AIService | null = null;
let cachedProviderType: string | null = null;

const getProvider = async (): Promise<AIService> => {
    const effectiveConfig = await getEffectiveAIConfig();
    const providerType = effectiveConfig.provider;
    
    if (aiProvider && cachedProviderType === providerType) {
        return aiProvider;
    }

    console.log(`[RouterService] Initializing provider: ${providerType}`);
    cachedProviderType = providerType;
    
    if (providerType === 'openai') {
        aiProvider = new OpenAIProvider();
    } else {
        aiProvider = new GeminiProvider();
    }
    return aiProvider;
};

export const routerService = {
    decideRelevantNPCs: async (
        gameState: GameState,
        playerAction: string,
        narrativeOutput: string,
        language: Language
    ): Promise<RouterOutput> => {
        if (!gameState.scpData?.mapBlueprint) {
            console.warn("[RouterService] No map blueprint found.");
            return { relevantNpcIds: [], encounteredNpcIds: [], npcSummaries: {} };
        }

        const map = gameState.map;
        const currentLoc = map?.currentNodeId || gameState.scpData.mapBlueprint.startNodeId;
        
        // Pass ALL alive NPCs with their locations to Router
        const allAliveNpcs = (gameState.npcs || [])
            .filter(npc => npc.alive)
            .map(npc => ({ id: npc.id, nodeId: npc.nodeId }));
        const npcContext = {
            summaries: gameState.npcLastSummaries || {},
            actions: gameState.npcLastActions || {}
        };

        try {
            const provider = await getProvider();
            return await provider.getRouterDecision(
                gameState.scpData.mapBlueprint,
                playerAction,
                narrativeOutput,
                currentLoc,
                allAliveNpcs,
                npcContext,
                language
            );
        } catch (error) {
            console.error("[RouterService] Error deciding relevant NPCs:", error);
            // Fallback: only visible NPCs are relevant (if router fails)
            const visibleNpcs = allAliveNpcs.filter(n => n.nodeId === currentLoc).map(n => n.id);
            return { relevantNpcIds: visibleNpcs, encounteredNpcIds: visibleNpcs, npcSummaries: {} };
        }
    }
};
