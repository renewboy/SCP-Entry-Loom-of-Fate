import { zodToJsonSchema } from "zod-to-json-schema";
import { AIService, ContextPromptAnchors, ImageAspectRatio } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from "../../../types";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt, getProfileCandidatesPrompt, getCompressionPrompt } from "../prompts";
import { getEditorAssistantPrompt, getEditorAssistantContext, editorTools } from "../editorPrompts";
import { normalizeGameReviewData, safeParseJson, cleanHistoryText } from "../utils";
import { AudioDramaSchema } from "../schemas";
import { postJson, streamSse } from "./backendClient";
import { aiConfig } from "../../../config/aiConfig";
import { imageSizeFromAspectRatio } from "../utils";
import { getEffectiveAIConfig } from "../../aiConfigService";
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

    private async getConfig() {
        if (this.cachedConfig) return this.cachedConfig;
        const effective = await getEffectiveAIConfig();
        this.cachedConfig = {
            apiKey: effective.openai.apiKey,
            baseUrl: effective.openai.baseUrl,
            chatModel: effective.openai.chatModel,
            imageModel: effective.openai.imageModel,
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

    constructor() {
    }

    public async generateImage(prompt: string, aspectRatio: ImageAspectRatio = "1:1", responseFormat: "url" | "b64_json" = "url"): Promise<string | null> {
        try {
            const config = await this.getConfig();
            const response = await postJson<any>("/api/ai/openai/generate-image", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.imageModel,
                size: imageSizeFromAspectRatio(aspectRatio),
                prompt: prompt,
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

    async generateProfileCandidates(role: string, scpDesignation: string, language: Language, legacyData?: LegacyData): Promise<EntityProfile[]> {
        const prompt = getProfileCandidatesPrompt(role, scpDesignation, language, legacyData);
        try {
            const config = await this.getConfig();
            console.log(`[OpenAIProvider] Generating profile candidates for ${role}...`);
            const response = await postJson<any>("/api/ai/openai/response", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: prompt,
                tools: [{ type: "web_search" }],
                text: { format: { type: "json_object" } },
            });
            const output_text = getOpenAIText(response);
            console.log(`[OpenAIProvider] Raw response for profile candidates: ${output_text}`);
            const text = output_text || "";
            if (!text) throw new Error("Empty response for profile candidates");
            
            const parsed = safeParseJson(text);
            if (Array.isArray(parsed)) return parsed;
            // Fallback for wrapped objects
            if (parsed && typeof parsed === 'object') {
                const values = Object.values(parsed);
                const candidateArray = values.find(v => Array.isArray(v));
                if (candidateArray) return candidateArray as EntityProfile[];
            }
            
            return [];
        } catch (error) {
             console.error("Failed to generate profile candidates:", error);
             return [
                {
                    name: role,
                    age: "Unknown",
                    abilities: ["Observation", "Basic Survival"],
                    background: "A standard personnel assigned to this anomaly.",
                    keywords: ["Survival", "Mystery"]
                }
            ];
        }
    }

    async analyzeSCPUrl(input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData, profile?: EntityProfile): Promise<SCPData> {
        try {
            const config = await this.getConfig();
            const prompt = getAnalyzeSCPPrompt(input, language, role, difficulty, legacyData, profile);
            const response = await postJson<any>("/api/ai/openai/response", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: prompt,
                tools: [{ type: "web_search" }],
                text: { format: { type: "json_object" } }
            });
            const text = getOpenAIText(response);
            if (!text) throw new Error("No response from analysis");

            const parsed = safeParseJson(text);
            if (!parsed) throw new Error("Failed to parse analysis JSON");
            parsed.role = role;
            return parsed as SCPData;

        } catch (e) {
            return {
                role: role,
                designation: "???",
                name: "异常实体",
                containmentClass: "未知",
                visualDescription: "dark abstract glitch horror texture, scp foundation aesthetic",
                entityDescription: "unknown anomaly, redacted silhouette, scp foundation record",
            };
        }
    }

    async *initializeGameChatStream(scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData, difficulty: GameDifficulty = 'normal'): AsyncGenerator<string> {
        console.log(`[OpenAIProvider] Initializing chat stream for ${scp.designation} as ${role} in ${language}`);
        this.systemInstruction = getSystemInstruction(role, language);
        const config = await this.getConfig();
        const startPrompt = getStartGamePrompt(role, scp.designation, scp.containmentClass, language, difficulty, legacyData, scp.mapBlueprint, scp.storyDraft);

        console.log("[OpenAIProvider] Sending start message... ");
        this.messages = [
            { role: "system", content: this.systemInstruction },
            { role: "user", content: startPrompt }
        ];
        this.gameReviewHistory = [];
        this.qaHistory = [];

        if (this.callbacks.onStatusUpdate) this.callbacks.onStatusUpdate('generating');
        let fullResponse = "";
        for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            chatModel: config.chatModel,
            input: this.messages,
            tools: [{ type: "web_search" }],
        })) {
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
            for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: messagesToSend,
                tools: [],
            }, { signal })) {
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
            const response = await postJson<any>("/api/ai/openai/response", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: prompt,
            });
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
            const { output_text } = await postJson<{ output_text: string | null }>("/api/ai/openai/response", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: prompt,
                text: {
                    format:  {
                        type: "json_schema",
                        name: "audio_drama",
                        schema: zodToJsonSchema(AudioDramaSchema)
                    }
                },
            });
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
            const { output_text } = await postJson<{ output_text: string | null }>("/api/ai/openai/response", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: this.buildMessages(prompt),
            });
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
            yield language === 'zh' ? "会话连接已丢失。" : "Session connection lost.";
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
            for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: qaMessages,
            })) {
                const delta = getOpenAIResponseDelta(chunk);
                fullResponse += delta;
                yield delta;
            }
            this.qaHistory.push({ role: "user", content: prompt });
            this.qaHistory.push({ role: "assistant", content: fullResponse });
        } catch (error) {
            yield language === 'zh' ? "因果同步超时。" : "Causal sync timeout.";
        }
    }

    async generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult> {
        if (this.messages.length === 0) {
             return { traits: [], items: [], echoes: [] };
        }
        const config = await this.getConfig();

        const prompt = getLegacyGenerationPrompt(ending, role, language);

        try {
            const { output_text } = await postJson<{ output_text: string | null }>("/api/ai/openai/response", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: this.buildMessages(prompt),
            });
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

        // Convert EditorChatMessage[] to OpenAI-native messages,
        // which correctly replays prior tool calls via nativeHistory
        const historyMessages = toOpenAIMessages(messages);

        const contextMessages = [
            { role: "system", content: systemPrompt },
            { role: "system", content: getEditorAssistantContext(scpData) },
            ...historyMessages
        ];

        let currentLoopMessages: any[] = [...contextMessages];

        // Collect all native history entries produced during THIS turn
        // so the UI can store them for future replay
        const turnNativeHistory: any[] = [];

        let loopCount = 0;
        const MAX_LOOPS = 20;

        while (loopCount < MAX_LOOPS) {
            loopCount++;

            const toolCallsMap: Record<number, { index: number; id?: string; name?: string; arguments: string }> = {};
            let hasToolCalls = false;
            let assistantText = "";

            console.log(`[EditorAssistant] streamEditorAssistant loop ${loopCount}`);

            // 1. Call OpenAI API and stream response
            const stream = streamSse<any>("/api/ai/openai/chat-completion-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: currentLoopMessages,
                tools: editorTools,
                stream: true
            });

            for await (const chunk of stream) {
                const choice = chunk.choices?.[0];
                if (!choice) continue;
                const delta = choice.delta;

                // Handle text content delta
                if (delta.content) {
                    assistantText += delta.content;
                    yield { type: "assistant_delta", delta: delta.content };
                }

                // Handle tool calls delta
                if (delta.tool_calls) {
                    hasToolCalls = true;
                    for (const tc of delta.tool_calls) {
                        const index = tc.index;
                        if (!toolCallsMap[index]) {
                            toolCallsMap[index] = { index, arguments: "" };
                        }
                        if (tc.id) toolCallsMap[index].id = tc.id;
                        if (tc.function?.name) toolCallsMap[index].name = tc.function.name;
                        if (tc.function?.arguments) toolCallsMap[index].arguments += tc.function.arguments;
                    }
                }
            }

            // 2. If no tool calls, record the assistant text and break
            if (!hasToolCalls) {
                if (assistantText) {
                    turnNativeHistory.push({ role: "assistant", content: assistantText });
                }
                break;
            }

            // 3. Process accumulated tool calls
            const completedToolCalls = Object.values(toolCallsMap).map(tc => ({
                id: tc.id || `call_${Date.now()}_${tc.index}`,
                type: 'function',
                function: {
                    name: tc.name || "",
                    arguments: tc.arguments
                }
            }));

            // Build the assistant message with tool_calls (and optional text)
            const assistantEntry: any = {
                role: "assistant",
                content: assistantText || null,
                tool_calls: completedToolCalls
            };
            currentLoopMessages.push(assistantEntry);
            turnNativeHistory.push(assistantEntry);

            // 4. Execute tools and yield events
            for (const call of completedToolCalls) {
                const callId = call.id;
                const toolName = call.function.name;
                const startTime = Date.now();
                let args = {};

                try {
                    args = JSON.parse(call.function.arguments);
                } catch (e) {
                    console.error("Failed to parse tool arguments:", call.function.arguments);
                }

                // Send "start" event
                yield {
                    type: "tool_call",
                    callId,
                    name: toolName,
                    args,
                    state: "start",
                    startTime
                };

                let resultStr = "";
                try {
                    console.log(`[EditorAssistant] Executing tool ${toolName}...`);
                    const result = await onToolCall(toolName, args);
                    const endTime = Date.now();

                    // Send "result" event
                    yield {
                        type: "tool_call",
                        callId,
                        name: toolName,
                        state: "result",
                        result,
                        endTime
                    };

                    resultStr = JSON.stringify(result);
                } catch (e) {
                    const endTime = Date.now();
                    console.error(`Tool execution failed: ${e}`);

                    // Send "error" event
                    yield {
                        type: "tool_call",
                        callId,
                        name: toolName,
                        state: "error",
                        error: String(e),
                        endTime
                    };

                    resultStr = JSON.stringify({ error: String(e) });
                }

                // Append tool result to history
                const toolResultEntry = {
                    role: "tool",
                    tool_call_id: call.id,
                    name: toolName,
                    content: resultStr
                };
                currentLoopMessages.push(toolResultEntry);
                turnNativeHistory.push(toolResultEntry);
            }
        }

        // Yield turn_complete with the native history for this entire turn
        yield { type: "turn_complete", nativeHistory: turnNativeHistory };
    }

}
