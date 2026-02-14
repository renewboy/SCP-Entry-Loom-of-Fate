import { GameState, GameStatus } from '../types';
import { initializeGameChatStream, extractStability, extractVisualPrompt, generateImage, extractLoc, extractMapUpdate } from '../services/aiService';
import { loadGlobalSettings } from '../services/indexedDBService';

interface StartGameParams {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    language: 'zh' | 'en'; // Assuming Language type from types.ts matches this or similar
    t: (key: string) => string;
}

export const startGameProcess = async ({ gameState, setGameState, language, t }: StartGameParams) => {
    if (!gameState.scpData) return;
    
    try {
        const settings = await loadGlobalSettings();
        const difficulty = settings.difficulty || 'normal';
        
        const finalBlueprint = gameState.scpData.mapBlueprint;
        
        // Update scpData with final blueprint
        const finalScpData = {
            ...gameState.scpData,
            mapBlueprint: finalBlueprint
        };

        const draftBg = finalScpData.storyDraft?.backgroundImage;
        const draftEntity = finalScpData.storyDraft?.entityImage;

        // --- Start Async Image Generation (Non-blocking) ---
        // 1. Background Image
        const hasBg = draftBg || gameState.backgroundImage;
        if (!hasBg && settings.enableBackgroundImages) {
             const bgDesc = finalScpData.visualDescription || `texture and atmosphere of ${finalScpData.name}`;
             const bgPrompt = `Atmospheric, cinematic lighting, abstract horror background representing ${bgDesc}, subtle, texture, scp foundation style, dark moody`;
             generateImage(bgPrompt, "16:9").then(bgUrl => {
                 if(bgUrl) setGameState(prev => ({...prev, backgroundImage: bgUrl}));
             });
        }

        // 2. Entity Image
        const hasEntity = draftEntity || gameState.mainImage;
        if (!hasEntity && settings.enableEntityImages) {
            const entityDesc = finalScpData.entityDescription;
            const mainPrompt = `Close up full body shot of ${entityDesc}. detailed, photorealistic, containment cell, scp foundation record photo`;
            generateImage(mainPrompt, "1:1").then(mainUrl => {
                 if(mainUrl) setGameState(prev => ({...prev, mainImage: mainUrl}));
            });
        }

        const stream = initializeGameChatStream(finalScpData, gameState.role, language, gameState.legacy, difficulty);
        const msgId = 'intro';
        let fullText = "";
        let isFirstChunk = true;

        // Prepare initial state
        const initialMap = finalBlueprint ? {
            id: finalBlueprint.id,
            title: finalBlueprint.title,
            currentNodeId: finalBlueprint.startNodeId,
            discoveredNodeIds: [finalBlueprint.startNodeId]
        } : undefined;

        const initialNpcs = finalBlueprint ? finalBlueprint.npcs.map(npc => ({
            id: npc.id,
            name: npc.name,
            archetype: npc.archetype,
            nodeId: npc.initialNodeId,
            alive: true,
            secretTags: npc.secretTags,
            dialogueGoals: npc.dialogueGoals
        })) : undefined;

        const initialObjectives = finalBlueprint ? finalBlueprint.objectives.map(obj => ({
            id: obj.id,
            title: obj.title,
            type: obj.type,
            nodeId: obj.nodeId,
            status: 'ACTIVE' as const,
            progress: typeof obj.progress === 'number' ? obj.progress : 0,
            detail: obj.detail,
            reward: obj.reward
        })) : undefined;

        for await (const chunk of stream) {
            fullText += chunk;
            
            if (isFirstChunk) {
                setGameState(prev => ({
                    ...prev,
                    status: GameStatus.PLAYING,
                    scpData: finalScpData,
                    stability: 100,
                    turnCount: 0,
                    map: initialMap,
                    npcs: initialNpcs,
                    objectives: initialObjectives,
                    inventory: [],
                    backgroundImage: draftBg || prev.backgroundImage,
                    mainImage: draftEntity || prev.mainImage,
                    messages: [{
                        id: msgId,
                        sender: 'narrator',
                        content: fullText,
                        timestamp: Date.now(),
                        isTyping: true
                    }]
                }));
                isFirstChunk = false;
            } else {
                 setGameState(prev => ({
                    ...prev,
                    messages: prev.messages.map(m => 
                        m.id === msgId ? { ...m, content: fullText } : m
                    )
                 }));
            }
        }

        // Post-process
        const stabilityResult = extractStability(fullText);
        const introStability = stabilityResult.newStability ?? 100;
        const { cleanText: visualCleanText, visualPrompt } = extractVisualPrompt(stabilityResult.cleanText);
        const LocResult = extractLoc(visualCleanText);
        const mapUpdateResult = extractMapUpdate(LocResult.cleanText);
        setGameState(prev => ({
            ...prev,
            messages: prev.messages.map(m => 
                m.id === msgId ? { 
                    ...m, 
                    content: mapUpdateResult.cleanText, 
                    isTyping: false,
                    stabilitySnapshot: introStability 
                } : m
            )
        }));

        // --- Image Generation Logic (Scene Only) ---
        
        // 3. Scene Image (Intro)
        if (visualPrompt && settings.enableSceneImages) {
            generateImage(visualPrompt, "16:9").then(introImageUrl => {
                if (introImageUrl) {
                    setGameState(prev => ({
                        ...prev,
                        messages: prev.messages.map(m => 
                            m.id === msgId ? { ...m, imageUrl: introImageUrl } : m
                        )
                    }));
                }
            });
        }

    } catch (e) {
        console.error("Error starting game process:", e);
        throw e;
    }
};
