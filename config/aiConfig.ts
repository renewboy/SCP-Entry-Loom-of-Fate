// Configuration for AI Services
export const aiConfig = {
  // Gemini API Key (loaded from environment variable)
  apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '',
  
  // Provider configuration
  provider: (process.env.AI_PROVIDER || 'gemini') as 'gemini' | 'openai',
  
  // OpenAI / Volcengine specific config
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL,
    chatModel: process.env.OPENAI_CHAT_MODEL,
  },

  // Model names (Gemini)
  models: {
    chat: 'gemini-3-flash-preview',
    image: 'gemini-2.5-flash-image',
    embedding: 'gemini-embedding-001',
  },

  // Generation configuration
  generation: {
    temperature: 0.9
  }
};
