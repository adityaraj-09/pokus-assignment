import { TaskDefinition, TaskType, ClassificationResult, AgentDefinition } from './types.js';
import { isGeminiEnabled } from '../config.js';
import { classifyIntent as geminiClassify } from '../services/gemini.js';

export class TaskRegistry {
  private static instance: TaskRegistry;
  private tasks: Map<TaskType, TaskDefinition> = new Map();
  private agents: Map<string, AgentDefinition> = new Map();

  private constructor() {}

  static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  register(definition: TaskDefinition): void {
    if (this.tasks.has(definition.type)) {
      throw new Error(`Task type '${definition.type}' is already registered`);
    }
    this.tasks.set(definition.type, definition);
  }

  registerAgent(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
  }

  getTask(type: TaskType): TaskDefinition | undefined {
    return this.tasks.get(type);
  }

  getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  listTasks(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  async classifyWithAI(input: string): Promise<ClassificationResult> {
    if (!isGeminiEnabled()) {
      return this.classify(input);
    }

    try {
      const result = await geminiClassify(input);
      return {
        taskType: result.taskType === 'unknown' ? 'unknown' : result.taskType,
        confidence: result.confidence,
        extractedEntities: result.extractedEntities as Record<string, string>,
      };
    } catch (error) {
      console.error('Gemini classification failed, falling back to rule-based:', error);
      return this.classify(input);
    }
  }

  classify(input: string): ClassificationResult {
    const normalizedInput = input.toLowerCase();
    let bestMatch: { type: TaskType; score: number } | null = null;

    for (const [type, definition] of this.tasks) {
      let score = 0;

      for (const pattern of definition.patterns) {
        if (normalizedInput.includes(pattern.toLowerCase())) {
          score += 10;
        }
      }

      for (const example of definition.intentExamples) {
        const exampleWords = example.toLowerCase().split(/\s+/);
        const inputWords = normalizedInput.split(/\s+/);
        const overlap = exampleWords.filter((w) => inputWords.includes(w)).length;
        score += overlap * 2;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { type, score };
      }
    }

    const extractedEntities: Record<string, string> = {};

    if (bestMatch) {
      const definition = this.tasks.get(bestMatch.type);
      if (definition) {
        for (const pattern of definition.patterns) {
          const regex = new RegExp(`${pattern}\\s+([\\w\\s]+?)(?:\\s+near|\\s+in|$)`, 'i');
          const match = input.match(regex);
          if (match) {
            extractedEntities['query'] = match[1]?.trim() || '';
          }
        }
      }
    }

    return {
      taskType: bestMatch?.type || 'unknown',
      confidence: bestMatch ? Math.min(bestMatch.score / 30, 1) : 0,
      extractedEntities,
    };
  }

  hasTask(type: TaskType): boolean {
    return this.tasks.has(type);
  }
}

export const registry = TaskRegistry.getInstance();
