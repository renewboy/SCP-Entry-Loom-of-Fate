import { resolveAIModelConfig } from "../aiConfigService";
import { postJson } from "./providers/backendClient";

export const runAssistantWebSearch = async (query: string): Promise<string> => {
    const config = await resolveAIModelConfig("assistant");
    const systemPrompt = "You are an SCP Foundation editor assistant. Search the given query, prioritize authoritative sources, and return concise key points and conclusions.";

    if (config.provider === "gemini") {
        const response = await postJson<any>("/api/ai/gemini/generate-content", {
            apiKey: config.apiKey,
            model: config.model,
            contents: [{ role: "user", parts: [{ text: query }] }],
            config: {
                systemInstruction: systemPrompt,
                tools: [{ googleSearch: {} }],
            },
        });
        return response?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(response);
    }

    const response = await postJson<any>("/api/ai/openai/response", {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        chatModel: config.model,
        input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
        ],
        tools: [{ type: "web_search" }]
    });
    return response?.output_text || response?.choices?.[0]?.message?.content || JSON.stringify(response);
};
