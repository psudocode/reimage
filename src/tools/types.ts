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

export interface ImageTool<O = unknown> {
  id: string;
  labelKey: string;
  icon: string;
  kind?: 'one-to-one' | 'many-to-one';
  defaults: O;
  validate(options: O): string[];
  run(input: ImageBitmap, options: O, ctx: ToolContext): Promise<ImageBitmap>;
  runMany?(inputs: ImageBitmap[], options: O, ctx: ToolContext): Promise<ImageBitmap>;
  Panel: ComponentType<ToolPanelProps<O>>;
  supports?(env: Env): boolean;
}
