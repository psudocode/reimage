import type { Size } from '../../core/image/resample.ts';

/** Clockwise quarter turns, in degrees. */
export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

export interface RotateOptions {
  rotation: Rotation;
  /** Mirror left to right. Applied before the rotation. */
  flipH: boolean;
  /** Mirror top to bottom. Applied before the rotation. */
  flipV: boolean;
}

export const rotateDefaults: RotateOptions = { rotation: 90, flipH: false, flipV: false };

/** Returns i18n error keys; empty array means valid. */
export function validateRotate(options: RotateOptions): string[] {
  return ROTATIONS.includes(options.rotation) ? [] : ['tools.rotate.errors.rotation'];
}

export function isIdentity(options: RotateOptions): boolean {
  return options.rotation === 0 && !options.flipH && !options.flipV;
}

/** A quarter turn swaps width and height; the pixel count never changes. */
export function rotatedSize(source: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270
    ? { width: source.height, height: source.width }
    : { width: source.width, height: source.height };
}

/**
 * Canvas transform `[a, b, c, d, e, f]` that draws a `source`-sized image
 * flipped, then rotated clockwise, into `rotatedSize(source, rotation)`.
 */
type Matrix = [number, number, number, number, number, number];

export function rotateMatrix(source: Size, options: RotateOptions): Matrix {
  const { width, height } = source;
  const sx = options.flipH ? -1 : 1;
  const sy = options.flipV ? -1 : 1;
  // Flip about the image centre, expressed as a matrix on the source box.
  const flip: Matrix = [sx, 0, 0, sy, options.flipH ? width : 0, options.flipV ? height : 0];
  const turn: Matrix = {
    0: [1, 0, 0, 1, 0, 0],
    90: [0, 1, -1, 0, height, 0],
    180: [-1, 0, 0, -1, width, height],
    270: [0, -1, 1, 0, 0, width],
  }[options.rotation] as Matrix;
  // turn * flip
  const [a1, b1, c1, d1, e1, f1] = turn;
  const [a2, b2, c2, d2, e2, f2] = flip;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}
