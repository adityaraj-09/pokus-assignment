import chalk from 'chalk';
import ora from 'ora';
import '../config.js';
import { registry } from '../core/registry.js';
import { medicineTask } from '../tasks/medicine/index.js';
import { travelTask } from '../tasks/travel/index.js';
import { MedicineWorkflow } from '../tasks/medicine/workflow.js';
import { TravelWorkflow } from '../tasks/travel/workflow.js';
import { getSearchStatus } from '../services/search.js';
import { getGeminiStatus } from '../services/gemini.js';
import {
  askQuestion,
  askInput,
  displayWelcome,
  displayTaskHeader,
  displayCompletion,
  displayError,
} from './prompts.js';

registry.register(medicineTask);
registry.register(travelTask);

export async function runCLI(): Promise<void> {
  displayWelcome();

  const aiStatus = getGeminiStatus();
  const searchStatus = getSearchStatus();

  if (aiStatus.enabled) {
    console.log(chalk.green(`✓ Gemini AI enabled (${aiStatus.model})`));
  } else {
    console.log(chalk.yellow('⚠ Gemini AI not configured - using rule-based logic'));
    console.log(chalk.dim('  Set GEMINI_API_KEY in .env to enable AI'));
  }

  if (searchStatus.exaEnabled) {
    console.log(chalk.green('✓ Exa API enabled - using real web search\n'));
  } else {
    console.log(chalk.yellow('⚠ Exa API not configured - using simulated data'));
    console.log(chalk.dim('  Set EXA_API_KEY in .env to enable real search\n'));
  }

  let running = true;

  while (running) {
    try {
      const userInput = await askInput('What would you like to do?');

      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        console.log(chalk.dim('\nGoodbye! 👋\n'));
        running = false;
        continue;
      }

      if (!userInput.trim()) {
        continue;
      }

      const classification = await registry.classifyWithAI(userInput);
      const aiLabel = aiStatus.enabled ? chalk.cyan(' via Gemini') : '';

      console.log(chalk.dim(`\n[Detected: ${classification.taskType} (${(classification.confidence * 100).toFixed(0)}% confidence${aiLabel})]`));

      if (classification.confidence < 0.2) {
        console.log(
          chalk.yellow(
            "\nI'm not sure what you're looking for. Try asking about:"
          )
        );
        console.log(chalk.dim('  • Finding medicine: "Find paracetamol near me"'));
        console.log(chalk.dim('  • Planning travel: "Create an itinerary for Bali"'));
        continue;
      }

      displayTaskHeader(classification.taskType);

      const workflowContext = {
        askUser: askQuestion,
        showProgress: (message: string) => {
          const spinner = ora({ text: message, stream: process.stdout }).start();
          return spinner;
        },
        log: (message: string) => console.log(message),
      };

      if (classification.taskType === 'medicine') {
        const workflow = new MedicineWorkflow(workflowContext);
        await workflow.run(userInput);
        displayCompletion('medicine');
      } else if (classification.taskType === 'travel') {
        const workflow = new TravelWorkflow(workflowContext);
        await workflow.run(userInput);
        displayCompletion('travel');
      } else {
        console.log(
          chalk.yellow(
            `\nTask type "${classification.taskType}" is not yet implemented.`
          )
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        displayError(error.message);
      } else {
        displayError('An unexpected error occurred');
      }
    }
  }
}

export async function runDemo(): Promise<void> {
  console.log(chalk.bold.cyan('\n🎭 DEMO MODE - Simulated Task Execution\n'));
  console.log(chalk.dim('This demo shows the system capabilities with simulated inputs.\n'));

  const demoScenarios = [
    {
      name: 'Medicine Finder',
      input: 'Find paracetamol near me',
    },
    {
      name: 'Travel Planner',
      input: 'Create an itinerary for Bali',
    },
  ];

  for (const scenario of demoScenarios) {
    console.log(chalk.bold.yellow(`\n━━━ Demo: ${scenario.name} ━━━`));
    console.log(chalk.dim(`Input: "${scenario.input}"\n`));

    const classification = await registry.classifyWithAI(scenario.input);
    const aiStatus = getGeminiStatus();
    const aiLabel = aiStatus.enabled ? ' (via Gemini)' : '';
    console.log(chalk.green(`✓ Classified as: ${classification.taskType}${aiLabel}`));
    console.log(chalk.green(`✓ Confidence: ${(classification.confidence * 100).toFixed(0)}%`));
    console.log(chalk.dim('\nRun in interactive mode to see the full workflow.\n'));
  }
}
