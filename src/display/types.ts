import { SelectableOption } from '../ui/types.js';

export type FieldType = 'text' | 'price' | 'rating' | 'badge' | 'list' | 'distance' | 'duration';
export type ColorType = 'green' | 'yellow' | 'cyan' | 'red' | 'dim' | 'bold';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  icon?: string;
  color?: ColorType;
  format?: string;
  hideIfEmpty?: boolean;
  priority?: number;
}

export interface ResultDisplaySchema<T = unknown> {
  type: string;
  name: string;
  titleField: keyof T & string;
  descriptionField?: keyof T & string;
  fields: FieldConfig[];
  toSelectableOption: (item: T, index: number) => SelectableOption<T>;
}

export interface FormattedField {
  label: string;
  value: string;
  icon?: string;
  color?: ColorType;
}

export interface FormattedCard {
  index: number;
  title: string;
  subtitle?: string;
  fields: FormattedField[];
  badges: string[];
}

export interface SchemaRegistry {
  register<T>(schema: ResultDisplaySchema<T>): void;
  get<T>(type: string): ResultDisplaySchema<T> | undefined;
  has(type: string): boolean;
  list(): string[];
}
