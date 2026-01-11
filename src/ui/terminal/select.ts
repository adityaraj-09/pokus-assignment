import * as readline from 'readline';
import { SelectConfig, SelectResult, SelectableOption } from '../types.js';
import { ANSI, truncate, hideCursor, showCursor } from './renderer.js';

// Track if keypress events have been set up
let keypressInitialized = false;

function ensureKeypressEvents(): void {
  if (!keypressInitialized && process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    keypressInitialized = true;
  }
}

export class TerminalSelect<T = unknown> {
  private cursor: number = 0;
  private scrollOffset: number = 0;
  private pageSize: number;
  private loop: boolean;
  private renderedLines: number = 0;

  constructor(private config: SelectConfig<T>) {
    this.pageSize = config.pageSize || 7;
    this.loop = config.loop !== false;
  }

  async prompt(): Promise<SelectResult<T>> {
    if (!process.stdin.isTTY) {
      return this.fallbackPrompt();
    }

    return new Promise((resolve) => {
      ensureKeypressEvents();

      // Store original raw mode state
      const wasRaw = process.stdin.isRaw || false;

      // Enter raw mode
      process.stdin.setRawMode(true);
      process.stdin.resume();

      hideCursor();
      this.render();

      const cleanup = () => {
        process.stdin.removeListener('keypress', onKeypress);
        process.stdin.setRawMode(wasRaw);
        showCursor();
      };

      const onKeypress = (_str: string | undefined, key: readline.Key | undefined) => {
        if (!key) return;

        if (key.ctrl && key.name === 'c') {
          cleanup();
          this.clearDisplay();
          process.exit(0);
        }

        if (key.name === 'escape') {
          cleanup();
          this.clearDisplay();
          resolve({ selected: null as T, indices: [], cancelled: true });
          return;
        }

        if (key.name === 'up' || key.name === 'k') {
          this.moveCursor(-1);
          this.render();
        } else if (key.name === 'down' || key.name === 'j') {
          this.moveCursor(1);
          this.render();
        } else if (key.name === 'return') {
          cleanup();
          this.clearDisplay();
          const selected = this.config.options[this.cursor];
          this.showSelection(selected);
          resolve({
            selected: selected.value,
            indices: [this.cursor],
            cancelled: false,
          });
        }
      };

      process.stdin.on('keypress', onKeypress);
    });
  }

  private moveCursor(direction: number): void {
    const len = this.config.options.length;
    let next = this.cursor + direction;

    if (this.loop) {
      if (next < 0) next = len - 1;
      if (next >= len) next = 0;
    } else {
      next = Math.max(0, Math.min(len - 1, next));
    }

    while (this.config.options[next]?.disabled && next !== this.cursor) {
      next += direction;
      if (this.loop) {
        if (next < 0) next = len - 1;
        if (next >= len) next = 0;
      } else {
        next = Math.max(0, Math.min(len - 1, next));
      }
    }

    this.cursor = next;
    this.adjustScroll();
  }

  private adjustScroll(): void {
    if (this.cursor < this.scrollOffset) {
      this.scrollOffset = this.cursor;
    } else if (this.cursor >= this.scrollOffset + this.pageSize) {
      this.scrollOffset = this.cursor - this.pageSize + 1;
    }
  }

  private clearDisplay(): void {
    if (this.renderedLines > 0) {
      // Move cursor to start of rendered content and clear
      process.stdout.write(`\x1b[${this.renderedLines}A\x1b[0J`);
    }
  }

  private render(): void {
    this.clearDisplay();

    let lineCount = 0;

    // Header
    process.stdout.write(`${ANSI.cyan}${ANSI.bold}${this.config.message}${ANSI.reset} ${ANSI.dim}(use arrows, enter to select)${ANSI.reset}\n`);
    lineCount++;

    const visibleOptions = this.config.options.slice(
      this.scrollOffset,
      this.scrollOffset + this.pageSize
    );

    visibleOptions.forEach((opt, i) => {
      const actualIndex = this.scrollOffset + i;
      const isCurrent = actualIndex === this.cursor;
      const prefix = isCurrent ? `${ANSI.cyan}>${ANSI.reset} ` : '  ';

      const label = opt.disabled
        ? `${ANSI.dim}${opt.label} (unavailable)${ANSI.reset}`
        : isCurrent
          ? `${ANSI.bold}${opt.label}${ANSI.reset}`
          : opt.label;

      process.stdout.write(`${prefix}${label}\n`);
      lineCount++;

      if (opt.description) {
        const desc = truncate(opt.description, 50);
        process.stdout.write(`     ${ANSI.dim}${desc}${ANSI.reset}\n`);
        lineCount++;
      }
    });

    // Page indicator
    if (this.config.options.length > this.pageSize) {
      const current = this.cursor + 1;
      const total = this.config.options.length;
      process.stdout.write(`${ANSI.dim}  (${current}/${total})${ANSI.reset}\n`);
      lineCount++;
    }

    this.renderedLines = lineCount;
  }

  private showSelection(opt: SelectableOption<T>): void {
    process.stdout.write(`${ANSI.green}>${ANSI.reset} ${this.config.message}: ${ANSI.cyan}${opt.label}${ANSI.reset}\n`);
  }

  private async fallbackPrompt(): Promise<SelectResult<T>> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      process.stdout.write(`\n${ANSI.cyan}${this.config.message}${ANSI.reset}\n`);
      this.config.options.forEach((opt, i) => {
        const disabled = opt.disabled ? ` ${ANSI.dim}(unavailable)${ANSI.reset}` : '';
        process.stdout.write(`  ${ANSI.dim}${i + 1}.${ANSI.reset} ${opt.label}${disabled}\n`);
      });

      rl.question(`\n${ANSI.dim}Enter number (1-${this.config.options.length}):${ANSI.reset} `, (answer) => {
        rl.close();
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < this.config.options.length) {
          resolve({
            selected: this.config.options[index].value,
            indices: [index],
            cancelled: false,
          });
        } else {
          resolve({
            selected: this.config.options[0].value,
            indices: [0],
            cancelled: false,
          });
        }
      });
    });
  }
}
