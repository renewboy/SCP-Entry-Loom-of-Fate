import { zodToJsonSchema } from "zod-to-json-schema";
import { AIService } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty } from "../../../types";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt } from "../prompts";
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
export class OpenAIProvider implements AIService {
    private messages: ChatMessage[] = [];
    private systemInstruction: string = "";
    private gameReviewHistory: ChatMessage[] = [];
    private qaHistory: ChatMessage[] = [];
    private cachedConfig: { apiKey: string; baseUrl: string; chatModel: string; imageModel: string } | null = null;

    private async getConfig() {
        if (this.cachedConfig) return this.cachedConfig;
        const effective = await getEffectiveAIConfig();
        console.log(`[OpenAIProvider] Effective Config: ${JSON.stringify(effective)}`);
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
            const { imageDataUrl } = await postJson<{ imageDataUrl: string | null }>("/api/ai/openai/generate-image", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.imageModel,
                size: imageSizeFromAspectRatio(aspectRatio),
                prompt,
            });
            return imageDataUrl;
        } catch (error) {
            return null;
        }
    }

    async analyzeSCPUrl(input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData): Promise<SCPData> {
        try {
            const config = await this.getConfig();
            const prompt = getAnalyzeSCPPrompt(input, language, role, difficulty, legacyData);
            const { output_text } = await postJson<{ output_text: string | null }>("/api/ai/openai/response", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: prompt,
                tools: [{ type: "web_search" }],
            });
            const text = output_text || "";
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

        console.log("[OpenAIProvider] Sending start message... ", startPrompt);
        this.messages = [
            { role: "system", content: this.systemInstruction },
            { role: "user", content: startPrompt }
        ];
        this.gameReviewHistory = [];
        this.qaHistory = [];

        let fullResponse = "";
        for await (const delta of streamSse<string>("/api/ai/openai/response-stream", {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            chatModel: config.chatModel,
            input: this.messages,
            tools: [{ type: "web_search" }],
        })) {
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
            for await (const delta of streamSse<string>("/api/ai/openai/response-stream", {
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                chatModel: config.chatModel,
                input: [...this.messages, { role: "user", content: contextPrompt }],
                tools: [],
            })) {
                fullResponse += delta;
                yield delta;
            }
            console.log("[OpenAIProvider] sendAction complete. Response: ", fullResponse);
            this.messages.push({ role: "user", content: contextPrompt });
            this.messages.push({ role: "assistant", content: fullResponse });

        } catch (err) {
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
}
