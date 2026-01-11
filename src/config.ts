import 'dotenv/config';

export const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    enabled: !!process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  },

  exa: {
    apiKey: process.env.EXA_API_KEY || '',
    enabled: !!process.env.EXA_API_KEY,
  },

  search: {
    useRealSearch: !!process.env.EXA_API_KEY,
    numResults: 10,
    timeout: 10000,
  },

  simulation: {
    enabled: !process.env.EXA_API_KEY,
    latencyMs: { min: 500, max: 1500 },
  },
};

export function isSearchEnabled(): boolean {
  return config.exa.enabled;
}

export function isGeminiEnabled(): boolean {
  return config.gemini.enabled;
}

export function getSearchMode(): 'real' | 'simulated' {
  return config.search.useRealSearch ? 'real' : 'simulated';
}

export function getAIMode(): 'gemini' | 'rule-based' {
  return config.gemini.enabled ? 'gemini' : 'rule-based';
}
