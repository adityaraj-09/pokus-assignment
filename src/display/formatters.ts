import { FieldType } from './types.js';

export type FormatterFn = (value: unknown, format?: string) => string;

const formatters: Record<FieldType, FormatterFn> = {
  text: (value, format) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (format) {
      return format.replace('{value}', str);
    }
    return str;
  },

  price: (value, format) => {
    if (value === null || value === undefined) return '';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);
    const formatted = `$${num.toFixed(num % 1 === 0 ? 0 : 2)}`;
    if (format) {
      return format.replace('{value}', formatted).replace('${value}', formatted);
    }
    return formatted;
  },

  rating: (value, format) => {
    if (value === null || value === undefined) return '';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);
    const formatted = num.toFixed(1);
    if (format) {
      return format.replace('{value}', formatted);
    }
    return `${formatted}/5`;
  },

  badge: (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
  },

  list: (value, format) => {
    if (!Array.isArray(value)) return '';
    const maxItems = format ? parseInt(format) || 3 : 3;
    const items = value.slice(0, maxItems);
    const more = value.length > maxItems ? ` +${value.length - maxItems}` : '';
    return items.join(', ') + more;
  },

  distance: (value, format) => {
    if (value === null || value === undefined) return '';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);
    const unit = format || 'km';
    return `${num.toFixed(1)} ${unit}`;
  },

  duration: (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
  },
};

export function formatValue(type: FieldType, value: unknown, format?: string): string {
  const formatter = formatters[type];
  if (!formatter) return String(value ?? '');
  return formatter(value, format);
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    temple: '🛕',
    beach: '🏖️',
    nature: '🌴',
    museum: '🏛️',
    activity: '🎯',
    adventure: '⛰️',
    culture: '🎭',
    food: '🍽️',
    shopping: '🛍️',
    nightlife: '🌙',
    wildlife: '🐒',
    hotel: '🏨',
    pharmacy: '💊',
    restaurant: '🍴',
  };
  return icons[category.toLowerCase()] || '📍';
}
