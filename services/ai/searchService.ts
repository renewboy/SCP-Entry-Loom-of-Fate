import { resolveAIModelConfig } from "../aiConfigService";
import type { ResolvedAIModelConfig } from "../aiConfigService";
import { postJson } from "./providers/backendClient";

type WebSearchConfig = Pick<ResolvedAIModelConfig, 'provider' | 'apiKey' | 'baseUrl' | 'model'>;

export const runWebSearch = async (query: unknown, config: WebSearchConfig, signal?: AbortSignal): Promise<string> => {
    if (typeof query !== 'string' || !query.trim()) throw new Error('web_search.query must be a non-empty string');

    if (config.provider === "gemini") {
        const response = await postJson<any>("/api/ai/gemini/generate-content", {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            model: config.model,
            contents: [{ role: "user", parts: [{ text: query }] }],
            config: {
                tools: [{ googleSearch: {} }],
            },
        }, { signal });
        const candidate = response?.candidates?.[0];
        if (response?.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== 'STOP')) {
            throw new Error(`Gemini search failed: ${response?.promptFeedback?.blockReason || candidate.finishReason}`);
        }
        const text = (candidate?.content?.parts || [])
            .filter((part: any) => !part.thought && typeof part.text === 'string')
            .map((part: any) => part.text).join('');
        if (!text.trim()) throw new Error('Gemini search returned no results');
        const sources = (candidate?.groundingMetadata?.groundingChunks || [])
            .map((chunk: any) => chunk.web?.uri).filter(Boolean);
        return [text, ...new Set(sources)].join('\n');
    }

    const response = await postJson<any>("/api/ai/openai/response", {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        chatModel: config.model,
        input: [
            { role: "user", content: query }
        ],
        tools: [{ type: "web_search" }]
    }, { signal });
    const text = response?.output_text || (response?.output || [])
        .filter((item: any) => item.type === 'message')
        .flatMap((item: any) => item.content || [])
        .filter((part: any) => part.type === 'output_text').map((part: any) => part.text).join('');
    if (!text.trim()) throw new Error('OpenAI search returned no results');
    return text;
};

export const runAssistantWebSearch = async (query: string): Promise<string> =>
    runWebSearch(query, await resolveAIModelConfig("assistant"));
