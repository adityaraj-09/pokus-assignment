import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  IAgent,
  AgentCapability,
  AgentExecutionContext,
  AgentResult,
  AgentTask,
  AgentConfig,
  ToolExecution,
} from './types.js';
import { ITool, ToolCall, ToolContext } from '../tools/types.js';
import { ToolExecutor } from '../tools/executor.js';
import { config } from '../../config.js';

export abstract class BaseAgentImpl implements IAgent {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: AgentCapability[];

  protected model: GenerativeModel | null = null;
  protected toolExecutor: ToolExecutor;
  protected systemPrompt: string = '';
  protected tools: ITool[] = [];

  constructor(tools: ITool[] = [], agentConfig: AgentConfig = {}) {
    this.tools = tools;
    this.toolExecutor = new ToolExecutor(tools);
    this.initializeModel(agentConfig);
  }

  private initializeModel(agentConfig: AgentConfig): void {
    const apiKey = agentConfig.geminiApiKey || config.gemini.apiKey;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({
        model: agentConfig.model || config.gemini.model || 'gemini-1.5-flash',
      });
    }
  }

  abstract execute(context: AgentExecutionContext): Promise<AgentResult>;

  abstract canHandle(task: AgentTask): boolean;

  protected async executeToolCalls(
    toolCalls: ToolCall[],
    context: AgentExecutionContext
  ): Promise<ToolExecution[]> {
    const executions: ToolExecution[] = [];

    for (const call of toolCalls) {
      context.emit({
        type: 'tool_called',
        agentId: this.id,
        tool: call.name,
        input: call.arguments,
      });

      const toolContext: ToolContext = {
        sessionId: context.sessionId,
        state: context.state,
      };

      const result = await this.toolExecutor.execute(
        call.name,
        call.arguments,
        toolContext
      );

      context.emit({
        type: 'tool_result',
        agentId: this.id,
        tool: call.name,
        output: result.output,
      });

      executions.push(result);
    }

    return executions;
  }

  protected async generateWithTools(
    prompt: string,
    context: AgentExecutionContext
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    if (!this.model) {
      return { content: '', toolCalls: [] };
    }

    const toolDescriptions = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: JSON.stringify(t.parametersSchema),
    }));

    const systemWithTools =
      this.systemPrompt +
      (toolDescriptions.length > 0
        ? `\n\nAvailable tools:\n${JSON.stringify(toolDescriptions, null, 2)}\n\nWhen you need to use a tool, respond with:\n<tool_call name="tool_name">{"param": "value"}</tool_call>\n\nAfter using tools, provide your final response.`
        : '');

    const result = await this.model.generateContent(
      systemWithTools + '\n\n' + prompt
    );

    const response = result.response.text();
    const toolCalls = this.parseToolCalls(response);
    const content = response
      .replace(/<tool_call[^>]*>[\s\S]*?<\/tool_call>/g, '')
      .trim();

    return { content, toolCalls };
  }

  protected parseToolCalls(response: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const regex = /<tool_call name="([^"]+)">([\s\S]*?)<\/tool_call>/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
      try {
        calls.push({
          name: match[1],
          arguments: JSON.parse(match[2]),
        });
      } catch {
        console.warn(`Failed to parse tool call: ${match[0]}`);
      }
    }

    return calls;
  }

  protected createSuccessResult(
    output: unknown,
    stateUpdates: Record<string, unknown> = {},
    startTime: number
  ): AgentResult {
    return {
      success: true,
      output,
      stateUpdates,
      nextAction: { type: 'continue' },
      toolsUsed: [],
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }

  protected createErrorResult(
    message: string,
    recoverable: boolean,
    startTime: number
  ): AgentResult {
    return {
      success: false,
      output: null,
      stateUpdates: {},
      nextAction: { type: 'error', message, recoverable },
      toolsUsed: [],
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }

  protected createWaitForInputResult(
    prompt: string,
    options: string[] | undefined,
    startTime: number
  ): AgentResult {
    return {
      success: true,
      output: null,
      stateUpdates: {},
      nextAction: { type: 'wait_for_input', prompt, options },
      toolsUsed: [],
      metadata: { executionTimeMs: Date.now() - startTime },
    };
  }
}
