import { z } from 'zod';
import { StateSnapshot } from '../state/types.js';
import { SelectConfig, SelectResult } from '../../ui/types.js';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  stages: WorkflowStageDefinition[];
  initialStage: string;
  stateSchema?: z.ZodSchema;
  createInitialState?: () => Record<string, unknown>;
  onStart?: (state: StateSnapshot) => Promise<void>;
  onComplete?: (state: StateSnapshot) => Promise<void>;
  onError?: (error: Error, state: StateSnapshot) => Promise<void>;
}

export interface WorkflowStageDefinition {
  id: string;
  name: string;
  description?: string;
  agent: string;
  input?: (state: StateSnapshot) => Record<string, unknown>;
  preconditions?: StagePrecondition[];
  next: string | ((state: StateSnapshot) => string | null) | null;
  retry?: RetryConfig;
  timeout?: number;
}

export interface StagePrecondition {
  field: string;
  condition: 'exists' | 'equals' | 'not_empty' | 'custom';
  value?: unknown;
  customCheck?: (state: StateSnapshot) => boolean;
  errorMessage: string;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

export interface WorkflowResult {
  success: boolean;
  finalState: StateSnapshot;
  executionLog: StageExecution[];
  output: unknown;
  error?: string;
  durationMs: number;
}

export interface StageExecution {
  stageId: string;
  agentId: string;
  result: import('../agent/types.js').AgentResult;
  attempts: number;
  durationMs: number;
}

export interface WorkflowExecutorConfig {
  requestInput: <T = string>(
    promptOrConfig: string | SelectConfig<T>,
    options?: string[]
  ) => Promise<string | SelectResult<T>>;
  log: (message: string, level?: string) => void;
  showProgress: (message: string) => ProgressIndicator;
}

export interface ProgressIndicator {
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}
