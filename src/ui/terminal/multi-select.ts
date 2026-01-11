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

export class TerminalMultiSelect<T = unknown> {
  private cursor: number = 0;
  private selected: Set<number> = new Set();
  private scrollOffset: number = 0;
  private pageSize: number;
  private loop: boolean;
  private renderedLines: number = 0;
  private minSelect: number;
  private maxSelect: number;

  constructor(private config: SelectConfig<T>) {
    this.pageSize = config.pageSize || 7;
    this.loop = config.loop !== false;
    this.minSelect = config.minSelect || 0;
    this.maxSelect = config.maxSelect || config.options.length;
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
          resolve({ selected: [], indices: [], cancelled: true });
          return;
        }

        if (key.name === 'up' || key.name === 'k') {
          this.moveCursor(-1);
          this.render();
        } else if (key.name === 'down' || key.name === 'j') {
          this.moveCursor(1);
          this.render();
        } else if (key.name === 'space') {
          this.toggleSelection();
          this.render();
        } else if (key.name === 'a' && key.ctrl) {
          this.selectAll();
          this.render();
        } else if (key.name === 'return') {
          if (this.selected.size >= this.minSelect) {
            cleanup();
            this.clearDisplay();
            const indices = Array.from(this.selected).sort((a, b) => a - b);
            const selectedItems = indices.map((i) => this.config.options[i].value);
            this.showSelection(indices);
            resolve({
              selected: selectedItems,
              indices,
              cancelled: false,
            });
          }
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

  private toggleSelection(): void {
    const opt = this.config.options[this.cursor];
    if (opt.disabled) return;

    if (this.selected.has(this.cursor)) {
      this.selected.delete(this.cursor);
    } else if (this.selected.size < this.maxSelect) {
      this.selected.add(this.cursor);
    }
  }

  private selectAll(): void {
    if (this.selected.size === this.config.options.length) {
      this.selected.clear();
    } else {
      this.config.options.forEach((opt, i) => {
        if (!opt.disabled && this.selected.size < this.maxSelect) {
          this.selected.add(i);
        }
      });
    }
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
    process.stdout.write(`${ANSI.cyan}${ANSI.bold}${this.config.message}${ANSI.reset}\n`);
    lineCount++;

    // Hint
    process.stdout.write(`${ANSI.dim}(arrows to move, space to toggle, enter to confirm)${ANSI.reset}\n`);
    lineCount++;

    const visibleOptions = this.config.options.slice(
      this.scrollOffset,
      this.scrollOffset + this.pageSize
    );

    visibleOptions.forEach((opt, i) => {
      const actualIndex = this.scrollOffset + i;
      const isCurrent = actualIndex === this.cursor;
      const isSelected = this.selected.has(actualIndex);

      const cursor = isCurrent ? `${ANSI.cyan}>${ANSI.reset}` : ' ';
      const checkbox = isSelected
        ? `${ANSI.green}[x]${ANSI.reset}`
        : `${ANSI.dim}[ ]${ANSI.reset}`;

      const label = opt.disabled
        ? `${ANSI.dim}${opt.label} (unavailable)${ANSI.reset}`
        : isCurrent
          ? `${ANSI.bold}${opt.label}${ANSI.reset}`
          : opt.label;

      process.stdout.write(`${cursor} ${checkbox} ${label}\n`);
      lineCount++;

      if (opt.description) {
        const desc = truncate(opt.description, 50);
        process.stdout.write(`       ${ANSI.dim}${desc}${ANSI.reset}\n`);
        lineCount++;
      }
    });

    // Selected count
    const selectedCount = this.selected.size;
    const maxInfo = this.maxSelect < this.config.options.length ? `/${this.maxSelect}` : '';
    const minWarning = selectedCount < this.minSelect
      ? ` ${ANSI.yellow}(min ${this.minSelect})${ANSI.reset}`
      : '';

    process.stdout.write(`${ANSI.dim}Selected: ${selectedCount}${maxInfo}${minWarning}${ANSI.reset}\n`);
    lineCount++;

    // Page indicator
    if (this.config.options.length > this.pageSize) {
      const current = this.cursor + 1;
      const total = this.config.options.length;
      process.stdout.write(`${ANSI.dim}(${current}/${total})${ANSI.reset}\n`);
      lineCount++;
    }

    this.renderedLines = lineCount;
  }

  private showSelection(indices: number[]): void {
    const names = indices
      .slice(0, 3)
      .map((i) => this.config.options[i].label)
      .join(', ');
    const more = indices.length > 3 ? ` +${indices.length - 3} more` : '';
    process.stdout.write(`${ANSI.green}>${ANSI.reset} Selected ${indices.length}: ${ANSI.cyan}${names}${more}${ANSI.reset}\n`);
  }

  private async fallbackPrompt(): Promise<SelectResult<T>> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      process.stdout.write(`\n${ANSI.cyan}${this.config.message}${ANSI.reset}\n`);
      process.stdout.write(`${ANSI.dim}(Select multiple, comma-separated)${ANSI.reset}\n`);
      this.config.options.forEach((opt, i) => {
        const disabled = opt.disabled ? ` ${ANSI.dim}(unavailable)${ANSI.reset}` : '';
        process.stdout.write(`  ${ANSI.dim}${i + 1}.${ANSI.reset} ${opt.label}${disabled}\n`);
      });

      rl.question(`\n${ANSI.dim}Enter numbers (e.g., 1,3,5):${ANSI.reset} `, (answer) => {
        rl.close();
        const indices = answer
          .split(',')
          .map((s) => parseInt(s.trim()) - 1)
          .filter((i) => i >= 0 && i < this.config.options.length);

        const selectedItems = indices.map((i) => this.config.options[i].value);
        resolve({
          selected: selectedItems,
          indices,
          cancelled: false,
        });
      });
    });
  }
}
