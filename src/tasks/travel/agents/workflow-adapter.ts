import { BaseAgentImpl } from '../../../core/agent/base-agent.js';
import {
  AgentCapability,
  AgentExecutionContext,
  AgentResult,
  AgentTask,
} from '../../../core/agent/types.js';
import { TravelWorkflow, TravelWorkflowContext } from '../workflow.js';
import { SelectConfig, SelectResult } from '../../../ui/types.js';
import { TerminalSelect, TerminalMultiSelect } from '../../../ui/terminal/index.js';
import ora from 'ora';

export class TravelWorkflowAdapter extends BaseAgentImpl {
  readonly id = 'travel:workflow';
  readonly name = 'Travel Workflow Agent';
  readonly capabilities: AgentCapability[] = [
    'information-gathering',
    'search',
    'generation',
  ];

  constructor() {
    super([]);
  }

  canHandle(task: AgentTask): boolean {
    return task.type === 'travel' || task.type === 'travel-full';
  }

  async execute(context: AgentExecutionContext): Promise<AgentResult> {
    const startTime = Date.now();

    const askUserWrapper = async (question: string, options?: string[]): Promise<string> => {
      const result = await context.requestInput(question, options);
      if (typeof result === 'string') {
        return result;
      }
      if (result.cancelled) {
        return options?.[0] || '';
      }
      return String(result.selected);
    };

    const selectWrapper = async <T>(config: SelectConfig<T>): Promise<SelectResult<T>> => {
      if (config.mode === 'multi') {
        const selector = new TerminalMultiSelect(config);
        return selector.prompt();
      }
      const selector = new TerminalSelect(config);
      return selector.prompt();
    };

    const workflowContext: TravelWorkflowContext = {
      askUser: askUserWrapper,
      select: selectWrapper,
      showProgress: (message: string) => ora(message).start(),
      log: (message: string) => {
        // Print directly to console so itinerary is visible
        console.log(message);
      },
    };

    try {
      const workflow = new TravelWorkflow(workflowContext);
      const userInput = (context.task.input as { userInput?: string })?.userInput || '';
      const finalState = await workflow.run(userInput);

      return {
        success: finalState.status === 'completed',
        output: {
          itinerary: finalState.itinerary,
          destination: finalState.destination,
          dates: finalState.dates,
          preferences: finalState.preferences,
        },
        stateUpdates: {
          destination: finalState.destination,
          dates: finalState.dates,
          budget: finalState.budget,
          preferences: finalState.preferences,
          itinerary: finalState.itinerary,
          workflowStage: finalState.workflowStage,
        },
        nextAction: { type: 'complete', summary: 'Travel itinerary created' },
        toolsUsed: [],
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error',
        false,
        startTime
      );
    }
  }
}
