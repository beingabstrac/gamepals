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

function WordGuessArt() {
  const tile = (x: number, fill: string, letter: string, ink: string) => (
    <g key={x}>
      <rect x={x} y="34" width="26" height="32" rx="7" fill={fill} stroke={fill === '#fff' ? '#E6E1F3' : fill} stroke-width="2.5" />
      <text
        x={x + 13}
        y="51"
        font-family="Fredoka, sans-serif"
        font-weight="600"
        font-size="18"
        text-anchor="middle"
        dominant-baseline="central"
        fill={ink}
      >
        {letter}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {tile(8, COLORS.mint, 'W', '#fff')}
      {tile(38, '#fff', 'O', INK)}
      {tile(68, COLORS.sunny, 'D', '#fff')}
      <rect x="8" y="72" width="26" height="8" rx="4" fill="#E6E1F3" />
      <rect x="38" y="72" width="26" height="8" rx="4" fill="#E6E1F3" />
      <rect x="68" y="72" width="26" height="8" rx="4" fill="#E6E1F3" />
      <rect x="8" y="20" width="86" height="8" rx="4" fill="#E6E1F3" />
    </svg>
  );
}

function WordSearchArt() {
  const letters = ['S', 'C', 'A', 'N', 'W', 'O', 'R', 'D', 'T', 'E', 'H', 'M', 'P', 'I', 'L', 'K'];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="20" width="76" height="70" rx="12" fill="#E3DEF0" />
      <rect x="12" y="14" width="76" height="70" rx="12" fill="#fff" stroke="#E6E1F3" stroke-width="3" />
      <rect x="19" y="39" width="62" height="14" rx="7" fill={COLORS.mint} opacity="0.35" />
      {letters.map((letter, i) => (
        <text
          key={letter + i}
          x={26 + (i % 4) * 16}
          y={27 + Math.floor(i / 4) * 16}
          font-family="Fredoka, sans-serif"
          font-weight="600"
          font-size="13"
          text-anchor="middle"
          dominant-baseline="central"
          fill={i >= 4 && i <= 7 ? DARK.mint : INK}
        >
          {letter}
        </text>
      ))}
    </svg>
  );
}

function CrosswordArt() {
  const blocks = new Set(['0,0', '0,1', '1,0', '3,3', '3,4', '4,3', '4,4']);
  const cells = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const block = blocks.has(`${r},${c}`);
      cells.push(
        <rect
          key={`${r},${c}`}
          x={14 + c * 14.4}
          y={14 + r * 14.4}
          width="13"
          height="13"
          rx="3"
          fill={block ? INK : '#fff'}
          stroke={block ? INK : '#E6E1F3'}
          stroke-width="2"
        />,
      );
    }
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="16" width="80" height="80" rx="12" fill="#E3DEF0" />
      <rect x="10" y="10" width="80" height="80" rx="12" fill="#fff" stroke="#E6E1F3" stroke-width="3" />
      {cells}
      <text x="49.5" y="49.5" font-family="Fredoka, sans-serif" font-weight="600" font-size="11" text-anchor="middle" dominant-baseline="central" fill={DARK.sky}>
        C
      </text>
      <text x="63.9" y="49.5" font-family="Fredoka, sans-serif" font-weight="600" font-size="11" text-anchor="middle" dominant-baseline="central" fill={DARK.sky}>
        R
      </text>
    </svg>
  );
}

function WordLadderArt() {
  const rows = [
    { word: 'CAT', fill: COLORS.grape, ink: '#fff' },
    { word: 'COT', fill: COLORS.grape, ink: '#fff' },
    { word: 'COG', fill: '#fff', ink: INK },
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {rows.map((row, r) =>
        [...row.word].map((letter, i) => (
          <g key={`${r}${i}`}>
            <rect
              x={18 + i * 23}
              y={20 + r * 23}
              width="19"
              height="19"
              rx="5"
              fill={row.fill}
              stroke={row.fill === '#fff' ? '#E6E1F3' : row.fill}
              stroke-width="2.5"
            />
            <text
              x={27.5 + i * 23}
              y={29.5 + r * 23}
              font-family="Fredoka, sans-serif"
              font-weight="600"
              font-size="12"
              text-anchor="middle"
              dominant-baseline="central"
              fill={row.ink}
            >
              {letter}
            </text>
          </g>
        )),
      )}
    </svg>
  );
}

function WordGroupsArt() {
  const fills = [COLORS.sunny, COLORS.mint, COLORS.sky, '#fff'];
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells.push(
        <rect
          key={`${r}${c}`}
          x={14 + c * 19}
          y={20 + r * 17}
          width="16"
          height="14"
          rx="4"
          fill={fills[r]}
          stroke={fills[r] === '#fff' ? '#E6E1F3' : fills[r]}
          stroke-width="2"
        />,
      );
    }
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="20" width="84" height="76" rx="12" fill="#E3DEF0" />
      <rect x="8" y="14" width="84" height="76" rx="12" fill="#fff" stroke="#E6E1F3" stroke-width="3" />
      {cells}
    </svg>
  );
}

function AnagramHuntArt() {
  const letters = ['A', 'N', 'G', 'R', 'M', 'A', 'S'];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {letters.map((letter, i) => {
        const angle = (i / letters.length) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 28;
        const y = 52 + Math.sin(angle) * 28;
        return (
          <g key={letter + i}>
            <rect x={x - 10} y={y - 8} width="20" height="19" rx="6" fill={DARK.peach} />
            <rect x={x - 10} y={y - 10} width="20" height="19" rx="6" fill={COLORS.peach} />
            <text
              x={x}
              y={y}
              font-family="Fredoka, sans-serif"
              font-weight="600"
              font-size="13"
              text-anchor="middle"
              dominant-baseline="central"
              fill="#fff"
            >
              {letter}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TargetNumberArt() {
  const tiles = [
    { label: '75', x: 14, y: 46 },
    { label: '6', x: 41, y: 46 },
    { label: '4', x: 68, y: 46 },
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="20" y="16" width="60" height="24" rx="10" fill={DARK.sky} />
      <rect x="20" y="12" width="60" height="24" rx="10" fill={COLORS.sky} />
      <text x="50" y="24" font-family="Fredoka, sans-serif" font-weight="600" font-size="15" text-anchor="middle" dominant-baseline="central" fill="#fff">
        454
      </text>
      {tiles.map((tile) => (
        <g key={tile.label}>
          <rect x={tile.x} y={tile.y + 3} width="22" height="22" rx="7" fill="#E6E1F3" />
          <rect x={tile.x} y={tile.y} width="22" height="22" rx="7" fill="#fff" stroke="#E6E1F3" stroke-width="2" />
          <text x={tile.x + 11} y={tile.y + 11} font-family="Fredoka, sans-serif" font-weight="600" font-size="12" text-anchor="middle" dominant-baseline="central" fill={INK}>
            {tile.label}
          </text>
        </g>
      ))}
      <text x="50" y="84" font-family="Fredoka, sans-serif" font-weight="600" font-size="16" text-anchor="middle" dominant-baseline="central" fill={COLORS.sunny}>
        + − × ÷
      </text>
    </svg>
  );
}

function QuickMathsArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="12" width="80" height="34" rx="12" fill="#CFE4FF" />
      <rect x="10" y="54" width="80" height="34" rx="12" fill="#FFD6D6" />
      <text x="50" y="29" font-family="Fredoka, sans-serif" font-weight="600" font-size="18" text-anchor="middle" dominant-baseline="central" fill={INK}>
        7 × 8
      </text>
      <text x="50" y="71" font-family="Fredoka, sans-serif" font-weight="600" font-size="18" text-anchor="middle" dominant-baseline="central" fill={INK} transform="rotate(180 50 71)">
        7 × 8
      </text>
      <circle cx="24" cy="50" r="7" fill={COLORS.sky} />
      <circle cx="76" cy="50" r="7" fill={COLORS.tomato} />
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

function FloodArt() {
  // The flooded corner is one flat patch with its star; the rest are raised tiles still to take.
  const grid = ['ssspg', 'sstmg', 'smttp', 'gpmsm', 'tgpmt'];
  const fill: Record<string, string> = { s: COLORS.sky, t: COLORS.tomato, m: COLORS.mint, p: COLORS.bubblegum, g: COLORS.sunny };
  const lip: Record<string, string> = { s: DARK.sky, t: DARK.tomato, m: DARK.mint, p: DARK.bubblegum, g: DARK.sunny };
  const owned = new Set([0, 1, 2, 5, 6, 10]);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="14" fill="#E6E0F4" />
      <rect x="10" y="10" width="80" height="80" rx="14" fill="#fff" />
      {grid
        .join('')
        .split('')
        .map((key, i) => {
          const x = 14 + (i % 5) * 14.6;
          const y = 14 + Math.floor(i / 5) * 14.6;
          if (owned.has(i)) return <rect key={i} x={x - 0.4} y={y - 0.4} width="14.6" height="14.6" rx="3" fill={fill[key]} />;
          return (
            <g key={i}>
              <rect x={x} y={y + 1.6} width="13.2" height="12.4" rx="3.5" fill={lip[key]} />
              <rect x={x} y={y} width="13.2" height="12.2" rx="3.5" fill={fill[key]} />
            </g>
          );
        })}
      <path d="M 21 15.5 L 22.6 19.4 L 26.8 19.6 L 23.5 22.2 L 24.7 26.3 L 21 23.9 L 17.3 26.3 L 18.5 22.2 L 15.2 19.6 L 19.4 19.4 Z" fill="#fff" />
    </svg>
  );
}

function TileMatchArt() {
  // A small pile with a cherry on top, and two cherries already waiting in the tray for the third.
  const tile = (x: number, y: number, dim = false) => (
    <g>
      <rect x={x} y={y + 3} width="24" height="26" rx="6" fill="#D9D2EC" />
      <rect x={x} y={y} width="24" height="26" rx="6" fill={COLORS.paper} stroke="#ECE8F5" stroke-width="1.5" />
      {dim && <rect x={x} y={y} width="24" height="29" rx="6" fill={INK} opacity="0.3" />}
    </g>
  );
  const cherry = (x: number, y: number, s = 1) => (
    <g>
      <path d={`M ${x - 3 * s} ${y + 1 * s} L ${x + 1 * s} ${y - 7 * s} L ${x + 4 * s} ${y + 1 * s}`} stroke={DARK.mint} stroke-width={1.6 * s} fill="none" />
      <circle cx={x - 3.4 * s} cy={y + 3 * s} r={3.6 * s} fill={COLORS.tomato} />
      <circle cx={x + 3.8 * s} cy={y + 3.6 * s} r={3.6 * s} fill={COLORS.tomato} />
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {tile(18, 14, true)}
      {tile(46, 14, true)}
      {tile(32, 22)}
      {cherry(44, 33)}
      <circle cx="30" cy="27" r="5" fill={COLORS.sunny} opacity="0.5" />
      <circle cx="67" cy="27" r="5" fill={COLORS.sky} opacity="0.5" />
      <rect x="8" y="62" width="84" height="30" rx="12" fill="#E6E0F4" />
      <rect x="8" y="60" width="84" height="30" rx="12" fill="#fff" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={13 + i * 19.5} y="64" width="17" height="22" rx="5" fill={i < 2 ? COLORS.paper : '#F4F1FB'} stroke={i < 2 ? '#ECE8F5' : 'none'} />
      ))}
      {cherry(21.5, 74, 0.7)}
      {cherry(41, 74, 0.7)}
    </svg>
  );
}

function JigsawArt() {
  // Four pieces of a sunny picture, three in and the last one on its way.
  const piece = (dx: number, dy: number) => (
    <path
      transform={`translate(${dx} ${dy})`}
      d="M0 0 H14 C14 -6 22 -6 22 0 H36 V14 C42 14 42 22 36 22 V36 H22 C22 30 14 30 14 36 H0 V22 C6 22 6 14 0 14 Z"
      fill={COLORS.sky}
      stroke="#fff"
      stroke-width="2.5"
    />
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="16" width="76" height="76" rx="14" fill="#E6E0F4" />
      <rect x="12" y="12" width="76" height="76" rx="14" fill="#fff" />
      <rect x="16" y="16" width="68" height="68" rx="8" fill="#F4F1FB" />
      <circle cx="34" cy="34" r="12" fill={COLORS.sunny} />
      <path d="M16 64 Q40 50 66 62 T84 58 V84 H16 Z" fill={COLORS.mint} />
      <g opacity="0.9">{piece(52, 18)}</g>
      <g transform="rotate(-12 70 70)">
        {piece(56, 56)}
        <circle cx="74" cy="74" r="6" fill={COLORS.tomato} />
      </g>
    </svg>
  );
}

function PoolArt() {
  // A corner of green cloth: the cue ball rolling at a short rack.
  const balls: [number, number, string, boolean][] = [
    [62, 30, COLORS.sunny, false],
    [54, 44, COLORS.tomato, true],
    [70, 44, INK, false],
    [46, 58, COLORS.sky, false],
    [62, 58, COLORS.grape, true],
    [78, 58, COLORS.bubblegum, false],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="12" width="84" height="84" rx="16" fill={DARK.peach} />
      <rect x="8" y="8" width="84" height="84" rx="16" fill={COLORS.peach} />
      <rect x="16" y="16" width="68" height="68" rx="6" fill={DARK.mint} />
      <circle cx="18" cy="18" r="6" fill={INK} />
      <circle cx="82" cy="18" r="6" fill={INK} />
      {balls.map(([x, y, color, stripe], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="7.5" fill={stripe ? '#fff' : color} />
          {stripe && <rect x={x - 7.5} y={y - 3.5} width="15" height="7" fill={color} />}
          <circle cx={x} cy={y} r="3" fill="#fff" />
        </g>
      ))}
      <path d="M34 80 L54 64" stroke="#fff" stroke-width="2" stroke-dasharray="3 3" />
      <circle cx="30" cy="84" r="7.5" fill="#fff" />
      <path d="M8 104 L24 90" stroke="#C98A4B" stroke-width="5" stroke-linecap="round" />
    </svg>
  );
}

function MiniGolfArt() {
  // A dogleg green with its rail, a ball on the tee and the flag at the far end.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M18 90 V22 H84 V52 H48 V90 Z" fill={COLORS.mint} stroke={DARK.peach} stroke-width="9" stroke-linejoin="round" />
      <path d="M18 90 V22 H84 V52 H48 V90 Z" fill={COLORS.mint} stroke={COLORS.peach} stroke-width="5" stroke-linejoin="round" />
      <circle cx="72" cy="37" r="5" fill={INK} />
      <path d="M72 37 V18" stroke={INK} stroke-width="2.5" />
      <path d="M72 18 L84 22 L72 26 Z" fill={COLORS.tomato} />
      <path d="M33 74 Q30 52 44 40" stroke="#fff" stroke-width="2.5" stroke-dasharray="1 5" stroke-linecap="round" fill="none" />
      <circle cx="33" cy="80" r="5.5" fill="#fff" stroke={COLORS.tomato} stroke-width="2" />
    </svg>
  );
}

function ArcheryArt() {
  // The face, and an arrow just in the gold.
  const rings = ['#fff', INK, COLORS.sky, COLORS.tomato, COLORS.sunny];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="54" r="40" fill={DARK.peach} />
      <circle cx="50" cy="50" r="40" fill={COLORS.peach} />
      {rings.map((color, i) => (
        <circle key={i} cx="50" cy="50" r={34 - i * 6.6} fill={color} stroke={i === 0 ? '#E6E0F4' : 'none'} stroke-width="1.5" />
      ))}
      <path d="M53 47 L80 20" stroke={INK} stroke-width="3" stroke-linecap="round" />
      <path d="M80 20 L78 11 L84 14 Z M80 20 L89 22 L86 16 Z" fill={COLORS.sky} />
      <circle cx="53" cy="47" r="2.5" fill={INK} />
    </svg>
  );
}

function SpinnerArt() {
  // Two tops in the bowl, just meeting, with a spark between them.
  const top = (x: number, y: number, color: string, dark: string) => (
    <g>
      <ellipse cx={x + 2} cy={y + 4} rx="15" ry="13" fill={INK} opacity="0.15" />
      <circle cx={x} cy={y} r="14" fill={dark} />
      <path d={`M${x} ${y - 14} L${x + 6} ${y} L${x - 6} ${y} Z M${x + 14} ${y} L${x} ${y + 6} L${x} ${y - 6} Z M${x} ${y + 14} L${x - 6} ${y} L${x + 6} ${y} Z M${x - 14} ${y} L${x} ${y - 6} L${x} ${y + 6} Z`} fill={color} />
      <circle cx={x} cy={y} r="5" fill="#fff" />
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="54" r="42" fill={DARK.grape} />
      <circle cx="50" cy="50" r="42" fill={COLORS.grape} />
      <circle cx="50" cy="50" r="36" fill="#F4F1FB" />
      <circle cx="50" cy="50" r="24" fill="#E3DBF4" />
      {top(34, 58, COLORS.sky, DARK.sky)}
      {top(64, 42, COLORS.tomato, DARK.tomato)}
      <path d="M49 44 L52 50 L47 51 L50 57" stroke={COLORS.sunny} stroke-width="3" fill="none" stroke-linejoin="round" />
    </svg>
  );
}

function RacingArt() {
  // A bend of road on the grass, two cars neck and neck.
  const car = (x: number, y: number, color: string, dark: string, turn: number) => (
    <g transform={`rotate(${turn} ${x} ${y})`}>
      <rect x={x - 11} y={y - 6} width="22" height="12" rx="5" fill={dark} />
      <rect x={x - 10} y={y - 6} width="20" height="10" rx="4" fill={color} />
      <rect x={x + 1} y={y - 4} width="5" height="6" rx="1.5" fill="#fff" />
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="18" fill={COLORS.mint} />
      <path d="M-4 78 Q50 80 64 50 Q74 26 104 22" stroke="#fff" stroke-width="30" fill="none" />
      <path d="M-4 78 Q50 80 64 50 Q74 26 104 22" stroke={COLORS.soft} stroke-width="24" fill="none" />
      <path d="M-4 78 Q50 80 64 50 Q74 26 104 22" stroke="#fff" stroke-width="2" stroke-dasharray="5 6" fill="none" />
      {car(34, 72, COLORS.sky, DARK.sky, -10)}
      {car(52, 62, COLORS.tomato, DARK.tomato, -38)}
    </svg>
  );
}

function SwordArt() {
  // Two fencers on the strip, one lunging, blades crossing.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="30" y="6" width="40" height="92" rx="10" fill={DARK.peach} />
      <rect x="30" y="4" width="40" height="92" rx="10" fill={COLORS.peach} />
      <rect x="36" y="9" width="28" height="82" rx="6" fill="#F4F1FB" />
      <path d="M44 66 L60 30" stroke="#D9D2EC" stroke-width="3.5" stroke-linecap="round" />
      <path d="M56 34 L44 46" stroke="#D9D2EC" stroke-width="3.5" stroke-linecap="round" />
      <circle cx="46" cy="74" r="9" fill="#fff" stroke={COLORS.sky} stroke-width="3" />
      <ellipse cx="46" cy="71" rx="4.5" ry="3.5" fill={INK} />
      <circle cx="54" cy="24" r="9" fill="#fff" stroke={COLORS.tomato} stroke-width="3" />
      <ellipse cx="54" cy="27" rx="4.5" ry="3.5" fill={INK} />
      <path d="M50 40 L53 36 M48 38 L52 42" stroke={COLORS.sunny} stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

function WhackArt() {
  // A mole up out of its hole, a mallet coming down.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="12" width="84" height="80" rx="18" fill={COLORS.mint} />
      <ellipse cx="46" cy="72" rx="26" ry="11" fill="#3B2A1A" />
      <rect x="30" y="40" width="32" height="36" rx="15" fill="#A8744A" />
      <ellipse cx="46" cy="58" rx="10" ry="7" fill="#FFE0C2" />
      <circle cx="40" cy="50" r="2.5" fill={INK} />
      <circle cx="52" cy="50" r="2.5" fill={INK} />
      <ellipse cx="46" cy="55" rx="3.5" ry="2.5" fill={COLORS.bubblegum} />
      <rect x="18" y="74" width="56" height="14" fill={DARK.mint} />
      <g transform="rotate(-30 74 30)">
        <rect x="70" y="30" width="7" height="34" rx="3" fill={COLORS.peach} />
        <rect x="58" y="20" width="32" height="16" rx="6" fill={COLORS.tomato} />
      </g>
    </svg>
  );
}

function PaintArt() {
  // A floor half blue, half red, and a roller cutting across it.
  const tiles = Array.from({ length: 16 }, (_, i) => i);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="14" fill="#E6E0F4" />
      <rect x="10" y="10" width="80" height="80" rx="14" fill="#fff" />
      {tiles.map((i) => {
        const x = 15 + (i % 4) * 18;
        const y = 15 + Math.floor(i / 4) * 18;
        const fill = i % 4 < 2 && i < 13 ? COLORS.sky : i % 4 >= 2 && i > 2 ? COLORS.tomato : '#F4F1FB';
        return <rect key={i} x={x} y={y} width="16" height="16" rx="4" fill={fill} />;
      })}
      <g transform="rotate(-20 52 46)">
        <rect x="44" y="34" width="12" height="24" rx="5" fill={DARK.sky} />
        <rect x="46" y="36" width="8" height="20" rx="3" fill={COLORS.sky} />
        <rect x="28" y="44" width="16" height="4" fill={INK} />
      </g>
    </svg>
  );
}

function GrabArt() {
  // A cherry on the stage and two hands reaching for it from either side.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="52" r="30" fill="#E6E0F4" />
      <circle cx="50" cy="50" r="30" fill="#fff" />
      <path d="M44 50 L50 36 L56 50" stroke={DARK.mint} stroke-width="2.5" fill="none" />
      <circle cx="43" cy="54" r="7.5" fill={COLORS.tomato} />
      <circle cx="57" cy="55" r="7.5" fill={COLORS.tomato} />
      <rect x="4" y="74" width="30" height="18" rx="8" fill={COLORS.sky} />
      <rect x="66" y="8" width="30" height="18" rx="8" fill={COLORS.tomato} />
      <path d="M26 74 L36 62 M74 26 L64 38" stroke={INK} stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}

function ImpostorArt() {
  // Three cards with the word and one with a question mark: the one who does not know.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`rotate(${-24 + i * 16} 50 88)`}>
          <rect x="34" y="18" width="32" height="44" rx="7" fill="#E6E0F4" />
          <rect x="34" y="16" width="32" height="44" rx="7" fill="#fff" />
          <rect x="40" y="34" width="20" height="5" rx="2.5" fill={COLORS.grape} />
        </g>
      ))}
      <g transform="rotate(26 50 88)">
        <rect x="34" y="18" width="32" height="44" rx="7" fill={DARK.tomato} />
        <rect x="34" y="16" width="32" height="44" rx="7" fill={COLORS.tomato} />
        <text x="50" y="38" text-anchor="middle" dominant-baseline="central" font-size="24" font-weight="700" fill="#fff">
          ?
        </text>
      </g>
      <circle cx="50" cy="84" r="11" fill={COLORS.sunny} />
      <circle cx="46" cy="82" r="1.8" fill={INK} />
      <circle cx="54" cy="82" r="1.8" fill={INK} />
      <path d="M45 87 Q50 91 55 87" stroke={INK} stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>
  );
}

function CharadesArt() {
  // A face with the phone held on its forehead, the word facing out.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="64" r="28" fill={DARK.sky} />
      <circle cx="50" cy="61" r="28" fill={COLORS.sky} />
      <circle cx="40" cy="66" r="3.5" fill={INK} />
      <circle cx="60" cy="66" r="3.5" fill={INK} />
      <ellipse cx="50" cy="78" rx="7" ry="5" fill={INK} />
      <rect x="22" y="14" width="56" height="32" rx="7" fill={INK} />
      <rect x="26" y="18" width="48" height="24" rx="4" fill="#fff" />
      <rect x="33" y="27" width="34" height="6" rx="3" fill={COLORS.peach} />
      <path d="M14 30 L6 26 M14 38 L6 42 M86 30 L94 26 M86 38 L94 42" stroke={COLORS.sunny} stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}

function DrawGuessArt() {
  // A sketch of a house on a card, a crayon still drawing it, and a question mark.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="16" width="70" height="72" rx="12" fill="#E6E0F4" />
      <rect x="10" y="12" width="70" height="72" rx="12" fill="#fff" />
      <path d="M24 52 L45 32 L66 52 M29 48 L29 70 L61 70 L61 48" stroke={INK} stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="40" y="56" width="10" height="14" rx="2" fill={COLORS.tomato} />
      <g transform="rotate(35 80 64)">
        <rect x="74" y="40" width="12" height="36" rx="3" fill={COLORS.sky} />
        <path d="M74 76 L80 88 L86 76 Z" fill="#F4D9A8" />
        <path d="M78.5 84 L80 88 L81.5 84 Z" fill={INK} />
      </g>
      <circle cx="82" cy="20" r="13" fill={COLORS.sunny} />
      <text x="82" y="21" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="700" fill="#fff">
        ?
      </text>
    </svg>
  );
}

function GuessPersonArt() {
  // A little board of faces, two tipped over, and one with a question mark over it.
  const faces = [COLORS.sunny, COLORS.peach, COLORS.sky, COLORS.mint, COLORS.bubblegum, COLORS.grape];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="30" width="84" height="64" rx="12" fill={DARK.grape} />
      <rect x="8" y="26" width="84" height="64" rx="12" fill={COLORS.grape} />
      {faces.map((color, i) => {
        const x = 24 + (i % 3) * 26;
        const y = 44 + Math.floor(i / 3) * 28;
        const down = i === 1 || i === 3;
        return down ? (
          <rect key={i} x={x - 10} y={y + 6} width="20" height="6" rx="3" fill="#fff" opacity="0.6" />
        ) : (
          <g key={i}>
            <rect x={x - 10} y={y - 12} width="20" height="24" rx="5" fill="#fff" />
            <circle cx={x} cy={y - 2} r="6.5" fill={color} />
            <circle cx={x - 2.2} cy={y - 3} r="1" fill={INK} />
            <circle cx={x + 2.2} cy={y - 3} r="1" fill={INK} />
          </g>
        );
      })}
      <circle cx="76" cy="16" r="12" fill={COLORS.sunny} />
      <text x="76" y="17" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="700" fill="#fff">
        ?
      </text>
    </svg>
  );
}

function UrArt() {
  // The board on end: the long middle row, the two short ends, a flower and two pieces.
  const cells: [number, number][] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) if (col === 1 || row <= 1 || row >= 4) cells.push([col, row]);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="28" y="4" width="44" height="94" rx="8" fill="#E6E0F4" />
      {cells.map(([col, row]) => (
        <rect key={`${col}-${row}`} x={31 + col * 13} y={7 + row * 11} width="12" height="10" rx="2.5" fill={col === 1 ? COLORS.sunny : '#fff'} />
      ))}
      {[[37, 12], [37, 84], [50, 51], [63, 12], [63, 84]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill={COLORS.bubblegum} />
      ))}
      <circle cx="50" cy="29" r="5" fill={COLORS.sky} />
      <circle cx="50" cy="73" r="5" fill={COLORS.tomato} />
      <circle cx="16" cy="60" r="7" fill={COLORS.sky} />
      <circle cx="84" cy="40" r="7" fill={COLORS.tomato} />
    </svg>
  );
}

function SenetArt() {
  // The three rows of thirty squares, the water, the flower, a spool and a cone, and the sticks.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="28" width="88" height="44" rx="8" fill="#E6E0F4" />
      {Array.from({ length: 30 }, (_, i) => {
        const col = i % 10;
        const row = Math.floor(i / 10);
        const special = (row === 2 && col >= 5) || (row === 1 && col === 5);
        return <rect key={i} x={9 + col * 8.3} y={31 + row * 13.5} width="7.3" height="12" rx="2" fill={special ? COLORS.sunny : '#fff'} />;
      })}
      <path d="M59 66 q1.5 -2 3 0 q1.5 2 3 0" stroke={COLORS.sky} stroke-width="1.6" fill="none" />
      <circle cx="55" cy="65" r="2.6" fill={COLORS.bubblegum} />
      <circle cx="30" cy="37" r="3.4" fill={COLORS.sky} />
      <path d="M44 55 L48 48 L52 55 Z" fill={COLORS.tomato} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={36 + i * 8} y="78" width="5" height="18" rx="2.5" fill={i % 2 ? '#fff' : COLORS.peach} stroke={DARK.peach} stroke-width="1" />
      ))}
    </svg>
  );
}

function MorrisArt() {
  // Three nested squares joined at the middles, a mill of three lit up and a piece on its way.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="10" width="88" height="88" rx="14" fill={DARK.sunny} />
      <rect x="6" y="6" width="88" height="88" rx="14" fill={COLORS.sunny} />
      <g stroke="#fff" stroke-width="3.5" fill="none">
        <rect x="16" y="16" width="68" height="68" />
        <rect x="28" y="28" width="44" height="44" />
        <rect x="40" y="40" width="20" height="20" />
        <path d="M50 16 V40 M50 60 V84 M16 50 H40 M60 50 H84" />
      </g>
      <path d="M16 16 H84" stroke={COLORS.bubblegum} stroke-width="7" stroke-linecap="round" opacity="0.8" />
      {[16, 50, 84].map((x) => (
        <circle key={x} cx={x} cy="16" r="6.5" fill={COLORS.sky} />
      ))}
      <circle cx="28" cy="72" r="6.5" fill={COLORS.tomato} />
      <circle cx="72" cy="50" r="6.5" fill={COLORS.tomato} />
    </svg>
  );
}

function PachisiArt() {
  // The cross with its middle, a castle on each arm, pieces of both sides and two cowries.
  const arms = [
    [42, 6, 16, 32],
    [42, 62, 16, 32],
    [6, 42, 32, 16],
    [62, 42, 32, 16],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {arms.map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y! + 2} width={w} height={h} rx="4" fill="#E6E0F4" />
          <rect x={x} y={y} width={w} height={h} rx="4" fill="#fff" />
        </g>
      ))}
      <rect x="40" y="40" width="20" height="20" rx="5" fill={COLORS.grape} />
      {[[50, 10], [50, 90], [10, 50], [90, 50]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x! - 5} y={y! - 5} width="10" height="10" rx="2" fill={COLORS.sunny} />
      ))}
      <circle cx="46" cy="28" r="5" fill={COLORS.sky} />
      <circle cx="54" cy="74" r="5" fill={COLORS.tomato} />
      <circle cx="76" cy="46" r="5" fill={COLORS.grape} />
      <ellipse cx="18" cy="18" rx="6" ry="9" fill="#fff" stroke={DARK.sunny} stroke-width="2" />
      <ellipse cx="30" cy="22" rx="6" ry="9" fill={COLORS.sunny} />
    </svg>
  );
}

function GoArt() {
  // A corner of the board: the lines, a star point, and black and white stones hemming each other in.
  const stones: [number, number, string][] = [
    [34, 34, INK],
    [50, 34, '#fff'],
    [34, 50, '#fff'],
    [50, 50, INK],
    [66, 50, INK],
    [50, 66, '#fff'],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="12" width="84" height="84" rx="12" fill={DARK.sunny} />
      <rect x="8" y="8" width="84" height="84" rx="12" fill={COLORS.sunny} />
      <g stroke={DARK.sunny} stroke-width="2.5">
        {[18, 34, 50, 66, 82].map((v) => (
          <g key={v}>
            <path d={`M18 ${v} H82`} />
            <path d={`M${v} 18 V82`} />
          </g>
        ))}
      </g>
      <circle cx="66" cy="66" r="3" fill={DARK.sunny} />
      {stones.map(([x, y, fill]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill={fill} stroke={fill === '#fff' ? '#D8D3E6' : 'none'} stroke-width="1.5" />
      ))}
    </svg>
  );
}

function TaflArt() {
  // The king in his crown at the middle, his defenders round him, attackers closing in from the edge.
  const defenders = [[50, 36], [36, 50], [64, 50], [50, 64]];
  const attackers = [[50, 12], [12, 50], [88, 50], [50, 88], [24, 24]];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="4" y="8" width="92" height="90" rx="14" fill={DARK.peach} />
      <rect x="4" y="4" width="92" height="90" rx="14" fill={COLORS.peach} />
      <rect x="10" y="10" width="80" height="80" rx="8" fill="#fff" />
      {[[10, 10], [80, 10], [10, 80], [80, 80]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="10" height="10" rx="3" fill={COLORS.sunny} />
      ))}
      {attackers.map(([x, y]) => (
        <circle key={`a${x}-${y}`} cx={x} cy={y} r="6" fill={COLORS.tomato} />
      ))}
      {defenders.map(([x, y]) => (
        <circle key={`d${x}-${y}`} cx={x} cy={y} r="6" fill={COLORS.sky} />
      ))}
      <circle cx="50" cy="50" r="9" fill={COLORS.sky} />
      <path d="M43 53 V45 L46.5 49 L50 43 L53.5 49 L57 45 V53 Z" fill={COLORS.sunny} />
    </svg>
  );
}

function FanoronaArt() {
  // A corner of the board with its diagonals, a blue piece stepping up and a red line about to go.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="16" width="88" height="70" rx="12" fill={DARK.mint} />
      <rect x="6" y="12" width="88" height="70" rx="12" fill={COLORS.mint} />
      <g stroke="#fff" stroke-width="2.5" opacity="0.9">
        <path d="M18 24 H82 M18 47 H82 M18 70 H82 M18 24 V70 M50 24 V70 M82 24 V70 M18 24 L64 70 M18 70 L64 24 M50 24 L82 56" />
      </g>
      <circle cx="18" cy="47" r="7" fill={COLORS.sky} />
      <circle cx="50" cy="47" r="7" fill={COLORS.tomato} />
      <circle cx="66" cy="47" r="7" fill={COLORS.tomato} />
      <circle cx="82" cy="47" r="7" fill={COLORS.tomato} />
      <path d="M26 47 H36" stroke={COLORS.sky} stroke-width="4" stroke-linecap="round" />
      <path d="M33 42 L38 47 L33 52" stroke={COLORS.sky} stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function ChowkaArt() {
  // The 5 by 5 floor with its crossed safe squares, a piece or two, and four cowries.
  const safe = new Set([2, 10, 12, 14, 22]);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="10" width="76" height="76" rx="10" fill={DARK.grape} />
      <rect x="12" y="6" width="76" height="76" rx="10" fill={COLORS.grape} />
      {Array.from({ length: 25 }, (_, i) => {
        const x = 16 + (i % 5) * 14;
        const y = 10 + Math.floor(i / 5) * 14;
        return (
          <g key={i}>
            <rect x={x} y={y} width="12" height="12" rx="3" fill={safe.has(i) ? COLORS.sunny : '#fff'} />
            {safe.has(i) && <path d={`M${x + 3} ${y + 3} L${x + 9} ${y + 9} M${x + 9} ${y + 3} L${x + 3} ${y + 9}`} stroke={DARK.sunny} stroke-width="1.5" />}
          </g>
        );
      })}
      <circle cx="36" cy="58" r="4.5" fill={COLORS.sky} />
      <circle cx="64" cy="30" r="4.5" fill={COLORS.tomato} />
      {[34, 44, 56, 66].map((x, i) => (
        <ellipse key={x} cx={x} cy="92" rx="4" ry="5.5" fill={i % 2 ? COLORS.sunny : '#fff'} stroke={DARK.sunny} stroke-width="1" />
      ))}
    </svg>
  );
}

function CodeBreakerArt() {
  // The covered code on top, two guess rows with their dots, the last one right.
  const rows: [string[], number, number][] = [
    [[COLORS.tomato, COLORS.sky, COLORS.mint, COLORS.sunny], 1, 2],
    [[COLORS.sky, COLORS.tomato, COLORS.mint, COLORS.grape], 4, 0],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="10" width="84" height="22" rx="10" fill={COLORS.grape} />
      {[22, 38, 54, 70].map((x) => (
        <text key={x} x={x} y="21" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="700" fill="#fff">
          ?
        </text>
      ))}
      {rows.map(([pegs, exact, near], r) => (
        <g key={r}>
          <rect x="8" y={40 + r * 26} width="84" height="22" rx="8" fill="#fff" stroke="#E6E0F4" stroke-width="2" />
          {pegs.map((c, i) => (
            <circle key={i} cx={20 + i * 14} cy={51 + r * 26} r="5.5" fill={c} />
          ))}
          {[0, 1, 2, 3].map((k) => (
            <circle key={k} cx={78 + (k % 2) * 7} cy={47 + r * 26 + Math.floor(k / 2) * 8} r="2.6" fill={k < exact ? INK : 'none'} stroke={k < exact + near ? INK : '#D8D3E6'} stroke-width="1.3" />
          ))}
        </g>
      ))}
    </svg>
  );
}

function HexArt() {
  // A small rhombus of hexes, red edges top and bottom, blue at the sides, a red chain getting through.
  const cells: [number, number, string][] = [];
  const red = new Set(['1,0', '1,1', '0,2', '0,3']);
  const blue = new Set(['2,1', '3,2', '2,2']);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) cells.push([x, y, red.has(`${x},${y}`) ? COLORS.tomato : blue.has(`${x},${y}`) ? COLORS.sky : '#fff']);
  const hexPath = (cx: number, cy: number) => {
    const r = 9;
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 90);
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    });
    return `M${pts.join(' L')} Z`;
  };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M18 18 H70" stroke={COLORS.tomato} stroke-width="5" stroke-linecap="round" />
      <path d="M40 86 H92" stroke={COLORS.tomato} stroke-width="5" stroke-linecap="round" />
      <path d="M12 26 L34 78" stroke={COLORS.sky} stroke-width="5" stroke-linecap="round" />
      <path d="M76 22 L98 74" stroke={COLORS.sky} stroke-width="5" stroke-linecap="round" />
      {cells.map(([x, y, fill]) => (
        <path key={`${x}-${y}`} d={hexPath(26 + x * 15.6 + y * 7.8, 30 + y * 13.5)} fill={fill} stroke="#D8D3E6" stroke-width="1.5" />
      ))}
    </svg>
  );
}

function ChineseCheckersArt() {
  // The six-pointed star in dots, two points filled with marbles, one hopping over another.
  const dots: [number, number][] = [];
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 2 || (q >= -2 && r >= -2 && s >= -2) || (q <= 2 && r <= 2 && s <= 2)) dots.push([q, r]);
    }
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {dots.map(([q, r]) => {
        const x = 50 + (q + r / 2) * 9.5;
        const y = 50 + r * 8.2;
        const fill = r <= -3 ? COLORS.tomato : r >= 3 ? COLORS.sky : '#E6E0F4';
        return <circle key={`${q},${r}`} cx={x} cy={y} r={r <= -3 || r >= 3 ? 4 : 3} fill={fill} />;
      })}
      <path d="M50 58 Q55 44 60 50" stroke={COLORS.grape} stroke-width="2.5" fill="none" stroke-linecap="round" />
    </svg>
  );
}

function NonogramArt() {
  // A 5 by 5 grid with its clues, a little mirrored picture half painted in.
  const pic = ['01110', '11011', '11111', '01010', '10001'];
  const done = 3;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="30" y="30" width="62" height="62" rx="8" fill="#fff" stroke="#E6E0F4" stroke-width="2" />
      {pic.map((row, y) =>
        [...row].map((c, x) => (
          <rect key={`${x}-${y}`} x={33 + x * 11.6} y={33 + y * 11.6} width="10" height="10" rx="2.5" fill={c === '1' && y < done ? COLORS.mint : '#F4F1FB'} />
        )),
      )}
      {['3', '2 2', '5', '1 1', '1 1'].map((t, y) => (
        <text key={t + y} x="27" y={38 + y * 11.6} text-anchor="end" dominant-baseline="central" font-size="7" font-weight="700" fill={INK}>
          {t}
        </text>
      ))}
      {['1 1', '4', '3', '4', '1 1'].map((t, x) => (
        <text key={t + x} x={38 + x * 11.6} y="25" text-anchor="middle" dominant-baseline="central" font-size="7" font-weight="700" fill={INK}>
          {t}
        </text>
      ))}
    </svg>
  );
}

function MahjongArt() {
  // A small stack of cream tiles, one on top of two, faces of dots, a numeral and a flower.
  const tile = (x: number, y: number, key: string, face: JSX.Element) => (
    <g key={key}>
      <rect x={x} y={y + 3} width="26" height="34" rx="5" fill={DARK.sunny} />
      <rect x={x} y={y} width="26" height="34" rx="5" fill="#FFF6DD" />
      {face}
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {tile(14, 46, 'a', <g><circle cx="21" cy="55" r="3.5" fill={COLORS.sky} /><circle cx="27" cy="63" r="3.5" fill={COLORS.tomato} /><circle cx="33" cy="71" r="3.5" fill={COLORS.mint} /></g>)}
      {tile(42, 46, 'b', <text x="55" y="63" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="700" fill={COLORS.tomato}>7</text>)}
      {tile(70, 46, 'c', <g>{[0, 1, 2, 3, 4, 5].map((k) => <circle key={k} cx={83 + Math.cos(k) * 6} cy={63 + Math.sin(k) * 6} r="4" fill={COLORS.bubblegum} />)}<circle cx="83" cy="63" r="3" fill={COLORS.sunny} /></g>)}
      {tile(34, 14, 'd', <path d="M47 22 L54 30 L50 30 L50 40 L44 40 L44 30 L40 30 Z" fill={COLORS.grape} />)}
    </svg>
  );
}

function BlockPuzzleArt() {
  // A grid with a nearly full row, and an L piece on its way down to finish it.
  const filled: [number, number, string][] = [
    [0, 3, COLORS.sky], [1, 3, COLORS.sky], [2, 3, COLORS.mint], [4, 3, COLORS.grape], [0, 2, COLORS.tomato], [4, 2, COLORS.sunny], [3, 2, COLORS.peach],
  ];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="40" width="76" height="50" rx="8" fill="#F4F1FB" />
      {filled.map(([x, y, c]) => (
        <rect key={`${x}-${y}`} x={16 + x * 14} y={44 + (y - 1) * 14} width="12" height="12" rx="3" fill={c} />
      ))}
      <rect x="58" y="8" width="12" height="12" rx="3" fill={COLORS.bubblegum} />
      <rect x="58" y="22" width="12" height="12" rx="3" fill={COLORS.bubblegum} />
      <rect x="44" y="22" width="12" height="12" rx="3" fill={COLORS.bubblegum} />
    </svg>
  );
}

function NumberMatchArt() {
  // A page of digits with a 3 and a 7 struck through together, and two ones side by side.
  const digits = ['1', '3', '5', '7', '2', '9', '4', '1', '1'];
  const gone = new Set([1, 3]);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="18" width="80" height="64" rx="10" fill="#fff" stroke="#E6E0F4" stroke-width="2" />
      {digits.map((d, i) => (
        <text key={i} x={24 + (i % 3) * 26} y={32 + Math.floor(i / 3) * 18} text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="700" fill={gone.has(i) ? '#D8D3E6' : [COLORS.sky, COLORS.tomato, COLORS.mint][i % 3]}>
          {d}
        </text>
      ))}
      <path d="M50 32 L24 50" stroke={COLORS.tomato} stroke-width="3" stroke-linecap="round" />
      <rect x="37" y="59" width="50" height="18" rx="8" fill="none" stroke={COLORS.grape} stroke-width="2.5" />
    </svg>
  );
}

function PopItArt() {
  // A rainbow heart of bubbles, two rows pressed down.
  const rows = ['.oo.oo.', 'ooooooo', 'ooooooo', '.ooooo.', '..ooo..', '...o...'];
  const colors = [COLORS.tomato, COLORS.peach, COLORS.sunny, COLORS.mint, COLORS.sky, COLORS.grape];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {rows.map((line, r) =>
        [...line].map((c, k) =>
          c === 'o' ? (
            <g key={`${r}-${k}`}>
              <circle cx={17 + k * 11} cy={22 + r * 11} r="5.2" fill={colors[r]} opacity={r >= 4 ? 0.65 : 1} />
              {r < 4 && <ellipse cx={15.5 + k * 11} cy={20.5 + r * 11} rx="2" ry="1.2" fill="#fff" opacity="0.6" />}
            </g>
          ) : null,
        ),
      )}
    </svg>
  );
}

function ZenGardenArt() {
  // A tray of sand raked in lines, rings round two stones.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="14" width="84" height="76" rx="10" fill={DARK.peach} />
      <rect x="8" y="10" width="84" height="76" rx="10" fill={COLORS.peach} />
      <rect x="13" y="15" width="74" height="66" rx="7" fill="#F3E6C8" />
      {[24, 32, 40, 64, 72].map((y) => (
        <path key={y} d={`M16 ${y} H84`} stroke="#D9C394" stroke-width="2" />
      ))}
      <ellipse cx="38" cy="52" rx="16" ry="10" fill="none" stroke="#D9C394" stroke-width="2" />
      <ellipse cx="38" cy="52" rx="10" ry="6" fill="#8F8BA3" />
      <ellipse cx="68" cy="50" rx="11" ry="8" fill="none" stroke="#D9C394" stroke-width="2" />
      <ellipse cx="68" cy="50" rx="6" ry="4.5" fill="#6F6D85" />
    </svg>
  );
}

function CradleArt() {
  // The frame, five balls on strings, the end one swung out.
  const balls = [20, 36, 52, 68];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="84" width="84" height="9" rx="4.5" fill={COLORS.sky} />
      <rect x="10" y="14" width="80" height="6" rx="3" fill={COLORS.grape} />
      <rect x="10" y="14" width="5" height="72" rx="2.5" fill={COLORS.grape} />
      <rect x="85" y="14" width="5" height="72" rx="2.5" fill={COLORS.grape} />
      {balls.map((x) => (
        <g key={x}>
          <path d={`M${x + 8} 20 L${x + 8} 62`} stroke={COLORS.soft} stroke-width="1.5" />
          <circle cx={x + 8} cy="66" r="7.5" fill="#D8D3E6" />
        </g>
      ))}
      <path d="M76 20 L90 58" stroke={COLORS.soft} stroke-width="1.5" />
      <circle cx="92" cy="61" r="7.5" fill="#D8D3E6" />
    </svg>
  );
}

function RatherArt() {
  // Two choice cards, one above the other, and a little face under each.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="14" width="76" height="28" rx="10" fill={DARK.sky} />
      <rect x="12" y="10" width="76" height="28" rx="10" fill={COLORS.sky} />
      <text x="50" y="24" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#fff">A</text>
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill={COLORS.soft}>or</text>
      <rect x="12" y="62" width="76" height="28" rx="10" fill={DARK.tomato} />
      <rect x="12" y="58" width="76" height="28" rx="10" fill={COLORS.tomato} />
      <text x="50" y="72" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#fff">B</text>
      <circle cx="86" cy="40" r="7" fill={COLORS.sunny} />
      <circle cx="14" cy="88" r="7" fill={COLORS.mint} />
    </svg>
  );
}

function TruthOrDareArt() {
  // Two cards fanned: a blue question mark and a red lightning bolt.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g transform="rotate(-12 40 55)">
        <rect x="16" y="22" width="40" height="56" rx="9" fill={DARK.sky} />
        <rect x="16" y="18" width="40" height="56" rx="9" fill={COLORS.sky} />
        <text x="36" y="46" text-anchor="middle" dominant-baseline="central" font-size="28" font-weight="700" fill="#fff">?</text>
      </g>
      <g transform="rotate(12 60 55)">
        <rect x="44" y="22" width="40" height="56" rx="9" fill={DARK.tomato} />
        <rect x="44" y="18" width="40" height="56" rx="9" fill={COLORS.tomato} />
        <path d="M68 30 L56 50 L64 50 L60 66 L74 44 L66 44 Z" fill="#fff" />
      </g>
    </svg>
  );
}

function HangmanArt() {
  // A basket held up by balloons, and the word's slots with two letters in.
  const balloons: [number, number, string][] = [[26, 26, COLORS.tomato], [42, 16, COLORS.sunny], [58, 16, COLORS.mint], [74, 26, COLORS.grape]];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {balloons.map(([x, y, c]) => (
        <g key={x}>
          <path d={`M${x} ${y + 9} L50 52`} stroke={COLORS.soft} stroke-width="1" />
          <ellipse cx={x} cy={y} rx="8" ry="10" fill={c} />
        </g>
      ))}
      <rect x="40" y="52" width="20" height="11" rx="3" fill={COLORS.peach} />
      <circle cx="50" cy="49" r="5" fill={COLORS.sunny} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={20 + i * 13} y="84" width="10" height="2.5" rx="1" fill={INK} />
      ))}
      <text x="25" y="77" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill={INK}>A</text>
      <text x="64" y="77" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="700" fill={INK}>E</text>
    </svg>
  );
}

function PointersArt() {
  // A small grid of arrow tiles, one flying off the edge.
  const tiles: [number, number, number][] = [[0, 0, 1], [1, 0, 0], [2, 0, 3], [0, 1, 2], [1, 1, 1], [0, 2, 3], [2, 2, 0], [1, 2, 2]];
  const colors = [COLORS.sky, COLORS.mint, COLORS.tomato, COLORS.grape];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {tiles.map(([x, y, d]) => (
        <g key={`${x}-${y}`} transform={`translate(${20 + x * 22} ${24 + y * 22}) rotate(${d * 90})`}>
          <rect x="-9" y="-9" width="18" height="18" rx="4" fill={colors[d]} />
          <path d="M0 -6 L5 0 L2 0 L2 6 L-2 6 L-2 0 L-5 0 Z" fill="#fff" />
        </g>
      ))}
      <g transform="translate(86 46) rotate(90)">
        <rect x="-9" y="-9" width="18" height="18" rx="4" fill={COLORS.mint} opacity="0.7" />
        <path d="M0 -6 L5 0 L2 0 L2 6 L-2 6 L-2 0 L-5 0 Z" fill="#fff" />
      </g>
    </svg>
  );
}

function BombPassArt() {
  // A round bomb with a sparking fuse, arcing between a blue half and a red one.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="52" width="88" height="42" rx="10" fill={COLORS.sky} opacity="0.25" />
      <rect x="6" y="6" width="88" height="42" rx="10" fill={COLORS.tomato} opacity="0.25" />
      <path d="M28 76 Q18 50 34 30" stroke={COLORS.soft} stroke-width="2" stroke-dasharray="3 4" fill="none" />
      <circle cx="54" cy="54" r="20" fill={INK} />
      <circle cx="47" cy="47" r="5" fill="#fff" opacity="0.3" />
      <rect x="58" y="30" width="7" height="7" rx="2" fill={COLORS.soft} />
      <circle cx="66" cy="26" r="6" fill={COLORS.sunny} />
      <circle cx="66" cy="26" r="3" fill={COLORS.peach} />
      <circle cx="76" cy="80" r="9" fill={COLORS.mint} />
    </svg>
  );
}

function BrickBlastArt() {
  // A wall of candy bricks with a gap knocked through it, a paddle at each end and a ball on its way.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="52" width="88" height="42" rx="10" fill={COLORS.sky} opacity="0.2" />
      <rect x="6" y="6" width="88" height="42" rx="10" fill={COLORS.tomato} opacity="0.2" />
      <rect x="10" y="38" width="18" height="9" rx="3" fill={COLORS.sunny} />
      <rect x="31" y="38" width="18" height="9" rx="3" fill={COLORS.sunny} />
      <rect x="73" y="38" width="18" height="9" rx="3" fill={COLORS.sunny} />
      <rect x="10" y="50" width="18" height="9" rx="3" fill={COLORS.grape} />
      <rect x="52" y="50" width="18" height="9" rx="3" fill={COLORS.grape} />
      <rect x="73" y="50" width="18" height="9" rx="3" fill={COLORS.grape} />
      <rect x="32" y="84" width="34" height="7" rx="3.5" fill={COLORS.sky} />
      <rect x="40" y="10" width="34" height="7" rx="3.5" fill={COLORS.tomato} />
      <circle cx="58" cy="30" r="6" fill="#fff" />
      <circle cx="58" cy="30" r="4.5" fill={COLORS.sky} />
    </svg>
  );
}

function SlingPuckArt() {
  // A wooden board, a wall with a slot, a puck pulled back on its band and one flying through.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="8" y="6" width="84" height="88" rx="12" fill="#C98F5A" />
      <rect x="13" y="11" width="74" height="78" rx="8" fill="#F7E3C4" />
      <rect x="8" y="47" width="32" height="6" rx="2" fill="#A8703F" />
      <rect x="60" y="47" width="32" height="6" rx="2" fill="#A8703F" />
      <path d="M18 80 L50 88 L82 80" stroke={COLORS.sky} stroke-width="3" fill="none" stroke-linejoin="round" />
      <circle cx="50" cy="80" r="8" fill={INK} />
      <circle cx="50" cy="80" r="5" fill={COLORS.grape} />
      <circle cx="54" cy="36" r="8" fill={INK} />
      <circle cx="54" cy="36" r="5" fill={COLORS.grape} />
      <path d="M52 62 L53 48" stroke={COLORS.soft} stroke-width="2" stroke-dasharray="2 3" />
      <path d="M18 20 L82 20" stroke={COLORS.tomato} stroke-width="3" />
    </svg>
  );
}

function HoopsArt() {
  // A backboard and rim with a ball dropping in on its arc.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="80" width="88" height="14" rx="4" fill="#E8B878" />
      <rect x="80" y="18" width="6" height="64" rx="3" fill={COLORS.soft} />
      <rect x="70" y="12" width="8" height="40" rx="2" fill="#fff" stroke={COLORS.tomato} stroke-width="2" />
      <path d="M50 38 L54 54 M58 38 L59 54 M66 38 L64 54" stroke={COLORS.soft} stroke-width="1.5" />
      <path d="M14 70 Q34 6 56 30" stroke={COLORS.soft} stroke-width="2" stroke-dasharray="3 4" fill="none" />
      <circle cx="57" cy="28" r="9" fill={COLORS.peach} />
      <path d="M48 28 L66 28 M57 19 L57 37" stroke={INK} stroke-width="1.5" opacity="0.5" />
      <rect x="46" y="36" width="26" height="4" rx="2" fill={COLORS.tomato} />
    </svg>
  );
}

function TankArt() {
  // Two toy tanks either side of a block, a shell bouncing off it.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="12" fill="#EEF6E4" />
      <rect x="40" y="44" width="22" height="14" rx="4" fill={COLORS.mint} />
      <rect x="14" y="66" width="24" height="6" rx="2" fill={INK} />
      <rect x="14" y="80" width="24" height="6" rx="2" fill={INK} />
      <rect x="16" y="70" width="20" height="12" rx="3" fill={COLORS.sky} />
      <rect x="30" y="73" width="16" height="5" rx="2" fill={COLORS.sky} />
      <circle cx="26" cy="76" r="5" fill="#2F7DD1" />
      <rect x="62" y="14" width="24" height="6" rx="2" fill={INK} />
      <rect x="62" y="28" width="24" height="6" rx="2" fill={INK} />
      <rect x="64" y="18" width="20" height="12" rx="3" fill={COLORS.tomato} />
      <rect x="54" y="21" width="16" height="5" rx="2" fill={COLORS.tomato} />
      <circle cx="74" cy="24" r="5" fill="#C73A2E" />
      <path d="M48 76 L66 60 L80 46" stroke={COLORS.soft} stroke-width="2" stroke-dasharray="3 4" fill="none" />
      <circle cx="48" cy="76" r="3.5" fill="#fff" stroke={INK} stroke-width="1.5" />
    </svg>
  );
}

function RoadDodgeArt() {
  // A three-lane road with a car weaving between two lumps of traffic.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="6" width="80" height="88" rx="10" fill="#E9E6F2" />
      <rect x="35" y="10" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="35" y="36" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="35" y="62" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="62" y="10" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="62" y="36" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="62" y="62" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="15" y="16" width="16" height="22" rx="6" fill={COLORS.sunny} />
      <rect x="69" y="30" width="16" height="22" rx="6" fill={COLORS.grape} />
      <rect x="42" y="64" width="16" height="22" rx="6" fill={COLORS.sky} />
      <rect x="45" y="67" width="10" height="5" rx="2" fill="#fff" opacity="0.8" />
    </svg>
  );
}

function SlotCarsArt() {
  // A grape stadium track with two grooves, a blue car on the straight and a red one on the bend.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="14" fill="#E6F5DC" />
      <rect x="18" y="12" width="64" height="76" rx="32" fill="none" stroke={COLORS.grape} stroke-width="14" />
      <rect x="14" y="8" width="72" height="84" rx="36" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8" />
      <rect x="22" y="16" width="56" height="68" rx="28" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8" />
      <rect x="76" y="44" width="8" height="14" rx="3" fill={COLORS.sky} />
      <rect x="44" y="6" width="14" height="8" rx="3" fill={COLORS.tomato} />
      <rect x="72" y="66" width="16" height="3" fill={INK} />
    </svg>
  );
}

function SweeperArt() {
  // A cleared corner with the numbers along its edge and a flag on the mine they point at.
  const cells = ['', '', '1', 'c', '', '1', '2', 'c', '1', '2', 'f', 'c', 'c', 'c', 'c', 'c'];
  const numberColor: Record<string, string> = { '1': COLORS.sky, '2': COLORS.mint };
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="14" width="80" height="80" rx="14" fill="#E6E0F4" />
      <rect x="10" y="10" width="80" height="80" rx="14" fill="#fff" />
      {cells.map((cell, i) => {
        const x = 14 + (i % 4) * 18.5;
        const y = 14 + Math.floor(i / 4) * 18.5;
        if (cell === 'c' || cell === 'f') {
          return (
            <g key={i}>
              <rect x={x} y={y + 2} width="16.5" height="16" rx="4" fill={DARK.mint} />
              <rect x={x} y={y} width="16.5" height="15.5" rx="4" fill={COLORS.mint} />
              {cell === 'f' && (
                <g>
                  <rect x={x + 6} y={y + 3} width="2" height="10" rx="1" fill={INK} />
                  <path d={`M ${x + 8} ${y + 3} L ${x + 14} ${y + 6} L ${x + 8} ${y + 9} Z`} fill={COLORS.tomato} />
                </g>
              )}
            </g>
          );
        }
        return (
          <g key={i}>
            <rect x={x} y={y} width="16.5" height="16.5" rx="4" fill="#F4F1FB" />
            {cell && (
              <text x={x + 8.25} y={y + 8.5} text-anchor="middle" dominant-baseline="central" font-family="Fredoka, sans-serif" font-weight="600" font-size="11" fill={numberColor[cell]}>
                {cell}
              </text>
            )}
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
  'word-guess': WordGuessArt,
  'word-search': WordSearchArt,
  'mini-crossword': CrosswordArt,
  'word-ladder': WordLadderArt,
  'word-groups': WordGroupsArt,
  'anagram-hunt': AnagramHuntArt,
  'target-number': TargetNumberArt,
  'quick-maths': QuickMathsArt,
  tripeaks: TriPeaksArt,
  sudoku: SudokuArt,
  'sliding-puzzle': SlidingArt,
  sweeper: SweeperArt,
  flood: FloodArt,
  'tile-match': TileMatchArt,
  jigsaw: JigsawArt,
  pool: PoolArt,
  'mini-golf': MiniGolfArt,
  archery: ArcheryArt,
  'spinner-war': SpinnerArt,
  racing: RacingArt,
  'sword-duel': SwordArt,
  'whack-a-mole': WhackArt,
  'paint-fight': PaintArt,
  'grab-it': GrabArt,
  impostor: ImpostorArt,
  charades: CharadesArt,
  'draw-guess': DrawGuessArt,
  'guess-person': GuessPersonArt,
  ur: UrArt,
  senet: SenetArt,
  morris: MorrisArt,
  pachisi: PachisiArt,
  go: GoArt,
  tafl: TaflArt,
  fanorona: FanoronaArt,
  chowka: ChowkaArt,
  'code-breaker': CodeBreakerArt,
  hex: HexArt,
  'chinese-checkers': ChineseCheckersArt,
  nonogram: NonogramArt,
  mahjong: MahjongArt,
  'block-puzzle': BlockPuzzleArt,
  'number-match': NumberMatchArt,
  'pop-it': PopItArt,
  'zen-garden': ZenGardenArt,
  'newtons-cradle': CradleArt,
  'would-you-rather': RatherArt,
  'truth-or-dare': TruthOrDareArt,
  hangman: HangmanArt,
  pointers: PointersArt,
  'bomb-pass': BombPassArt,
  'brick-blast': BrickBlastArt,
  'sling-puck': SlingPuckArt,
  hoops: HoopsArt,
  'tank-duel': TankArt,
  'road-dodge': RoadDodgeArt,
  'slot-cars': SlotCarsArt,
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

/** The streak switch: a flame, struck through when streaks are hidden. */
export function FlameIcon({ on }: { on: boolean }) {
  return (
    <svg {...iconProps}>
      <path d="M12 3c2.5 3 4.5 4.8 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.6-2.8 1.6-4 .2 1.2.8 2 1.7 2.4C10.4 7.4 11 5.2 12 3z" />
      {!on && <path d="M4 4l16 16" />}
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
