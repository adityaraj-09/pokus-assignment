export const ANSI = {
  clearLine: '\x1b[2K',
  cursorUp: (n: number) => `\x1b[${n}A`,
  cursorDown: (n: number) => `\x1b[${n}B`,
  cursorLeft: '\x1b[G',
  cursorHide: '\x1b[?25l',
  cursorShow: '\x1b[?25h',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

export function clearLines(count: number): void {
  for (let i = 0; i < count; i++) {
    process.stdout.write(ANSI.cursorUp(1) + ANSI.clearLine + ANSI.cursorLeft);
  }
}

export function writeLine(text: string): void {
  process.stdout.write(text + '\n');
}

export function write(text: string): void {
  process.stdout.write(text);
}

export function hideCursor(): void {
  process.stdout.write(ANSI.cursorHide);
}

export function showCursor(): void {
  process.stdout.write(ANSI.cursorShow);
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function padEnd(str: string, len: number): string {
  if (str.length >= len) return str;
  return str + ' '.repeat(len - str.length);
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}
