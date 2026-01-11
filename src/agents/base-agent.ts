import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { AgentDefinition, ExecutionContext } from '../core/types.js';
import { config } from '../config.js';

export interface AgentConfig {
  geminiApiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }>;
  finished: boolean;
}

export abstract class BaseAgent {
  protected definition: AgentDefinition;
  protected genAI: GoogleGenerativeAI | null = null;
  protected model: GenerativeModel | null = null;
  protected config: AgentConfig;
  protected conversationHistory: Content[] = [];

  constructor(definition: AgentDefinition, agentConfig: AgentConfig = {}) {
    this.definition = definition;
    this.config = {
      model: config.gemini.model,
      temperature: 0.7,
      maxTokens: 4096,
      ...agentConfig,
    };

    const apiKey = agentConfig.geminiApiKey || config.gemini.apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.config.model! });
    }
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  async process(
    message: string,
    context: ExecutionContext
  ): Promise<AgentResponse> {
    if (!this.model) {
      throw new Error('Gemini API not configured. Set GEMINI_API_KEY in .env file.');
    }

    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const prompt = `${this.definition.systemPrompt}\n\nUser: ${message}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      this.conversationHistory.push({
        role: 'model',
        parts: [{ text: response }],
      });

      return {
        content: response,
        toolCalls: [],
        finished: true,
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      return {
        content: 'I encountered an error processing your request.',
        toolCalls: [],
        finished: true,
      };
    }
  }

  reset(): void {
    this.conversationHistory = [];
  }

  getHistory(): Content[] {
    return [...this.conversationHistory];
  }
}
