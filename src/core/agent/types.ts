import { z } from 'zod';
import { SelectConfig, SelectResult } from '../../ui/types.js';

export type AgentCapability =
  | 'information-gathering'
  | 'search'
  | 'generation'
  | 'validation'
  | 'communication'
  | 'orchestration';

export interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly capabilities: AgentCapability[];

  execute(context: AgentExecutionContext): Promise<AgentResult>;
  canHandle(task: AgentTask): boolean;
}

export interface AgentTask {
  id: string;
  type: string;
  input: Record<string, unknown>;
  constraints?: Record<string, unknown>;
}

export interface AgentExecutionContext {
  sessionId: string;
  task: AgentTask;
  state: StateSnapshot;
  emit: (event: AgentEvent) => void;
  requestInput: <T = string>(
    promptOrConfig: string | SelectConfig<T>,
    options?: string[]
  ) => Promise<string | SelectResult<T>>;
}

export interface StateSnapshot {
  sessionId: string;
  taskType?: string;
  status: 'idle' | 'active' | 'waiting_input' | 'completed' | 'error';
  currentStage?: string;
  currentAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  domain: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output: unknown;
  stateUpdates: Record<string, unknown>;
  nextAction: NextAction;
  toolsUsed: ToolExecution[];
  metadata: {
    executionTimeMs: number;
    reasoning?: string;
  };
}

export type NextAction =
  | { type: 'continue'; nextStage?: string }
  | { type: 'wait_for_input'; prompt: string; options?: string[] }
  | { type: 'handoff'; targetAgent: string; reason: string }
  | { type: 'complete'; summary: string }
  | { type: 'error'; message: string; recoverable: boolean };

export type AgentEvent =
  | { type: 'started'; agentId: string; task: AgentTask }
  | { type: 'progress'; agentId: string; message: string; percent?: number }
  | { type: 'tool_called'; agentId: string; tool: string; input: unknown }
  | { type: 'tool_result'; agentId: string; tool: string; output: unknown }
  | { type: 'state_updated'; agentId: string; updates: Record<string, unknown> }
  | { type: 'completed'; agentId: string; result: AgentResult }
  | { type: 'error'; agentId: string; error: Error };

export interface ToolExecution {
  tool: string;
  input: unknown;
  output: unknown;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface AgentConfig {
  geminiApiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
