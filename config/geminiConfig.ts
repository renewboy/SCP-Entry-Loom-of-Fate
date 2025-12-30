// Configuration for Gemini API
export const geminiConfig = {
  // API Key (loaded from environment variable)
  apiKey: process.env.API_KEY || '',

  // Model names
  models: {
    chat: 'gemini-2.5-flash-lite',
    image: 'gemini-2.5-flash-image',
  },

  // Generation configuration
  generation: {
    temperature: 0.9
  }
};
