import { z } from 'zod';
import { WorkflowDefinition } from '../workflow/types.js';
import { IAgent } from '../agent/types.js';
import { ITool } from '../tools/types.js';

export interface TaskPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;

  readonly patterns: string[];
  readonly intentExamples: string[];

  readonly stateSchema: z.ZodSchema;
  readonly createInitialState: () => Record<string, unknown>;

  readonly workflow: WorkflowDefinition;

  readonly agents: IAgent[];

  readonly tools: ITool[];

  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
}

export interface SharedAgentDefinition {
  readonly id: string;
  readonly agent: IAgent;
  readonly description: string;
  readonly usedBy: string[];
}
