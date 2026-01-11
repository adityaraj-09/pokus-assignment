import { BaseAgentImpl } from '../../core/agent/base-agent.js';
import {
  AgentCapability,
  AgentExecutionContext,
  AgentResult,
  AgentTask,
} from '../../core/agent/types.js';

export interface ReviewInput {
  title?: string;
  content: string | Record<string, unknown>;
  approveText?: string;
  reviseText?: string;
  stateField?: string;
}

export class ReviewAgent extends BaseAgentImpl {
  readonly id = 'shared:review';
  readonly name = 'Review Agent';
  readonly capabilities: AgentCapability[] = ['information-gathering'];

  constructor() {
    super([]);
  }

  canHandle(task: AgentTask): boolean {
    return task.type === 'review' && task.input && 'content' in task.input;
  }

  async execute(context: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const input = context.task.input as unknown as ReviewInput;

    let displayContent: string;
    if (typeof input.content === 'string') {
      displayContent = input.content;
    } else {
      displayContent = JSON.stringify(input.content, null, 2);
    }

    const title = input.title || 'Please review:';
    const message = `${title}\n\n${displayContent}\n`;

    const approveText = input.approveText || 'Approve';
    const reviseText = input.reviseText || 'Request changes';

    const responseResult = await context.requestInput(message, [approveText, reviseText]);
    const response = typeof responseResult === 'string'
      ? responseResult
      : responseResult.cancelled
        ? reviseText
        : String(responseResult.selected);
    const approved =
      response.toLowerCase().includes('approve') || response === approveText;

    if (approved) {
      const stateUpdates = input.stateField
        ? { [input.stateField]: 'approved' }
        : {};

      return {
        success: true,
        output: { approved: true },
        stateUpdates,
        nextAction: { type: 'continue' },
        toolsUsed: [],
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }

    const feedbackResult = await context.requestInput(
      'What changes would you like to make?'
    );
    const feedback = typeof feedbackResult === 'string'
      ? feedbackResult
      : feedbackResult.cancelled
        ? ''
        : String(feedbackResult.selected);

    return {
      success: true,
      output: { approved: false, feedback },
      stateUpdates: { userFeedback: feedback },
      nextAction: { type: 'continue', nextStage: 'refining' },
      toolsUsed: [],
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }
}
