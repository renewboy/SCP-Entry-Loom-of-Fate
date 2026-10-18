import { zodToJsonSchema } from "zod-to-json-schema";
import { AIProviderConfig, AIService, ContextPromptAnchors, ImageAspectRatio, ImageReference } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from "../../../types";
import { aiConfig } from "../../../config/aiConfig";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt, getProfileCandidatesPrompt, getCompressionPrompt } from "../prompts";
import { getEditorAssistantPrompt, getEditorAssistantContext, editorTools } from "../editorPrompts";
import { normalizeGameReviewData, safeParseJson, cleanHistoryText } from "../utils";
import { AudioDramaSchema } from "../schemas";
import {
    getGeminiSubmissionConfig,
    profileCandidatesSubmission,
    scpAnalysisSubmission,
    SubmissionContract,
    validateSubmission,
    webSearchFunction,
} from "../structuredOutput";
import { completeAgentLoop, createToolRegistry, runAgentLoop } from "../agentLoop";
import type { AgentToolHandler } from "../agentLoop";
import { GeminiAgentAdapter } from "../agentAdapters";
import { runWebSearch } from "../searchService";
import { postJson, streamSse } from "./backendClient";
import { translate } from "../../../utils/i18n";
import { AgentStreamEvent } from "../streamProtocol";
import { EditorChatMessage, toGeminiContents } from "../editorAssistantTypes";

const INIT_EMPTY_MAX_RETRIES = 3;

const getGeminiText = (response: any): string => {
    return (response?.candidates?.[0]?.content?.parts || [])
        .filter((part: any) => !part.thought && typeof part.text === 'string')
        .map((part: any) => part.text).join('');
};

export class GeminiProvider implements AIService {
    private history: any[] = [];
    private summaryContext: string = "";
    private currentTokenCount: number = 0;
    private systemInstruction: string = "";
    private temperature: number = aiConfig.generation.temperature;
    private cachedContentName: string | null = null;
    private gameReviewHistory: any[] = [];
    private qaHistory: any[] = [];
    private cachedConfig: { apiKey: string; baseUrl: string; chatModel: string; imageModel: string; embeddingModel?: string; contextConfig: { tokenLimit: number; compressionCount: number } } | null = null;
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
            embeddingModel: this.providerConfig.embeddingModel,
            contextConfig: aiConfig.context,
        };
        return this.cachedConfig;
    }

    setCallbacks(callbacks: { onTokenUpdate?: (count: number) => void; onStatusUpdate?: (status: 'idle' | 'generating' | 'summarizing') => void }): void {
        this.callbacks = callbacks || {};
    }

    getSummaryContext(): string {
        return this.summaryContext;
    }

    public async generateImage(prompt: string, aspectRatio: ImageAspectRatio = "1:1", responseFormat: "url" | "b64_json" = "url", referenceImages: ImageReference[] = []): Promise<string | null> {
        try {
            const config = await this.getConfig();
            console.log(`[GeminiProvider] Generating image for prompt: ${prompt}`);
            const response = await postJson<any>("/api/ai/gemini/generate-image", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.imageModel,
                prompt,
                referenceImages,
                aspectRatio,
                imageSize: '2K'
            });
            
            const parts = response.candidates?.[0]?.content?.parts || [];
            let imageDataUrl = null;
            for (const part of parts) {
                if (part.inlineData) {
                    imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
            console.log(`[GeminiProvider] Generated image: ${imageDataUrl?.slice(0, 300)}`);
            return imageDataUrl;
        } catch (error) {
            return null;
        }
    }

    private async runSubmission<T>(prompt: string, contract: SubmissionContract<T>): Promise<T> {
        const config = await this.getConfig();
        const adapter = new GeminiAgentAdapter({
            path: '/api/ai/gemini/generate-content',
            buildRequest: (contents) => ({
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents,
                config: {
                    ...getGeminiSubmissionConfig(contract),
                },
            }),
        });
        const tools = new Map<string, AgentToolHandler<T>>([
            [webSearchFunction.name, async (args, signal) => ({
                output: await runWebSearch(args.query, {
                    provider: 'gemini', apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.chatModel,
                }, signal),
            })],
            [contract.name, async args => ({ output: { success: true }, result: validateSubmission(contract, args) })],
        ]);
        return completeAgentLoop({
            adapter,
            history: [{ role: 'user', parts: [{ text: prompt }] }],
            tools,
        });
    }

    async analyzeSCPUrl(input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData, profile?: EntityProfile): Promise<SCPData> {
        console.log(`[GeminiProvider] Analyzing SCP: ${input}`);
        return this.runSubmission(getAnalyzeSCPPrompt(input, language, role, difficulty, legacyData, profile), scpAnalysisSubmission);
    }

    async generateProfileCandidates(role: string, scpDesignation: string, language: Language, legacyData?: LegacyData): Promise<EntityProfile[]> {
        console.log(`[GeminiProvider] Generating profile candidates for ${role}`);
        return this.runSubmission(getProfileCandidatesPrompt(role, scpDesignation, language, legacyData), profileCandidatesSubmission);
    }

    private async compressHistory(language: Language): Promise<void> {
        const config = await this.getConfig();
        const { compressionCount } = config.contextConfig;
        
        if (this.history.length <= compressionCount + 2) return;

        const firstMsg = this.history[0];
        const firstResponse = this.history[1];
        
        // Extract messages to compress (e.g., from index 2 to 2 + COUNT)
        const toCompress = this.history.slice(2, 2 + compressionCount);
        const remaining = this.history.slice(2 + compressionCount);

        const historyText = toCompress.map(msg => {
            const role = msg.role === 'user' ? 'User' : 'Narrator';
            const text = msg.parts?.[0]?.text || '';
            return `${role}: ${text}`;
        }).join('\n\n');

        // Extract first message content for better context
        const firstMsgContent = [
            firstMsg?.parts?.[0]?.text ? `User: ${firstMsg.parts[0].text}` : "",
            firstResponse?.parts?.[0]?.text ? `Narrator: ${firstResponse.parts[0].text}` : ""
        ].filter(Boolean).join('\n');
        const prompt = getCompressionPrompt(historyText, language, firstMsgContent);
        
        try {
            const response = await postJson<any>("/api/ai/gemini/generate-content", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });
            const summary = getGeminiText(response);
            if (summary) {
                this.summaryContext += `\n[Summary Segment]: ${summary}`;
                this.history = [firstMsg, firstResponse, ...remaining];
                console.log(`[GeminiProvider] Compressed history. New length: ${this.history.length}\nSummaryContext:\n${this.summaryContext}`);
                
                // Recalculate token count (rough estimate or call API)
                // For now, reset to 0 to force update on next turn, or just subtract estimate?
                // Safest is to let the next turn update it.
                this.currentTokenCount = 0; 
            }
        } catch (e) {
            console.error("Failed to compress history", e);
        }
    }

    private async ensureCachedContentName(): Promise<string | null> {
        if (!this.systemInstruction) return null;
        if (this.cachedContentName) return this.cachedContentName;
        try {
            const config = await this.getConfig();
            const { name } = await postJson<{ name: string }>("/api/ai/gemini/cache", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                ttl: aiConfig.providers.gemini.cacheTtl,
                systemInstruction: this.systemInstruction,
            });
            this.cachedContentName = name || null;
            return this.cachedContentName;
        } catch (error) {
            return null;
        }
    }

    private buildContents(prompt: string, extraHistory: any[] = []): any[] {
        if (!this.summaryContext) {
             return [
                ...this.history,
                ...extraHistory,
                { role: "user", parts: [{ text: prompt }] }
            ];
        }
        
        const firstTurn = this.history.slice(0, 2);
        const recentHistory = this.history.slice(2);
        
        const summaryMsg = {
            role: "user",
            parts: [{ text: `[SYSTEM: STORY SUMMARY]\n${this.summaryContext}` }]
        };
        const summaryAck = {
             role: "model",
             parts: [{ text: "Acknowledged. I retain these memories." }]
        };
        
        return [
            ...firstTurn,
            summaryMsg,
            summaryAck,
            ...recentHistory,
            ...extraHistory,
            { role: "user", parts: [{ text: prompt }] }
        ];
    }

    private async logTokenCount(contents: any[], onTokenUpdate?: (count: number) => void): Promise<void> {
        try {
            const config = await this.getConfig();
            const { totalTokens, cachedContentTokenCount } = await postJson<{ totalTokens: number; cachedContentTokenCount: number }>("/api/ai/gemini/count-tokens", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents,
            });
            this.currentTokenCount = totalTokens;
            console.log(`[GeminiProvider] tokens total=${totalTokens} cached=${cachedContentTokenCount}`);
            if (onTokenUpdate) onTokenUpdate(totalTokens);
        } catch (error) {
        }
    }

    private buildGeminiTools() {
        const toolList: any[] = [];
        for (const tool of editorTools) {
            const name = tool.function?.name;
            // if (name === "web_search") {
            //     toolList.push({ googleSearch: {} });
            //     continue;
            // }
            toolList.push({
                functionDeclarations: [{
                    name,
                    description: tool.function?.description || "",
                    parameters: tool.function?.parameters,
                }],
            });
        }
        return toolList;
    }

    async *initializeGameChatStream(scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData, difficulty: GameDifficulty = 'normal'): AsyncGenerator<string> {
        console.log(`[GeminiProvider] Initializing chat stream for ${scp.designation} as ${role} in ${language}`);
        this.systemInstruction = getSystemInstruction(role, language);
        console.log(`[GeminiProvider] initializeGameChatStream System instruction: ${this.systemInstruction}`);
        this.temperature = aiConfig.generation.temperature;
        this.cachedContentName = null;
        this.gameReviewHistory = [];
        this.qaHistory = [];
        const config = await this.getConfig();
        const startPrompt = getStartGamePrompt(role, scp.designation, scp.containmentClass, language, difficulty, legacyData, scp.mapBlueprint, scp.storyDraft, scp.npcVisuals);
        console.log(`[GeminiProvider] Sending start message...`);

        if (this.callbacks.onStatusUpdate) this.callbacks.onStatusUpdate('generating');
        this.history = [];
        const cachedContent = await this.ensureCachedContentName();
        console.log(`[GeminiProvider] Cached content name: ${cachedContent}`);
        for (let attempt = 0; attempt < INIT_EMPTY_MAX_RETRIES; attempt += 1) {
            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents: this.buildContents(startPrompt),
                config: {
                    systemInstruction: this.systemInstruction,
                    temperature: this.temperature,
                    tools: [
                        { googleSearch: {} },
                    ],
                },
            })) {
                const delta = getGeminiText(chunk);
                fullResponse += delta;
                yield delta;
            }

            if (fullResponse.trim().length === 0) {
                if (attempt < INIT_EMPTY_MAX_RETRIES - 1) {
                    continue;
                }
                const error = new Error("Gemini init empty response");
                (error as any).code = "GEMINI_INIT_EMPTY";
                throw error;
            }

            this.history.push({ role: "user", parts: [{ text: startPrompt }] });
            this.history.push({ role: "model", parts: [{ text: fullResponse }] });
            await this.logTokenCount(this.history, this.callbacks.onTokenUpdate);
            return;
        }
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
        console.log(`[GeminiProvider] sendAction called. Input: "${action}", Stability: ${currentStability}, Turn: ${turnCount}, Language: ${language}`);
        const config = await this.getConfig();
        const { tokenLimit } = config.contextConfig;
        
        if (this.currentTokenCount > tokenLimit) {
             console.log(`[GeminiProvider] Token limit exceeded (${this.currentTokenCount} > ${tokenLimit}). Compressing...`);
             if (this.callbacks.onStatusUpdate) this.callbacks.onStatusUpdate('summarizing');
             await this.compressHistory(language);
             if (this.callbacks.onStatusUpdate) this.callbacks.onStatusUpdate('generating');
        }

        const resolvedMapContext = mapContext ? mapContext(this.currentTokenCount > tokenLimit) : undefined;
        const contextPrompt = getContextPrompt(action, currentStability, turnCount, language, ragContext, resolvedMapContext, promptAnchors);

        try {
            const cachedContent = await this.ensureCachedContentName();
            console.log(`[GeminiProvider] Cached content name: ${cachedContent}`);
            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents: this.buildContents(contextPrompt),
                config: {
                    systemInstruction: cachedContent ? undefined : this.systemInstruction,
                    temperature: this.temperature,
                    tools: [],
                    cachedContent: cachedContent || undefined,
                },
            }, { signal })) {
                const delta = getGeminiText(chunk);
                fullResponse += delta;
                yield delta;

                const usage = chunk.usageMetadata || chunk.usage_metadata;
                if (usage) {
                    const total = usage.totalTokenCount || usage.total_token_count;
                    if (total) {
                        this.currentTokenCount = total;
                        if (this.callbacks.onTokenUpdate) this.callbacks.onTokenUpdate(total);
                    }
                }
            }
            console.log(`[GeminiProvider] SendAction Full response: "${fullResponse}"`);
            
            // Clean visual tags to save tokens
            const cleanResponse = cleanHistoryText(fullResponse);
            const cleanPrompt = cleanHistoryText(contextPrompt);

            this.history.push({ role: "user", parts: [{ text: cleanPrompt }] });
            this.history.push({ role: "model", parts: [{ text: cleanResponse }] });
            
            if (this.currentTokenCount === 0 || !this.callbacks.onTokenUpdate) {
                await this.logTokenCount(this.history, this.callbacks.onTokenUpdate);
            }
        } catch (err) {
            console.error("[GeminiProvider] Error in sendAction: ", err);
            throw err;
        }
    }

    async getChatHistory(): Promise<any[]> {
        return this.history;
    }

    async restoreChatSession(options: { history: any[]; role: string; language?: Language; tokenCount?: number; summaryContext?: string }): Promise<void> {
        const { history, role, language = 'zh', tokenCount, summaryContext } = options;
        this.systemInstruction = getSystemInstruction(role, language);
        this.temperature = aiConfig.generation.temperature;
        this.cachedContentName = null;
        this.gameReviewHistory = [];
        this.qaHistory = [];
        this.history = Array.isArray(history) ? history : [];
        this.currentTokenCount = typeof tokenCount === 'number' ? tokenCount : 0;
        this.summaryContext = summaryContext || "";
    }

    async generateAudioDramaScript(
        messages: Message[],
        role: string,
        scpDesignation: string,
        language: Language = 'zh'
    ): Promise<AudioDramaScript | null> {
        console.log("[GeminiProvider] Generating Audio Drama Script (JSON)...");
        const config = await this.getConfig();
        
        const storyLog = messages
            .filter(m => m.sender === 'user' || m.sender === 'narrator')
            .map(m => `[ID:${m.id}] ${m.sender.toUpperCase()}: ${m.content}`)
            .join('\n\n');

        const prompt = getAudioDramaPrompt(storyLog, role, scpDesignation, language);

        try {
            const response = await postJson<any>("/api/ai/gemini/generate-content", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.7,
                    responseMimeType: "application/json",
                    responseJsonSchema: zodToJsonSchema(AudioDramaSchema as any),
                },
            });
            const text = getGeminiText(response);
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
        const prompt = getGameReviewPrompt(role, ending, language);
        const config = await this.getConfig();

        try {
            const cachedContent = await this.ensureCachedContentName();
            let text = "";
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents: this.buildContents(prompt),
                config: {
                    systemInstruction: cachedContent ? undefined : this.systemInstruction,
                    temperature: this.temperature,
                    tools: [],
                    cachedContent: cachedContent || undefined,
                },
            })) {
                text += getGeminiText(chunk);
            }

            if (!text) throw new Error("Empty response for review");

            const parsed = safeParseJson(text);
            if (!parsed) throw new Error('Failed to parse review JSON');

            this.gameReviewHistory.push({ role: "user", parts: [{ text: prompt }] });
            this.gameReviewHistory.push({ role: "model", parts: [{ text }] });
            await this.logTokenCount([...this.history, ...this.gameReviewHistory]);
            return normalizeGameReviewData(parsed);
        } catch (error) {
            return normalizeGameReviewData(null);
        }
    }

    async *askNarratorQuestion(question: string, language: Language): AsyncGenerator<string> {
        const prompt = getQAPrompt(question, language);
        const config = await this.getConfig();

        try {
            const cachedContent = await this.ensureCachedContentName();
            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents: this.buildContents(prompt, [...this.gameReviewHistory, ...this.qaHistory]),
                config: {
                    systemInstruction: cachedContent ? undefined : this.systemInstruction,
                    temperature: this.temperature,
                    tools: [],
                    cachedContent: cachedContent || undefined,
                },
            })) {
                const delta = getGeminiText(chunk);
                fullResponse += delta;
                yield delta;
            }

            this.qaHistory.push({ role: "user", parts: [{ text: prompt }] });
            this.qaHistory.push({ role: "model", parts: [{ text: fullResponse }] });
            await this.logTokenCount([...this.history, ...this.gameReviewHistory, ...this.qaHistory]);
        } catch (error) {
            yield translate(language, 'ai.causal_sync_timeout');
        }
    }

    async generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult> {
        console.log(`[GeminiProvider] Generating Legacy Data...`);
        const config = await this.getConfig();

        const prompt = getLegacyGenerationPrompt(ending, role, language);

        try {
            const cachedContent = await this.ensureCachedContentName();
            let text = "";
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents: this.buildContents(prompt),
                config: {
                    systemInstruction: cachedContent ? undefined : this.systemInstruction,
                    temperature: this.temperature,
                    tools: [],
                    cachedContent: cachedContent || undefined,
                },
            })) {
                text += getGeminiText(chunk);
            }
            if (!text) throw new Error("Empty response for legacy data");

            const parsed = safeParseJson(text);
            if (!parsed) throw new Error('Failed to parse legacy JSON');

            this.history.push({ role: "user", parts: [{ text: prompt }] });
            this.history.push({ role: "model", parts: [{ text }] });
            await this.logTokenCount(this.history);
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
            console.error("Failed to generate legacy data:", error);
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
        const systemInstruction = `${getEditorAssistantPrompt(language, difficulty, legacyData)}\n\n${getEditorAssistantContext(scpData)}`;
        const adapter = new GeminiAgentAdapter({
            path: '/api/ai/gemini/chat-stream',
            stream: true,
            buildRequest: (contents) => ({
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.chatModel,
                contents,
                config: {
                    systemInstruction,
                    tools: this.buildGeminiTools(),
                },
            }),
        });
        yield* runAgentLoop({
            adapter,
            history: toGeminiContents(messages),
            tools: createToolRegistry(editorTools.map(tool => tool.function.name), async (name, args) => ({
                output: await onToolCall(name, args),
            })),
        });
    }

}
