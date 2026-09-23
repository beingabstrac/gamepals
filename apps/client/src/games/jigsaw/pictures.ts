import { COLORS, DARK } from '../../theme';

/**
 * The eight Jigsaw pictures, drawn by us as SVG in the app's flat candy style, 400 by 300. Every part
 * of each picture has something in it (a cloud, a window, a stripe), because a piece of plain sky
 * is a piece nobody can place without trying every hole.
 */
export const PICTURE_W = 400;
export const PICTURE_H = 300;

const C = COLORS;
const D = DARK;
const SKY = '#8FC8FF';
const NIGHT = '#27264A';
const WHITE = '#FFFFFF';

const cloud = (x: number, y: number, s = 1) =>
  `<g fill="${WHITE}"><circle cx="${x}" cy="${y}" r="${14 * s}"/><circle cx="${x + 16 * s}" cy="${y - 8 * s}" r="${17 * s}"/><circle cx="${x + 34 * s}" cy="${y}" r="${13 * s}"/><rect x="${x}" y="${y}" width="${34 * s}" height="${13 * s}"/></g>`;

const sun = (x: number, y: number, r: number) => {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return `<line x1="${x + Math.cos(a) * r * 1.25}" y1="${y + Math.sin(a) * r * 1.25}" x2="${x + Math.cos(a) * r * 1.6}" y2="${y + Math.sin(a) * r * 1.6}"/>`;
  }).join('');
  return `<g stroke="${C.sunny}" stroke-width="5" stroke-linecap="round">${rays}</g><circle cx="${x}" cy="${y}" r="${r}" fill="${C.sunny}"/>`;
};

const star = (x: number, y: number, r: number, fill: string) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * d).toFixed(1)},${(y + Math.sin(a) * d).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${points}" fill="${fill}"/>`;
};

const beach = () => `
  <rect width="400" height="300" fill="${SKY}"/>
  ${sun(330, 60, 30)}${cloud(40, 50)}${cloud(170, 80, 0.8)}
  <rect y="150" width="400" height="60" fill="${C.sky}"/>
  <path d="M0 165 Q25 157 50 165 T100 165 T150 165 T200 165 T250 165 T300 165 T350 165 T400 165" stroke="${WHITE}" stroke-width="4" fill="none"/>
  <path d="M0 188 Q25 180 50 188 T100 188 T150 188 T200 188 T250 188 T300 188 T350 188 T400 188" stroke="${D.sky}" stroke-width="4" fill="none"/>
  <path d="M0 210 Q100 196 200 208 T400 204 V300 H0 Z" fill="${C.sunny}"/>
  <rect x="236" y="150" width="6" height="110" fill="${C.ink}"/>
  <path d="M170 160 Q239 90 310 160 Z" fill="${C.tomato}"/>
  <path d="M205 160 Q239 100 240 160 Z M240 160 Q248 100 275 160 Z" fill="${WHITE}"/>
  <circle cx="90" cy="250" r="24" fill="${WHITE}"/><path d="M66 250 A24 24 0 0 1 114 250 Z" fill="${C.tomato}"/><path d="M78 229 Q90 250 78 271" stroke="${C.sky}" stroke-width="6" fill="none"/>
  <path d="M300 262 l10 -18 l10 18 Z" fill="${C.peach}"/><path d="M296 262 h28 l-4 14 h-20 Z" fill="${C.bubblegum}"/>
  <circle cx="160" cy="270" r="6" fill="${C.bubblegum}"/><circle cx="360" cy="240" r="5" fill="${C.peach}"/>`;

const house = () => `
  <rect width="400" height="300" fill="${SKY}"/>
  ${sun(60, 55, 24)}${cloud(250, 45)}${cloud(330, 90, 0.7)}
  <path d="M0 210 Q100 170 200 205 T400 190 V300 H0 Z" fill="${C.mint}"/>
  <path d="M0 250 Q120 225 240 250 T400 245 V300 H0 Z" fill="${D.mint}"/>
  <rect x="150" y="140" width="130" height="100" fill="${C.tomato}"/>
  <path d="M138 145 L215 82 L292 145 Z" fill="${C.grape}"/>
  <rect x="246" y="92" width="18" height="32" fill="${C.ink}"/>
  <rect x="200" y="185" width="32" height="55" rx="6" fill="${C.sunny}"/><circle cx="224" cy="214" r="3" fill="${C.ink}"/>
  <rect x="163" y="160" width="28" height="28" rx="4" fill="${WHITE}"/><rect x="241" y="160" width="28" height="28" rx="4" fill="${WHITE}"/>
  <path d="M177 160 v28 M163 174 h28 M255 160 v28 M241 174 h28" stroke="${C.sky}" stroke-width="3"/>
  <rect x="327" y="160" width="12" height="70" fill="${C.peach}"/><circle cx="333" cy="140" r="36" fill="${D.mint}"/><circle cx="318" cy="150" r="20" fill="${C.mint}"/>
  <circle cx="345" cy="130" r="5" fill="${C.tomato}"/><circle cx="322" cy="126" r="5" fill="${C.tomato}"/>
  ${[40, 70, 100, 290, 380].map((x, i) => `<circle cx="${x}" cy="${262 + (i % 2) * 14}" r="7" fill="${i % 2 ? C.sunny : C.bubblegum}"/><circle cx="${x}" cy="${262 + (i % 2) * 14}" r="3" fill="${WHITE}"/>`).join('')}`;

const balloons = () => {
  const balloon = (x: number, y: number, s: number, a: string, b: string) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -44 C34 -44 40 -8 22 16 L10 30 H-10 L-22 16 C-40 -8 -34 -44 0 -44 Z" fill="${a}"/><path d="M0 -44 C14 -44 16 -8 8 16 L4 30 H-4 L-8 16 C-16 -8 -14 -44 0 -44 Z" fill="${b}"/><path d="M-10 30 L-8 44 M10 30 L8 44" stroke="${C.ink}" stroke-width="2"/><rect x="-10" y="44" width="20" height="14" rx="3" fill="${C.peach}"/></g>`;
  return `
  <rect width="400" height="300" fill="${SKY}"/>
  ${cloud(20, 60)}${cloud(300, 40, 0.9)}${cloud(200, 120, 0.6)}
  ${balloon(95, 110, 1.3, C.tomato, C.sunny)}${balloon(250, 80, 1, C.grape, C.mint)}${balloon(340, 150, 0.8, C.bubblegum, WHITE)}
  <path d="M0 230 Q70 180 150 225 Q230 170 300 215 Q350 190 400 210 V300 H0 Z" fill="${C.mint}"/>
  <path d="M0 265 Q100 235 200 262 T400 255 V300 H0 Z" fill="${D.mint}"/>
  ${[30, 120, 210, 330].map((x) => `<rect x="${x}" y="${232 + (x % 3) * 6}" width="6" height="18" fill="${C.peach}"/><circle cx="${x + 3}" cy="${226 + (x % 3) * 6}" r="12" fill="${D.mint}"/>`).join('')}`;
};

const rocket = () => `
  <rect width="400" height="300" fill="${NIGHT}"/>
  ${[[30, 40], [120, 25], [210, 60], [370, 30], [60, 150], [320, 120], [150, 250], [260, 270], [380, 220], [20, 260]].map(([x, y], i) => star(x!, y!, 5 + (i % 3) * 2, C.sunny)).join('')}
  <circle cx="320" cy="210" r="46" fill="${C.peach}"/><ellipse cx="320" cy="210" rx="76" ry="14" fill="none" stroke="${C.sunny}" stroke-width="7"/>
  <circle cx="305" cy="195" r="8" fill="${D.peach}"/><circle cx="335" cy="225" r="6" fill="${D.peach}"/>
  <circle cx="70" cy="80" r="30" fill="${WHITE}"/><circle cx="60" cy="72" r="6" fill="#E6E0F4"/><circle cx="82" cy="92" r="8" fill="#E6E0F4"/>
  <g transform="translate(175 150) rotate(30)">
    <path d="M0 -80 C28 -50 28 20 22 40 H-22 C-28 20 -28 -50 0 -80 Z" fill="${WHITE}"/>
    <path d="M0 -80 C12 -68 18 -56 20 -46 H-20 C-18 -56 -12 -68 0 -80 Z" fill="${C.tomato}"/>
    <circle cx="0" cy="-12" r="12" fill="${C.sky}" stroke="${C.grape}" stroke-width="5"/>
    <path d="M-22 10 L-44 46 L-22 40 Z M22 10 L44 46 L22 40 Z" fill="${C.tomato}"/>
    <path d="M-14 40 Q0 90 14 40 Z" fill="${C.sunny}"/><path d="M-7 40 Q0 70 7 40 Z" fill="${C.peach}"/>
  </g>`;

const fishbowl = () => `
  <rect width="400" height="300" fill="${C.bubblegum}"/>
  ${[[40, 40], [110, 90], [340, 50], [370, 140], [30, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${D.bubblegum}"/>`).join('')}
  <rect y="250" width="400" height="50" fill="${C.grape}"/><rect y="250" width="400" height="8" fill="${D.grape}"/>
  <path d="M130 60 H270 Q270 80 290 100 Q330 150 300 210 Q280 250 200 252 Q120 250 100 210 Q70 150 110 100 Q130 80 130 60 Z" fill="${SKY}" stroke="${WHITE}" stroke-width="6"/>
  <path d="M104 130 Q200 118 296 130 Q330 170 300 212 Q280 248 200 250 Q120 248 100 212 Q72 170 104 130 Z" fill="${C.sky}"/>
  <path d="M120 238 Q200 222 280 238 Q260 250 200 250 Q140 250 120 238 Z" fill="${C.sunny}"/>
  ${[[140, 236, C.tomato], [170, 240, C.mint], [230, 240, C.peach], [258, 236, WHITE]].map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="7" fill="${f}"/>`).join('')}
  <path d="M150 236 Q140 200 155 170 Q162 200 158 236 Z M248 236 Q262 196 250 160 Q240 200 242 236 Z" fill="${C.mint}"/>
  <g transform="translate(205 180)"><ellipse rx="34" ry="22" fill="${C.peach}"/><path d="M30 0 L56 -18 L56 18 Z" fill="${C.peach}"/><circle cx="-16" cy="-5" r="6" fill="${WHITE}"/><circle cx="-17" cy="-5" r="3" fill="${C.ink}"/><path d="M-4 -20 Q6 -34 16 -20 Z" fill="${D.peach}"/></g>
  <g transform="translate(150 150) scale(0.55)"><ellipse rx="34" ry="22" fill="${C.sunny}"/><path d="M30 0 L56 -18 L56 18 Z" fill="${C.sunny}"/><circle cx="-16" cy="-5" r="6" fill="${WHITE}"/><circle cx="-17" cy="-5" r="3" fill="${C.ink}"/></g>
  ${[[240, 140, 6], [250, 118, 4], [236, 100, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${WHITE}" stroke-width="2.5"/>`).join('')}`;

const farm = () => `
  <rect width="400" height="300" fill="${SKY}"/>
  ${sun(340, 50, 22)}${cloud(60, 45)}${cloud(190, 70, 0.7)}
  <rect y="170" width="400" height="130" fill="${C.mint}"/>
  ${[0, 1, 2, 3, 4].map((i) => `<path d="M${i * 90 - 20} 300 L${150 + i * 22} 170 L${170 + i * 22} 170 L${i * 90 + 30} 300 Z" fill="${C.sunny}" opacity="${i % 2 ? 1 : 0.85}"/>`).join('')}
  <rect x="40" y="110" width="110" height="80" fill="${C.tomato}"/>
  <path d="M30 115 L95 70 L160 115 Z" fill="${D.tomato}"/>
  <rect x="75" y="140" width="40" height="50" fill="${WHITE}"/><path d="M75 140 L115 190 M115 140 L75 190" stroke="${C.tomato}" stroke-width="5"/>
  <rect x="84" y="90" width="22" height="16" fill="${WHITE}"/>
  ${[180, 210, 240, 270, 300, 330, 360, 390].map((x) => `<rect x="${x}" y="176" width="7" height="30" fill="${WHITE}"/>`).join('')}
  <rect x="176" y="182" width="224" height="6" fill="${WHITE}"/><rect x="176" y="196" width="224" height="6" fill="${WHITE}"/>
  <g transform="translate(290 250)"><ellipse rx="42" ry="24" fill="${WHITE}"/><circle cx="-12" cy="-6" r="9" fill="${C.ink}"/><circle cx="16" cy="6" r="7" fill="${C.ink}"/>
    <rect x="-34" y="14" width="8" height="22" fill="${WHITE}"/><rect x="24" y="14" width="8" height="22" fill="${WHITE}"/>
    <ellipse cx="46" cy="-12" rx="17" ry="14" fill="${WHITE}"/><ellipse cx="54" cy="-6" rx="9" ry="7" fill="${C.bubblegum}"/><circle cx="42" cy="-18" r="3" fill="${C.ink}"/></g>`;

const city = () => {
  const building = (x: number, w: number, h: number, fill: string) => {
    const lights: string[] = [];
    for (let y = 300 - h + 14; y < 286; y += 22) {
      for (let wx = x + 8; wx < x + w - 12; wx += 18) if ((wx * 7 + y * 3) % 5 !== 0) lights.push(`<rect x="${wx}" y="${y}" width="9" height="11" rx="2" fill="${C.sunny}"/>`);
    }
    return `<rect x="${x}" y="${300 - h}" width="${w}" height="${h}" fill="${fill}"/>${lights.join('')}`;
  };
  return `
  <rect width="400" height="300" fill="${NIGHT}"/>
  <circle cx="320" cy="60" r="32" fill="${C.sunny}"/><circle cx="336" cy="50" r="28" fill="${NIGHT}"/>
  ${[[30, 30], [90, 70], [160, 30], [230, 80], [260, 20], [380, 110], [20, 110]].map(([x, y], i) => star(x!, y!, 4 + (i % 2) * 3, WHITE)).join('')}
  ${building(0, 70, 150, C.grape)}${building(64, 60, 210, C.sky)}${building(118, 80, 130, C.bubblegum)}${building(192, 56, 180, C.mint)}${building(242, 74, 120, C.peach)}${building(310, 90, 190, C.tomato)}
  <rect x="80" y="70" width="4" height="22" fill="${WHITE}"/><circle cx="82" cy="68" r="4" fill="${C.tomato}"/>`;
};

const snowman = () => `
  <rect width="400" height="300" fill="${SKY}"/>
  ${[[30, 40], [80, 120], [150, 30], [250, 60], [330, 30], [370, 110], [200, 140], [40, 200]].map(([x, y]) => `<g stroke="${WHITE}" stroke-width="3" stroke-linecap="round"><line x1="${x! - 7}" y1="${y}" x2="${x! + 7}" y2="${y}"/><line x1="${x}" y1="${y! - 7}" x2="${x}" y2="${y! + 7}"/><line x1="${x! - 5}" y1="${y! - 5}" x2="${x! + 5}" y2="${y! + 5}"/><line x1="${x! - 5}" y1="${y! + 5}" x2="${x! + 5}" y2="${y! - 5}"/></g>`).join('')}
  <path d="M0 220 Q100 190 200 215 T400 205 V300 H0 Z" fill="${WHITE}"/>
  ${[[40, 1], [330, 1.2], [380, 0.8]].map(([x, s]) => `<g transform="translate(${x} 220) scale(${s})"><rect x="-5" y="0" width="10" height="16" fill="${C.peach}"/><path d="M0 -70 L28 0 H-28 Z" fill="${D.mint}"/><path d="M0 -70 L20 -24 H-20 Z" fill="${C.mint}"/></g>`).join('')}
  <circle cx="200" cy="232" r="52" fill="${WHITE}" stroke="#E6E0F4" stroke-width="4"/>
  <circle cx="200" cy="150" r="38" fill="${WHITE}" stroke="#E6E0F4" stroke-width="4"/>
  <rect x="172" y="96" width="56" height="10" rx="4" fill="${C.ink}"/><rect x="182" y="66" width="36" height="34" rx="4" fill="${C.ink}"/><rect x="182" y="90" width="36" height="7" fill="${C.tomato}"/>
  <circle cx="188" cy="142" r="4" fill="${C.ink}"/><circle cx="212" cy="142" r="4" fill="${C.ink}"/><path d="M200 152 L228 158 L200 162 Z" fill="${C.peach}"/>
  <path d="M166 180 Q200 196 234 180 L236 192 Q200 208 164 192 Z" fill="${C.tomato}"/><rect x="214" y="186" width="14" height="34" rx="4" fill="${C.tomato}"/>
  ${[212, 232, 252].map((y) => `<circle cx="200" cy="${y}" r="5" fill="${C.ink}"/>`).join('')}
  <path d="M160 200 L118 176 M240 200 L284 172" stroke="${C.peach}" stroke-width="6" stroke-linecap="round"/>
  ${[[70, 262, 30], [320, 275, 40], [130, 290, 22], [370, 250, 18]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r! / 3.5}" fill="#E6E0F4"/>`).join('')}
  <g transform="translate(58 268)"><rect x="-26" y="-12" width="52" height="10" rx="4" fill="${C.tomato}"/><path d="M-30 4 H28 Q38 4 36 -8" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M-16 -2 V4 M16 -2 V4" stroke="${C.ink}" stroke-width="4"/></g>
  ${[[290, 240], [305, 252], [318, 238], [334, 250]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="6" fill="${C.sky}" opacity="0.5"/>`).join('')}`;

const DRAW: readonly (() => string)[] = [beach, house, balloons, rocket, fishbowl, farm, city, snowman];

/** Picture `index` as a standalone SVG, `width` by `height` pixels. */
export function pictureSvg(index: number, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PICTURE_W} ${PICTURE_H}" width="${width}" height="${height}">${DRAW[index % DRAW.length]!()}</svg>`;
}
