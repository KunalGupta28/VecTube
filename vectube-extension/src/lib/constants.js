// ============================================================================
// VecTube Chrome Extension - Constants & AI Model Definitions
// Centralized configuration ported from the original web/pages/chat/[id].vue
// ============================================================================

export const AI_PROVIDERS = ['openai', 'gemini', 'claude', 'mistral', 'ollama'];

export const ANALYSIS_PROVIDERS = ['local', 'gemini', 'voyageai', 'openai', 'mistral'];

export const AI_MODELS = {
  openai: [
    'gpt-4-turbo',
    'gpt-4',
    'gpt-4o',
    'gpt-4o-mini',
    'o1-mini',
    'gpt-3.5-turbo',
  ],
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'],
  claude: [
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ],
  mistral: [
    'mistral-large-latest',
    'open-mistral-nemo',
    'open-mistral-7b',
    'open-mixtral-8x7b',
    'open-mixtral-8x22b',
  ],
  ollama: ['qwen2', 'llama3.1'],
};

export const ANALYSIS_STATES = {
  NOT_ANALYZED: 0,
  READY: 1,
  IN_PROGRESS: 2,
};

export const DEFAULT_SETTINGS = {
  apiUrl: 'http://localhost:8000',
  defaultChatProvider: 'gemini',
  defaultChatModel: 'gemini-1.5-flash',
  defaultSummaryProvider: 'gemini',
  defaultSummaryModel: 'gemini-1.5-flash',
  defaultSummaryLang: 'en',
  defaultAnalysisProvider: 'gemini',
};
