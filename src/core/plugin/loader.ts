import { TaskPlugin, SharedAgentDefinition } from './types.js';
import { TaskRegistry } from '../registry.js';
import { ToolRegistry } from '../tools/registry.js';
import { WorkflowExecutor, WorkflowExecutorConfig } from '../workflow/index.js';
import { IAgent } from '../agent/types.js';

export class PluginLoader {
  private plugins: Map<string, TaskPlugin> = new Map();
  private sharedAgents: Map<string, SharedAgentDefinition> = new Map();

  constructor(
    private taskRegistry: TaskRegistry,
    private toolRegistry: ToolRegistry
  ) {}

  async load(plugin: TaskPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin already loaded: ${plugin.id}`);
    }

    if (plugin.onLoad) {
      await plugin.onLoad();
    }

    plugin.tools.forEach((tool) => {
      if (!this.toolRegistry.has(tool.name)) {
        this.toolRegistry.register(tool);
      }
    });

    this.taskRegistry.register({
      type: plugin.id,
      name: plugin.name,
      description: plugin.description,
      patterns: plugin.patterns,
      intentExamples: plugin.intentExamples,
      createInitialState: plugin.createInitialState,
      workflow: {
        stages: plugin.workflow.stages.map((s) => ({
          id: s.id,
          name: s.name,
          agent: s.agent,
          next: s.next as string | ((state: Record<string, unknown>) => string | null) | null,
        })),
        initialStage: plugin.workflow.initialStage,
      },
    });

    this.plugins.set(plugin.id, plugin);

    console.log(`Loaded plugin: ${plugin.name} v${plugin.version}`);
  }

  async discover(tasksDir: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    let entries;
    try {
      entries = await fs.readdir(tasksDir, { withFileTypes: true });
    } catch {
      console.warn(`Tasks directory not found: ${tasksDir}`);
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(tasksDir, entry.name, 'plugin.js');

        try {
          await fs.access(pluginPath);
          const module = await import(pluginPath);

          if (module.default && this.isTaskPlugin(module.default)) {
            await this.load(module.default);
          } else if (module.plugin && this.isTaskPlugin(module.plugin)) {
            await this.load(module.plugin);
          }
        } catch {
          // Plugin file doesn't exist or failed to load - skip silently
        }
      }
    }
  }

  registerSharedAgent(definition: SharedAgentDefinition): void {
    this.sharedAgents.set(definition.id, definition);
  }

  getAgentsForWorkflow(plugin: TaskPlugin): IAgent[] {
    const agents: IAgent[] = [...plugin.agents];

    for (const stage of plugin.workflow.stages) {
      const shared = this.sharedAgents.get(stage.agent);
      if (shared && !agents.find((a) => a.id === shared.id)) {
        agents.push(shared.agent);
      }
    }

    return agents;
  }

  createExecutor(
    pluginId: string,
    config: WorkflowExecutorConfig
  ): WorkflowExecutor {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const executor = new WorkflowExecutor(config);
    const agents = this.getAgentsForWorkflow(plugin);
    executor.registerAgents(agents);

    return executor;
  }

  getPlugin(id: string): TaskPlugin | undefined {
    return this.plugins.get(id);
  }

  listPlugins(): TaskPlugin[] {
    return Array.from(this.plugins.values());
  }

  hasPlugin(id: string): boolean {
    return this.plugins.has(id);
  }

  async unload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    this.plugins.delete(pluginId);
  }

  getSharedAgent(id: string): SharedAgentDefinition | undefined {
    return this.sharedAgents.get(id);
  }

  listSharedAgents(): SharedAgentDefinition[] {
    return Array.from(this.sharedAgents.values());
  }

  private isTaskPlugin(obj: unknown): obj is TaskPlugin {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'id' in obj &&
      'workflow' in obj &&
      'agents' in obj
    );
  }
}
