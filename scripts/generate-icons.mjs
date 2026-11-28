// Generates the PWA PNG icons (no image deps): dark tile with a blue rounded square.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, { scale }) {
  const bg = [15, 23, 42]; // slate-950
  const fg = [37, 99, 235]; // blue-600
  const half = (size * scale) / 2;
  const radius = half * 0.28;
  const c = size / 2;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = Math.max(Math.abs(x + 0.5 - c) - (half - radius), 0);
      const dy = Math.max(Math.abs(y + 0.5 - c) - (half - radius), 0);
      const inside = Math.hypot(dx, dy) <= radius;
      const px = inside ? fg : bg;
      raw.set(px, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// "any" icons fill most of the tile; maskable keeps the glyph inside the 80% safe zone.
writeFileSync('public/pwa-192.png', png(192, { scale: 0.7 }));
writeFileSync('public/pwa-512.png', png(512, { scale: 0.7 }));
writeFileSync('public/pwa-maskable-512.png', png(512, { scale: 0.6 }));
writeFileSync('public/apple-touch-icon.png', png(180, { scale: 0.7 }));
