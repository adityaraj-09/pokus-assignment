import * as readline from 'readline';
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

registry.register(medicineTask);
registry.register(travelTask);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.cyan(question + ' '), (answer) => {
      resolve(answer);
    });
  });
}

async function selectOption(question: string, options?: string[]): Promise<string> {
  if (options && options.length > 0) {
    console.log(chalk.cyan('\n' + question));
    options.forEach((opt, i) => {
      console.log(chalk.dim(`  ${i + 1}. ${opt}`));
    });

    const answer = await prompt('Enter number (1-' + options.length + '):');
    const index = parseInt(answer) - 1;

    if (index >= 0 && index < options.length) {
      return options[index];
    }
    return options[0];
  } else {
    return await prompt(question);
  }
}

async function main() {
  console.log('');
  console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   POKUS - Real-World Task Completion System                ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log('');

  const searchStatus = getSearchStatus();
  const aiStatus = getGeminiStatus();

  if (aiStatus.enabled) {
    console.log(chalk.green(`✓ Gemini AI enabled (${aiStatus.model})`));
  } else {
    console.log(chalk.yellow('⚠ Using rule-based logic (no GEMINI_API_KEY)'));
  }

  if (searchStatus.exaEnabled) {
    console.log(chalk.green('✓ Exa API enabled\n'));
  } else {
    console.log(chalk.yellow('⚠ Using simulated data (no EXA_API_KEY)\n'));
  }

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
    console.log(chalk.dim(`[Detected: ${classification.taskType} - ${(classification.confidence * 100).toFixed(0)}% confidence${aiLabel}]`));

    if (classification.confidence < 0.2) {
      console.log(chalk.yellow('\nNot sure what you mean. Try:'));
      console.log(chalk.dim('  • "Find paracetamol near me"'));
      console.log(chalk.dim('  • "Create an itinerary for Bali"'));
      continue;
    }

    const workflowContext = {
      askUser: selectOption,
      showProgress: (message: string) => ora(message).start(),
      log: (message: string) => console.log(message),
    };

    try {
      if (classification.taskType === 'medicine') {
        console.log(chalk.bold.magenta('\n━━━ MEDICINE FINDER ━━━'));
        const workflow = new MedicineWorkflow(workflowContext);
        await workflow.run(userInput);
        console.log(chalk.bold.green('\n✓ Task completed!'));
      } else if (classification.taskType === 'travel') {
        console.log(chalk.bold.magenta('\n━━━ TRAVEL PLANNER ━━━'));
        const workflow = new TravelWorkflow(workflowContext);
        await workflow.run(userInput);
        console.log(chalk.bold.green('\n✓ Task completed!'));
      }
    } catch (error) {
      console.log(chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error')));
    }
  }

  rl.close();
}

main();
