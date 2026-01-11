import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowStageDefinition,
  WorkflowResult,
  StageExecution,
  WorkflowExecutorConfig,
} from './types.js';
import {
  IAgent,
  AgentExecutionContext,
  AgentResult,
} from '../agent/types.js';
import { SessionState, stateManager } from '../state/manager.js';
import { StateSnapshot } from '../state/types.js';

export class WorkflowExecutor {
  private agents: Map<string, IAgent> = new Map();
  private eventBus: EventEmitter = new EventEmitter();

  constructor(private config: WorkflowExecutorConfig) {}

  registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  registerAgents(agents: IAgent[]): void {
    agents.forEach((a) => this.registerAgent(a));
  }

  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  async execute(
    workflow: WorkflowDefinition,
    initialInput?: Record<string, unknown>
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    const initialState: Partial<StateSnapshot> = {
      taskType: workflow.id,
      status: 'active',
      domain: {
        ...(workflow.createInitialState?.() || {}),
        ...initialInput,
      },
    };

    const session = stateManager.createSession(initialState);
    const executionLog: StageExecution[] = [];

    this.emit('workflow:start', { workflowId: workflow.id, sessionId: session.id });

    if (workflow.onStart) {
      await workflow.onStart(session.getState());
    }

    let currentStage: string | null = workflow.initialStage;

    try {
      while (currentStage) {
        const stageDef = workflow.stages.find((s) => s.id === currentStage);
        if (!stageDef) {
          throw new Error(`Stage not found: ${currentStage}`);
        }

        this.emit('stage:start', { stageId: currentStage, sessionId: session.id });
        this.config.log(`Stage: ${stageDef.name}`, 'info');

        session.update({ currentStage: stageDef.id });

        this.validatePreconditions(stageDef, session.getState());

        const stageResult = await this.executeStage(stageDef, session);
        executionLog.push(stageResult);

        this.emit('stage:complete', {
          stageId: currentStage,
          sessionId: session.id,
          result: stageResult,
        });

        currentStage = this.resolveNextStage(stageDef, stageResult, session.getState());
      }

      if (workflow.onComplete) {
        await workflow.onComplete(session.getState());
      }

      session.update({ status: 'completed' });

      this.emit('workflow:complete', {
        workflowId: workflow.id,
        sessionId: session.id,
        success: true,
      });

      return {
        success: true,
        finalState: session.getState(),
        executionLog,
        output: this.extractOutput(executionLog),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (workflow.onError) {
        await workflow.onError(error as Error, session.getState());
      }

      session.update({ status: 'error' });

      this.emit('workflow:error', {
        workflowId: workflow.id,
        sessionId: session.id,
        error: errorMessage,
      });

      return {
        success: false,
        finalState: session.getState(),
        executionLog,
        output: null,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async executeStage(
    stage: WorkflowStageDefinition,
    session: SessionState
  ): Promise<StageExecution> {
    const agent = this.agents.get(stage.agent);
    if (!agent) {
      throw new Error(`Agent not registered: ${stage.agent}`);
    }

    session.update({ currentAgent: agent.id });

    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = stage.retry?.maxAttempts || 1;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      attempts++;

      const context: AgentExecutionContext = {
        sessionId: session.id,
        task: {
          id: `${session.id}-${stage.id}-${attempts}`,
          type: stage.id,
          input: stage.input?.(session.getState()) ?? {},
        },
        state: session.getState(),
        emit: (event) => this.emit('agent:event', event),
        requestInput: this.config.requestInput,
      };

      try {
        const result = await this.executeWithTimeout(
          () => agent.execute(context),
          stage.timeout || 60000
        );

        if (Object.keys(result.stateUpdates).length > 0) {
          session.updateDomain(result.stateUpdates, agent.id);
        }

        if (result.nextAction.type === 'wait_for_input') {
          const inputResult = await this.config.requestInput(
            result.nextAction.prompt,
            result.nextAction.options
          );

          const input = typeof inputResult === 'string'
            ? inputResult
            : inputResult.cancelled
              ? null
              : inputResult.selected;

          context.task.input = { ...context.task.input, userInput: input };
          const retryResult = await agent.execute(context);

          if (Object.keys(retryResult.stateUpdates).length > 0) {
            session.updateDomain(retryResult.stateUpdates, agent.id);
          }

          return {
            stageId: stage.id,
            agentId: agent.id,
            result: retryResult,
            attempts,
            durationMs: Date.now() - startTime,
          };
        }

        return {
          stageId: stage.id,
          agentId: agent.id,
          result,
          attempts,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;

        if (attempts < maxAttempts && stage.retry) {
          const delay =
            stage.retry.delayMs *
            Math.pow(stage.retry.backoffMultiplier || 1, attempts - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error(`Stage ${stage.id} failed after ${attempts} attempts`);
  }

  private validatePreconditions(
    stage: WorkflowStageDefinition,
    state: StateSnapshot
  ): void {
    if (!stage.preconditions) return;

    for (const condition of stage.preconditions) {
      const value = this.getNestedValue(state, condition.field);
      let valid = false;

      switch (condition.condition) {
        case 'exists':
          valid = value !== undefined;
          break;
        case 'not_empty':
          valid = value !== undefined && value !== null && value !== '';
          break;
        case 'equals':
          valid = value === condition.value;
          break;
        case 'custom':
          valid = condition.customCheck?.(state) ?? false;
          break;
      }

      if (!valid) {
        throw new Error(`Precondition failed: ${condition.errorMessage}`);
      }
    }
  }

  private resolveNextStage(
    stage: WorkflowStageDefinition,
    execution: StageExecution,
    state: StateSnapshot
  ): string | null {
    if (execution.result.nextAction.type === 'error') {
      if (!execution.result.nextAction.recoverable) {
        throw new Error(execution.result.nextAction.message);
      }
    }

    if (execution.result.nextAction.type === 'complete') {
      return null;
    }

    if (execution.result.nextAction.type === 'handoff') {
      return execution.result.nextAction.targetAgent;
    }

    if (
      execution.result.nextAction.type === 'continue' &&
      execution.result.nextAction.nextStage
    ) {
      return execution.result.nextAction.nextStage;
    }

    if (typeof stage.next === 'function') {
      return stage.next(state);
    }

    return stage.next;
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Stage timeout')), timeoutMs)
      ),
    ]);
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce(
      (current: unknown, key: string) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      obj
    );
  }

  private extractOutput(log: StageExecution[]): unknown {
    const lastSuccessful = [...log].reverse().find((e) => e.result.success);
    return lastSuccessful?.result.output;
  }

  private emit(event: string, data: unknown): void {
    this.eventBus.emit(event, data);
  }

  on(event: string, handler: (...args: unknown[]) => void): () => void {
    this.eventBus.on(event, handler);
    return () => this.eventBus.off(event, handler);
  }
}
