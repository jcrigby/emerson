import type { GenerationRequest, GenerationResponse, ModelConfig } from '@/types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Popular models for different tasks
export const MODELS: Record<string, ModelConfig> = {
  // Analysis (cheap, fast)
  'google/gemini-flash-1.5': {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    contextWindow: 1000000,
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
  },
  'anthropic/claude-3-haiku': {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    contextWindow: 200000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
  },
  // Writing (quality matters)
  'anthropic/claude-sonnet-4': {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  'anthropic/claude-3.5-sonnet': {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  // Creative (best quality)
  'anthropic/claude-opus-4': {
    id: 'anthropic/claude-opus-4',
    name: 'Claude Opus 4',
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  'openai/gpt-4o': {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  },
};

export const DEFAULT_MODELS = {
  analysis: 'google/gemini-flash-1.5',
  writing: 'anthropic/claude-sonnet-4',
  brainstorm: 'anthropic/claude-opus-4',
};

export async function generate(
  apiKey: string,
  request: GenerationRequest
): Promise<GenerationResponse> {
  const model = MODELS[request.model];
  if (!model) {
    throw new Error(`Unknown model: ${request.model}`);
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Emerson',
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
  
  const cost = 
    (usage.prompt_tokens / 1000) * model.costPer1kInput +
    (usage.completion_tokens / 1000) * model.costPer1kOutput;

  return {
    content: data.choices[0]?.message?.content || '',
    model: request.model,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      cost,
    },
  };
}

// Convenience functions for common tasks
export async function analyzeContent(
  apiKey: string,
  systemPrompt: string,
  content: string,
  model = DEFAULT_MODELS.analysis
): Promise<GenerationResponse> {
  return generate(apiKey, {
    model,
    systemPrompt,
    userPrompt: content,
    temperature: 0.3, // Lower temp for analysis
  });
}

export async function writeContent(
  apiKey: string,
  systemPrompt: string,
  instructions: string,
  model = DEFAULT_MODELS.writing
): Promise<GenerationResponse> {
  return generate(apiKey, {
    model,
    systemPrompt,
    userPrompt: instructions,
    temperature: 0.8, // Higher temp for creative writing
    maxTokens: 8192,
  });
}

export async function brainstorm(
  apiKey: string,
  systemPrompt: string,
  prompt: string,
  model = DEFAULT_MODELS.brainstorm
): Promise<GenerationResponse> {
  return generate(apiKey, {
    model,
    systemPrompt,
    userPrompt: prompt,
    temperature: 1.0, // Max creativity
  });
}

// Estimate token count (rough approximation)
export function estimateTokens(text: string): number {
  // ~4 chars per token on average for English
  return Math.ceil(text.length / 4);
}

// Check if content fits in context window
export function fitsInContext(text: string, modelId: string, reserveForOutput = 4096): boolean {
  const model = MODELS[modelId];
  if (!model) return false;
  const tokens = estimateTokens(text);
  return tokens < (model.contextWindow - reserveForOutput);
}
