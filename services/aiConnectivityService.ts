import { AISettings } from '../types';
import { postJson } from './ai/providers/backendClient';

const connectivityTestingMessage = 'connection test, return {} directly';
export async function testAIConnectivity(settings: AISettings): Promise<void> {
  if (settings.provider === 'gemini') {
    await postJson('/api/ai/gemini/count-tokens', {
      apiKey: settings.gemini.apiKey,
      model: settings.gemini.chatModel,
      contents: [{ role: 'user', parts: [{ text: connectivityTestingMessage }] }],
    });
    return;
  }

  await postJson('/api/ai/openai/response', {
    apiKey: settings.openai.apiKey,
    baseUrl: settings.openai.baseUrl,
    chatModel: settings.openai.chatModel,
    input: connectivityTestingMessage,
  });
}
