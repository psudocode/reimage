import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createZip } from './zip.ts';

const bytesOf = (blob: Blob) =>
  new Promise<Uint8Array>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });

describe('createZip', () => {
  it('round-trips every entry under its file name', async () => {
    const zip = await createZip([
      { fileName: 'a-reimage.jpg', blob: new Blob(['aaa'], { type: 'image/jpeg' }) },
      { fileName: 'b-reimage.png', blob: new Blob(['bbbb'], { type: 'image/png' }) },
    ]);
    expect(zip.type).toBe('application/zip');
    const files = unzipSync(await bytesOf(zip));
    expect(Object.keys(files)).toEqual(['a-reimage.jpg', 'b-reimage.png']);
    expect(strFromU8(files['a-reimage.jpg']!)).toBe('aaa');
    expect(strFromU8(files['b-reimage.png']!)).toBe('bbbb');
  });

  it('rejects duplicate names instead of silently dropping an image', async () => {
    const blob = new Blob(['x']);
    await expect(
      createZip([
        { fileName: 'a.jpg', blob },
        { fileName: 'a.jpg', blob },
      ]),
    ).rejects.toThrow(/Duplicate/);
  });
});
