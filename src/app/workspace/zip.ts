import { zipSync, type Zippable } from 'fflate';

export interface ZipEntry {
  fileName: string;
  blob: Blob;
}

/** `Blob.arrayBuffer` with a FileReader fallback for older engines (and jsdom). */
function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsArrayBuffer(blob);
  });
}

export const ZIP_MIME = 'application/zip';

/**
 * Packs finished images into one ZIP, entirely in memory (no upload).
 * Images are already compressed, so entries are stored (level 0): fast, and
 * deflate would only burn CPU for ~0% gain. File names must be unique.
 */
export async function createZip(entries: readonly ZipEntry[]): Promise<Blob> {
  const files: Zippable = {};
  for (const { fileName, blob } of entries) {
    if (fileName in files) throw new Error(`Duplicate file name "${fileName}"`);
    files[fileName] = [await readBytes(blob), { level: 0 }];
  }
  const bytes = zipSync(files);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: ZIP_MIME });
}
