export const AI_CONFIG_MISSING_EVENT = 'ai-config-missing';

export const dispatchAIConfigMissing = () => {
  window.dispatchEvent(new CustomEvent(AI_CONFIG_MISSING_EVENT));
};

export const subscribeAIConfigMissing = (callback: () => void): (() => void) => {
  window.addEventListener(AI_CONFIG_MISSING_EVENT, callback);
  return () => window.removeEventListener(AI_CONFIG_MISSING_EVENT, callback);
};
