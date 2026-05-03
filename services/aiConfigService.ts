import { AIModelRoute, AIModelRouteName, AIProvider, AISettings } from '../types';
import { loadGlobalSettings } from './indexedDBService';
import { aiConfig } from "../config/aiConfig";
import { getRequestHeaders } from "./ai/providers/backendClient";

export interface EffectiveAIConfig {
  providers: {
    gemini: {
      apiKey: string;
    };
    openai: {
      apiKey: string;
      baseUrl: string;
    };
  };
  routes: Record<AIModelRouteName, AIModelRoute>;
}

export interface ResolvedAIModelConfig {
  route: AIModelRouteName;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface AIConfigValidation {
  valid: boolean;
  missingFields: string[];
}

const AI_ROUTE_NAMES: AIModelRouteName[] = ['analysis', 'assistant', 'narration', 'image', 'embedding'];

let cachedEffectiveConfig: EffectiveAIConfig | null = null;
let cachedUserSettings: AISettings | null = null;

export async function loadUserAISettings(): Promise<AISettings | null> {
  if (cachedUserSettings) return cachedUserSettings;
  try {
    const settings = await loadGlobalSettings();
    cachedUserSettings = settings?.aiSettings || null;
    return cachedUserSettings;
  } catch {
    return null;
  }
}

export function clearAISettingsCache(): void {
  cachedUserSettings = null;
  cachedEffectiveConfig = null;
}

export function getDefaultAISettings(): AISettings {
  return {
    providers: {
      gemini: {
        apiKey: '',
      },
      openai: {
        apiKey: '',
        baseUrl: aiConfig.providers.openai.baseUrl,
      },
    },
    routes: {
      analysis: {
        provider: aiConfig.routes.analysis.provider as AIProvider,
        model: aiConfig.routes.analysis.model,
      },
      assistant: {
        provider: aiConfig.routes.assistant.provider as AIProvider,
        model: aiConfig.routes.assistant.model,
      },
      narration: {
        provider: aiConfig.routes.narration.provider as AIProvider,
        model: aiConfig.routes.narration.model,
      },
      image: {
        provider: aiConfig.routes.image.provider as AIProvider,
        model: aiConfig.routes.image.model,
      },
      embedding: {
        provider: 'gemini',
        model: aiConfig.routes.embedding.model,
      },
    },
  };
}

export async function getEffectiveAIConfig(): Promise<EffectiveAIConfig> {
  if (cachedEffectiveConfig) return cachedEffectiveConfig;

  const defaults = getDefaultAISettings();
  const userSettings = await loadUserAISettings();

  const effectiveConfig: EffectiveAIConfig = {
    providers: {
      gemini: {
        apiKey: userSettings?.providers?.gemini?.apiKey || defaults.providers.gemini.apiKey || '',
      },
      openai: {
        apiKey: userSettings?.providers?.openai?.apiKey || defaults.providers.openai.apiKey || '',
        baseUrl: userSettings?.providers?.openai?.baseUrl || defaults.providers.openai.baseUrl || '',
      },
    },
    routes: {
      analysis: userSettings?.routes?.analysis || defaults.routes.analysis,
      assistant: userSettings?.routes?.assistant || defaults.routes.assistant,
      narration: userSettings?.routes?.narration || defaults.routes.narration,
      image: userSettings?.routes?.image || defaults.routes.image,
      embedding: {
        provider: 'gemini',
        model: userSettings?.routes?.embedding?.model || defaults.routes.embedding.model,
      },
    },
  };

  cachedEffectiveConfig = effectiveConfig;
  return effectiveConfig;
}

export async function resolveAIModelConfig(route: AIModelRouteName): Promise<ResolvedAIModelConfig> {
  const config = await getEffectiveAIConfig();
  const routeConfig = config.routes[route];

  if (routeConfig.provider === 'openai') {
    return {
      route,
      provider: 'openai',
      apiKey: config.providers.openai.apiKey,
      baseUrl: config.providers.openai.baseUrl,
      model: routeConfig.model,
    };
  }

  return {
    route,
    provider: 'gemini',
    apiKey: config.providers.gemini.apiKey,
    model: routeConfig.model,
  };
}

export function validateAISettings(settings: AISettings): AIConfigValidation {
  const missingFields: string[] = [];
  const routes = settings.routes || getDefaultAISettings().routes;

  for (const route of AI_ROUTE_NAMES) {
    const routeConfig = routes[route];
    if (!routeConfig?.provider) {
      missingFields.push(`routes.${route}.provider`);
    }
    if (!routeConfig?.model) {
      missingFields.push(`routes.${route}.model`);
    }
  }

  if (routes.embedding?.provider !== 'gemini') {
    missingFields.push('routes.embedding.provider');
  }

  const usesGemini = AI_ROUTE_NAMES.some((route) => routes[route]?.provider === 'gemini');
  const usesOpenAI = AI_ROUTE_NAMES.some((route) => routes[route]?.provider === 'openai');

  if (usesGemini && !settings.providers?.gemini?.apiKey) {
    missingFields.push('providers.gemini.apiKey');
  }
  if (usesOpenAI) {
    if (!settings.providers?.openai?.apiKey) {
      missingFields.push('providers.openai.apiKey');
    }
    if (!settings.providers?.openai?.baseUrl) {
      missingFields.push('providers.openai.baseUrl');
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export async function checkAIConfigAvailable(): Promise<{ available: boolean; reason?: string }> {
  const userSettings = await loadUserAISettings();

  if (userSettings) {
    const validation = validateAISettings(userSettings);
    if (validation.valid) {
      return { available: true };
    }
  }

  try {
    const headers = await getRequestHeaders();
    const userApiKey = userSettings?.providers?.gemini?.apiKey || userSettings?.providers?.openai?.apiKey || "";
    if (userApiKey) {
      headers.apikey = userApiKey;
    }
    const response = await fetch(`${aiConfig.apiBaseUrl}/api/status`, {
      headers,
    });
    if (!response.ok) {
      return { available: false, reason: 'SERVER_ERROR' };
    }
    const status = await response.json();

    if (status.geminiAvailable || status.openaiAvailable) {
      return { available: true };
    }

    return { available: false, reason: 'NO_CONFIG' };
  } catch {
    return { available: false, reason: 'NETWORK_ERROR' };
  }
}

export function getProviderDisplayName(provider: AIProvider): string {
  return provider === 'gemini' ? 'Gemini' : '自定义';
}
