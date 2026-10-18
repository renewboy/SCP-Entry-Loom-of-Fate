import { zodToJsonSchema } from "zod-to-json-schema";
import { AIProviderConfig, AIService, ContextPromptAnchors, ImageAspectRatio, ImageReference } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from "../../../types";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt, getProfileCandidatesPrompt, getCompressionPrompt } from "../prompts";
import { getEditorAssistantPrompt, getEditorAssistantContext, editorTools } from "../editorPrompts";
import { normalizeGameReviewData, safeParseJson, cleanHistoryText } from "../utils";
import { AudioDramaSchema } from "../schemas";
import {
    profileCandidatesSubmission,
    scpAnalysisSubmission,
    SubmissionContract,
    toOpenAIResponseTool,
    validateSubmission,
} from "../structuredOutput";
import { completeAgentLoop, createToolRegistry, runAgentLoop } from "../agentLoop";
import type { AgentToolHandler } from "../agentLoop";
import { OpenAIChatAgentAdapter, OpenAIResponsesAgentAdapter } from "../agentAdapters";
import { postJson, streamSse } from "./backendClient";
import { aiConfig } from "../../../config/aiConfig";
import { imageSizeFromAspectRatio } from "../utils";
import { translate } from "../../../utils/i18n";
import { AgentStreamEvent } from "../streamProtocol";
import { EditorChatMessage, toOpenAIMessages } from "../editorAssistantTypes";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
const getOpenAIText = (response: any): string => {
    return response?.output_text || "";
};

const getOpenAIResponseDelta = (chunk: any): string => {
    return chunk.type == "response.output_text.delta" ? chunk.delta : "";
};

export class OpenAIProvider implements AIService {
    private messages: ChatMessage[] = [];
    private summaryContext: string = "";
    private currentTokenCount: number = 0;
    private systemInstruction: string = "";
    private gameReviewHistory: ChatMessage[] = [];
    private qaHistory: ChatMessage[] = [];
    private cachedConfig: { apiKey: string; baseUrl: string; chatModel: string; imageModel: string; contextConfig: { tokenLimit: number; compressionCount: number } } | null = null;
    private callbacks: { onTokenUpdate?: (count: number) => void; onStatusUpdate?: (status: 'idle' | 'generating' | 'summarizing') => void } = {};
    private readonly providerConfig: AIProviderConfig;

    constructor(providerConfig: AIProviderConfig) {
        this.providerConfig = providerConfig;
    }

    private async getConfig() {
        if (this.cachedConfig) return this.cachedConfig;
        this.cachedConfig = {
            apiKey: this.providerConfig.apiKey,
            baseUrl: this.providerConfig.baseUrl || "",
            chatModel: this.providerConfig.chatModel,
            imageModel: this.providerConfig.imageModel,
            contextConfig: aiConfig.context,
        };
        return this.cachedConfig;
    }

    private buildResponseRequest(config: NonNullable<typeof this.cachedConfig>, request: Record<string, unknown>) {
        const text = request.text && typeof request.text === 'object'
            ? request.text as Record<string, unknown>
            : {};
        return {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            chatModel: config.chatModel,
            ...request,
            text: {
                ...text,
                verbosity: aiConfig.providers.openai.textVerbosity,
            },
            reasoning: {
                effort: aiConfig.providers.openai.reasoningEffort,
            },
        };
    }

    setCallbacks(callbacks: { onTokenUpdate?: (count: number) => void; onStatusUpdate?: (status: 'idle' | 'generating' | 'summarizing') => void }): void {
        this.callbacks = callbacks || {};
    }

    getSummaryContext(): string {
        return this.summaryContext;
    }

    private buildMessages(prompt: string, extraHistory: ChatMessage[] = []): ChatMessage[] {
        let baseMessages = [...this.messages, ...extraHistory];
        if (this.summaryContext) {
            const prefix = baseMessages.slice(0, 3);
            const suffix = baseMessages.slice(3);
            baseMessages = [
                ...prefix,
                { role: "system", content: `[PREVIOUS STORY SUMMARY]\n${this.summaryContext}` },
                ...suffix
            ];
        }
        return [
            ...baseMessages,
            { role: "user", content: prompt }
        ];
    }

    public async generateImage(prompt: string, aspectRatio: ImageAspectRatio = "1:1", responseFormat: "url" | "b64_json" = "url", referenceImages: ImageReference[] = []): Promise<string | null> {
        try {
            const config = await this.getConfig();
            const response = await postJson<any>("/api/ai/openai/generate-image", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.imageModel,
                size: imageSizeFromAspectRatio(aspectRatio),
                prompt: prompt,
                referenceImages,
                response_format: 'b64_json',
                extra_body: {
                    watermark: false,
                }
            });
            const item = response.data?.[0];
            return item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null;
        } catch (error) {
            return null;
        }
    }

    private async runSubmission<T>(prompt: string, contract: SubmissionContract<T>): Promise<T> {
        const config = await this.getConfig();
        const adapter = new OpenAIResponsesAgentAdapter({
            path: '/api/ai/openai/response',
            buildRequest: (input) => this.buildResponseRequest(config, {
                input,
                tools: [{ type: 'web_search' }, toOpenAIResponseTool(contract)],
            }),
        });
        const tools = new Map<string, AgentToolHandler<T>>([
            [contract.name, async args => ({ output: { success: true }, result: validateSubmission(contract, args) })],
        ]);
        return completeAgentLoop({
            adapter,
            history: [{ role: 'user', content: prompt }],
            tools,
        });
    }

    async generateProfileCandidates(role: string, scpDesignation: string, language: Language, legacyData?: LegacyData): Promise<EntityProfile[]> {
        return this.runSubmission(getProfileCandidatesPrompt(role, scpDesignation, language, legacyData), profileCandidatesSubmission);
    }

    async analyzeSCPUrl(input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData, profile?: EntityProfile): Promise<SCPData> {
        return this.runSubmission(getAnalyzeSCPPrompt(input, language, role, difficulty, legacyData, profile), scpAnalysisSubmission);
    }

    async *initializeGameChatStream(scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData, difficulty: GameDifficulty = 'normal'): AsyncGenerator<string> {
        console.log(`[OpenAIProvider] Initializing chat stream for ${scp.designation} as ${role} in ${language}`);
        this.systemInstruction = getSystemInstruction(role, language);
        const config = await this.getConfig();
        const startPrompt = getStartGamePrompt(role, scp.designation, scp.containmentClass, language, difficulty, legacyData, scp.mapBlueprint, scp.storyDraft, scp.npcVisuals);

        console.log("[OpenAIProvider] Sending start message... ");
        this.messages = [
            { role: "system", content: this.systemInstruction },
            { role: "user", content: startPrompt }
        ];
        this.gameReviewHistory = [];
        this.qaHistory = [];

        if (this.callbacks.onStatusUpdate) this.callbacks.onStatusUpdate('generating');
        let fullResponse = "";
        for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", this.buildResponseRequest(config, {
            input: this.messages,
            tools: [{ type: "web_search" }],
        }))) {
            const delta = getOpenAIResponseDelta(chunk);
            fullResponse += delta;
            yield delta;
            if (chunk.type === "response.completed") {
                const usage = chunk.response?.usage;
                if (usage) {
                    this.currentTokenCount = usage.total_tokens;
                    if (this.callbacks.onTokenUpdate) this.callbacks.onTokenUpdate(this.currentTokenCount);
                }
            }
        }
        console.log("[OpenAIProvider] Initialization complete. Response: ", fullResponse);
        this.messages.push({ role: "assistant", content: fullResponse });
    }

    async *sendAction(
        action: string, 
        currentStability: number, 
        turnCount: number, 
        language: Language = 'zh', 
        ragContext?: string, 
        mapContext?: ((enhanced?: boolean) => string),
        promptAnchors?: ContextPromptAnchors,
        signal?: AbortSignal
    ): AsyncGenerator<string> {
        console.log(`[OpenAIProvider] sendAction called. Input: "${action}", Stability: ${currentStability}, Turn: ${turnCount}`);
        const config = await this.getConfig();
        const { tokenLimit } = config.contextConfig;

        if (this.messages.length === 0) {
            console.error("[OpenAIProvider] CRITICAL: messages empty. Game state may have been reset.");
            throw new Error("Game not initialized - session missing");
        }

        if (this.currentTokenCount > tokenLimit) {
             console.log(`[OpenAIProvider] Token limit exceeded (${this.currentTokenCount} > ${tokenLimit}). Compressing...`);
             if (this.callbacks.onStatusUpdate) this.callbacks.onStatusUpdate('summarizing');
             await this.compressHistory(language);
             if (this.callbacks.onStatusUpdate) this.callbacks.onStatusUpdate('generating');
        }

        const resolvedMapContext = mapContext ? mapContext(this.currentTokenCount > tokenLimit) : undefined;
        const contextPrompt = getContextPrompt(action, currentStability, turnCount, language, ragContext, resolvedMapContext, promptAnchors);

        // Inject summary if exists
        const messagesToSend = this.buildMessages(contextPrompt);
        try {
            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", this.buildResponseRequest(config, {
                input: messagesToSend,
                tools: [],
            }), { signal })) {
                const delta = getOpenAIResponseDelta(chunk);
                fullResponse += delta;
                yield delta;
                if (chunk.type === "response.completed") {
                    const usage = chunk.response?.usage;
                    if (usage) {
                        this.currentTokenCount = usage.total_tokens;
                        if (this.callbacks.onTokenUpdate) this.callbacks.onTokenUpdate(this.currentTokenCount);
                    }
                }
            }
            if(fullResponse.trim().length === 0) {
                return;
            }
            const cleanResponse = cleanHistoryText(fullResponse);
            const cleanPrompt = cleanHistoryText(contextPrompt);
            this.messages.push({ role: "user", content: cleanPrompt });
            this.messages.push({ role: "assistant", content: cleanResponse });

        } catch (err) {
            console.error("[OpenAIProvider] Error in sendAction: ", err);
            throw err;
        }
    }

    private async compressHistory(language: Language): Promise<void> {
        const config = await this.getConfig();
        const { compressionCount } = config.contextConfig;

        if (this.messages.length <= compressionCount + 3) return;

        const systemMsg = this.messages[0];
        const firstMsg = this.messages[1];
        const firstResponse = this.messages[2];
        
        const toCompress = this.messages.slice(3, 3 + compressionCount);
        const remaining = this.messages.slice(3 + compressionCount);
        
        const historyText = toCompress.map(msg => {
             const role = msg.role === 'user' ? 'User' : 'Narrator';
             return `${role}: ${msg.content}`;
        }).join('\n\n');

        const firstMsgContent = [
            firstMsg?.content ? `User: ${firstMsg.content}` : "",
            firstResponse?.content ? `Narrator: ${firstResponse.content}` : ""
        ].filter(Boolean).join('\n');
        const prompt = getCompressionPrompt(historyText, language, firstMsgContent);
        
        try {
            const response = await postJson<any>("/api/ai/openai/response", this.buildResponseRequest(config, {
                input: prompt,
            }));
            const summary = getOpenAIText(response);
            if (summary) {
                this.summaryContext += `\n[Summary Segment]: ${summary}`;
                console.log(`[OpenAIProvider] Compressed history. summaryContext: ${this.summaryContext}`);
                this.messages = [systemMsg, firstMsg, firstResponse, ...remaining];
                console.log(`[OpenAIProvider] Compressed history. New length: ${this.messages.length}`);
                this.currentTokenCount = 0;
            }
        } catch (e) {
             console.error("Failed to compress history", e);
        }
    }

    async getChatHistory(): Promise<any[]> {
        let googleMessages: any[] = this.messages.map(msg => {
            let role = 'user';
            if (msg.role === 'assistant') role = 'model';
            else if (msg.role === 'system') role = 'system';
            if (msg.role === 'system') {
                return null; 
            }

            return {
                role: role,
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            };
        }).filter(Boolean) as any[];
        return googleMessages;
    }

    async restoreChatSession(options: { history: any[]; role: string; language?: Language; tokenCount?: number; summaryContext?: string }): Promise<void> {
        const { history, role, language = 'zh', tokenCount, summaryContext } = options;
        this.systemInstruction = getSystemInstruction(role, language);
        
        this.messages = [{ role: "system", content: this.systemInstruction }];
        this.gameReviewHistory = [];
        this.qaHistory = [];
        this.summaryContext = summaryContext || "";

        const restoredMessages: ChatMessage[] = history.map(msg => {
            const role = msg.role === 'model' ? 'assistant' : 'user';
            const content = msg.parts?.map(p => p.text).join('') || '';
            return { role, content } as ChatMessage;
        }).filter(msg => msg.content.trim() !== '');

        this.messages = [...this.messages, ...restoredMessages];
        this.currentTokenCount = typeof tokenCount === 'number' ? tokenCount : 0;
    }

    async generateAudioDramaScript(
        messages: Message[],
        role: string,
        scpDesignation: string,
        language: Language = 'zh'
    ): Promise<AudioDramaScript | null> {
        console.log("[OpenAIProvider] Generating Audio Drama Script (JSON)...");
        const config = await this.getConfig();
        
        const storyLog = messages
            .filter(m => m.sender === 'user' || m.sender === 'narrator')
            .map(m => `[ID:${m.id}] ${m.sender.toUpperCase()}: ${m.content}`)
            .join('\n\n');

        const prompt = getAudioDramaPrompt(storyLog, role, scpDesignation, language);

        try {
            const { output_text } = await postJson<{ output_text: string | null }>("/api/ai/openai/response", this.buildResponseRequest(config, {
                input: prompt,
                text: {
                    format:  {
                        type: "json_schema",
                        name: "audio_drama",
                        schema: zodToJsonSchema(AudioDramaSchema)
                    }
                },
            }));
            const text = output_text || "";
            if (!text) throw new Error("Empty response for audio script");

            const parsed = JSON.parse(text) as AudioDramaScript;
            return parsed;

        } catch (error) {
            return null;
        }
    }

    async generateGameReview(
        role: string,
        ending: EndingType,
        language: Language,
    ): Promise<GameReviewData> {
        if (this.messages.length === 0) {
            return normalizeGameReviewData(null);
        }
        const config = await this.getConfig();

        const prompt = getGameReviewPrompt(role, ending, language);

        try {
            const { output_text } = await postJson<{ output_text: string | null }>("/api/ai/openai/response", this.buildResponseRequest(config, {
                input: this.buildMessages(prompt),
            }));
            const text = output_text || "";
            if (!text) throw new Error("Empty response for review");
            const parsed = safeParseJson(text);
            if (!parsed) throw new Error('Failed to parse review JSON');
            
            this.gameReviewHistory.push({ role: "user", content: prompt });
            this.gameReviewHistory.push({ role: "assistant", content: text });
            
            return normalizeGameReviewData(parsed);
        } catch (error) {
            return normalizeGameReviewData(null);
        }
    }

    async *askNarratorQuestion(question: string, language: Language): AsyncGenerator<string> {
        if (this.messages.length === 0) {
            yield translate(language, 'ai.session_lost');
            return;
        }
        const config = await this.getConfig();

        const prompt = getQAPrompt(question, language);
        const qaMessages: ChatMessage[] = this.buildMessages(prompt, [
            ...this.gameReviewHistory,
            ...this.qaHistory
        ]);

        try {
            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", this.buildResponseRequest(config, {
                input: qaMessages,
            }))) {
                const delta = getOpenAIResponseDelta(chunk);
                fullResponse += delta;
                yield delta;
            }
            this.qaHistory.push({ role: "user", content: prompt });
            this.qaHistory.push({ role: "assistant", content: fullResponse });
        } catch (error) {
            yield translate(language, 'ai.causal_sync_timeout');
        }
    }

    async generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult> {
        if (this.messages.length === 0) {
             return { traits: [], items: [], echoes: [] };
        }
        const config = await this.getConfig();

        const prompt = getLegacyGenerationPrompt(ending, role, language);

        try {
            const { output_text } = await postJson<{ output_text: string | null }>("/api/ai/openai/response", this.buildResponseRequest(config, {
                input: this.buildMessages(prompt),
            }));
            const text = output_text || "";
            if (!text) throw new Error("Empty response for legacy data");

            const parsed = safeParseJson(text);
            if (!parsed) throw new Error('Failed to parse legacy JSON');

            return {
                traits: Array.isArray(parsed.traits) ? parsed.traits : [],
                items: Array.isArray(parsed.items) ? parsed.items : [],
                echoes: parsed.echo ? [{
                    ...parsed.echo,
                    timestamp: Date.now(),
                    roleName: role
                }] : [],
                memoryRecords: Array.isArray(parsed.memoryRecords) ? parsed.memoryRecords : []
            };
        } catch (error) {
             return { traits: [], items: [], echoes: [] };
        }
    }

    async *streamEditorAssistant(
        messages: EditorChatMessage[],
        scpData: SCPData,
        language: Language,
        onToolCall: (toolName: string, args: any) => Promise<any>,
        difficulty?: GameDifficulty,
        legacyData?: LegacyData
    ): AsyncGenerator<AgentStreamEvent> {
        const config = await this.getConfig();
        const systemPrompt = getEditorAssistantPrompt(language, difficulty, legacyData);
        const adapter = new OpenAIChatAgentAdapter({
            path: '/api/ai/openai/chat-completion-stream',
            stream: true,
            buildRequest: (input) => ({
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input,
                tools: editorTools,
            }),
        });
        yield* runAgentLoop({
            adapter,
            history: [
                { role: 'system', content: systemPrompt },
                { role: 'system', content: getEditorAssistantContext(scpData) },
                ...toOpenAIMessages(messages),
            ],
            tools: createToolRegistry(editorTools.map(tool => tool.function.name), async (name, args) => ({
                output: await onToolCall(name, args),
            })),
        });
    }

}
