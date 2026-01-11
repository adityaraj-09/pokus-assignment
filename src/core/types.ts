import { z } from 'zod';

export type AgentId = string;
export type TaskType = 'medicine' | 'travel' | string;
export type WorkflowStage = string;

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.unknown()).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const CoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const LocationSchema = z.object({
  coordinates: CoordinatesSchema,
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});
export type Location = z.infer<typeof LocationSchema>;

export interface AgentDefinition {
  id: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  model?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown, context: ExecutionContext) => Promise<unknown>;
}

export interface ExecutionContext {
  sessionId: string;
  agentId: AgentId;
  state: BaseState;
  updateState: (update: Partial<BaseState>) => void;
  askUser: (question: string, options?: string[]) => Promise<string>;
  log: (message: string, level?: 'info' | 'debug' | 'warn' | 'error') => void;
}

export const BaseStateSchema = z.object({
  sessionId: z.string(),
  taskType: z.string().optional(),
  status: z.enum(['idle', 'active', 'waiting_input', 'completed', 'error']),
  messages: z.array(MessageSchema),
  currentAgent: z.string().optional(),
  workflowStage: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type BaseState = z.infer<typeof BaseStateSchema>;

export interface TaskDefinition {
  type: TaskType;
  name: string;
  description: string;
  patterns: string[];
  intentExamples: string[];
  createInitialState: () => Record<string, unknown>;
  workflow: WorkflowDefinition;
}

export interface WorkflowDefinition {
  stages: WorkflowStageDefinition[];
  initialStage: string;
}

export interface WorkflowStageDefinition {
  id: string;
  name: string;
  agent: AgentId;
  next: string | ((state: BaseState) => string | null) | null;
}

export interface ClassificationResult {
  taskType: TaskType;
  confidence: number;
  extractedEntities: Record<string, string>;
}

export interface WorkflowResult {
  success: boolean;
  finalState: BaseState;
  output: unknown;
  error?: string;
}
