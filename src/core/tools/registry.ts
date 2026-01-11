import { ITool, ToolCategory } from './types.js';
import { ToolExecutor } from './executor.js';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ITool> = new Map();
  private byCategory: Map<ToolCategory, Set<string>> = new Map();

  private constructor() {
    const categories: ToolCategory[] = [
      'search',
      'data',
      'communication',
      'user',
      'storage',
      'external',
    ];
    categories.forEach((c) => this.byCategory.set(c, new Set()));
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: ITool): void {
    this.tools.set(tool.name, tool);
    this.byCategory.get(tool.category)?.add(tool.name);
  }

  registerMany(tools: ITool[]): void {
    tools.forEach((t) => this.register(t));
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getByCategory(category: ToolCategory): ITool[] {
    const names = this.byCategory.get(category) || new Set();
    return Array.from(names)
      .map((n) => this.tools.get(n)!)
      .filter(Boolean);
  }

  createExecutor(toolNames?: string[]): ToolExecutor {
    const tools = toolNames
      ? (toolNames.map((n) => this.tools.get(n)).filter(Boolean) as ITool[])
      : Array.from(this.tools.values());
    return new ToolExecutor(tools);
  }

  listAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  clear(): void {
    this.tools.clear();
    for (const set of this.byCategory.values()) {
      set.clear();
    }
  }
}

export const toolRegistry = ToolRegistry.getInstance();
