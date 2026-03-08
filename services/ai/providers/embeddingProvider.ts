import { postJson } from "./backendClient";
import { getEffectiveAIConfig } from "../../aiConfigService";

class EmbeddingProvider {
  constructor() {
  }

  async getEmbeddings(contents: string[]): Promise<number[][]> {
    if (!contents || contents.length === 0) return [];
    try {
      const config = await getEffectiveAIConfig();
      const response = await postJson<any>("/api/ai/gemini/embeddings", {
        apiKey: config.gemini.apiKey,
        model: config.gemini.embeddingModel,
        contents,
      });
      const embeddings = response.embeddings?.map((e) => e.values) || [];
      return embeddings;
    } catch (error) {
      console.error("Failed to generate embeddings:", error);
      return [];
    }
  }
}

const embeddingProvider = new EmbeddingProvider();

export const getEmbeddings = async (contents: string[]): Promise<number[][]> => {
  return embeddingProvider.getEmbeddings(contents);
};
