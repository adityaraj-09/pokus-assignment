import { z } from 'zod';
import { BaseAgent, AgentConfig } from './base-agent.js';
import { AgentDefinition, ExecutionContext, ClassificationResult } from '../core/types.js';
import { registry } from '../core/registry.js';

const supervisorDefinition: AgentDefinition = {
  id: 'supervisor',
  name: 'Task Supervisor',
  description: 'Classifies user intent and routes to appropriate domain agents',
  systemPrompt: `You are a helpful assistant that helps users complete real-world tasks. Your role is to:

1. Understand what the user wants to accomplish
2. Gather any missing information needed to complete the task
3. Route the task to the appropriate specialist

You can help with:
- Finding medicine at nearby pharmacies
- Creating travel itineraries

When a user makes a request:
1. Identify the type of task (medicine finding or travel planning)
2. Extract key information from their request
3. Ask clarifying questions if needed
4. Once you have enough information, proceed with the task

Be conversational, helpful, and efficient. Focus on getting to a clear outcome.`,
  tools: [
    {
      name: 'classify_intent',
      description: 'Classify the user intent and extract entities',
      parameters: z.object({
        userInput: z.string().describe('The user input to classify'),
      }),
      execute: async (params) => {
        const { userInput } = params as { userInput: string };
        return registry.classify(userInput);
      },
    },
    {
      name: 'ask_clarifying_question',
      description: 'Ask the user a clarifying question',
      parameters: z.object({
        question: z.string().describe('The question to ask'),
        options: z.array(z.string()).optional().describe('Optional list of choices'),
      }),
      execute: async (params, context) => {
        const { question, options } = params as { question: string; options?: string[] };
        return context.askUser(question, options);
      },
    },
  ],
};

export class SupervisorAgent extends BaseAgent {
  constructor(config: AgentConfig = {}) {
    super(supervisorDefinition, config);
  }

  async classifyInput(input: string): Promise<ClassificationResult> {
    return registry.classify(input);
  }

  async handleInitialInput(
    input: string,
    context: ExecutionContext
  ): Promise<{
    taskType: string;
    extractedInfo: Record<string, unknown>;
    response: string;
    needsMoreInfo: boolean;
    questions?: string[];
  }> {
    const classification = this.classifyInput(input);

    const response = await this.process(
      `The user said: "${input}".

Please help them accomplish their goal. If this is about finding medicine, we need to know:
- What medicine they're looking for
- Their approximate location (or they can share it)
- Any urgency or preferences

If this is about travel planning, we need to know:
- The destination
- Travel dates (or flexibility)
- Budget and preferences

Respond naturally and ask for any missing information.`,
      context
    );

    const result = await classification;

    return {
      taskType: result.taskType,
      extractedInfo: result.extractedEntities,
      response: response.content,
      needsMoreInfo: result.confidence < 0.7,
    };
  }
}

export const createSupervisorAgent = (config?: AgentConfig): SupervisorAgent => {
  return new SupervisorAgent(config);
};
