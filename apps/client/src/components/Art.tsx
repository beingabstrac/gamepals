import type { BotTier } from '@gamepals/rules';
import type { ComponentChildren, JSX } from 'preact';
import { COLORS, DARK } from '../theme';

/* Original vector art: crisp at any size, flat colors, no gradients. */

const INK = COLORS.ink;
const round = { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

function TicTacToeArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {[35, 65].map((p) => (
        <g key={p} fill="#B9A8F0">
          <rect x={p - 2.5} y="8" width="5" height="84" rx="2.5" />
          <rect x="8" y={p - 2.5} width="84" height="5" rx="2.5" />
        </g>
      ))}
      <g stroke={COLORS.tomato} stroke-width="7" {...round}>
        <path d="M12 12 L28 28 M28 12 L12 28" />
        <path d="M72 72 L88 88 M88 72 L72 88" />
      </g>
      <g stroke={COLORS.sky} stroke-width="7" fill="none">
        <circle cx="50" cy="50" r="9" />
        <circle cx="80" cy="20" r="9" />
      </g>
    </svg>
  );
}

function FourInARowArt() {
  const cols = [23, 41, 59, 77];
  const rows = [36, 53, 70];
  const discs: Record<string, string> = { '0-2': COLORS.sunny, '1-2': COLORS.tomato, '1-1': COLORS.sunny, '2-2': COLORS.sunny, '3-2': COLORS.tomato, '2-1': COLORS.tomato };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="24" width="80" height="64" rx="12" fill={DARK.sky} />
      <rect x="10" y="18" width="80" height="64" rx="12" fill={COLORS.sky} />
      {cols.map((cx, c) =>
        rows.map((cy, r) => <circle key={`${c}-${r}`} cx={cx} cy={cy - 6} r="7" fill={discs[`${c}-${r}`] ?? '#EAF3FF'} />),
      )}
    </svg>
  );
}

function LudoArt() {
  const corners: [number, number, string][] = [
    [12, 12, COLORS.tomato],
    [58, 12, COLORS.mint],
    [58, 58, COLORS.sunny],
    [12, 58, COLORS.sky],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="8" width="84" height="84" rx="16" fill="#fff" stroke="#E6E1F3" stroke-width="2" />
      {corners.map(([x, y, color]) => (
        <g key={color}>
          <rect x={x} y={y} width="30" height="30" rx="9" fill={color} />
          <circle cx={x + 15} cy={y + 15} r="8" fill="#fff" />
          <circle cx={x + 15} cy={y + 15} r="4" fill={color} />
        </g>
      ))}
      <path d="M44 44 L56 44 L50 50 Z" fill={COLORS.mint} />
      <path d="M56 44 L56 56 L50 50 Z" fill={COLORS.sunny} />
      <path d="M56 56 L44 56 L50 50 Z" fill={COLORS.sky} />
      <path d="M44 56 L44 44 L50 50 Z" fill={COLORS.tomato} />
    </svg>
  );
}

function AirHockeyArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="20" y="6" width="60" height="88" rx="16" fill="#DCEEFF" stroke={DARK.sky} stroke-width="3" />
      <line x1="24" y1="50" x2="76" y2="50" stroke="#8EC2FF" stroke-width="2.5" />
      <circle cx="50" cy="50" r="9" fill="none" stroke="#8EC2FF" stroke-width="2.5" />
      <rect x="38" y="6" width="24" height="4" rx="2" fill={COLORS.tomato} />
      <rect x="38" y="90" width="24" height="4" rx="2" fill={COLORS.sky} />
      <circle cx="50" cy="24" r="9" fill={COLORS.tomato} stroke="#fff" stroke-width="2" />
      <circle cx="50" cy="24" r="4" fill={DARK.tomato} />
      <circle cx="46" cy="76" r="9" fill={COLORS.sky} stroke="#fff" stroke-width="2" />
      <circle cx="46" cy="76" r="4" fill={DARK.sky} />
      <circle cx="60" cy="46" r="5" fill={INK} stroke={COLORS.sunny} stroke-width="2" />
    </svg>
  );
}

function MancalaArt() {
  const pits = [30, 50, 70];
  const seeds = [COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.sunny];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="28" width="88" height="52" rx="22" fill={DARK.peach} />
      <rect x="6" y="24" width="88" height="52" rx="22" fill={COLORS.peach} />
      <rect x="10" y="32" width="12" height="36" rx="6" fill="#fff" />
      <rect x="78" y="32" width="12" height="36" rx="6" fill="#fff" />
      {[38, 62].map((y) =>
        pits.map((x, i) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="8" fill="#fff" />
            <circle cx={x - 2} cy={y - 1} r="2.6" fill={seeds[(i + y) % 4]} />
            <circle cx={x + 2.5} cy={y + 1.5} r="2.6" fill={seeds[(i + y + 1) % 4]} />
          </g>
        )),
      )}
      <circle cx="84" cy="46" r="2.6" fill={COLORS.grape} />
      <circle cx="84" cy="53" r="2.6" fill={COLORS.tomato} />
    </svg>
  );
}

function SnakesArt() {
  const rungs = [0.2, 0.4, 0.6, 0.8];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="16" fill="#E6E0F4" />
      <rect x="10" y="10" width="80" height="80" rx="16" fill="#fff" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) =>
          (row + col) % 2 ? null : <rect key={`${row}-${col}`} x={14 + col * 24} y={14 + row * 24} width="24" height="24" rx="6" fill="#FFF1DC" />,
        ),
      )}
      <g stroke={DARK.sunny} stroke-width="4" stroke-linecap="round">
        <line x1="24" y1="80" x2="44" y2="24" />
        <line x1="36" y1="84" x2="56" y2="28" />
        {rungs.map((t) => (
          <line key={t} x1={24 + 20 * t} y1={80 - 56 * t} x2={36 + 20 * t} y2={84 - 56 * t} />
        ))}
      </g>
      <path d="M70 26 C 88 40, 52 50, 70 62 S 66 84, 80 84" fill="none" stroke={COLORS.grape} stroke-width="8" stroke-linecap="round" />
      <circle cx="70" cy="26" r="8" fill={COLORS.grape} />
      <circle cx="67" cy="24" r="2" fill="#fff" />
      <circle cx="73" cy="24" r="2" fill="#fff" />
    </svg>
  );
}

function UltimateArt() {
  const at = [14, 38, 62];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="12" width="84" height="84" rx="16" fill="#E6E0F4" />
      <rect x="8" y="8" width="84" height="84" rx="16" fill="#fff" />
      {at.map((y, row) =>
        at.map((x, col) => {
          const live = row === 1 && col === 2;
          return (
            <rect key={`${row}-${col}`} x={x} y={y} width="24" height="24" rx="6" fill={live ? '#FFF3C4' : '#F3EFFB'} stroke={live ? COLORS.sunny : 'none'} stroke-width="2" />
          );
        }),
      )}
      <g stroke={COLORS.tomato} stroke-width="4" stroke-linecap="round">
        <line x1="21" y1="21" x2="31" y2="31" />
        <line x1="31" y1="21" x2="21" y2="31" />
        <line x1="45" y1="45" x2="55" y2="55" />
        <line x1="55" y1="45" x2="45" y2="55" />
      </g>
      <circle cx="74" cy="26" r="5.5" fill="none" stroke={COLORS.sky} stroke-width="4" />
      <circle cx="26" cy="74" r="5.5" fill="none" stroke={COLORS.sky} stroke-width="4" />
    </svg>
  );
}

function YatzyArt() {
  const five: [number, number][] = [[24, 46], [44, 46], [34, 56], [24, 66], [44, 66]];
  const three: [number, number][] = [[56, 34], [66, 44], [76, 54]];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g transform="rotate(-12 34 56)">
        <rect x="14" y="40" width="40" height="40" rx="10" fill="#DCD6EE" />
        <rect x="14" y="36" width="40" height="40" rx="10" fill="#fff" />
        {five.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={INK} />
        ))}
      </g>
      <g transform="rotate(10 66 44)">
        <rect x="46" y="28" width="40" height="40" rx="10" fill={DARK.tomato} />
        <rect x="46" y="24" width="40" height="40" rx="10" fill={COLORS.tomato} />
        {three.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#fff" />
        ))}
      </g>
    </svg>
  );
}

function ShutArt() {
  const tiles = [1, 2, 3, 4, 5];
  const shut = new Set([2, 4]);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="24" width="88" height="60" rx="16" fill={DARK.peach} />
      <rect x="6" y="20" width="88" height="60" rx="16" fill={COLORS.peach} />
      <rect x="12" y="28" width="76" height="40" rx="10" fill="#FFE9CF" />
      {tiles.map((n, i) =>
        shut.has(n) ? (
          <rect key={n} x={15 + i * 14.6} y="58" width="12" height="7" rx="3" fill={DARK.peach} />
        ) : (
          <g key={n}>
            <rect x={15 + i * 14.6} y="32" width="12" height="32" rx="4" fill="#fff" />
            <text x={21 + i * 14.6} y="48" text-anchor="middle" dominant-baseline="central" font-family="Fredoka, sans-serif" font-weight="600" font-size="10" fill={INK}>
              {n}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}

function DominoArt() {
  const pips = (cx: number, cy: number, spots: [number, number][], color: string) =>
    spots.map(([dx, dy]) => <circle key={`${cx}-${cy}-${dx}-${dy}`} cx={cx + dx * 6} cy={cy + dy * 6} r="3.2" fill={color} />);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g transform="rotate(-14 36 52)">
        <rect x="22" y="20" width="28" height="60" rx="8" fill="#E3DCCD" />
        <rect x="22" y="16" width="28" height="60" rx="8" fill="#FFFAF0" />
        <rect x="26" y="45" width="20" height="3" rx="1.5" fill="#E3DCCD" />
        {pips(36, 31, [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], COLORS.bubblegum)}
        {pips(36, 61, [[-1, -1], [1, 1]], COLORS.sky)}
      </g>
      <g transform="rotate(12 66 50)">
        <rect x="52" y="24" width="28" height="60" rx="8" fill="#E3DCCD" />
        <rect x="52" y="20" width="28" height="60" rx="8" fill="#FFFAF0" />
        <rect x="56" y="49" width="20" height="3" rx="1.5" fill="#E3DCCD" />
        {pips(66, 35, [[-1, -1], [1, 1]], COLORS.sky)}
        {pips(66, 65, [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]], COLORS.peach)}
      </g>
    </svg>
  );
}

function ChessArt() {
  const squares = [0, 1, 2, 3].flatMap((row) => [0, 1, 2, 3].map((col) => ({ row, col })));
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="14" fill="#E6E0F4" />
      <rect x="10" y="10" width="80" height="80" rx="14" fill="#FFF1DC" />
      {squares.map(({ row, col }) =>
        (row + col) % 2 ? <rect key={`${row}-${col}`} x={14 + col * 18} y={14 + row * 18} width="18" height="18" fill="#C9B6F5" /> : null,
      )}
      <g>
        <ellipse cx="50" cy="74" rx="15" ry="5" fill={INK} opacity="0.12" />
        <rect x="41" y="46" width="18" height="26" rx="6" fill="#fff" stroke={INK} stroke-width="3" />
        <rect x="33" y="70" width="34" height="8" rx="4" fill="#fff" stroke={INK} stroke-width="3" />
        <rect x="38" y="32" width="24" height="16" rx="5" fill="#fff" stroke={INK} stroke-width="3" />
        <rect x="47" y="18" width="6" height="16" rx="2" fill="#fff" stroke={INK} stroke-width="3" />
        <rect x="42" y="23" width="16" height="6" rx="2" fill="#fff" stroke={INK} stroke-width="3" />
      </g>
    </svg>
  );
}

function BackgammonArt() {
  const cols = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="16" width="88" height="72" rx="12" fill={DARK.peach} />
      <rect x="6" y="12" width="88" height="72" rx="12" fill={COLORS.peach} />
      <rect x="10" y="16" width="80" height="64" fill="#FFF6EA" />
      <rect x="47" y="16" width="6" height="64" fill={DARK.peach} />
      {cols.map((c) => (
        <g key={c}>
          <path d={`M${12 + c * 13} 16 L${22 + c * 13} 16 L${17 + c * 13} 44 Z`} fill={c % 2 ? '#C9B6F5' : '#FFE9CF'} />
          <path d={`M${12 + c * 13} 80 L${22 + c * 13} 80 L${17 + c * 13} 52 Z`} fill={c % 2 ? '#FFE9CF' : '#C9B6F5'} />
        </g>
      ))}
      <circle cx="17" cy="74" r="6" fill={COLORS.sky} />
      <circle cx="17" cy="63" r="6" fill={COLORS.sky} />
      <circle cx="82" cy="22" r="6" fill={COLORS.tomato} />
      <circle cx="82" cy="33" r="6" fill={COLORS.tomato} />
    </svg>
  );
}

function SeaBattleArt() {
  const misses: [number, number][] = [[30, 30], [58, 44], [72, 30]];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="16" width="80" height="76" rx="12" fill="#B9D9F2" />
      <rect x="10" y="12" width="80" height="76" rx="12" fill="#DFF1FF" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} stroke="#B9D9F2" stroke-width="1.5">
          <line x1={10 + i * 16} y1="12" x2={10 + i * 16} y2="88" />
          <line x1="10" y1={12 + i * 15.2} x2="90" y2={12 + i * 15.2} />
        </g>
      ))}
      <rect x="16" y="58" width="46" height="12" rx="6" fill="#8D93A8" />
      <rect x="64" y="60" width="12" height="26" rx="6" fill="#4B4A5C" />
      {misses.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.4" fill="#fff" />
      ))}
      <g stroke={COLORS.tomato} stroke-width="4" stroke-linecap="round">
        <line x1="66" y1="66" x2="74" y2="74" />
        <line x1="74" y1="66" x2="66" y2="74" />
        <line x1="24" y1="60" x2="32" y2="68" />
        <line x1="32" y1="60" x2="24" y2="68" />
      </g>
    </svg>
  );
}

function DotsArt() {
  const dots = [22, 50, 78];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="16" fill="#E6E0F4" />
      <rect x="10" y="10" width="80" height="80" rx="16" fill="#fff" />
      <rect x="25" y="25" width="22" height="22" rx="4" fill={COLORS.sky} opacity="0.35" />
      <text x="36" y="36" text-anchor="middle" dominant-baseline="central" font-family="Fredoka, sans-serif" font-weight="600" font-size="14" fill={COLORS.sky}>
        B
      </text>
      <g stroke-width="5" stroke-linecap="round">
        <path d="M22 22 H50 M22 22 V50 M50 22 V50 M22 50 H50" stroke={COLORS.sky} />
        <path d="M50 50 H78 M78 50 V78" stroke={COLORS.tomato} />
        <path d="M22 78 H50" stroke="#E6E0F4" />
      </g>
      {dots.map((y) => dots.map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill={INK} />))}
    </svg>
  );
}

function ReversiArt() {
  const discs: [number, number, 'dark' | 'light'][] = [
    [38, 38, 'light'],
    [62, 38, 'dark'],
    [38, 62, 'dark'],
    [62, 62, 'light'],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="16" fill={DARK.mint} />
      <rect x="10" y="10" width="80" height="80" rx="16" fill={COLORS.mint} />
      <path d="M26 10 V90 M50 10 V90 M74 10 V90 M10 26 H90 M10 50 H90 M10 74 H90" stroke="#FFF4DC" stroke-width="2" opacity="0.8" />
      {discs.map(([x, y, side]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y + 2} r="10" fill={side === 'dark' ? '#16151F' : COLORS.sky} />
          <circle cx={x} cy={y} r="10" fill={side === 'dark' ? INK : '#fff'} />
        </g>
      ))}
      {/* A disc mid-flip. */}
      <ellipse cx="74" cy="26" rx="4" ry="10" fill={INK} />
    </svg>
  );
}

function CheckersArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="12" width="76" height="76" rx="14" fill="#fff" stroke="#F1E3D8" stroke-width="2" />
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3].map((c) => ((r + c) % 2 ? <rect key={`${r}${c}`} x={12 + c * 19} y={12 + r * 19} width="19" height="19" fill="#FFBE96" /> : null)),
      )}
      <circle cx="40.5" cy="21.5" r="7" fill={COLORS.tomato} />
      <circle cx="78.5" cy="21.5" r="7" fill={COLORS.tomato} />
      <circle cx="21.5" cy="78.5" r="7" fill={INK} />
      <circle cx="59.5" cy="78.5" r="7" fill={INK} />
    </svg>
  );
}

function SolitaireArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="18" y="20" width="40" height="56" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(-10 38 48)" />
      <rect x="42" y="24" width="40" height="56" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(8 62 52)" />
      <path d="M62 44 l7 9 -7 9 -7 -9 z" fill={COLORS.tomato} transform="rotate(8 62 52)" />
    </svg>
  );
}


function FreeCellArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="12" width="17" height="23" rx="5" fill="#fff" stroke={COLORS.sky} stroke-width="2.5" />
      <rect x="31" y="12" width="17" height="23" rx="5" fill="#fff" stroke={COLORS.sky} stroke-width="2.5" />
      <rect x="55" y="12" width="17" height="23" rx="5" fill="#fff" stroke={COLORS.sky} stroke-width="2.5" />
      <rect x="76" y="12" width="17" height="23" rx="5" fill={COLORS.sky} />
      <path d="M84.5 18 l4.5 5.5 -4.5 5.5 -4.5 -5.5 z" fill="#fff" />
      <rect x="22" y="44" width="24" height="33" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text x="34" y="60" font-family="Fredoka, sans-serif" font-weight="600" font-size="15" text-anchor="middle" dominant-baseline="central" fill={COLORS.tomato}>
        9
      </text>
      <rect x="22" y="60" width="24" height="33" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text x="34" y="76" font-family="Fredoka, sans-serif" font-weight="600" font-size="15" text-anchor="middle" dominant-baseline="central" fill={INK}>
        8
      </text>
      <rect x="54" y="52" width="24" height="33" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text x="66" y="68" font-family="Fredoka, sans-serif" font-weight="600" font-size="15" text-anchor="middle" dominant-baseline="central" fill={COLORS.tomato}>
        K
      </text>
    </svg>
  );
}

function SpiderArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="9" y="16" width="20" height="28" rx="6" fill={DARK.mint} />
      <rect x="34" y="16" width="20" height="28" rx="6" fill={DARK.mint} />
      <rect x="59" y="16" width="20" height="28" rx="6" fill={DARK.mint} />
      <rect x="9" y="34" width="20" height="28" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <path d="M19 44 c-4 4 -6 6 -6 8 a3.2 3.2 0 0 0 6 1.6 a3.2 3.2 0 0 0 6 -1.6 c0 -2 -2 -4 -6 -8 z" fill={INK} />
      <rect x="34" y="34" width="20" height="28" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <path d="M44 44 c-4 4 -6 6 -6 8 a3.2 3.2 0 0 0 6 1.6 a3.2 3.2 0 0 0 6 -1.6 c0 -2 -2 -4 -6 -8 z" fill={COLORS.tomato} />
      <rect x="59" y="34" width="20" height="28" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <path d="M69 44 c-4 4 -6 6 -6 8 a3.2 3.2 0 0 0 6 1.6 a3.2 3.2 0 0 0 6 -1.6 c0 -2 -2 -4 -6 -8 z" fill={INK} />
      <rect x="66" y="68" width="24" height="24" rx="7" fill={COLORS.peach} />
      <path d="M72 80 h12 M78 74 v12" stroke="#fff" stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}

function PyramidArt() {
  const card = (x: number, y: number, label: string, red: boolean) => (
    <g>
      <rect x={x} y={y} width="22" height="30" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text
        x={x + 11}
        y={y + 15}
        font-family="Fredoka, sans-serif"
        font-weight="600"
        font-size="13"
        text-anchor="middle"
        dominant-baseline="central"
        fill={red ? COLORS.tomato : INK}
      >
        {label}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {card(39, 10, 'K', false)}
      {card(27, 33, '9', true)}
      {card(51, 33, '4', false)}
      {card(15, 56, '7', false)}
      {card(39, 56, '6', true)}
      {card(63, 56, 'A', true)}
      <circle cx="50" cy="88" r="10" fill={COLORS.bubblegum} />
      <text x="50" y="88" font-family="Fredoka, sans-serif" font-weight="600" font-size="11" text-anchor="middle" dominant-baseline="central" fill="#fff">
        13
      </text>
    </svg>
  );
}

function TriPeaksArt() {
  const peak = (x: number) => (
    <g>
      <rect x={x - 11} y="16" width="22" height="30" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <rect x={x - 22} y="34" width="22" height="30" rx="6" fill={DARK.mint} />
      <rect x={x} y="34" width="22" height="30" rx="6" fill={DARK.mint} />
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {peak(22)}
      {peak(50)}
      {peak(78)}
      <rect x="6" y="56" width="22" height="30" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <rect x="32" y="56" width="22" height="30" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <rect x="58" y="56" width="22" height="30" rx="6" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <g font-family="Fredoka, sans-serif" font-weight="600" font-size="14" text-anchor="middle" dominant-baseline="central">
        <text x="17" y="71" fill={INK}>
          8
        </text>
        <text x="43" y="71" fill={COLORS.tomato}>
          9
        </text>
        <text x="69" y="71" fill={INK}>
          10
        </text>
      </g>
    </svg>
  );
}

function CrazyEightsArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="14" y="30" width="34" height="46" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(-12 31 53)" />
      <rect x="34" y="26" width="34" height="46" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text x="51" y="49" font-family="Fredoka, sans-serif" font-weight="600" font-size="26" text-anchor="middle" dominant-baseline="central" fill={COLORS.grape}>
        8
      </text>
      <circle cx="74" cy="34" r="11" fill={COLORS.tomato} />
      <path d="M74 29 c-3 3 -5 5 -5 6.5 a2.6 2.6 0 0 0 5 1.3 a2.6 2.6 0 0 0 5 -1.3 c0 -1.5 -2 -3.5 -5 -6.5 z" fill="#fff" />
      <circle cx="74" cy="60" r="11" fill={COLORS.ink} />
      <path d="M74 55 l4.5 5.5 -4.5 5.5 -4.5 -5.5 z" fill="#fff" />
    </svg>
  );
}

function GoFishArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="20" width="26" height="36" rx="7" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <rect x="20" y="30" width="26" height="36" rx="7" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <rect x="30" y="40" width="26" height="36" rx="7" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text x="43" y="58" font-family="Fredoka, sans-serif" font-weight="600" font-size="18" text-anchor="middle" dominant-baseline="central" fill={COLORS.sky}>
        7
      </text>
      <path d="M64 46 c10 -9 22 -9 26 0 c-4 9 -16 9 -26 0 z" fill={COLORS.sky} />
      <path d="M90 46 l8 -7 v14 z" fill={COLORS.sky} />
      <circle cx="71" cy="45" r="2" fill="#fff" />
    </svg>
  );
}

function WarArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="16" width="34" height="46" rx="8" fill={COLORS.sky} transform="rotate(-8 27 39)" />
      <rect x="14" y="20" width="34" height="46" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text x="31" y="43" font-family="Fredoka, sans-serif" font-weight="600" font-size="20" text-anchor="middle" dominant-baseline="central" fill={INK}>
        A
      </text>
      <rect x="56" y="38" width="34" height="46" rx="8" fill={COLORS.tomato} transform="rotate(8 73 61)" />
      <rect x="52" y="34" width="34" height="46" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      <text x="69" y="57" font-family="Fredoka, sans-serif" font-weight="600" font-size="20" text-anchor="middle" dominant-baseline="central" fill={COLORS.tomato}>
        K
      </text>
    </svg>
  );
}

function OldMaidArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="28" width="28" height="40" rx="7" fill={DARK.grape} transform="rotate(-10 22 48)" />
      <rect x="26" y="24" width="28" height="40" rx="7" fill={DARK.grape} />
      <rect x="46" y="28" width="28" height="40" rx="7" fill={DARK.grape} transform="rotate(10 60 48)" />
      <rect x="62" y="34" width="30" height="42" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(14 77 55)" />
      <text
        x="77"
        y="53"
        font-family="Fredoka, sans-serif"
        font-weight="600"
        font-size="20"
        text-anchor="middle"
        dominant-baseline="central"
        fill={COLORS.bubblegum}
        transform="rotate(14 77 55)"
      >
        Q
      </text>
    </svg>
  );
}

function HeartsArt() {
  const heart = (x: number, y: number, size: number, fill: string) => (
    <path
      d={`M${x} ${y} c-${size} -${size * 0.9} -${size * 1.5} -${size * 1.6} -${size * 1.5} -${size * 2.4} a${size * 0.85} ${size * 0.85} 0 0 1 ${size * 1.5} -${size * 0.55} a${size * 0.85} ${size * 0.85} 0 0 1 ${size * 1.5} ${size * 0.55} c0 ${size * 0.8} -${size * 0.5} ${size * 1.5} -${size * 1.5} ${size * 2.4} z`}
      fill={fill}
    />
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="14" y="22" width="34" height="46" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(-9 31 45)" />
      {heart(31, 52, 9, COLORS.tomato)}
      <rect x="52" y="32" width="34" height="46" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(9 69 55)" />
      <text
        x="69"
        y="55"
        font-family="Fredoka, sans-serif"
        font-weight="600"
        font-size="22"
        text-anchor="middle"
        dominant-baseline="central"
        fill={INK}
        transform="rotate(9 69 55)"
      >
        Q
      </text>
      <path d="M69 68 l5 6 -5 6 -5 -6 z" fill={INK} transform="rotate(9 69 55)" />
    </svg>
  );
}

function SpadesArt() {
  const spade = (x: number, y: number, size: number, fill: string) => (
    <path
      d={`M${x} ${y - size * 2.2} c${size} ${size} ${size * 1.6} ${size * 1.5} ${size * 1.6} ${size * 2.3} a${size * 0.9} ${size * 0.9} 0 0 1 -${size * 1.6} ${size * 0.6} a${size * 0.9} ${size * 0.9} 0 0 1 -${size * 1.6} -${size * 0.6} c0 -${size * 0.8} ${size * 0.6} -${size * 1.3} ${size * 1.6} -${size * 2.3} z M${x - size * 0.5} ${y + size * 0.9} h${size} l-${size * 0.5} ${size * 0.9} z`}
      fill={fill}
    />
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="24" width="32" height="44" rx="8" fill={DARK.grape} transform="rotate(-8 26 46)" />
      <rect x="30" y="20" width="32" height="44" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      {spade(46, 44, 7, INK)}
      <rect x="56" y="36" width="32" height="44" rx="8" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(10 72 58)" />
      <text
        x="72"
        y="58"
        font-family="Fredoka, sans-serif"
        font-weight="600"
        font-size="22"
        text-anchor="middle"
        dominant-baseline="central"
        fill={COLORS.sky}
        transform="rotate(10 72 58)"
      >
        4
      </text>
    </svg>
  );
}

function CallbreakArt() {
  const spade = (x: number, y: number, size: number, fill: string) => (
    <path
      d={`M${x} ${y - size * 2.2} c${size} ${size} ${size * 1.6} ${size * 1.5} ${size * 1.6} ${size * 2.3} a${size * 0.9} ${size * 0.9} 0 0 1 -${size * 1.6} ${size * 0.6} a${size * 0.9} ${size * 0.9} 0 0 1 -${size * 1.6} -${size * 0.6} c0 -${size * 0.8} ${size * 0.6} -${size * 1.3} ${size * 1.6} -${size * 2.3} z M${x - size * 0.5} ${y + size * 0.9} h${size} l-${size * 0.5} ${size * 0.9} z`}
      fill={fill}
    />
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="16" y="18" width="34" height="46" rx="9" fill="#fff" stroke="#DCE9E1" stroke-width="2.5" transform="rotate(-12 33 41)" />
      {spade(33, 40, 7, DARK.mint)}
      <rect x="42" y="14" width="34" height="46" rx="9" fill="#fff" stroke="#DCE9E1" stroke-width="2.5" transform="rotate(8 59 37)" />
      {spade(59, 36, 7, INK)}
      <circle cx="62" cy="72" r="19" fill={COLORS.mint} />
      <text
        x="62"
        y="73"
        font-family="Fredoka, sans-serif"
        font-weight="600"
        font-size="22"
        text-anchor="middle"
        dominant-baseline="central"
        fill="#fff"
      >
        5
      </text>
    </svg>
  );
}

function GinRummyArt() {
  const pip = (x: number, y: number, fill: string) => <circle cx={x} cy={y} r="4.5" fill={fill} />;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="30" width="26" height="38" rx="7" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" transform="rotate(-10 21 49)" />
      {pip(21, 49, COLORS.grape)}
      <rect x="30" y="26" width="26" height="38" rx="7" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      {pip(43, 38, COLORS.grape)}
      {pip(43, 52, COLORS.grape)}
      <rect x="52" y="26" width="26" height="38" rx="7" fill="#fff" stroke="#E6E1F3" stroke-width="2.5" />
      {pip(65, 34, COLORS.grape)}
      {pip(65, 45, COLORS.grape)}
      {pip(65, 56, COLORS.grape)}
      <circle cx="72" cy="74" r="17" fill={COLORS.sunny} />
      <path d="M64 74 l6 6 l12 -13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function RummyArt() {
  const pip = (x: number, y: number, fill: string) => <circle cx={x} cy={y} r="4" fill={fill} />;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="22" width="24" height="34" rx="6" fill="#fff" stroke="#DCE9F0" stroke-width="2.5" />
      {pip(22, 39, COLORS.sky)}
      <rect x="30" y="22" width="24" height="34" rx="6" fill="#fff" stroke="#DCE9F0" stroke-width="2.5" />
      {pip(42, 33, COLORS.sky)}
      {pip(42, 45, COLORS.sky)}
      <rect x="50" y="22" width="24" height="34" rx="6" fill="#fff" stroke="#DCE9F0" stroke-width="2.5" />
      {pip(62, 31, COLORS.sky)}
      {pip(62, 39, COLORS.sky)}
      {pip(62, 47, COLORS.sky)}
      <rect x="24" y="58" width="24" height="34" rx="6" fill="#fff" stroke="#DCE9F0" stroke-width="2.5" transform="rotate(-6 36 75)" />
      {pip(36, 75, COLORS.tomato)}
      <rect x="52" y="58" width="24" height="34" rx="6" fill="#fff" stroke="#DCE9F0" stroke-width="2.5" transform="rotate(6 64 75)" />
      {pip(64, 69, COLORS.tomato)}
      {pip(64, 81, COLORS.tomato)}
    </svg>
  );
}

function SudokuArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="14" y="20" width="72" height="72" rx="12" fill={DARK.sky} />
      <rect x="14" y="14" width="72" height="72" rx="12" fill="#fff" stroke={COLORS.sky} stroke-width="3" />
      <path d="M38 16 V84 M62 16 V84 M16 38 H84 M16 62 H84" stroke={COLORS.sky} stroke-width="2.5" />
      <rect x="40.5" y="40.5" width="19" height="19" rx="4" fill={COLORS.sunny} />
      <g font-family="Fredoka, sans-serif" font-weight="600" font-size="16" text-anchor="middle" dominant-baseline="central" fill={INK}>
        <text x="26" y="26" dominant-baseline="central">1</text>
        <text x="50" y="50" dominant-baseline="central" fill={COLORS.grape}>5</text>
        <text x="74" y="74" dominant-baseline="central">9</text>
      </g>
    </svg>
  );
}

function ClassicSnakeArt() {
  const path = 'M24 70 H50 V40 H72';
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="16" fill={DARK.mint} />
      <rect x="10" y="10" width="80" height="80" rx="16" fill="#B3EFCC" />
      <path d={path} fill="none" stroke={DARK.sky} stroke-width="11" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 2)" />
      <path d={path} fill="none" stroke={COLORS.sky} stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="72" cy="40" r="8" fill={COLORS.sky} />
      <circle cx="74" cy="37" r="2.6" fill="#fff" />
      <circle cx="74" cy="43" r="2.6" fill="#fff" />
      <circle cx="75" cy="37" r="1.3" fill={INK} />
      <circle cx="75" cy="43" r="1.3" fill={INK} />
      <circle cx="68" cy="68" r="6" fill={COLORS.tomato} />
      <ellipse cx="71" cy="61" rx="4" ry="2" fill={COLORS.mint} />
    </svg>
  );
}

function EchoArt() {
  const pads: [number, number, string, string][] = [
    [50, 24, COLORS.tomato, DARK.tomato],
    [76, 50, COLORS.sky, DARK.sky],
    [50, 76, COLORS.sunny, DARK.sunny],
    [24, 50, COLORS.mint, DARK.mint],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#F1EDFA" />
      {pads.map(([x, y, color, dark]) => (
        <g key={color}>
          <circle cx={x} cy={y + 2.5} r="17" fill={dark} />
          <circle cx={x} cy={y} r="17" fill={color} />
        </g>
      ))}
      <circle cx="50" cy="24" r="17" fill="#fff" opacity="0.45" />
      <circle cx="50" cy="50" r="10" fill="#fff" stroke="#E6E0F4" stroke-width="2.5" />
    </svg>
  );
}

function ColorSortArt() {
  const tubes: string[][] = [
    [COLORS.sky, COLORS.tomato, COLORS.sky],
    [COLORS.tomato, COLORS.sky, COLORS.tomato, COLORS.sunny],
    [COLORS.sunny, COLORS.sunny],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {tubes.map((layers, t) => {
        const x = 16 + t * 26;
        return (
          <g key={t}>
            <rect x={x} y="16" width="18" height="70" rx="9" fill="#fff" stroke="#CFC6EC" stroke-width="3" />
            {layers.map((color, k) => (
              <rect key={k} x={x + 3} y={69 - k * 16} width="12" height="14" rx={k === 0 ? 6 : 3} fill={color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function SlidingArt() {
  const rowColor = [COLORS.tomato, COLORS.peach, COLORS.sunny];
  const tiles = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="14" fill="#E6E0F4" />
      <rect x="10" y="10" width="80" height="80" rx="14" fill="#fff" />
      {tiles.map((tile, i) => {
        const x = 15 + (i % 3) * 24;
        const y = 15 + Math.floor(i / 3) * 24;
        const color = rowColor[Math.floor(i / 3)]!;
        return (
          <g key={tile}>
            <rect x={x} y={y} width="22" height="22" rx="6" fill={color} />
            <text x={x + 11} y={y + 11} text-anchor="middle" dominant-baseline="central" font-family="Fredoka, sans-serif" font-weight="600" font-size="12" fill={i >= 6 ? INK : '#fff'}>
              {tile}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MemoryArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {[
        [14, 14, 'back'],
        [52, 14, 'heart'],
        [14, 52, 'heart'],
        [52, 52, 'back'],
      ].map(([x, y, kind]) => (
        <g key={`${x}-${y}`}>
          <rect x={x as number} y={(y as number) + 4} width="34" height="34" rx="8" fill={kind === 'back' ? DARK.bubblegum : '#E6E0F4'} />
          <rect x={x as number} y={y as number} width="34" height="34" rx="8" fill={kind === 'back' ? COLORS.bubblegum : '#fff'} />
          {kind === 'back' ? (
            <rect x={(x as number) + 6} y={(y as number) + 6} width="22" height="22" rx="5" fill="none" stroke="#fff" stroke-width="2.5" />
          ) : (
            <path
              d={`M${(x as number) + 17} ${(y as number) + 27} l-9 -9 a5 5 0 0 1 9 -6 a5 5 0 0 1 9 6 z`}
              fill={COLORS.tomato}
            />
          )}
        </g>
      ))}
    </svg>
  );
}

function PingPongArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="22" y="14" width="56" height="74" rx="8" fill={DARK.sky} />
      <rect x="22" y="10" width="56" height="74" rx="8" fill={COLORS.sky} />
      <rect x="25" y="13" width="50" height="68" rx="6" fill="none" stroke="#fff" stroke-width="2.5" />
      <line x1="50" y1="14" x2="50" y2="80" stroke="#fff" stroke-width="1.5" />
      <rect x="16" y="44" width="68" height="6" rx="2" fill="#F4F1FF" stroke={INK} stroke-width="1.5" />
      <ellipse cx="62" cy="32" rx="4" ry="2.5" fill={INK} opacity="0.2" />
      <circle cx="62" cy="25" r="4.5" fill="#fff" stroke="#FFE9B8" stroke-width="1.5" />
      <circle cx="34" cy="88" r="9" fill={COLORS.sky} stroke="#fff" stroke-width="2" />
      <circle cx="66" cy="8" r="7" fill={COLORS.tomato} stroke="#fff" stroke-width="2" />
    </svg>
  );
}

function TugOfWarArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="47" y="18" width="6" height="64" rx="3" fill="#D9A86C" />
      <circle cx="50" cy="56" r="6" fill={COLORS.sunny} stroke="#fff" stroke-width="2" />
      <rect x="34" y="4" width="32" height="22" rx="11" fill={COLORS.tomato} />
      <circle cx="44" cy="15" r="2.2" fill={INK} />
      <circle cx="56" cy="15" r="2.2" fill={INK} />
      <rect x="34" y="74" width="32" height="22" rx="11" fill={COLORS.sky} />
      <circle cx="44" cy="85" r="2.2" fill={INK} />
      <circle cx="56" cy="85" r="2.2" fill={INK} />
    </svg>
  );
}

function ReflexArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="54" r="34" fill={DARK.mint} />
      <circle cx="50" cy="50" r="34" fill={COLORS.mint} />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-width="4" />
      <path d="M54 26 L38 54 L50 54 L45 74 L63 44 L51 44 Z" fill="#fff" />
    </svg>
  );
}

function SumoArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="53" r="42" fill="#E9B98B" />
      <circle cx="50" cy="50" r="42" fill="#F6D2AD" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#D6B273" stroke-width="5" />
      <circle cx="40" cy="60" r="14" fill="#FFE0C2" stroke={COLORS.sky} stroke-width="4" />
      <circle cx="36" cy="58" r="1.8" fill={INK} />
      <circle cx="44" cy="58" r="1.8" fill={INK} />
      <circle cx="60" cy="40" r="14" fill="#FFE0C2" stroke={COLORS.tomato} stroke-width="4" />
      <circle cx="56" cy="38" r="1.8" fill={INK} />
      <circle cx="64" cy="38" r="1.8" fill={INK} />
    </svg>
  );
}

function PenaltyArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="8" width="84" height="84" rx="14" fill="#5FD684" />
      <rect x="8" y="50" width="84" height="20" fill="#4ECB74" />
      <rect x="20" y="14" width="60" height="16" rx="3" fill="#F4F1FF" stroke="#fff" stroke-width="3" />
      <path d="M26 14 V30 M34 14 V30 M42 14 V30 M50 14 V30 M58 14 V30 M66 14 V30 M74 14 V30" stroke="#C9C2E6" stroke-width="1" />
      <circle cx="44" cy="34" r="8" fill={COLORS.tomato} />
      <circle cx="33" cy="32" r="4" fill="#fff" />
      <circle cx="55" cy="32" r="4" fill="#fff" />
      <ellipse cx="62" cy="68" rx="6" ry="3" fill={INK} opacity="0.2" />
      <circle cx="62" cy="62" r="6.5" fill="#fff" stroke="#D9D3EA" stroke-width="1.5" />
      <circle cx="62" cy="62" r="2" fill={INK} />
      <circle cx="50" cy="82" r="9" fill={COLORS.sky} />
    </svg>
  );
}

function SnakeArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="16" fill={DARK.mint} />
      <rect x="10" y="10" width="80" height="80" rx="16" fill="#B3EFCC" />
      <path d="M24 74 H48 V56 H70" fill="none" stroke={COLORS.sky} stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="70" cy="56" r="8" fill={COLORS.sky} />
      <circle cx="73" cy="53" r="2.2" fill={INK} />
      <path d="M76 26 H54 V40 H34" fill="none" stroke={COLORS.tomato} stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="34" cy="40" r="8" fill={COLORS.tomato} />
      <circle cx="31" cy="43" r="2.2" fill={INK} />
      <circle cx="62" cy="76" r="6" fill={COLORS.tomato} />
      <ellipse cx="66" cy="70" rx="4" ry="2" fill={COLORS.mint} />
    </svg>
  );
}

function Twenty48Art() {
  const cells: [number, number, string, string][] = [
    [0, 0, '2', '#FFF4E0'],
    [1, 0, '4', '#FFE3C4'],
    [0, 1, '8', COLORS.peach],
    [1, 1, '16', COLORS.tomato],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="16" fill="#E7E1F5" />
      <rect x="10" y="10" width="80" height="80" rx="16" fill="#F3EFFB" />
      {cells.map(([cx, cy, label, fill]) => (
        <g key={label}>
          <rect x={16 + cx * 36} y={16 + cy * 36} width="32" height="32" rx="8" fill={fill} />
          <text
            x={32 + cx * 36}
            y={32 + cy * 36}
            text-anchor="middle"
            dominant-baseline="central"
            font-family="Fredoka, sans-serif"
            font-weight="600"
            font-size={label.length > 1 ? 13 : 17}
            fill={label === '2' || label === '4' ? INK : '#fff'}
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const ART: Record<string, () => JSX.Element> = {
  '2048': Twenty48Art,
  sumo: SumoArt,
  'snake-battle': SnakeArt,
  'penalty-kicks': PenaltyArt,
  'ping-pong': PingPongArt,
  'tug-of-war': TugOfWarArt,
  'reflex-race': ReflexArt,
  'tic-tac-toe': TicTacToeArt,
  'four-in-a-row': FourInARowArt,
  ludo: LudoArt,
  'air-hockey': AirHockeyArt,
  checkers: CheckersArt,
  chess: ChessArt,
  backgammon: BackgammonArt,
  'sea-battle': SeaBattleArt,
  solitaire: SolitaireArt,
  freecell: FreeCellArt,
  spider: SpiderArt,
  pyramid: PyramidArt,
  'crazy-eights': CrazyEightsArt,
  'go-fish': GoFishArt,
  war: WarArt,
  'old-maid': OldMaidArt,
  hearts: HeartsArt,
  spades: SpadesArt,
  callbreak: CallbreakArt,
  'gin-rummy': GinRummyArt,
  rummy: RummyArt,
  tripeaks: TriPeaksArt,
  sudoku: SudokuArt,
  'sliding-puzzle': SlidingArt,
  'color-sort': ColorSortArt,
  echo: EchoArt,
  'classic-snake': ClassicSnakeArt,
  reversi: ReversiArt,
  'dots-and-boxes': DotsArt,
  mancala: MancalaArt,
  'snakes-and-ladders': SnakesArt,
  'ultimate-ttt': UltimateArt,
  yatzy: YatzyArt,
  'shut-the-box': ShutArt,
  dominoes: DominoArt,
  memory: MemoryArt,
};

export function GameArt({ id }: { id: string }) {
  const Art = ART[id];
  return Art ? <Art /> : <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="30" fill={COLORS.grape} /></svg>;
}

/* ---------- Characters ---------- */

function Blob({ color, children }: { color: string; children: ComponentChildren }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="76" rx="36" fill={color} />
      <circle cx="27" cy="62" r="6" fill={COLORS.bubblegum} opacity="0.55" />
      <circle cx="73" cy="62" r="6" fill={COLORS.bubblegum} opacity="0.55" />
      {children}
    </svg>
  );
}

const BOT_COLORS: Record<BotTier, string> = {
  easy: COLORS.mint,
  medium: COLORS.sky,
  hard: COLORS.peach,
  expert: COLORS.grape,
};

/** Pip (easy, sleepy), Bo (medium, cheerful), Zed (hard, cool), Nova (expert, clever). */
export function BotFace({ tier }: { tier: BotTier }) {
  const color = BOT_COLORS[tier];
  if (tier === 'easy') {
    return (
      <Blob color={color}>
        <path d="M31 50 Q38 56 45 50 M55 50 Q62 56 69 50" stroke={INK} stroke-width="4" fill="none" {...round} />
        <circle cx="50" cy="66" r="3.5" fill={INK} />
        <text x="76" y="30" font-family="Fredoka, sans-serif" font-weight="600" font-size="16" fill={INK}>z</text>
      </Blob>
    );
  }
  if (tier === 'medium') {
    return (
      <Blob color={color}>
        <circle cx="38" cy="50" r="5" fill={INK} />
        <circle cx="62" cy="50" r="5" fill={INK} />
        <path d="M40 63 Q50 72 60 63" stroke={INK} stroke-width="4" fill="none" {...round} />
      </Blob>
    );
  }
  if (tier === 'hard') {
    return (
      <Blob color={color}>
        <rect x="25" y="42" width="50" height="13" rx="6.5" fill={INK} />
        <rect x="31" y="45" width="10" height="3" rx="1.5" fill="#fff" opacity="0.7" />
        <path d="M42 67 Q54 71 62 62" stroke={INK} stroke-width="4" fill="none" {...round} />
      </Blob>
    );
  }
  return (
    <Blob color={color}>
      <line x1="50" y1="14" x2="50" y2="5" stroke={INK} stroke-width="3" {...round} />
      <circle cx="50" cy="5" r="4.5" fill={COLORS.sunny} />
      <circle cx="37" cy="50" r="10" fill="#fff" stroke={INK} stroke-width="3" />
      <circle cx="63" cy="50" r="10" fill="#fff" stroke={INK} stroke-width="3" />
      <line x1="47" y1="50" x2="53" y2="50" stroke={INK} stroke-width="3" />
      <circle cx="38" cy="51" r="3.5" fill={INK} />
      <circle cx="64" cy="51" r="3.5" fill={INK} />
      <path d="M42 67 Q50 73 58 67" stroke={INK} stroke-width="4" fill="none" {...round} />
    </Blob>
  );
}

/** A person at the table, wearing their side's color. */
export function PersonFace({ color }: { color: string }) {
  return (
    <Blob color={color}>
      <circle cx="38" cy="49" r="5" fill={INK} />
      <circle cx="62" cy="49" r="5" fill={INK} />
      <path d="M38 60 Q50 76 62 60 Z" fill={INK} />
      <path d="M44 66 Q50 71 56 66" fill={COLORS.tomato} />
    </Blob>
  );
}

/** The Game Pals mascot. */
export function Mascot() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="16" width="80" height="74" rx="36" fill={COLORS.grape} />
      <rect x="30" y="4" width="14" height="20" rx="7" fill={COLORS.grape} transform="rotate(-18 37 14)" />
      <rect x="56" y="4" width="14" height="20" rx="7" fill={COLORS.grape} transform="rotate(18 63 14)" />
      <circle cx="27" cy="62" r="6" fill={COLORS.bubblegum} opacity="0.6" />
      <circle cx="73" cy="62" r="6" fill={COLORS.bubblegum} opacity="0.6" />
      <circle cx="38" cy="50" r="5.5" fill={INK} />
      <circle cx="62" cy="50" r="5.5" fill={INK} />
      <circle cx="40" cy="48" r="1.8" fill="#fff" />
      <circle cx="64" cy="48" r="1.8" fill="#fff" />
      <path d="M41 63 Q50 72 59 63" stroke={INK} stroke-width="4" fill="none" {...round} />
    </svg>
  );
}

/* ---------- Icons ---------- */

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, ...round, 'aria-hidden': true } as const;

export function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg {...iconProps}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      {on ? <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  );
}

export function VibrateIcon({ on }: { on: boolean }) {
  return (
    <svg {...iconProps}>
      <rect x="8" y="4" width="8" height="16" rx="2.5" />
      {on ? <path d="M4.5 9v6M19.5 9v6M2 11v2M22 11v2" /> : <path d="M4 4l16 16" />}
    </svg>
  );
}

/** Two swatches: the flat look and the games room, for the button that swaps them. */
export function LookIcon({ room }: { room: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="9" height="14" rx="3" fill={room ? '#1f5a43' : COLORS.grape} />
      <rect x="12" y="5" width="9" height="14" rx="3" fill={room ? '#d8a94a' : COLORS.sunny} />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14.5 6l-6 6 6 6" />
    </svg>
  );
}
