import type { ComponentType } from 'react';
import type { Env } from '../core/pipeline/types.ts';

export interface ToolContext {
  signal: AbortSignal;
  progress(fraction: number): void;
  createCanvas(width: number, height: number): OffscreenCanvas;
}

export interface ToolPanelProps<O> {
  value: O;
  onChange(options: O): void;
}

/**
 * The part of a tool that runs inside a worker. It must stay free of React and
 * the DOM: the worker bundle imports `runtimeRegistry.ts`, and anything pulled
 * in here is shipped to every worker. ESLint enforces the React part.
 */
export interface ToolRuntime<O = unknown> {
  /** Unique, kebab-case. Shared with the matching `ToolUI`. */
  id: string;
  kind?: 'one-to-one' | 'many-to-one';
  defaults: O;
  /** `[]` = valid; otherwise i18n error keys. */
  validate(options: O): string[];
  run(input: ImageBitmap, options: O, ctx: ToolContext): Promise<ImageBitmap>;
  runMany?(inputs: ImageBitmap[], options: O, ctx: ToolContext): Promise<ImageBitmap>;
  /** Hide the tool when the browser can't do it. */
  supports?(env: Env): boolean;
}

/** The part of a tool that renders on the main thread. Never imported by workers. */
export interface ToolUI<O = unknown> {
  /** Must equal the `id` of the matching `ToolRuntime`. */
  id: string;
  labelKey: string;
  icon: string;
  Panel: ComponentType<ToolPanelProps<O>>;
}
