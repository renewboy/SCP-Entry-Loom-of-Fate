import { postJson } from "./backendClient";
import { getEffectiveAIConfig } from "../../aiConfigService";

class EmbeddingProvider {
  constructor() {
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    try {
      const config = await getEffectiveAIConfig();
      const { embeddings } = await postJson<{ embeddings: number[][] }>("/api/ai/gemini/embeddings", {
        apiKey: config.gemini.apiKey,
        model: config.gemini.embeddingModel,
        texts,
      });
      return embeddings;
    } catch (error) {
      console.error("Failed to generate embeddings:", error);
      return [];
    }
  }
}

const embeddingProvider = new EmbeddingProvider();

export const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
  return embeddingProvider.getEmbeddings(texts);
};
