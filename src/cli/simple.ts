import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import '../config.js';
import { registry } from '../core/registry.js';
import { PluginLoader } from '../core/plugin/loader.js';
import { toolRegistry } from '../core/tools/registry.js';
import { getSearchStatus } from '../services/search.js';
import { getGeminiStatus } from '../services/gemini.js';
import { SelectionAgent, ConfirmationAgent, ReviewAgent } from '../agents/shared/index.js';
import { SelectConfig, SelectResult } from '../ui/types.js';
import { TerminalSelect, TerminalMultiSelect } from '../ui/terminal/index.js';

import { medicinePlugin } from '../tasks/medicine/plugin.js';
import { travelPlugin } from '../tasks/travel/plugin.js';

let rl: readline.Interface | null = null;

function getReadline(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

function pauseReadline(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    getReadline().question(chalk.cyan(question + ' '), (answer) => {
      resolve(answer);
    });
  });
}

async function enhancedInput<T = string>(
  promptOrConfig: string | SelectConfig<T>,
  options?: string[]
): Promise<string | SelectResult<T>> {
  if (typeof promptOrConfig === 'string') {
    if (options && options.length > 0) {
      // Pause readline to allow raw mode for arrow keys
      pauseReadline();

      const config: SelectConfig<string> = {
        message: promptOrConfig,
        options: options.map((opt) => ({ label: opt, value: opt })),
        mode: 'single',
      };
      const selector = new TerminalSelect(config);
      const result = await selector.prompt();
      if (result.cancelled) {
        return options[0];
      }
      return result.selected as string;
    }
    return prompt(promptOrConfig);
  }

  // Pause readline to allow raw mode for arrow keys
  pauseReadline();

  const config = promptOrConfig as SelectConfig<T>;

  if (config.mode === 'multi') {
    const selector = new TerminalMultiSelect(config);
    return selector.prompt();
  }

  const selector = new TerminalSelect(config);
  return selector.prompt();
}

async function main() {
  console.log('');
  console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   POKUS - Multi-Agent Task Completion System               ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log('');

  const pluginLoader = new PluginLoader(registry, toolRegistry);

  pluginLoader.registerSharedAgent({
    id: 'shared:selection',
    agent: new SelectionAgent(),
    description: 'Generic selection agent',
    usedBy: [],
  });

  pluginLoader.registerSharedAgent({
    id: 'shared:confirmation',
    agent: new ConfirmationAgent(),
    description: 'Generic confirmation agent',
    usedBy: [],
  });

  pluginLoader.registerSharedAgent({
    id: 'shared:review',
    agent: new ReviewAgent(),
    description: 'Generic review agent',
    usedBy: [],
  });

  await pluginLoader.load(medicinePlugin);
  await pluginLoader.load(travelPlugin);

  const searchStatus = getSearchStatus();
  const aiStatus = getGeminiStatus();

  console.log(chalk.bold('System Status:'));
  if (aiStatus.enabled) {
    console.log(chalk.green(`  ✓ Gemini AI enabled (${aiStatus.model})`));
  } else {
    console.log(chalk.yellow('  ⚠ Using rule-based logic (no GEMINI_API_KEY)'));
  }

  if (searchStatus.exaEnabled) {
    console.log(chalk.green('  ✓ Exa API enabled'));
  } else {
    console.log(chalk.yellow('  ⚠ Using simulated data (no EXA_API_KEY)'));
  }

  console.log(chalk.bold('\nLoaded Plugins:'));
  pluginLoader.listPlugins().forEach((plugin) => {
    console.log(chalk.cyan(`  • ${plugin.name} v${plugin.version}`));
  });

  console.log('');
  console.log(chalk.dim('Try: "Find paracetamol near me" or "Create an itinerary for Bali"'));
  console.log(chalk.dim('Type "exit" to quit.\n'));

  while (true) {
    const userInput = await prompt('\nWhat would you like to do?');

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log(chalk.dim('\nGoodbye!\n'));
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    const classification = await registry.classifyWithAI(userInput);
    const aiLabel = aiStatus.enabled ? chalk.cyan(' (via Gemini)') : '';
    console.log(
      chalk.dim(
        `[Detected: ${classification.taskType} - ${(classification.confidence * 100).toFixed(0)}% confidence${aiLabel}]`
      )
    );

    if (classification.confidence < 0.2) {
      console.log(chalk.yellow('\nNot sure what you mean. Try:'));
      pluginLoader.listPlugins().forEach((plugin) => {
        console.log(chalk.dim(`  • "${plugin.intentExamples[0]}"`));
      });
      continue;
    }

    const plugin = pluginLoader.getPlugin(classification.taskType);
    if (!plugin) {
      console.log(chalk.yellow(`\nTask type "${classification.taskType}" not available.`));
      continue;
    }

    console.log(chalk.bold.magenta(`\n━━━ ${plugin.name.toUpperCase()} ━━━`));

    try {
      const executor = pluginLoader.createExecutor(plugin.id, {
        requestInput: enhancedInput,
        log: (message: string, level?: string) => {
          if (level === 'error') {
            console.log(chalk.red(message));
          } else {
            console.log(message);
          }
        },
        showProgress: (message: string) => ora(message).start(),
      });

      const result = await executor.execute(plugin.workflow, {
        userInput,
      });

      if (result.success) {
        console.log(chalk.bold.green('\n✓ Task completed!'));
      } else {
        console.log(chalk.red(`\nTask failed: ${result.error}`));
      }
    } catch (error) {
      console.log(
        chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error'))
      );
    }
  }

  pauseReadline();
}

main();
