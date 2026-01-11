import { BaseAgentImpl } from '../../core/agent/base-agent.js';
import {
  AgentCapability,
  AgentExecutionContext,
  AgentResult,
  AgentTask,
} from '../../core/agent/types.js';

export interface ConfirmationInput {
  message?: string;
  details?: Record<string, string>;
  confirmText?: string;
  cancelText?: string;
}

export class ConfirmationAgent extends BaseAgentImpl {
  readonly id = 'shared:confirmation';
  readonly name = 'Confirmation Agent';
  readonly capabilities: AgentCapability[] = ['information-gathering'];

  constructor() {
    super([]);
  }

  canHandle(task: AgentTask): boolean {
    return task.type === 'confirmation';
  }

  async execute(context: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const input = context.task.input as ConfirmationInput;

    let message = input.message || 'Please confirm:';
    if (input.details) {
      message +=
        '\n\n' +
        Object.entries(input.details)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n');
    }

    const confirmText = input.confirmText || 'Yes, proceed';
    const cancelText = input.cancelText || 'No, cancel';

    const responseResult = await context.requestInput(message, [confirmText, cancelText]);
    const response = typeof responseResult === 'string'
      ? responseResult
      : responseResult.cancelled
        ? cancelText
        : String(responseResult.selected);
    const confirmed = response.toLowerCase().includes('yes') || response === confirmText;

    return {
      success: true,
      output: { confirmed },
      stateUpdates: {},
      nextAction: confirmed
        ? { type: 'continue' }
        : { type: 'complete', summary: 'User cancelled' },
      toolsUsed: [],
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }
}
