import { aiConfig } from "../../config/aiConfig";
import { ResolvedAIModelConfig, resolveAIModelConfig } from "../aiConfigService";
import { AIService } from "./types";
import { GeminiProvider } from "./providers/geminiProvider";
import { OpenAIProvider } from "./providers/openaiProvider";

interface CachedProvider {
    key: string;
    provider: AIService;
}

let analysisProvider: CachedProvider | null = null;
let assistantProvider: CachedProvider | null = null;
let narrationProvider: CachedProvider | null = null;
let imageProvider: CachedProvider | null = null;

const routeKey = (config: ResolvedAIModelConfig) => [
    config.route,
    config.provider,
    config.apiKey,
    config.baseUrl || "",
    config.model,
].join(":");

const createProvider = (config: ResolvedAIModelConfig): AIService => {
    const providerConfig = {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        chatModel: config.model,
        imageModel: config.model,
        embeddingModel: config.model,
    };

    if (config.provider === "openai") {
        return new OpenAIProvider(providerConfig);
    }
    return new GeminiProvider(providerConfig);
};

const getCachedProvider = async (
    route: "analysis" | "assistant" | "narration" | "image",
    cached: CachedProvider | null,
    setCached: (value: CachedProvider) => void,
): Promise<AIService> => {
    const config = await resolveAIModelConfig(route);
    const key = routeKey(config);
    if (cached?.key === key) {
        return cached.provider;
    }

    console.log(`[ProviderRouter] Initializing ${route} provider: ${config.provider}/${config.model}`);
    const provider = createProvider(config);
    setCached({ key, provider });
    return provider;
};

export const getAnalysisProvider = async (): Promise<AIService> => {
    return getCachedProvider("analysis", analysisProvider, (value) => {
        analysisProvider = value;
    });
};

export const getAssistantProvider = async (): Promise<AIService> => {
    return getCachedProvider("assistant", assistantProvider, (value) => {
        assistantProvider = value;
    });
};

export const getNarrationProvider = async (): Promise<AIService> => {
    return getCachedProvider("narration", narrationProvider, (value) => {
        narrationProvider = value;
    });
};

export const getImageProvider = async (): Promise<AIService> => {
    return getCachedProvider("image", imageProvider, (value) => {
        imageProvider = value;
    });
};

export const resolveEmbeddingConfig = async (): Promise<ResolvedAIModelConfig> => {
    const config = await resolveAIModelConfig("embedding");
    return {
        ...config,
        provider: "gemini",
        model: config.model || aiConfig.providers.gemini.embeddingModel,
    };
};

export const resetProviderRouter = () => {
    analysisProvider = null;
    assistantProvider = null;
    narrationProvider = null;
    imageProvider = null;
};
