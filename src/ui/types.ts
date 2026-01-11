export type SelectionMode = 'single' | 'multi';

export interface SelectableOption<T = unknown> {
  label: string;
  value: T;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

export interface SelectConfig<T = unknown> {
  message: string;
  options: SelectableOption<T>[];
  mode: SelectionMode;
  minSelect?: number;
  maxSelect?: number;
  pageSize?: number;
  loop?: boolean;
}

export interface SelectResult<T = unknown> {
  selected: T | T[];
  indices: number[];
  cancelled: boolean;
}

export interface KeypressEvent {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
}

export type InputRequestFn = <T = string>(
  promptOrConfig: string | SelectConfig<T>,
  options?: string[]
) => Promise<string | SelectResult<T>>;
