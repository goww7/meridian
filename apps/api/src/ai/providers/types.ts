/**
 * LLM Provider abstraction layer.
 * All providers must implement this interface to be used for artifact generation.
 */

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
  model: string;
}

export interface LlmResponse {
  text: string;
  usage: LlmUsage;
}

export interface LlmProvider {
  readonly name: string;
  readonly defaultModel: string;
  generate(messages: LlmMessage[], options?: LlmOptions): Promise<LlmResponse>;
}
