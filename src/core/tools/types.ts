import { z } from 'zod';
import { StateSnapshot } from '../agent/types.js';

export type ToolCategory =
  | 'search'
  | 'data'
  | 'communication'
  | 'user'
  | 'storage'
  | 'external';

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly parametersSchema: z.ZodSchema;
  readonly category: ToolCategory;

  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
  validate?(params: unknown): ValidationResult;
}

export interface ToolContext {
  sessionId: string;
  state: StateSnapshot;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolExecution {
  tool: string;
  input: unknown;
  output: unknown;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}
