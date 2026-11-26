/** Formats the encoder can read and write today (technical.md §8). */
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

const HEIC_MIME_TYPES = ['image/heic', 'image/heif'] as const;

/**
 * HEIC/HEIF is input-only and decoded natively where the browser can (Safari);
 * there is no way to know up front. Chromium often reports an empty MIME type
 * for `.heic`, so the extension counts too.
 */
export function isHeicFile(file: Pick<File, 'name' | 'type'>): boolean {
  return (
    (HEIC_MIME_TYPES as readonly string[]).includes(file.type) || /\.(heic|heif)$/i.test(file.name)
  );
}

export const ACCEPT_ATTRIBUTE = [...ACCEPTED_MIME_TYPES, ...HEIC_MIME_TYPES, '.heic', '.heif'].join(
  ',',
);

export interface SplitFiles {
  accepted: File[];
  rejected: File[];
}

/** Separates supported images from everything else (documents, GIF, folders, ...). */
export function splitAcceptedFiles(files: Iterable<File>): SplitFiles {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type) || isHeicFile(file)) {
      accepted.push(file);
    } else rejected.push(file);
  }
  return { accepted, rejected };
}

/** Human-readable size. Decimal units (1 KB = 1000 B) to match the Compress target field. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) {
    const kb = bytes / 1000;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Percentage saved, rounded. Negative when the output grew. 0 when there was no input. */
export function savedPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round((1 - after / before) * 100);
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function extensionForMime(mime: string): string {
  return EXTENSIONS[mime] ?? 'png';
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Expands `{name}` and `{ext}` in the pipeline's `fileNamePattern`. */
export function outputFileName(inputName: string, pattern: string, extension: string): string {
  return pattern.replaceAll('{name}', stripExtension(inputName)).replaceAll('{ext}', extension);
}

/**
 * Makes `name` unique within `used` by appending ` (2)`, ` (3)`, ... before the
 * extension, and records it. Two `photo.jpg` files from different folders must
 * not overwrite each other when downloaded or zipped.
 */
export function uniqueFileName(name: string, used: Set<string>): string {
  let candidate = name;
  if (used.has(candidate)) {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let counter = 2;
    while (used.has(`${base} (${counter})${ext}`)) counter += 1;
    candidate = `${base} (${counter})${ext}`;
  }
  used.add(candidate);
  return candidate;
}
