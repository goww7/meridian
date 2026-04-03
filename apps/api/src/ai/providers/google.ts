import { GoogleGenAI } from '@google/genai';
import type { LlmProvider, LlmMessage, LlmOptions, LlmResponse } from './types.js';

export class GoogleProvider implements LlmProvider {
  readonly name = 'google';
  readonly defaultModel = 'gemini-3.1-pro';
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(messages: LlmMessage[], options?: LlmOptions): Promise<LlmResponse> {
    const model = options?.model || this.defaultModel;

    // Combine messages into a single prompt (Gemini uses generateContent with contents)
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

    const response = await this.client.models.generateContent({
      model,
      contents,
      config: {
        maxOutputTokens: options?.maxTokens ?? 8192,
      },
    });

    const text = response.text ?? '';
    const usage = response.usageMetadata;

    return {
      text,
      usage: {
        input_tokens: usage?.promptTokenCount ?? 0,
        output_tokens: usage?.candidatesTokenCount ?? 0,
        model,
      },
    };
  }
}
