import { AIModelRouteName, AIProvider, AISettings } from '../types';
import { aiConfig } from '../config/aiConfig';
import { postJson } from './ai/providers/backendClient';

const connectivityTestingMessage = 'connection test, return {} directly';
const ROUTES: AIModelRouteName[] = ['analysis', 'assistant', 'narration', 'image', 'embedding'];

const findFirstTextRouteModel = (settings: AISettings, provider: AIProvider): string | undefined => {
  const textRoute = (['analysis', 'assistant', 'narration'] as AIModelRouteName[]).find(
    (route) => settings.routes[route]?.provider === provider && settings.routes[route]?.model,
  );
  return textRoute ? settings.routes[textRoute].model : undefined;
};

export async function testAIConnectivity(settings: AISettings): Promise<void> {
  const usesGemini = ROUTES.some((route) => settings.routes[route]?.provider === 'gemini');
  const usesOpenAI = ROUTES.some((route) => settings.routes[route]?.provider === 'openai');

  if (usesGemini) {
    await postJson('/api/ai/gemini/count-tokens', {
      apiKey: settings.providers.gemini.apiKey,
      model: findFirstTextRouteModel(settings, 'gemini') || aiConfig.providers.gemini.chatModel,
      contents: [{ role: 'user', parts: [{ text: connectivityTestingMessage }] }],
    });
  }

  if (usesOpenAI) {
    await postJson('/api/ai/openai/response', {
      apiKey: settings.providers.openai.apiKey,
      baseUrl: settings.providers.openai.baseUrl,
      chatModel: findFirstTextRouteModel(settings, 'openai') || aiConfig.providers.openai.chatModel,
      input: connectivityTestingMessage,
    });
  }
}
