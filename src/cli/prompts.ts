import inquirer from 'inquirer';
import chalk from 'chalk';

export async function askQuestion(
  question: string,
  options?: string[]
): Promise<string> {
  console.log('');

  if (options && options.length > 0) {
    const { answer } = await inquirer.prompt([
      {
        type: 'list',
        name: 'answer',
        message: chalk.cyan(question),
        choices: options,
      },
    ]);
    return answer;
  } else {
    const { answer } = await inquirer.prompt([
      {
        type: 'input',
        name: 'answer',
        message: chalk.cyan(question),
      },
    ]);
    return answer;
  }
}

export async function askInput(prompt: string): Promise<string> {
  console.log('');

  const { answer } = await inquirer.prompt([
    {
      type: 'input',
      name: 'answer',
      message: chalk.cyan(prompt),
    },
  ]);
  return answer;
}

export async function askConfirm(question: string): Promise<boolean> {
  console.log('');

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.cyan(question),
      default: true,
    },
  ]);
  return confirmed;
}

export function displayWelcome(): void {
  console.log('');
  console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                                                            ║'));
  console.log(chalk.bold.cyan('║   ') + chalk.bold.white('POKUS - Real-World Task Completion System') + chalk.bold.cyan('           ║'));
  console.log(chalk.bold.cyan('║   ') + chalk.dim('Powered by Multi-Agent AI Architecture') + chalk.bold.cyan('             ║'));
  console.log(chalk.bold.cyan('║                                                            ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.dim('Available tasks:'));
  console.log(chalk.yellow('  • Find Medicine') + chalk.dim(' - "Find paracetamol near me"'));
  console.log(chalk.yellow('  • Plan Travel') + chalk.dim('   - "Create an itinerary for Bali"'));
  console.log('');
  console.log(chalk.dim('Type your request or "exit" to quit.'));
  console.log('');
}

export function displayTaskHeader(taskType: string): void {
  console.log('');
  const headers: Record<string, string> = {
    medicine: '💊 MEDICINE FINDER',
    travel: '✈️  TRAVEL PLANNER',
  };
  const header = headers[taskType] || `📋 ${taskType.toUpperCase()}`;
  console.log(chalk.bold.magenta(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  console.log(chalk.bold.magenta(`  ${header}`));
  console.log(chalk.bold.magenta(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
}

export function displayCompletion(taskType: string): void {
  console.log('');
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.green('  ✓ TASK COMPLETED SUCCESSFULLY'));
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
}

export function displayError(message: string): void {
  console.log('');
  console.log(chalk.bold.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.red(`  ✗ ERROR: ${message}`));
  console.log(chalk.bold.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
}
