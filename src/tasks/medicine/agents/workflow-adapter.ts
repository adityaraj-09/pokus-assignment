import { BaseAgentImpl } from '../../../core/agent/base-agent.js';
import {
  AgentCapability,
  AgentExecutionContext,
  AgentResult,
  AgentTask,
} from '../../../core/agent/types.js';
import { MedicineWorkflow, MedicineWorkflowContext } from '../workflow.js';
import ora from 'ora';

export class MedicineWorkflowAdapter extends BaseAgentImpl {
  readonly id = 'medicine:workflow';
  readonly name = 'Medicine Workflow Agent';
  readonly capabilities: AgentCapability[] = [
    'information-gathering',
    'search',
    'communication',
  ];

  constructor() {
    super([]);
  }

  canHandle(task: AgentTask): boolean {
    return task.type === 'medicine' || task.type === 'medicine-full';
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

    const workflowContext: MedicineWorkflowContext = {
      askUser: askUserWrapper,
      showProgress: (message: string) => ora(message).start(),
      log: (message: string) => {
        // Print directly to console
        console.log(message);
      },
    };

    try {
      const workflow = new MedicineWorkflow(workflowContext);
      const userInput = (context.task.input as { userInput?: string })?.userInput || '';
      const finalState = await workflow.run(userInput);

      return {
        success: finalState.status === 'completed',
        output: {
          reservation: finalState.reservation,
          selectedPharmacy: finalState.selectedPharmacy,
          medicineName: finalState.medicineName,
          quantity: finalState.quantity,
        },
        stateUpdates: {
          medicineName: finalState.medicineName,
          quantity: finalState.quantity,
          pharmacies: finalState.pharmacies,
          availability: finalState.availability,
          selectedPharmacy: finalState.selectedPharmacy,
          reservation: finalState.reservation,
          workflowStage: finalState.workflowStage,
        },
        nextAction: { type: 'complete', summary: 'Medicine reservation completed' },
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
