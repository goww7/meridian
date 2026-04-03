import OpenAI from 'openai';
import type { LlmProvider, LlmMessage, LlmOptions, LlmResponse } from './types.js';

export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-5.4';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(messages: LlmMessage[], options?: LlmOptions): Promise<LlmResponse> {
    const model = options?.model || this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      max_completion_tokens: options?.maxTokens ?? 8192,
      messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    const choice = response.choices[0];
    const text = choice?.message?.content || '';

    return {
      text,
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
        model,
      },
    };
  }
}
