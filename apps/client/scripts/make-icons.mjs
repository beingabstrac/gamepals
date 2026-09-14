/**
 * Draws the app icons from our mascot, with no image tools: signed-distance shapes, 4x4 supersampling,
 * and a tiny PNG encoder on Node's zlib. Run: node scripts/make-icons.mjs (writes public/icons + favicon).
 * Flat colors only, like the rest of the app.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/', import.meta.url).pathname;
const PAPER = [0xff, 0xfd, 0xf8];
const GRAPE = [0x7b, 0x4d, 0xff];
const BUBBLEGUM = [0xff, 0x4d, 0xa6];
const INK = [0x2b, 0x2a, 0x3a];
const WHITE = [0xff, 0xff, 0xff];

// ---------- PNG encoding
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- Shapes (in the mascot's 100 x 100 design space; negative distance = inside)
function roundBox(px, py, cx, cy, w, h, r) {
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function rotated(px, py, cx, cy, deg, fn) {
  const a = (-deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return fn(cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a));
}
const circle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;
// The smile: a quadratic curve from (41,63) through control (50,72) to (59,63), 4 wide.
const SMILE = Array.from({ length: 33 }, (_, i) => {
  const t = i / 32;
  return [(1 - t) ** 2 * 41 + 2 * (1 - t) * t * 50 + t * t * 59, (1 - t) ** 2 * 63 + 2 * (1 - t) * t * 72 + t * t * 63];
});
function smile(px, py) {
  let d = Infinity;
  for (let i = 1; i < SMILE.length; i++) {
    const [ax, ay] = SMILE[i - 1];
    const [bx, by] = SMILE[i];
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    d = Math.min(d, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))));
  }
  return d - 2;
}

/** Painter's order: each layer is [color, alpha, distance function]. */
const MASCOT = [
  [GRAPE, 1, (x, y) => roundBox(x, y, 50, 53, 80, 74, 36)],
  [GRAPE, 1, (x, y) => rotated(x, y, 37, 14, -18, (a, b) => roundBox(a, b, 37, 14, 14, 20, 7))],
  [GRAPE, 1, (x, y) => rotated(x, y, 63, 14, 18, (a, b) => roundBox(a, b, 63, 14, 14, 20, 7))],
  [BUBBLEGUM, 0.6, (x, y) => circle(x, y, 27, 62, 6)],
  [BUBBLEGUM, 0.6, (x, y) => circle(x, y, 73, 62, 6)],
  [INK, 1, (x, y) => circle(x, y, 38, 50, 5.5)],
  [INK, 1, (x, y) => circle(x, y, 62, 50, 5.5)],
  [WHITE, 1, (x, y) => circle(x, y, 40, 48, 1.8)],
  [WHITE, 1, (x, y) => circle(x, y, 64, 48, 1.8)],
  [INK, 1, smile],
];

/**
 * Renders an icon: a paper background (full-bleed, or a rounded tile) with the mascot scaled to
 * `scale` of the icon and centered.
 */
function render(size, { scale, tile }) {
  const rgba = Buffer.alloc(size * size * 4);
  const S = 4; // 4 x 4 samples per pixel
  const unit = (size * scale) / 100;
  const offset = (size - size * scale) / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = px + (sx + 0.5) / S;
          const y = py + (sy + 0.5) / S;
          // Background: transparent outside a rounded tile, or paper everywhere.
          let color = [...PAPER];
          let alpha = tile ? (roundBox(x, y, size / 2, size / 2, size, size, size * 0.22) <= 0 ? 1 : 0) : 1;
          const mx = (x - offset) / unit;
          const my = (y - offset) / unit;
          for (const [c, op, sd] of MASCOT) {
            if (sd(mx, my) <= 0) {
              color = color.map((v, i) => v * (1 - op) + c[i] * op);
              alpha = 1;
            }
          }
          r += color[0] * alpha;
          g += color[1] * alpha;
          b += color[2] * alpha;
          a += alpha;
        }
      }
      const i = (py * size + px) * 4;
      const n = S * S;
      rgba[i] = a ? Math.round(r / a) : 0;
      rgba[i + 1] = a ? Math.round(g / a) : 0;
      rgba[i + 2] = a ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return png(size, rgba);
}

mkdirSync(`${OUT}icons`, { recursive: true });
const icons = [
  ['icons/icon-192.png', 192, { scale: 0.78, tile: true }],
  ['icons/icon-512.png', 512, { scale: 0.78, tile: true }],
  // Android crops maskable icons to a shape; the mascot stays inside the middle 60% safe zone.
  ['icons/maskable-512.png', 512, { scale: 0.6, tile: false }],
  // iOS adds its own rounded corners, so this one is full-bleed paper.
  ['icons/apple-touch-icon.png', 180, { scale: 0.74, tile: false }],
];
for (const [path, size, options] of icons) {
  writeFileSync(`${OUT}${path}`, render(size, options));
  console.log(`wrote ${path} (${size}x${size})`);
}

writeFileSync(
  `${OUT}favicon.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="10" y="16" width="80" height="74" rx="36" fill="#7B4DFF"/>
  <rect x="30" y="4" width="14" height="20" rx="7" fill="#7B4DFF" transform="rotate(-18 37 14)"/>
  <rect x="56" y="4" width="14" height="20" rx="7" fill="#7B4DFF" transform="rotate(18 63 14)"/>
  <circle cx="27" cy="62" r="6" fill="#FF4DA6" opacity="0.6"/>
  <circle cx="73" cy="62" r="6" fill="#FF4DA6" opacity="0.6"/>
  <circle cx="38" cy="50" r="5.5" fill="#2B2A3A"/>
  <circle cx="62" cy="50" r="5.5" fill="#2B2A3A"/>
  <circle cx="40" cy="48" r="1.8" fill="#fff"/>
  <circle cx="64" cy="48" r="1.8" fill="#fff"/>
  <path d="M41 63 Q50 72 59 63" stroke="#2B2A3A" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>
`,
);
console.log('wrote favicon.svg');
