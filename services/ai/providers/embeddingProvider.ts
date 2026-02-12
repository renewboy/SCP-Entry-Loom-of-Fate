import { aiConfig } from "../../../config/aiConfig";
import { postJson } from "./backendClient";

class EmbeddingProvider {
  constructor() {
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    try {
      const { embeddings } = await postJson<{ embeddings: number[][] }>("/api/ai/gemini/embeddings", {
        model: aiConfig.models.embedding,
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
