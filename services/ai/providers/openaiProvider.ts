import { zodToJsonSchema } from "zod-to-json-schema";
import { AIService } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from "../../../types";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt, getProfileCandidatesPrompt } from "../prompts";
import { getEditorAssistantPrompt, editorTools } from "../editorPrompts";
import { normalizeGameReviewData, safeParseJson } from "../utils";
import { AudioDramaSchema } from "../schemas";
import { postJson, streamSse } from "./backendClient";
import { aiConfig } from "../../../config/aiConfig";
import { imageSizeFromAspectRatio } from "../utils";
import { getEffectiveAIConfig } from "../../aiConfigService";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
const getOpenAIText = (response: any): string => {
    return response.choices?.[0]?.message?.content || "";
};

const getOpenAIDelta = (chunk: any): string => {
    return chunk.choices?.[0]?.delta?.content || "";
};

export class OpenAIProvider implements AIService {
    private messages: ChatMessage[] = [];
    private systemInstruction: string = "";
    private gameReviewHistory: ChatMessage[] = [];
    private qaHistory: ChatMessage[] = [];
    private cachedConfig: { apiKey: string; baseUrl: string; chatModel: string; imageModel: string } | null = null;

    private async getConfig() {
        if (this.cachedConfig) return this.cachedConfig;
        const effective = await getEffectiveAIConfig();
        this.cachedConfig = {
            apiKey: effective.openai.apiKey,
            baseUrl: effective.openai.baseUrl,
            chatModel: effective.openai.chatModel,
            imageModel: effective.openai.imageModel,
        };
        return this.cachedConfig;
    }

    constructor() {
    }

    public async generateImage(prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> {
        try {
            const config = await this.getConfig();
            const response = await postJson<any>("/api/ai/openai/generate-image", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.imageModel,
                size: imageSizeFromAspectRatio(aspectRatio),
                prompt: prompt,
                extra_body: {
                    watermark: false,
                }
            });
            const item = response.data?.[0];
            return item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url || null;
        } catch (error) {
            return null;
        }
    }

    async generateProfileCandidates(role: string, scpDesignation: string, language: Language): Promise<EntityProfile[]> {
        const prompt = getProfileCandidatesPrompt(role, scpDesignation, language);
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

        let fullResponse = "";
        for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            chatModel: config.chatModel,
            input: this.messages,
            tools: [{ type: "web_search" }],
        })) {
            const delta = getOpenAIDelta(chunk);
            fullResponse += delta;
            yield delta;
        }
        this.messages.push({ role: "assistant", content: fullResponse });
    }

    async *sendAction(action: string, currentStability: number, turnCount: number, language: Language = 'zh', ragContext?: string, mapContext?: string): AsyncGenerator<string> {
        console.log(`[OpenAIProvider] sendAction called. Input: "${action}", Stability: ${currentStability}, Turn: ${turnCount}`);
        const config = await this.getConfig();

        if (this.messages.length === 0) {
            console.error("[OpenAIProvider] CRITICAL: messages empty. Game state may have been reset.");
            throw new Error("Game not initialized - session missing");
        }

        const contextPrompt = getContextPrompt(action, currentStability, turnCount, language, ragContext, mapContext);

        try {
            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/openai/response-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: [...this.messages, { role: "user", content: contextPrompt }],
                tools: [],
            })) {
                const delta = getOpenAIDelta(chunk);
                fullResponse += delta;
                yield delta;
            }
            console.log("[OpenAIProvider] sendAction complete. Response: ", fullResponse);
            this.messages.push({ role: "user", content: contextPrompt });
            this.messages.push({ role: "assistant", content: fullResponse });

        } catch (err) {
            console.error("[OpenAIProvider] Error in sendAction: ", err);
            throw err;
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

    async restoreChatSession(history: any[], role: string, language: Language = 'zh'): Promise<void> {
        this.systemInstruction = getSystemInstruction(role, language);
        
        this.messages = [{ role: "system", content: this.systemInstruction }];
        this.gameReviewHistory = [];
        this.qaHistory = [];

        const restoredMessages: ChatMessage[] = history.map(msg => {
            const role = msg.role === 'model' ? 'assistant' : 'user';
            const content = msg.parts?.map(p => p.text).join('') || '';
            return { role, content } as ChatMessage;
        });

        this.messages = [...this.messages, ...restoredMessages];
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
                input: [...this.messages, { role: "user", content: prompt }],
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
        const qaMessages: ChatMessage[] = [
            ...this.messages,
            ...this.gameReviewHistory,
            ...this.qaHistory,
            { role: "user", content: prompt }
        ];

        try {
            let fullResponse = "";
            for await (const delta of streamSse<string>("/api/ai/openai/response-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: qaMessages,
            })) {
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
                input: [...this.messages, { role: "user", content: prompt }],
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
        messages: { role: string; content: string }[],
        scpData: SCPData,
        language: Language,
        onToolCall: (toolName: string, args: any) => Promise<any>
    ): AsyncGenerator<string> {
        const config = await this.getConfig();
        const systemPrompt = getEditorAssistantPrompt(language);

        const contextMessages = [
            { role: "system", content: systemPrompt },
            { role: "system", content: `[CURRENT MAP BLUEPRINT]\n${JSON.stringify(scpData.mapBlueprint)}\n[CURRENT STORY INFO]\nName: ${scpData.name}\nDesignation: ${scpData.designation}\nRole: ${scpData.role}\nBackground: ${scpData.storyDraft?.storyBackground}` },
            ...messages
        ];

        let currentLoopMessages = [...contextMessages];
        let loopCount = 0;
        const MAX_LOOPS = 5;

        while (loopCount < MAX_LOOPS) {
            loopCount++;

            const toolCalls: Record<number, { name: string; arguments: string; id: string }> = {};
            let hasToolCalls = false;

            for await (const chunk of streamSse<any>("/api/ai/openai/chat-completion-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel, // User mentioned gpt-5, but we use config
                input: currentLoopMessages,
                tools: editorTools,
                stream: true
            })) {
                if (chunk.choices && chunk.choices[0]?.delta) {
                    const delta = chunk.choices[0].delta;
                    if (delta.content) {
                        yield delta.content;
                    }
                    if (delta.tool_calls) {
                        hasToolCalls = true;
                        for (const tc of delta.tool_calls) {
                            const index = typeof tc.index === "number" ? tc.index : 0;
                            if (!toolCalls[index]) {
                                toolCalls[index] = { name: "", arguments: "", id: "" };
                            }
                            if (tc.id) toolCalls[index].id = tc.id;
                            if (tc.function?.name) toolCalls[index].name = tc.function.name;
                            if (tc.function?.arguments) toolCalls[index].arguments += tc.function.arguments;
                        }
                    }
                }
            }

            if (!hasToolCalls) {
                break;
            }

            const toolOutputs = [];
            for (const call of Object.values(toolCalls)) {
                try {
                    const args = JSON.parse(call.arguments);
                    console.log(`[EditorAssistant] Executing tool: ${call.name}`, args);
                    yield `\n\n[Executing: ${call.name}]...\n`;
                    
                    const result = await onToolCall(call.name, args);
                    
                    toolOutputs.push({
                        role: "tool",
                        tool_call_id: call.id,
                        content: JSON.stringify(result)
                    });
                } catch (e) {
                    console.error(`Tool execution failed: ${e}`);
                    toolOutputs.push({
                        role: "tool",
                        tool_call_id: call.id,
                        content: JSON.stringify({ error: String(e) })
                    });
                }
            }

            const assistantMsg = {
                role: "assistant",
                content: null,
                tool_calls: Object.values(toolCalls).map(c => ({
                    id: c.id,
                    type: "function",
                    function: { name: c.name, arguments: c.arguments }
                }))
            };

            // @ts-ignore
            currentLoopMessages.push(assistantMsg);
            
            for (const output of toolOutputs) {
                // @ts-ignore
                currentLoopMessages.push(output);
            }
        }
    }
}
