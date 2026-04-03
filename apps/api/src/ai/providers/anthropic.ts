import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmMessage, LlmOptions, LlmResponse } from './types.js';

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-sonnet-4-6';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(messages: LlmMessage[], options?: LlmOptions): Promise<LlmResponse> {
    const model = options?.model || this.defaultModel;

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 8192,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        model,
      },
    };
  }
}
