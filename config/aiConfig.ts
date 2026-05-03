export const aiConfig = {
  apiBaseUrl: import.meta.env.VITE_AI_SERVER_URL || 'http://127.0.0.1:5174',
  providers: {
    gemini: {
      chatModel: 'gemini-3-flash-preview',
      imageModel: 'gemini-2.5-flash-image',
      embeddingModel: 'gemini-embedding-001',
      cacheTtl: '86400s',
    },
    openai: {
      baseUrl: '',
      chatModel: 'glm-4-7-251222',
      imageModel: 'doubao-seedream-4-5-251128',
    },
  },
  routes: {
    analysis: {
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
    },
    assistant: {
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
    },
    narration: {
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
    },
    image: {
      provider: 'gemini',
      model: 'gemini-2.5-flash-image',
    },
    embedding: {
      provider: 'gemini',
      model: 'gemini-embedding-001',
    },
  },
  generation: {
    temperature: 0.9
  },
  context: {
    tokenLimit: Number(import.meta.env.VITE_AI_TOKEN_LIMIT) || 18000,
    compressionCount: Number(import.meta.env.VITE_AI_COMPRESSION_COUNT) || 44,
  }
};
