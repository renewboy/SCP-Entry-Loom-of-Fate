import { GameState, Language } from "../types";
import { routerService } from "./routerService";
import { npcSessionManager } from "./npcSessionManager";
import { sendAction } from "./aiService";
import { NPCActionProposal } from "./ai/types"; 

// Orchestrator: Manages the turn loop (Router -> NPC -> Narrator)
export const agentOrchestrator = {
    // Phase 1: Router Analysis (Decide active NPCs)
    runRouterPhase: async (
        gameState: GameState,
        playerAction: string,
        lastNarratorOutput: string,
        language: Language
    ) => {
        return await routerService.decideRelevantNPCs(
            gameState,
            playerAction,
            lastNarratorOutput,
            language
        );
    },

    // Phase 2: NPC Actions (Parallel Execution)
    runNPCPhase: async (
        relevantNpcIds: string[],
        gameState: GameState,
        npcSummaries: Record<string, string>,
        narratorOpening: string,
        language: Language
    ): Promise<NPCActionProposal[]> => {
        // Prepare context delta for RELEVANT NPCs (full summary)
        const fullContextDelta = {
            turn: gameState.turnCount,
            stability: gameState.stability,
            turnEvent: '',
            npcState: { nodeId: '', nodeName: '', alive: true }
        };

        // Prepare context delta for OTHER NPCs (empty summary, just turn tick)
        const silentContextDelta = {
            turn: gameState.turnCount,
            stability: gameState.stability,
            turnEvent: "", // No new info
            npcState: { nodeId: '', nodeName: '', alive: true }
        };

        // Get ALL alive NPCs
        const allAliveNpcIds = (gameState.npcs || [])
            .filter(n => n.alive)
            .map(n => n.id);

        const promises = allAliveNpcIds.map(npcId => {
            const runtimeNpc = (gameState.npcs || []).find(n => n.id === npcId);
            const nodeId = runtimeNpc?.nodeId || '';
            const nodeName = gameState.scpData?.mapBlueprint?.nodes.find(n => n.id === nodeId)?.name || nodeId;
            const npcState = { nodeId, nodeName, alive: runtimeNpc?.alive ?? true };
            const isRelevant = relevantNpcIds.includes(npcId);
            // Use full context if relevant, otherwise silent
            const delta = isRelevant
                ? { ...fullContextDelta, turnEvent: npcSummaries[npcId] || '', npcState }
                : { ...silentContextDelta, npcState };
            
            return npcSessionManager.processNPCTurn(npcId, gameState, delta, narratorOpening, language);
        });

        const results = await Promise.all(promises);
        
        // Filter out failures (nulls) and cast to correct type
        const validResults = results.filter((res): res is NPCActionProposal => res !== null);

        return validResults;
    },

    // Phase 3: Narrator Generation (Streaming)
    // This is a wrapper around sendAction, but injects NPC context
    runNarratorPhase: async function* (
        action: string,
        currentStability: number,
        turnCount: number,
        language: Language,
        timelineId?: string,
        mapContext?: string,
        npcProposals?: NPCActionProposal[]
    ): AsyncGenerator<string> {
        
        // Format NPC context string
        let npcContextString = npcProposals ? JSON.stringify(npcProposals) : "";
       

        const generator = sendAction(
            action, 
            currentStability, 
            turnCount, 
            language, 
            timelineId, 
            mapContext, 
            npcContextString // Inject here
        );

        for await (const chunk of generator) {
            yield chunk;
        }
    }
};
