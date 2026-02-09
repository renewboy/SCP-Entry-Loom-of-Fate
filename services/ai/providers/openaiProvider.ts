import OpenAI from "openai";
import { GoogleGenAI, Chat, Content } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AIService } from "../types";
import { SCPData, EndingType, Language, Message, GameReviewData, AudioDramaScript, LegacyData, LegacyGenerationResult, GameDifficulty } from "../../../types";
import { aiConfig } from "../../../config/aiConfig";
import { getSystemInstruction, getAnalyzeSCPPrompt, getStartGamePrompt, getContextPrompt, getAudioDramaPrompt, getGameReviewPrompt, getQAPrompt, getLegacyGenerationPrompt } from "../prompts";
import { normalizeGameReviewData, safeParseJson } from "../utils";
import { AudioDramaSchema, OperationEvaluationSchema } from "../schemas";
import { Schema } from "zod";
import { format } from "path";

// Define Volcengine specific types or use generic objects
type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
export class OpenAIProvider implements AIService {
    private client: OpenAI;
    private messages: ChatMessage[] = [];
    private systemInstruction: string = "";

    constructor() {
        this.client = new OpenAI({
            apiKey: aiConfig.openai.apiKey,
            baseURL: aiConfig.openai.baseUrl,
            dangerouslyAllowBrowser: true // Required for client-side usage
        });
    }

    // OpenAI provider doesn't do image generation natively in this setup (delegated to Gemini in facade)
    
    async analyzeSCPUrl(input: string, language: Language = 'zh', role: string, difficulty: GameDifficulty = 'normal'): Promise<SCPData> {
        try {
            const prompt = getAnalyzeSCPPrompt(input, language, role, difficulty);
            console.log(`[OpenAIProvider] Analyzing SCP: ${input}`);

            const response = await this.client.responses.create({
                model: aiConfig.openai.chatModel,
                input: prompt,
                tools: [{ type: "web_search" } as any], // Volcengine specific tool
            });

            const text = response.output_text;
            console.log(`[OpenAIProvider] Analysis result length: ${text?.length}`);
            if (!text) throw new Error("No response from analysis");

            const parsed = safeParseJson(text);
            if (!parsed) throw new Error("Failed to parse analysis JSON");
            parsed.role = role;
            return parsed as SCPData;

        } catch (e) {
            console.error("Failed to analyze SCP:", e);
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

        const startPrompt = getStartGamePrompt(role, scp.designation, scp.containmentClass, language, difficulty, legacyString, scp.mapBlueprint, scp.storyDraft);

        // Store initial message for history
        this.messages = [
            { role: "system", content: this.systemInstruction },
            { role: "user", content: startPrompt }
        ];

        console.log("[OpenAIProvider] Sending start message... ", startPrompt);
        
        // Use Responses API with streaming
        const responseStream = await this.client.responses.create({
            model: aiConfig.openai.chatModel,
            input: this.messages,
            stream: true,
            tools: [{ type: "web_search" } as any], // Volcengine specific tool
        });

        let fullResponse = "";
        for await (const event of responseStream) {
            if(event.type === "response.output_text.delta"){
                fullResponse += event.delta;
                yield event.delta;
            }
        }
        
        // Append assistant response to history
        this.messages.push({ role: "assistant", content: fullResponse });
    }

    async *sendAction(action: string, currentStability: number, turnCount: number, language: Language = 'zh', ragContext?: string, mapContext?: string): AsyncGenerator<string> {
        console.log(`[OpenAIProvider] sendAction called. Input: "${action}", Stability: ${currentStability}, Turn: ${turnCount}`);

        if (this.messages.length === 0) {
            console.error("[OpenAIProvider] CRITICAL: messages empty. Game state may have been reset.");
            throw new Error("Game not initialized - session missing");
        }

        const contextPrompt = getContextPrompt(action, currentStability, turnCount, language, ragContext, mapContext);
        this.messages.push({ role: "user", content: contextPrompt });

        try {
            console.log("[OpenAIProvider] Sending message stream to model...");
            
            const responseStream = await this.client.responses.create({
                model: aiConfig.openai.chatModel,
                input: this.messages,
                stream: true,
                tools: [],
            });

            let fullResponse = "";
            let chunkCount = 0;
            for await (const event of responseStream) {
                chunkCount++;
                if(event.type === "response.output_text.delta")
                {
                    fullResponse += event.delta;
                    yield event.delta;
                }
            }
            console.log(`[OpenAIProvider] Stream finished. Received ${chunkCount} chunks.`);
            
            // Append assistant response to history
            this.messages.push({ role: "assistant", content: fullResponse });

        } catch (err) {
            console.error("[OpenAIProvider] Error during sendAction stream:", err);
            throw err;
        }
    }

    async getChatHistory(): Promise<Content[]> {
        // Convert OpenAI ChatMessage[] to Google Content[]
        let googleMessages: Content[] = this.messages.map(msg => {
            let role = 'user';
            if (msg.role === 'assistant') role = 'model';
            else if (msg.role === 'system') role = 'system'; // Note: Google usually puts system instructions in config, not history. 
            if (msg.role === 'system') {
                return null; 
            }

            return {
                role: role,
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            };
        }).filter(Boolean) as Content[];
        return googleMessages;
    }

    async restoreChatSession(history: Content[], role: string, language: Language = 'zh'): Promise<void> {
        console.log("[OpenAIProvider] Restoring chat session with history length:", history.length);
        this.systemInstruction = getSystemInstruction(role, language);
        
        this.messages = [{ role: "system", content: this.systemInstruction }];

        // Convert Google Content[] to OpenAI ChatMessage[]
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
        
        const storyLog = messages
            .filter(m => m.sender === 'user' || m.sender === 'narrator')
            .map(m => `[ID:${m.id}] ${m.sender.toUpperCase()}: ${m.content}`)
            .join('\n\n');

        const prompt = getAudioDramaPrompt(storyLog, role, scpDesignation, language);

        try {
            const response = await this.client.responses.create({
                model: aiConfig.openai.chatModel,
                input: prompt,
                text: {
                    format:  {
                        type: "json_schema",
                        name: "audio_drama",
                        schema: zodToJsonSchema(AudioDramaSchema)
                    }
                }
            });

            const text = response.output_text;
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
        console.log(`[OpenAIProvider] Generating Game Review...`);

        if (this.messages.length === 0) {
            console.error("Chat session is missing. Cannot generate review.");
            return normalizeGameReviewData(null);
        }

        const prompt = getGameReviewPrompt(role, ending, language);

        try {
            this.messages.push({ role: "user", content: prompt });
            const response = await this.client.responses.create({
                model: aiConfig.openai.chatModel,
                input: this.messages,
                // text: {
                //     format: {
                //         type: "json_schema",
                //         name: "operation_evalation",
                //         schema: zodToJsonSchema(OperationEvaluationSchema as any)
                //     }
                    
                // }
            });

            const text = response.output_text;
            if (!text) throw new Error("Empty response for review");
            const parsed = safeParseJson(text);
            if (!parsed) throw new Error('Failed to parse review JSON');
            
            // Append assistant response to history
            this.messages.push({ role: "assistant", content: text });
            
            return normalizeGameReviewData(parsed);
        } catch (error) {
            console.error("Failed to generate review:", error);
            return normalizeGameReviewData(null);
        }
    }

    async *askNarratorQuestion(question: string, language: Language): AsyncGenerator<string> {
        if (this.messages.length === 0) {
            yield language === 'zh' ? "会话连接已丢失。" : "Session connection lost.";
            return;
        }

        const prompt = getQAPrompt(question, language);
        const qaMessages: ChatMessage[] = [...this.messages, { role: "user", content: prompt }];

        try {
            // Use Responses API for streaming Q&A
            const responseStream = await this.client.responses.create({
                model: aiConfig.openai.chatModel,
                input: qaMessages,
                stream: true
            });

            for await (const event of responseStream) {
                if(event.type == "response.output_text.delta") {
                    yield event.delta;
                }
            }
        } catch (error) {
            console.error("Q&A failed:", error);
            yield language === 'zh' ? "因果同步超时。" : "Causal sync timeout.";
        }
    }

    async generateLegacyData(ending: string, role: string, language: Language): Promise<LegacyGenerationResult> {
        console.log(`[OpenAIProvider] Generating Legacy Data...`);
        if (this.messages.length === 0) {
             console.error("Chat session is missing. Cannot generate legacy data.");
             return { traits: [], items: [], echoes: [] };
        }

        const prompt = getLegacyGenerationPrompt(ending, role, language);

        try {
            this.messages.push({ role: "user", content: prompt });
            const response = await this.client.responses.create({
                model: aiConfig.openai.chatModel,
                input: this.messages,
            });

            const text = response.output_text;
            if (!text) throw new Error("Empty response for legacy data");

            const parsed = safeParseJson(text);
            if (!parsed) throw new Error('Failed to parse legacy JSON');

            // Append assistant response to history
            this.messages.push({ role: "assistant", content: text });

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
}
