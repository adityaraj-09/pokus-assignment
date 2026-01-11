import { ITool, ToolContext, ToolExecution } from './types.js';

export class ToolExecutor {
  private tools: Map<string, ITool> = new Map();

  constructor(tools: ITool[] = []) {
    tools.forEach((t) => this.register(t));
  }

  register(tool: ITool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  async execute(
    toolName: string,
    params: unknown,
    context: ToolContext
  ): Promise<ToolExecution> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        tool: toolName,
        input: params,
        output: null,
        success: false,
        durationMs: 0,
        error: `Tool not found: ${toolName}`,
      };
    }

    const startTime = Date.now();

    try {
      const parseResult = tool.parametersSchema.safeParse(params);
      if (!parseResult.success) {
        return {
          tool: toolName,
          input: params,
          output: null,
          success: false,
          durationMs: Date.now() - startTime,
          error: `Invalid parameters: ${parseResult.error.message}`,
        };
      }

      if (tool.validate) {
        const validation = tool.validate(parseResult.data);
        if (!validation.valid) {
          return {
            tool: toolName,
            input: params,
            output: null,
            success: false,
            durationMs: Date.now() - startTime,
            error: validation.errors?.join(', '),
          };
        }
      }

      const result = await tool.execute(parseResult.data, context);

      return {
        tool: toolName,
        input: params,
        output: result.output,
        success: result.success,
        durationMs: Date.now() - startTime,
        error: result.error,
      };
    } catch (error) {
      return {
        tool: toolName,
        input: params,
        output: null,
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  listTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}
