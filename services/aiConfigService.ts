import { AISettings, AIProvider, GeminiSettings, OpenAISettings } from '../types';
import { loadGlobalSettings } from './indexedDBService';
import { aiConfig } from '../config/aiConfig';

export interface EffectiveAIConfig {
  provider: AIProvider;
  gemini: {
    apiKey: string;
    chatModel: string;
    imageModel: string;
    embeddingModel: string;
  };
  openai: {
    apiKey: string;
    baseUrl: string;
    chatModel: string;
    imageModel: string;
  };
}

export interface AIConfigValidation {
  valid: boolean;
  missingFields: string[];
}

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

export async function getEffectiveAIConfig(): Promise<EffectiveAIConfig> {
  if (cachedEffectiveConfig) return cachedEffectiveConfig;

  const userSettings = await loadUserAISettings();
  const provider: AIProvider = userSettings?.provider || (aiConfig.provider as AIProvider) || 'gemini';

  const effectiveConfig: EffectiveAIConfig = {
    provider,
    gemini: {
      apiKey: userSettings?.gemini?.apiKey || '',
      chatModel: userSettings?.gemini?.chatModel || aiConfig.providers.gemini.chatModel,
      imageModel: userSettings?.gemini?.imageModel || aiConfig.providers.gemini.imageModel,
      embeddingModel: aiConfig.providers.gemini.embeddingModel,
    },
    openai: {
      apiKey: userSettings?.openai?.apiKey || '',
      baseUrl: userSettings?.openai?.baseUrl || aiConfig.providers.openai.baseUrl,
      chatModel: userSettings?.openai?.chatModel || aiConfig.providers.openai.chatModel,
      imageModel: userSettings?.openai?.imageModel || aiConfig.providers.openai.imageModel,
    },
  };

  cachedEffectiveConfig = effectiveConfig;
  return effectiveConfig;
}

export function validateAISettings(settings: AISettings, serverStatus?: { geminiAvailable: boolean; openaiAvailable: boolean }): AIConfigValidation {
  const missingFields: string[] = [];
  const { provider, gemini, openai } = settings;

  if (!provider) {
    missingFields.push('provider');
    return { valid: false, missingFields };
  }

  if (provider === 'gemini') {
    if (!gemini?.apiKey) {
      missingFields.push('gemini.apiKey');
    }
    if (!gemini?.chatModel) {
      missingFields.push('gemini.chatModel');
    }
  } else if (provider === 'openai') {
    if (!openai?.apiKey) {
      missingFields.push('openai.apiKey');
    }
    if (!openai?.baseUrl) {
      missingFields.push('openai.baseUrl');
    }
    if (!openai?.chatModel) {
      missingFields.push('openai.chatModel');
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
    const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
    const headers: Record<string, string> = {};
    if (supabaseAnonKey) {
      headers.Authorization = `Bearer ${supabaseAnonKey}`;
      headers.apikey = supabaseAnonKey;
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

export function getDefaultAISettings(): AISettings {
  return {
    provider: (aiConfig.provider as AIProvider) || 'gemini',
    gemini: {
      apiKey: '',
      chatModel: aiConfig.providers.gemini.chatModel,
      imageModel: aiConfig.providers.gemini.imageModel,
    },
    openai: {
      apiKey: '',
      baseUrl: aiConfig.providers.openai.baseUrl,
      chatModel: aiConfig.providers.openai.chatModel,
      imageModel: aiConfig.providers.openai.imageModel,
    },
  };
}
