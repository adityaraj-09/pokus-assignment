import { z } from 'zod';

export const BaseStateSchema = z.object({
  sessionId: z.string(),
  taskType: z.string().optional(),
  status: z.enum(['idle', 'active', 'waiting_input', 'completed', 'error']),
  currentStage: z.string().optional(),
  currentAgent: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

export type BaseState = z.infer<typeof BaseStateSchema>;

export interface StateSnapshot extends BaseState {
  domain: Record<string, unknown>;
}

export interface StateChange {
  path: string[];
  previousValue: unknown;
  newValue: unknown;
  timestamp: Date;
  source: string;
}

export type StateSubscriber = (
  state: StateSnapshot,
  changes: StateChange[]
) => void;

export type StateSelector<T> = (state: StateSnapshot) => T;
