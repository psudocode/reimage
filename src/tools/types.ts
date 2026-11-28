import type { ComponentType } from 'react';
import type { Env, OutputSettings } from '../core/pipeline/types.ts';
import type { Size } from '../core/image/resample.ts';
import type { IconName } from '../ui/iconNames.ts';
import type { ToolCategoryId } from './categories.ts';

export interface ToolContext {
  signal: AbortSignal;
  progress(fraction: number): void;
  createCanvas(width: number, height: number): OffscreenCanvas;
  /** Memory guard: the most pixels (width * height) a tool may produce. */
  maxPixels: number;
}

/** Output settings a tool may set. The pipeline builder merges them over the defaults. */
export type OutputOverrides = Partial<
  Pick<OutputSettings, 'format' | 'quality' | 'targetBytes' | 'stripMetadata'>
>;

export interface ToolPanelProps<O> {
  value: O;
  onChange(options: O): void;
}

/** The size of the image being shown, so an overlay can map percent to pixels. */
export interface ToolOverlayProps<O> extends ToolPanelProps<O> {
  imageSize: Size;
  /** True while a job runs: the overlay must not change the options. */
  disabled?: boolean;
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
  /**
   * Encoding happens once at the end of a pipeline (technical.md §6), so tools
   * like Compress and Convert change the *output settings* instead of the pixels.
   */
  toOutput?(options: O): OutputOverrides;
  /** Hide the tool when the browser can't do it. */
  supports?(env: Env): boolean;
}

/** The part of a tool that renders on the main thread. Never imported by workers. */
export interface ToolUI<O = unknown> {
  /** Must equal the `id` of the matching `ToolRuntime`. */
  id: string;
  labelKey: string;
  /** Which rail category lists this tool. */
  category: ToolCategoryId;
  icon: IconName;
  Panel: ComponentType<ToolPanelProps<O>>;
  /**
   * Optional interactive layer drawn over the original image on the canvas
   * (e.g. the crop box). While it exists, the canvas shows it instead of the
   * before/after slider.
   */
  Overlay?: ComponentType<ToolOverlayProps<O>>;
}
