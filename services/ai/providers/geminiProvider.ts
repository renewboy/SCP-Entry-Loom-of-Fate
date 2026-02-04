import { GoogleGenAI, Chat, Content } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AIService } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult } from "../../../types";
import { aiConfig } from "../../../config/aiConfig";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt } from "../prompts";
import { normalizeGameReviewData, safeParseJson } from "../utils";
import { AudioDramaSchema, OperationEvaluationSchema } from "../schemas";

type ChatSession = {
    chat : Chat;
    systemInstruction: string;
    temperature: number;
}
export class GeminiProvider implements AIService {
    private client: GoogleGenAI;
    private chatSession: ChatSession | null = null;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: aiConfig.apiKey });
    }

    private getClient() {
        return this.client;
    }

    // --- Image Generation (Gemini Only Feature, but exposed via Provider or Facade) ---
    // Note: The interface doesn't strictly enforce this if we handle it in facade, 
    // but good to have it here if we want to call it directly.
    public async generateImage(prompt: string, aspectRatio: "1:1" | "16:9" | "3:4" = "1:1"): Promise<string | null> {
        console.log(`[GeminiProvider] Generating image... Prompt: "${prompt.substring(0, 100)}..."`, { aspectRatio });
        try {
            const response = await this.client.models.generateContent({
                model: aiConfig.models.image,
                contents: { parts: [{ text: prompt }] },
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio,
                    }
                }
            });

            console.log("[GeminiProvider] Image generation response received", response);

            const parts = response.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData) {
                    console.log("[GeminiProvider] Image data extraction successful.");
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }

            console.warn("[GeminiProvider] Response contained no inline image data.", parts);
            return null;
        } catch (error) {
            console.error("[GeminiProvider] Image generation failed:", error);
            return null;
        }
    }

    async analyzeSCPUrl(input: string, language: Language = 'zh'): Promise<SCPData> {
        try {
            const prompt = getAnalyzeSCPPrompt(input, language);
            this.client = new GoogleGenAI({ apiKey: aiConfig.apiKey });
            console.log(`[GeminiProvider] Analyzing SCP: ${input}`);
            const response = await this.client.models.generateContent({
                model: aiConfig.models.chat,
                contents: prompt,
                config: {
                    tools: [
                        { googleSearch: {} }
                    ],
                }
            });

            const text = response.text;
            console.log(`[GeminiProvider] Analysis result length: ${text?.length}`);
            if (!text) throw new Error("No response from analysis");

            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson) as SCPData;

        } catch (e) {
            console.error("Failed to analyze SCP:", e);
            return {
                designation: "???",
                name: "异常实体",
                containmentClass: "未知",
                description: "数据删除。请求的文件已损坏或不存在。",
                visualDescription: "dark abstract glitch horror texture, scp foundation aesthetic",
                entityDescription: "unknown anomaly, redacted silhouette, scp foundation record"
            };
        }
    }

    async *initializeGameChatStream(scp: SCPData, role: string, language: Language = 'zh', legacyData?: LegacyData): AsyncGenerator<string> {
        console.log(`[GeminiProvider] Initializing chat stream for ${scp.designation} as ${role} in ${language}`);
        const systemInstruction = getSystemInstruction(role, language);
        
        // Format LegacyData into a string if it exists
        let legacyString = '';
        if (legacyData) {
            const traitsStr = legacyData.traits.length > 0 ? 
                `Traits:\n${legacyData.traits.map(t => `- ${t.icon} ${t.name}: ${t.description}`).join('\n')}` : '';
            const itemsStr = legacyData.items.length > 0 ? 
                `Items:\n${legacyData.items.map(i => `- ${i.icon} ${i.name}: ${i.description}`).join('\n')}` : '';
            const echoesStr = legacyData.echoes.length > 0 ? 
                `World Echoes (Past Lives):\n${legacyData.echoes.map(e => `- [Role: ${e.roleName}] [${e.endingType}] ${e.title}: ${e.summary}`).join('\n')}` : '';
            
            legacyString = [traitsStr, itemsStr, echoesStr].filter(Boolean).join('\n\n');
        }

        const startPrompt = getStartGamePrompt(role, scp.designation, scp.containmentClass, language, legacyString);

        this.chatSession = {
            chat: this.client.chats.create({
                model: aiConfig.models.chat,
                config: {
                    systemInstruction,
                    temperature: aiConfig.generation.temperature,
                    tools: [
                        { googleSearch: {} }
                    ],
                }
            }),
            systemInstruction: systemInstruction,
            temperature: aiConfig.generation.temperature,
        };

        console.log("[GeminiProvider] Sending start message... ", startPrompt);
        const result = await this.chatSession.chat.sendMessageStream({
            message: startPrompt
        });
        console.log("[GeminiProvider] Stream connection established.");
        for await (const chunk of result) {
            console.log("[GeminiProvider] Start stream chunk received:", chunk);
            if (chunk.text) {
                yield chunk.text;
            }
        }
    }

    async *sendAction(action: string, currentStability: number, turnCount: number, language: Language = 'zh', ragContext?: string): AsyncGenerator<string> {
        console.log(`[GeminiProvider] sendAction called. Input: "${action}", Stability: ${currentStability}, Turn: ${turnCount}, Language: ${language}`);

        if (!this.chatSession) {
            console.error("[GeminiProvider] CRITICAL: chatSession is null. Game state may have been reset.");
            throw new Error("Game not initialized - session missing");
        }

        const contextPrompt = getContextPrompt(action, currentStability, turnCount, language, ragContext);

        try {
            console.log("[GeminiProvider] Sending message stream to model...");
            const streamResult = await this.chatSession.chat.sendMessageStream({
                message: contextPrompt,
                config: {
                    systemInstruction: this.chatSession.systemInstruction,
                    temperature: this.chatSession.temperature,
                    tools: []
                }
            });
            console.log("[GeminiProvider] Stream connection established.");

            let chunkCount = 0;
            for await (const chunk of streamResult) {
                chunkCount++;
                const text = chunk.text;
                if (text) {
                    yield text;
                }
            }
            console.log(`[GeminiProvider] Stream finished. Received ${chunkCount} chunks.`);
        } catch (err) {
            console.error("[GeminiProvider] Error during sendAction stream:", err);
            throw err;
        }
    }

    async getChatHistory(): Promise<Content[]> {
        if (!this.chatSession) return [];
        try {
            const history = await this.chatSession.chat.getHistory();
            return history;
        } catch (e) {
            console.error("Failed to get chat history", e);
            return [];
        }
    }

    async restoreChatSession(history: Content[], role: string, language: Language = 'zh'): Promise<void> {
        console.log("[GeminiProvider] Restoring chat session with history length:", history.length);
        const systemInstruction = getSystemInstruction(role, language);

        this.chatSession = {
            chat: this.client.chats.create({
                model: aiConfig.models.chat,
                config: {
                    systemInstruction,
                    temperature: aiConfig.generation.temperature,
                    tools: [
                        { googleSearch: {} }
                    ],
                },
                history: history
            }),
            systemInstruction: systemInstruction,
            temperature: aiConfig.generation.temperature,
        };
    }

    async generateAudioDramaScript(
        messages: Message[],
        role: string,
        scpDesignation: string,
        language: Language = 'zh'
    ): Promise<AudioDramaScript | null> {
        console.log("[GeminiProvider] Generating Audio Drama Script (JSON)...");
        
        // Filter messages to keep only story relevant parts, but include ID for referencing
        const storyLog = messages
            .filter(m => m.sender === 'user' || m.sender === 'narrator')
            .map(m => `[ID:${m.id}] ${m.sender.toUpperCase()}: ${m.content}`)
            .join('\n\n');

        const prompt = getAudioDramaPrompt(storyLog, role, scpDesignation, language);

        try {
            const response = await this.client.models.generateContent({
                model: aiConfig.models.chat,
                contents: prompt,
                config: {
                    temperature: 0.7,
                    responseMimeType: "application/json",
                    responseJsonSchema: zodToJsonSchema(AudioDramaSchema as any)
                }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response for audio script");

            const parsed = JSON.parse(text) as AudioDramaScript;
            return parsed;

        } catch (error) {
            console.error("Failed to generate audio script:", error);
            return null;
        }
    }

    async generateGameReview(
        scpData: SCPData,
        role: string,
        ending: EndingType,
        language: Language,
        messages: Message[] = [],
        stabilityHistory: number[] = []
    ): Promise<GameReviewData> {
        console.log(`[GeminiProvider] Generating Game Review...`);

        if (!this.chatSession) {
            console.error("Chat session is missing. Cannot generate review.");
            return normalizeGameReviewData(null);
        }

        const prompt = getGameReviewPrompt(role, ending, language);

        try {
            // Send message to existing history
            const response = await this.chatSession.chat.sendMessage({
                message: prompt,
            });
            const text = response.text;

            if (!text) throw new Error("Empty response for review");

            const parsed = safeParseJson(text);
            if (!parsed) throw new Error('Failed to parse review JSON');
            return normalizeGameReviewData(parsed);
        } catch (error) {
            console.error("Failed to generate review:", error);
            return normalizeGameReviewData(null);
        }
    }

    async *askNarratorQuestion(question: string, language: Language): AsyncGenerator<string> {
        if (!this.chatSession) {
            yield language === 'zh' ? "会话连接已丢失。" : "Session connection lost.";
            return;
        }

        const prompt = getQAPrompt(question, language);

        try {
            const result = await this.chatSession.chat.sendMessageStream({ message: prompt });
            for await (const chunk of result) {
                if (chunk.text) {
                    yield chunk.text;
                }
            }
        } catch (error) {
            console.error("Q&A failed:", error);
            yield language === 'zh' ? "因果同步超时。" : "Causal sync timeout.";
        }
    }

    async generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult> {
        console.log(`[GeminiProvider] Generating Legacy Data...`);
        if (!this.chatSession) {
            console.error("Chat session is missing. Cannot generate legacy data.");
            return { traits: [], items: [], echoes: [] };
        }

        const prompt = getLegacyGenerationPrompt(ending, role, language);

        try {
             // Send message to existing history
             const response = await this.chatSession.chat.sendMessage({
                message: prompt,
            });
            const text = response.text;
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
            console.error("Failed to generate legacy data:", error);
            return { traits: [], items: [], echoes: [] };
        }
    }

    async getEmbeddings(texts: string[]): Promise<number[][]> {
        if (!texts || texts.length === 0) return [];
        console.log(`[GeminiProvider] Generating embeddings for ${texts.length} items...`);
        
        try {
            const response = await this.client.models.embedContent({
                model: aiConfig.models.embedding,
                contents: texts,
            });
            const embeddings = response.embeddings.map(e => e.values);
            return embeddings;

        } catch (error) {
            console.error("Failed to generate embeddings:", error);
            return [];
        }
    }
}
