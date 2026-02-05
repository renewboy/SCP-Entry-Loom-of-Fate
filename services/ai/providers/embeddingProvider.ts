import { GoogleGenAI } from "@google/genai";
import { aiConfig } from "../../../config/aiConfig";

class EmbeddingProvider {
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: aiConfig.apiKey });
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];
    try {
      const response = await this.client.models.embedContent({
        model: aiConfig.models.embedding,
        contents: texts,
      });
      return response.embeddings.map(e => e.values);
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
