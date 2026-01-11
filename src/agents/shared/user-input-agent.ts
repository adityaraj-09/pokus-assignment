import { BaseAgentImpl } from '../../core/agent/base-agent.js';
import {
  AgentCapability,
  AgentExecutionContext,
  AgentResult,
  AgentTask,
} from '../../core/agent/types.js';
import { StateSnapshot } from '../../core/state/types.js';

export interface FieldDefinition {
  name: string;
  prompt: string;
  options?: string[];
  required: boolean;
  validator?: (value: string) => boolean;
  validationMessage?: string;
  transformer?: (value: string) => unknown;
}

export interface UserInputConfig {
  fields: FieldDefinition[];
}

export class UserInputAgent extends BaseAgentImpl {
  readonly id = 'shared:user-input';
  readonly name = 'User Input Agent';
  readonly capabilities: AgentCapability[] = ['information-gathering'];

  private fieldDefinitions: FieldDefinition[];

  constructor(config?: UserInputConfig) {
    super([]);
    this.fieldDefinitions = config?.fields || [];
    this.systemPrompt = `You help gather information from users in a friendly, conversational way.
Ask one question at a time and validate responses before moving on.`;
  }

  canHandle(task: AgentTask): boolean {
    return task.type === 'gather-input' || task.type === 'user-input';
  }

  setFields(fields: FieldDefinition[]): void {
    this.fieldDefinitions = fields;
  }

  async execute(context: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    const fields =
      (context.task.input as { fields?: FieldDefinition[] })?.fields ||
      this.fieldDefinitions;

    const missing = this.findMissingFields(context.state, fields);

    if (missing.length === 0) {
      return {
        success: true,
        output: { message: 'All required information gathered' },
        stateUpdates: {},
        nextAction: { type: 'continue' },
        toolsUsed: [],
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }

    const field = missing[0];
    const userInputResult = await context.requestInput(field.prompt, field.options);
    const userInput = typeof userInputResult === 'string'
      ? userInputResult
      : userInputResult.cancelled
        ? ''
        : String(userInputResult.selected);

    try {
      const validated = await this.validateAndTransform(field, userInput);

      return {
        success: true,
        output: { field: field.name, value: validated },
        stateUpdates: { [field.name]: validated },
        nextAction:
          missing.length > 1
            ? {
                type: 'wait_for_input',
                prompt: missing[1].prompt,
                options: missing[1].options,
              }
            : { type: 'continue' },
        toolsUsed: [],
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        stateUpdates: {},
        nextAction: {
          type: 'wait_for_input',
          prompt: `Invalid input. ${field.validationMessage || 'Please try again.'}\n${field.prompt}`,
          options: field.options,
        },
        toolsUsed: [],
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  private findMissingFields(
    state: StateSnapshot,
    fields: FieldDefinition[]
  ): FieldDefinition[] {
    return fields.filter((field) => {
      const value = state.domain[field.name];
      return (
        field.required &&
        (value === undefined || value === null || value === '')
      );
    });
  }

  private async validateAndTransform(
    field: FieldDefinition,
    input: string
  ): Promise<unknown> {
    if (field.validator && !field.validator(input)) {
      throw new Error(
        `Invalid input for ${field.name}: ${field.validationMessage || 'Invalid value'}`
      );
    }

    if (field.transformer) {
      return field.transformer(input);
    }

    return input;
  }
}
