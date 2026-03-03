import { zodToJsonSchema } from "zod-to-json-schema";
import { AIService } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty, EntityProfile } from "../../../types";
import { aiConfig } from "../../../config/aiConfig";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt, getProfileCandidatesPrompt } from "../prompts";
import { getEditorAssistantPrompt, editorTools } from "../editorPrompts";
import { normalizeGameReviewData, safeParseJson } from "../utils";
import { AudioDramaSchema } from "../schemas";
import { postJson, streamSse } from "./backendClient";
import { getEffectiveAIConfig } from "../../aiConfigService";

const INIT_EMPTY_MAX_RETRIES = 3;

const getGeminiText = (response: any): string => {
    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

export class GeminiProvider implements AIService {
    private history: any[] = [];
    private systemInstruction: string = "";
    private temperature: number = aiConfig.generation.temperature;
    private cachedContentName: string | null = null;
    private gameReviewHistory: any[] = [];
    private qaHistory: any[] = [];
    private cachedConfig: { apiKey: string; chatModel: string; imageModel: string; embeddingModel: string } | null = null;

    private async getConfig() {
        if (this.cachedConfig) return this.cachedConfig;
        const effective = await getEffectiveAIConfig();
        this.cachedConfig = {
            apiKey: effective.gemini.apiKey,
            chatModel: effective.gemini.chatModel,
            imageModel: effective.gemini.imageModel,
            embeddingModel: effective.gemini.embeddingModel,
        };
        return this.cachedConfig;
    }

    constructor() {
    }

    public async generateImage(prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> {
        try {
            const config = await this.getConfig();
            const response = await postJson<any>("/api/ai/gemini/generate-image", {
                apiKey: config.apiKey,
                model: config.imageModel,
                prompt,
                aspectRatio,
            });
            
            const parts = response.candidates?.[0]?.content?.parts || [];
            let imageDataUrl = null;
            for (const part of parts) {
                if (part.inlineData) {
                    imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                }
            }
            return imageDataUrl;
        } catch (error) {
            return null;
        }
    }

    async analyzeSCPUrl(input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal', legacyData?: LegacyData, profile?: EntityProfile): Promise<SCPData> {
        try {
            const config = await this.getConfig();
            const prompt = getAnalyzeSCPPrompt(input, language, role, difficulty, legacyData, profile);
            console.log(`[GeminiProvider] Analyzing SCP: ${input}`);
            const response = await postJson<any>("/api/ai/gemini/generate-content", {
                apiKey: config.apiKey,
                model: config.chatModel,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
            const text = getGeminiText(response);
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

    async generateProfileCandidates(role: string, scpDesignation: string, language: Language): Promise<EntityProfile[]> {
        const prompt = getProfileCandidatesPrompt(role, scpDesignation, language);
        try {
            const config = await this.getConfig();
            console.log(`[GeminiProvider] Generating profile candidates for ${role}...`);
            const response = await postJson<any>("/api/ai/gemini/generate-content", {
                apiKey: config.apiKey,
                model: config.chatModel,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.9,
                    tools: [{ googleSearch: {} }],
                },
            });

            const text = getGeminiText(response);
            if (!text) throw new Error("Empty response for profile candidates");
            const parsed = safeParseJson(text);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Failed to generate profile candidates:", error);
            // Return fallback candidates
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

    private async ensureCachedContentName(): Promise<string | null> {
        if (!this.systemInstruction) return null;
        if (this.cachedContentName) return this.cachedContentName;
        try {
            const config = await this.getConfig();
            const { name } = await postJson<{ name: string }>("/api/ai/gemini/cache", {
                apiKey: config.apiKey,
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
        return [
            ...this.history,
            ...extraHistory,
            { role: "user", parts: [{ text: prompt }] }
        ];
    }

    private async logTokenCount(contents: any[]): Promise<void> {
        try {
            const config = await this.getConfig();
            const { totalTokens, cachedContentTokenCount } = await postJson<{ totalTokens: number; cachedContentTokenCount: number }>("/api/ai/gemini/count-tokens", {
                apiKey: config.apiKey,
                model: config.chatModel,
                contents,
            });
            console.log(`[GeminiProvider] tokens total=${totalTokens} cached=${cachedContentTokenCount}`);
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
        this.temperature = aiConfig.generation.temperature;
        this.cachedContentName = null;
        this.gameReviewHistory = [];
        this.qaHistory = [];
        const config = await this.getConfig();
        const startPrompt = getStartGamePrompt(role, scp.designation, scp.containmentClass, language, difficulty, legacyData, scp.mapBlueprint, scp.storyDraft);
        console.log(`[GeminiProvider] Sending start message...`);

        this.history = [];
        const cachedContent = await this.ensureCachedContentName();
        console.log(`[GeminiProvider] Cached content name: ${cachedContent}`);
        for (let attempt = 0; attempt < INIT_EMPTY_MAX_RETRIES; attempt += 1) {
            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
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
            await this.logTokenCount(this.history);
            return;
        }
    }

    async *sendAction(action: string, currentStability: number, turnCount: number, language: Language = 'zh', ragContext?: string, mapContext?: string): AsyncGenerator<string> {
        console.log(`[GeminiProvider] sendAction called. Input: "${action}", Stability: ${currentStability}, Turn: ${turnCount}, Language: ${language}`);
        const config = await this.getConfig();
        const contextPrompt = getContextPrompt(action, currentStability, turnCount, language, ragContext, mapContext);

        try {
            const cachedContent = await this.ensureCachedContentName();
            console.log(`[GeminiProvider] Cached content name: ${cachedContent}`);

            let fullResponse = "";
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
                model: config.chatModel,
                contents: this.buildContents(contextPrompt),
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
            console.log(`[GeminiProvider] SendAction Full response: "${fullResponse}"`);
            this.history.push({ role: "user", parts: [{ text: contextPrompt }] });
            this.history.push({ role: "model", parts: [{ text: fullResponse }] });
            await this.logTokenCount(this.history);
        } catch (err) {
            console.error("[GeminiProvider] Error in sendAction: ", err);
            throw err;
        }
    }

    async getChatHistory(): Promise<any[]> {
        return this.history;
    }

    async restoreChatSession(history: any[], role: string, language: Language = 'zh'): Promise<void> {
        this.systemInstruction = getSystemInstruction(role, language);
        this.temperature = aiConfig.generation.temperature;
        this.cachedContentName = null;
        this.gameReviewHistory = [];
        this.qaHistory = [];
        this.history = Array.isArray(history) ? history : [];
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
            yield language === 'zh' ? "因果同步超时。" : "Causal sync timeout.";
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
        messages: { role: string; content: string }[],
        scpData: SCPData,
        language: Language,
        onToolCall: (toolName: string, args: any) => Promise<any>
    ): AsyncGenerator<string> {
        const config = await this.getConfig();
        const systemInstruction = `${getEditorAssistantPrompt(language)}\n\n[CURRENT MAP BLUEPRINT]\n${JSON.stringify(scpData.mapBlueprint)}\n[CURRENT STORY INFO]\nName: ${scpData.name}\nDesignation: ${scpData.designation}\nRole: ${scpData.role}\nBackground: ${scpData.storyDraft?.storyBackground}`;
        const baseContents: any[] = messages.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
        }));
        let currentContents: any[] = [...baseContents];
        let loopCount = 0;
        const MAX_LOOPS = 5;
        console.log(`[GeminiProvider] streamEditorAssistant called. Input: ${JSON.stringify(messages)}`);
        while (loopCount < MAX_LOOPS) {
            loopCount += 1;
            const toolCalls: { name: string; args: any }[] = [];
            console.log(`[GeminiProvider] streamEditorAssistant loop ${loopCount}`);
            for await (const chunk of streamSse<any>("/api/ai/gemini/chat-stream", {
                apiKey: config.apiKey,
                model: config.chatModel,
                contents: currentContents,
                config: {
                    systemInstruction,
                    tools: this.buildGeminiTools(),
                },
            })) {
                const parts = chunk?.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.text) {
                        yield part.text;
                    }
                    if (part.functionCall) {
                        toolCalls.push({
                            name: part.functionCall.name,
                            args: part.functionCall.args || part.functionCall.arguments || {}
                        });
                    }
                }
            }
            if (toolCalls.length === 0) {
                break;
            }

            const modelToolParts = toolCalls.map(call => ({
                functionCall: {
                    name: call.name,
                    args: call.args
                }
            }));
            currentContents = [
                ...currentContents,
                { role: "model", parts: modelToolParts }
            ];

            const toolResponseParts = [];
            for (const call of toolCalls) {
                yield `\n\n[Executing: ${call.name}]...\n`;
                const result = await onToolCall(call.name, call.args);
                console.log(`[GeminiProvider] streamEditorAssistant toolCall result: ${JSON.stringify(result)}`);
                const response = typeof result === "string" ? { result } : result;
                toolResponseParts.push({
                    functionResponse: {
                        name: call.name,
                        response
                    }
                });
            }
            currentContents = [
                ...currentContents,
                { role: "tool", parts: toolResponseParts }
            ];
        }
    }
}
