import { describe, expect, it } from 'vitest';
import {
  extensionForMime,
  formatBytes,
  outputFileName,
  savedPercent,
  splitAcceptedFiles,
  uniqueFileName,
} from './files.ts';

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('splitAcceptedFiles', () => {
  it('keeps JPEG, PNG, WebP and AVIF and rejects the rest', () => {
    const { accepted, rejected } = splitAcceptedFiles([
      file('a.jpg', 'image/jpeg'),
      file('b.png', 'image/png'),
      file('c.webp', 'image/webp'),
      file('d.avif', 'image/avif'),
      file('e.gif', 'image/gif'),
      file('f.pdf', 'application/pdf'),
      file('g', ''),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['a.jpg', 'b.png', 'c.webp', 'd.avif']);
    expect(rejected.map((f) => f.name)).toEqual(['e.gif', 'f.pdf', 'g']);
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1000, '1.0 KB'],
    [9_949, '9.9 KB'],
    [200_000, '200 KB'],
    [1_500_000, '1.5 MB'],
    [Number.NaN, '–'],
    [-1, '–'],
  ])('formats %s as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('savedPercent', () => {
  it('rounds the saving', () => expect(savedPercent(1000, 340)).toBe(66));
  it('is negative when the output grew', () => expect(savedPercent(1000, 1100)).toBe(-10));
  it('is 0 without input', () => expect(savedPercent(0, 10)).toBe(0));
});

describe('outputFileName', () => {
  it('swaps the extension and appends the suffix from the pattern', () => {
    expect(outputFileName('holiday.photo.JPEG', '{name}-reimage.{ext}', 'jpg')).toBe(
      'holiday.photo-reimage.jpg',
    );
  });
  it('handles names without an extension and dotfiles', () => {
    expect(outputFileName('scan', '{name}.{ext}', 'png')).toBe('scan.png');
    expect(outputFileName('.hidden', '{name}.{ext}', 'png')).toBe('.hidden.png');
  });
});

describe('extensionForMime', () => {
  it('maps encoder output types, falling back to png', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/avif')).toBe('avif');
    expect(extensionForMime('image/unknown')).toBe('png');
  });
});

describe('uniqueFileName', () => {
  it('numbers duplicates before the extension', () => {
    const used = new Set<string>();
    expect(uniqueFileName('a.jpg', used)).toBe('a.jpg');
    expect(uniqueFileName('a.jpg', used)).toBe('a (2).jpg');
    expect(uniqueFileName('a.jpg', used)).toBe('a (3).jpg');
    expect(uniqueFileName('a', used)).toBe('a');
    expect(uniqueFileName('a', used)).toBe('a (2)');
  });
});
