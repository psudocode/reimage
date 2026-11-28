/**
 * Minimal PDF 1.4 writer: one JPEG per page, nothing else. JPEG data goes in as
 * is (`DCTDecode`), so building the file never re-compresses a pixel. Pure and
 * DOM-free, so it can run anywhere and is easy to test.
 */

export interface PdfPageImage {
  /** A complete JPEG file. */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

export type PdfPageSize = 'fit' | 'a4' | 'letter';
export type PdfMargin = 'none' | 'small' | 'large';

export interface PdfLayout {
  /** `fit` makes each page exactly as big as its image (plus margin). */
  pageSize: PdfPageSize;
  margin: PdfMargin;
}

/** PDF user units are points (1/72 in). */
const FIXED_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGIN_POINTS: Record<PdfMargin, number> = { none: 0, small: 18, large: 36 };
/** A browser pixel is 1/96 in. */
const POINTS_PER_PIXEL = 0.75;
/** Acrobat's page size limit (200 in). Larger pages are shrunk, not refused. */
const MAX_PAGE_POINTS = 14400;

interface Placement {
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where one image sits on its page, in points. Exported for tests. */
export function placeImage(image: PdfPageImage, layout: PdfLayout): Placement {
  const margin = MARGIN_POINTS[layout.margin];

  if (layout.pageSize === 'fit') {
    const natural = Math.max(image.width, image.height) * POINTS_PER_PIXEL + 2 * margin;
    const shrink = natural > MAX_PAGE_POINTS ? MAX_PAGE_POINTS / natural : 1;
    const width = image.width * POINTS_PER_PIXEL * shrink;
    const height = image.height * POINTS_PER_PIXEL * shrink;
    const m = margin * shrink;
    return {
      pageWidth: width + 2 * m,
      pageHeight: height + 2 * m,
      x: m,
      y: m,
      width,
      height,
    };
  }

  const [short, long] = FIXED_SIZES[layout.pageSize];
  const landscape = image.width > image.height;
  const pageWidth = landscape ? long : short;
  const pageHeight = landscape ? short : long;
  const scale = Math.min(
    (pageWidth - 2 * margin) / image.width,
    (pageHeight - 2 * margin) / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

const num = (value: number) => String(Math.round(value * 100) / 100);

class PdfBuilder {
  private readonly encoder = new TextEncoder();
  private readonly chunks: Uint8Array[] = [];
  private readonly offsets: number[] = [];
  private length = 0;

  private push(chunk: Uint8Array) {
    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  text(value: string) {
    this.push(this.encoder.encode(value));
  }

  /** Writes `n 0 obj … endobj`; `stream` is appended as the object's stream. */
  object(id: number, dictionary: string, stream?: Uint8Array) {
    this.offsets[id] = this.length;
    this.text(`${id} 0 obj\n<< ${dictionary}${stream ? ` /Length ${stream.length}` : ''} >>\n`);
    if (stream) {
      this.text('stream\n');
      this.push(stream);
      this.text('\nendstream\n');
    }
    this.text('endobj\n');
  }

  finish(rootId: number, objectCount: number): Uint8Array {
    const xrefOffset = this.length;
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= objectCount; id += 1) {
      xref += `${String(this.offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objectCount + 1} /Root ${rootId} 0 R >>\n`;
    xref += `startxref\n${xrefOffset}\n%%EOF\n`;
    this.text(xref);

    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

/** Builds a PDF with one page per image, in the order given. */
export function writePdf(images: readonly PdfPageImage[], layout: PdfLayout): Uint8Array {
  if (images.length === 0) throw new Error('A PDF needs at least one page');

  // Object numbers: 1 = catalog, 2 = page tree, then page / content / image per page.
  const pageId = (index: number) => 3 + index * 3;
  const pdf = new PdfBuilder();
  // The binary comment tells transfer tools this file is not plain text.
  pdf.text('%PDF-1.4\n%âãÏÓ\n');

  pdf.object(1, '/Type /Catalog /Pages 2 0 R');
  const kids = images.map((_, index) => `${pageId(index)} 0 R`).join(' ');
  pdf.object(2, `/Type /Pages /Count ${images.length} /Kids [${kids}]`);

  const encoder = new TextEncoder();
  images.forEach((image, index) => {
    const place = placeImage(image, layout);
    const id = pageId(index);
    pdf.object(
      id,
      `/Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(place.pageWidth)} ${num(place.pageHeight)}] ` +
        `/Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R`,
    );
    const content = `q ${num(place.width)} 0 0 ${num(place.height)} ${num(place.x)} ${num(place.y)} cm /Im0 Do Q`;
    pdf.object(id + 1, '', encoder.encode(content));
    pdf.object(
      id + 2,
      `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode',
      image.jpeg,
    );
  });

  return pdf.finish(1, 2 + images.length * 3);
}
