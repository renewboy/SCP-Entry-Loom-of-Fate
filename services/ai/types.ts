import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from '../../types';
import { EditorChatMessage } from './editorAssistantTypes';
import { AgentStreamEvent } from './streamProtocol';

export interface ContextPromptAnchors {
    anchorBefore?: string[];
    anchorAfter?: string[];
}

export interface AIProviderConfig {
    apiKey: string;
    baseUrl?: string;
    chatModel: string;
    imageModel: string;
    embeddingModel?: string;
}

export interface AIService {
    analyzeSCPUrl(input: string, language: Language, role: string, difficulty: GameDifficulty, legacyData?: LegacyData, profile?: EntityProfile): Promise<SCPData>;
    generateProfileCandidates(role: string, scpDesignation: string, language: Language, legacyData?: LegacyData): Promise<EntityProfile[]>;
    generateImage(prompt: string, aspectRatio?: ImageAspectRatio, responseFormat?: "url" | "b64_json"): Promise<string | null>;
    initializeGameChatStream(scp: SCPData, role: string, language: Language, legacyData: LegacyData | undefined, difficulty: GameDifficulty): AsyncGenerator<string>;
    setCallbacks(callbacks: { onTokenUpdate?: (count: number) => void; onStatusUpdate?: (status: 'idle' | 'generating' | 'summarizing') => void }): void;
    getSummaryContext(): string;
    sendAction(
        action: string, 
        currentStability: number, 
        turnCount: number, 
        language: Language, 
        ragContext?: string, 
        mapContext?: ((enhanced?: boolean) => string),
        promptAnchors?: ContextPromptAnchors,
        signal?: AbortSignal
    ): AsyncGenerator<string>;
    getChatHistory(): Promise<any[]>;
    restoreChatSession(options: { history: any[]; role: string; language?: Language; tokenCount?: number; summaryContext?: string }): Promise<void>;
    generateAudioDramaScript(messages: Message[], role: string, scpDesignation: string, language: Language): Promise<AudioDramaScript | null>;
    generateGameReview(role: string, ending: EndingType, language: Language): Promise<GameReviewData>;
    askNarratorQuestion(question: string, language: Language): AsyncGenerator<string>;
    generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult>;
    streamEditorAssistant(
        messages: EditorChatMessage[],
        scpData: SCPData,
        language: Language,
        onToolCall: (toolName: string, args: any) => Promise<any>,
        difficulty?: GameDifficulty,
        legacyData?: LegacyData
    ): AsyncGenerator<AgentStreamEvent>;
}

export type ImageAspectRatio = "1:1" | "16:9" | "3:4" | "9:16";
