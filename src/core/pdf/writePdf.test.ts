import { describe, expect, it } from 'vitest';
import { placeImage, writePdf, type PdfPageImage } from './writePdf.ts';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const page = (width: number, height: number): PdfPageImage => ({ jpeg, width, height });
const decode = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

describe('placeImage', () => {
  it('fit: page is the image at 96 dpi plus the margin', () => {
    const place = placeImage(page(800, 400), { pageSize: 'fit', margin: 'small' });
    expect(place).toMatchObject({ width: 600, height: 300, x: 18, y: 18 });
    expect(place.pageWidth).toBe(636);
    expect(place.pageHeight).toBe(336);
  });

  it('fit: shrinks pages that would pass the PDF size limit', () => {
    const place = placeImage(page(40000, 1000), { pageSize: 'fit', margin: 'none' });
    expect(place.pageWidth).toBeCloseTo(14400);
    expect(place.width / place.height).toBeCloseTo(40);
  });

  it('A4: centres a portrait image and keeps its ratio', () => {
    const place = placeImage(page(1000, 2000), { pageSize: 'a4', margin: 'none' });
    expect(place.pageWidth).toBeCloseTo(595.28);
    expect(place.pageHeight).toBeCloseTo(841.89);
    expect(place.height).toBeCloseTo(841.89);
    expect(place.width).toBeCloseTo(420.945);
    expect(place.x).toBeCloseTo((595.28 - place.width) / 2);
  });

  it('A4: turns the page sideways for a wide image and respects the margin', () => {
    const place = placeImage(page(3000, 1000), { pageSize: 'a4', margin: 'large' });
    expect(place.pageWidth).toBeCloseTo(841.89);
    expect(place.pageHeight).toBeCloseTo(595.28);
    expect(place.width).toBeCloseTo(841.89 - 72);
    expect(place.x).toBeCloseTo(36);
  });

  it('Letter uses 612 x 792', () => {
    const place = placeImage(page(100, 100), { pageSize: 'letter', margin: 'none' });
    expect([place.pageWidth, place.pageHeight]).toEqual([612, 792]);
  });
});

describe('writePdf', () => {
  it('refuses an empty document', () => {
    expect(() => writePdf([], { pageSize: 'fit', margin: 'none' })).toThrow();
  });

  it('writes a header, one page per image and a trailer', () => {
    const text = decode(
      writePdf([page(10, 10), page(20, 10)], { pageSize: 'fit', margin: 'none' }),
    );
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(text.match(/\/Filter \/DCTDecode/g)).toHaveLength(2);
    expect(text).toContain('/Width 20 /Height 10');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('embeds the JPEG bytes unchanged', () => {
    const payload = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    const bytes = writePdf([{ jpeg: payload, width: 1, height: 1 }], {
      pageSize: 'fit',
      margin: 'none',
    });
    expect(decode(bytes)).toContain(decode(payload));
  });

  it('has an xref table whose offsets point at each object', () => {
    const bytes = writePdf([page(10, 10), page(5, 5)], { pageSize: 'a4', margin: 'small' });
    const text = decode(bytes);
    const start = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const entries = text
      .slice(start)
      .split('\n')
      .slice(3)
      .filter((line) => line.endsWith(' n '));
    expect(entries).toHaveLength(2 + 2 * 3);
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });
});
