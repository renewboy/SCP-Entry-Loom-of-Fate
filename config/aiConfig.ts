export const aiConfig = {
  provider: (import.meta.env.VITE_AI_PROVIDER) as 'gemini' | 'openai',
  apiBaseUrl: import.meta.env.VITE_AI_SERVER_URL || 'http://127.0.0.1:5174',
  cacheTtl: import.meta.env.VITE_AI_CACHE_TTL || '864000s',
  models: {
    chat: 'gemini-2.5-flash',
    image: 'gemini-2.5-flash-image',
    embedding: 'gemini-embedding-001',
  },
  generation: {
    temperature: 0.9
  }
};
