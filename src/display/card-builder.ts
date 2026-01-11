import chalk from 'chalk';
import { ResultDisplaySchema, FormattedCard, FieldConfig } from './types.js';
import { formatValue } from './formatters.js';

export class CardBuilder<T> {
  constructor(private schema: ResultDisplaySchema<T>) {}

  build(item: T, index: number): FormattedCard {
    const title = String(item[this.schema.titleField as keyof T] ?? '');
    const subtitle = this.schema.descriptionField
      ? String(item[this.schema.descriptionField as keyof T] ?? '')
      : undefined;

    const sortedFields = [...this.schema.fields].sort(
      (a, b) => (a.priority ?? 99) - (b.priority ?? 99)
    );

    const fields = sortedFields
      .map((fieldConfig) => this.formatField(item, fieldConfig))
      .filter((f) => f !== null) as FormattedCard['fields'];

    const badges = sortedFields
      .filter((f) => f.type === 'badge')
      .map((f) => String(item[f.key as keyof T] ?? ''))
      .filter(Boolean);

    return { index, title, subtitle, fields, badges };
  }

  private formatField(
    item: T,
    config: FieldConfig
  ): FormattedCard['fields'][0] | null {
    const value = item[config.key as keyof T];

    if (config.hideIfEmpty && (value === null || value === undefined || value === '')) {
      return null;
    }

    const formatted = formatValue(config.type, value, config.format);
    if (!formatted && config.hideIfEmpty) {
      return null;
    }

    return {
      label: config.label,
      value: formatted || (config.type === 'price' ? 'Free' : 'N/A'),
      icon: config.icon,
      color: config.color,
    };
  }

  render(item: T, index: number): string {
    const card = this.build(item, index);
    return this.renderCard(card);
  }

  renderCard(card: FormattedCard): string {
    const lines: string[] = [];
    const width = 52;

    lines.push(chalk.dim('┌' + '─'.repeat(width) + '┐'));

    const indexStr = `${card.index + 1}. `;
    const titleLine = `${indexStr}${card.title}`;
    const badgeStr = card.badges.length > 0 ? ` ${chalk.cyan(card.badges[0])}` : '';
    const titleWithBadge = titleLine + badgeStr;
    lines.push(chalk.dim('│ ') + chalk.bold(this.padRight(titleWithBadge, width - 2)) + chalk.dim(' │'));

    if (card.subtitle) {
      lines.push(chalk.dim('│    ') + chalk.dim(this.padRight(card.subtitle, width - 5)) + chalk.dim('│'));
    }

    const displayFields = card.fields.filter((f) => f.label !== 'Type');
    if (displayFields.length > 0) {
      const fieldParts = displayFields
        .slice(0, 3)
        .map((f) => {
          const icon = f.icon || '';
          const colorFn = this.getColorFn(f.color);
          return `${icon} ${colorFn(f.value)}`;
        });

      const fieldLine = fieldParts.join('  ');
      lines.push(chalk.dim('│    ') + this.padRight(fieldLine, width - 5) + chalk.dim('│'));
    }

    lines.push(chalk.dim('└' + '─'.repeat(width) + '┘'));

    return lines.join('\n');
  }

  private padRight(str: string, len: number): string {
    const visibleLen = this.stripAnsi(str).length;
    if (visibleLen >= len) return str;
    return str + ' '.repeat(len - visibleLen);
  }

  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private getColorFn(color?: string): (s: string) => string {
    switch (color) {
      case 'green':
        return chalk.green;
      case 'yellow':
        return chalk.yellow;
      case 'cyan':
        return chalk.cyan;
      case 'red':
        return chalk.red;
      case 'dim':
        return chalk.dim;
      case 'bold':
        return chalk.bold;
      default:
        return (s: string) => s;
    }
  }
}

export function renderCards<T>(
  items: T[],
  schema: ResultDisplaySchema<T>,
  options: { title?: string; maxDisplay?: number } = {}
): string {
  const builder = new CardBuilder(schema);
  const maxDisplay = options.maxDisplay || items.length;
  const displayItems = items.slice(0, maxDisplay);

  const lines: string[] = [];

  if (options.title) {
    lines.push('');
    lines.push(chalk.bold(options.title));
    lines.push('');
  }

  displayItems.forEach((item, index) => {
    lines.push(builder.render(item, index));
  });

  if (items.length > maxDisplay) {
    lines.push(chalk.dim(`  ... and ${items.length - maxDisplay} more`));
  }

  return lines.join('\n');
}
