#!/usr/bin/env node

import { Command } from 'commander';
import { runCLI, runDemo } from './cli/index.js';

const program = new Command();

program
  .name('pokus')
  .description('Multi-agent system for real-world task completion')
  .version('1.0.0');

program
  .command('start')
  .description('Start the interactive CLI')
  .action(async () => {
    await runCLI();
  });

program
  .command('demo')
  .description('Run demo mode with simulated scenarios')
  .action(async () => {
    await runDemo();
  });

program.action(async () => {
  await runCLI();
});

program.parse();
