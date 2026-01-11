import { BaseAgentImpl } from '../../core/agent/base-agent.js';
import {
  AgentCapability,
  AgentExecutionContext,
  AgentResult,
  AgentTask,
} from '../../core/agent/types.js';

export interface SelectionInput {
  prompt?: string;
  options: Array<string | { label: string; value: unknown }>;
  stateField?: string;
}

export class SelectionAgent extends BaseAgentImpl {
  readonly id = 'shared:selection';
  readonly name = 'Selection Agent';
  readonly capabilities: AgentCapability[] = ['information-gathering'];

  constructor() {
    super([]);
    this.systemPrompt = `You help users make selections from available options.
Present choices clearly and help users understand the trade-offs.`;
  }

  canHandle(task: AgentTask): boolean {
    return (
      task.type === 'selection' && task.input && 'options' in task.input
    );
  }

  async execute(context: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();
    const input = context.task.input as unknown as SelectionInput;

    if (!input.options || input.options.length === 0) {
      return this.createErrorResult('No options provided', false, startTime);
    }

    const optionLabels = input.options.map((opt) =>
      typeof opt === 'string' ? opt : opt.label
    );

    const selectionResult = await context.requestInput(
      input.prompt || 'Please select an option:',
      optionLabels
    );

    const selection = typeof selectionResult === 'string'
      ? selectionResult
      : selectionResult.cancelled
        ? optionLabels[0]
        : String(selectionResult.selected);

    const selectedIndex = optionLabels.indexOf(selection);
    const selectedOption =
      input.options[selectedIndex >= 0 ? selectedIndex : 0];
    const selectedValue =
      typeof selectedOption === 'string' ? selectedOption : selectedOption.value;

    const stateUpdates = input.stateField
      ? { [input.stateField]: selectedValue }
      : {};

    return {
      success: true,
      output: { selected: selectedValue, index: selectedIndex },
      stateUpdates,
      nextAction: { type: 'continue' },
      toolsUsed: [],
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }
}
