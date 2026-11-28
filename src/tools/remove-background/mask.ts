/** Pure maths around the model's input and output. No DOM, no ONNX: unit-testable. */

/**
 * RGBA pixels → planar RGB floats (CHW), as IS-Net expects: (value - 128) / 256
 * on the 0..255 scale. Alpha is ignored.
 */
export function rgbaToTensor(rgba: Uint8ClampedArray, pixels: number): Float32Array {
  const out = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    out[i] = (rgba[i * 4]! - 128) / 256;
    out[pixels + i] = (rgba[i * 4 + 1]! - 128) / 256;
    out[2 * pixels + i] = (rgba[i * 4 + 2]! - 128) / 256;
  }
  return out;
}

/**
 * Model output → 0..255 alpha, stretched so the weakest value is 0 and the
 * strongest 255 (the model's range varies per image). A flat output gives 0.
 * `softEdges: false` cuts hard at 50%.
 */
export function maskToAlpha(mask: ArrayLike<number>, softEdges: boolean): Uint8ClampedArray {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < mask.length; i += 1) {
    const v = mask[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  const alpha = new Uint8ClampedArray(mask.length);
  if (!(range > 0)) return alpha;
  for (let i = 0; i < mask.length; i += 1) {
    const unit = (mask[i]! - min) / range;
    alpha[i] = softEdges ? Math.round(unit * 255) : unit >= 0.5 ? 255 : 0;
  }
  return alpha;
}
