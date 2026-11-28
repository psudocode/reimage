import type { Size } from '../../core/image/resample.ts';

export const MERGE_LAYOUTS = ['horizontal', 'vertical', 'grid'] as const;
export type MergeLayout = (typeof MERGE_LAYOUTS)[number];

export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 8;
export const MAX_GAP = 200;
/** At least two pictures make a merge; the cap keeps the decoded inputs within memory. */
export const MIN_MERGE_IMAGES = 2;
export const MAX_MERGE_IMAGES = 50;

export const TRANSPARENT = 'transparent';

export interface MergeOptions {
  layout: MergeLayout;
  /** Grid layout only. */
  columns: number;
  /** Space between pictures, and around the edge, in pixels. */
  gap: number;
  /** `#rrggbb` or `transparent` (the result is then written as PNG). */
  background: string;
}

export const mergeDefaults: MergeOptions = {
  layout: 'horizontal',
  columns: 2,
  gap: 0,
  background: '#ffffff',
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Returns i18n error keys; empty array means valid. */
export function validateMerge(options: MergeOptions): string[] {
  const errors: string[] = [];
  if (!MERGE_LAYOUTS.includes(options.layout)) errors.push('tools.merge.errors.layout');
  if (
    options.layout === 'grid' &&
    !(
      Number.isInteger(options.columns) &&
      options.columns >= MIN_COLUMNS &&
      options.columns <= MAX_COLUMNS
    )
  ) {
    errors.push('tools.merge.errors.columns');
  }
  if (!(Number.isInteger(options.gap) && options.gap >= 0 && options.gap <= MAX_GAP)) {
    errors.push('tools.merge.errors.gap');
  }
  if (options.background !== TRANSPARENT && !HEX_COLOR.test(options.background)) {
    errors.push('tools.merge.errors.background');
  }
  return errors;
}

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MergeLayoutResult {
  width: number;
  height: number;
  /** One per input, in input order. */
  placements: Placement[];
}

const fit = (source: Size, box: Size): Size => {
  const factor = Math.min(box.width / source.width, box.height / source.height, 1);
  return {
    width: Math.max(1, Math.round(source.width * factor)),
    height: Math.max(1, Math.round(source.height * factor)),
  };
};

/** Where each picture goes, before the memory guard. Pictures are never enlarged. */
function arrange(sizes: readonly Size[], options: MergeOptions, gap: number) {
  const minWidth = Math.min(...sizes.map((size) => size.width));
  const minHeight = Math.min(...sizes.map((size) => size.height));
  const placements: Placement[] = [];

  if (options.layout === 'grid') {
    const columns = Math.min(options.columns, sizes.length);
    const rows = Math.ceil(sizes.length / columns);
    const cell = { width: minWidth, height: minHeight };
    sizes.forEach((size, index) => {
      const drawn = fit(size, cell);
      const column = index % columns;
      const row = Math.floor(index / columns);
      placements.push({
        x: gap + column * (cell.width + gap) + Math.round((cell.width - drawn.width) / 2),
        y: gap + row * (cell.height + gap) + Math.round((cell.height - drawn.height) / 2),
        ...drawn,
      });
    });
    return {
      width: gap + columns * (cell.width + gap),
      height: gap + rows * (cell.height + gap),
      placements,
    };
  }

  // A row or a column: scale everyone to the smallest height (or width) so edges line up.
  const horizontal = options.layout === 'horizontal';
  let cursor = gap;
  for (const size of sizes) {
    const factor = horizontal ? minHeight / size.height : minWidth / size.width;
    const drawn = {
      width: Math.max(1, Math.round(size.width * factor)),
      height: Math.max(1, Math.round(size.height * factor)),
    };
    placements.push(horizontal ? { x: cursor, y: gap, ...drawn } : { x: gap, y: cursor, ...drawn });
    cursor += (horizontal ? drawn.width : drawn.height) + gap;
  }
  return {
    width: horizontal ? cursor : minWidth + 2 * gap,
    height: horizontal ? minHeight + 2 * gap : cursor,
    placements,
  };
}

/**
 * The output canvas and the place of every picture. Assumes `options` passed
 * `validateMerge` and `sizes` is not empty. When the canvas would exceed
 * `maxPixels` (the memory guard) the whole layout, gaps included, shrinks
 * evenly instead of failing.
 */
export function computeMergeLayout(
  sizes: readonly Size[],
  options: MergeOptions,
  maxPixels: number,
): MergeLayoutResult {
  const full = arrange(sizes, options, options.gap);
  if (full.width * full.height <= maxPixels) return full;

  const scale = Math.sqrt(maxPixels / (full.width * full.height));
  // Shrink the inputs, not the finished canvas, so rounding cannot overshoot the cap.
  const shrunk = sizes.map((size) => ({
    width: Math.max(1, Math.floor(size.width * scale)),
    height: Math.max(1, Math.floor(size.height * scale)),
  }));
  const result = arrange(shrunk, options, Math.floor(options.gap * scale));
  return result.width * result.height <= maxPixels ? result : arrange(shrunk, options, 0);
}
