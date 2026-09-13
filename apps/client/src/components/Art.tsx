import type { BotTier } from '@gamepals/rules';
import type { ComponentChildren, JSX } from 'preact';
import { COLORS, DARK } from '../theme';

/* Original vector art: crisp at any size, flat colors, no gradients. */

const INK = COLORS.ink;
const round = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function TicTacToeArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {[35, 65].map((p) => (
        <g key={p} fill="#B9A8F0">
          <rect x={p - 2.5} y="8" width="5" height="84" rx="2.5" />
          <rect x="8" y={p - 2.5} width="84" height="5" rx="2.5" />
        </g>
      ))}
      <g stroke={COLORS.tomato} strokeWidth="7" {...round}>
        <path d="M12 12 L28 28 M28 12 L12 28" />
        <path d="M72 72 L88 88 M88 72 L72 88" />
      </g>
      <g stroke={COLORS.sky} strokeWidth="7" fill="none">
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
      <rect x="8" y="8" width="84" height="84" rx="16" fill="#fff" stroke="#E6E1F3" strokeWidth="2" />
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
      <rect x="20" y="6" width="60" height="88" rx="16" fill="#DCEEFF" stroke={DARK.sky} strokeWidth="3" />
      <line x1="24" y1="50" x2="76" y2="50" stroke="#8EC2FF" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="9" fill="none" stroke="#8EC2FF" strokeWidth="2.5" />
      <rect x="38" y="6" width="24" height="4" rx="2" fill={COLORS.tomato} />
      <rect x="38" y="90" width="24" height="4" rx="2" fill={COLORS.sky} />
      <circle cx="50" cy="24" r="9" fill={COLORS.tomato} stroke="#fff" strokeWidth="2" />
      <circle cx="50" cy="24" r="4" fill={DARK.tomato} />
      <circle cx="46" cy="76" r="9" fill={COLORS.sky} stroke="#fff" strokeWidth="2" />
      <circle cx="46" cy="76" r="4" fill={DARK.sky} />
      <circle cx="60" cy="46" r="5" fill={INK} stroke={COLORS.sunny} strokeWidth="2" />
    </svg>
  );
}

function CheckersArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="12" y="12" width="76" height="76" rx="14" fill="#fff" stroke="#F1E3D8" strokeWidth="2" />
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

function ChessArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="30" r="11" fill={COLORS.grape} />
      <path d="M37 72 Q50 38 63 72 Z" fill={COLORS.grape} />
      <rect x="30" y="70" width="40" height="12" rx="6" fill={DARK.grape} />
    </svg>
  );
}

function SolitaireArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="18" y="20" width="40" height="56" rx="8" fill="#fff" stroke="#E6E1F3" strokeWidth="2.5" transform="rotate(-10 38 48)" />
      <rect x="42" y="24" width="40" height="56" rx="8" fill="#fff" stroke="#E6E1F3" strokeWidth="2.5" transform="rotate(8 62 52)" />
      <path d="M62 44 l7 9 -7 9 -7 -9 z" fill={COLORS.tomato} transform="rotate(8 62 52)" />
    </svg>
  );
}

function SeaBattleArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M12 78 q9 -6 19 0 t19 0 t19 0 t19 0" fill="none" stroke={COLORS.sky} strokeWidth="5" {...round} />
      <path d="M22 60 L78 60 L68 72 L32 72 Z" fill={DARK.sky} />
      <line x1="50" y1="24" x2="50" y2="60" stroke={INK} strokeWidth="3" {...round} />
      <path d="M52 26 L72 56 L52 56 Z" fill={COLORS.tomato} />
    </svg>
  );
}

function SudokuArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="14" y="14" width="72" height="72" rx="12" fill="#fff" stroke="#EADFB8" strokeWidth="3" />
      <path d="M38 16 V84 M62 16 V84 M16 38 H84 M16 62 H84" stroke="#F3E7BF" strokeWidth="2.5" />
      <g fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="17" textAnchor="middle" fill={INK}>
        <text x="26" y="32">1</text>
        <text x="50" y="56" fill={DARK.sunny}>5</text>
        <text x="74" y="80">9</text>
      </g>
    </svg>
  );
}

function PingPongArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="22" y="14" width="56" height="74" rx="8" fill={DARK.sky} />
      <rect x="22" y="10" width="56" height="74" rx="8" fill={COLORS.sky} />
      <rect x="25" y="13" width="50" height="68" rx="6" fill="none" stroke="#fff" strokeWidth="2.5" />
      <line x1="50" y1="14" x2="50" y2="80" stroke="#fff" strokeWidth="1.5" />
      <rect x="16" y="44" width="68" height="6" rx="2" fill="#F4F1FF" stroke={INK} strokeWidth="1.5" />
      <ellipse cx="62" cy="32" rx="4" ry="2.5" fill={INK} opacity="0.2" />
      <circle cx="62" cy="25" r="4.5" fill="#fff" stroke="#FFE9B8" strokeWidth="1.5" />
      <circle cx="34" cy="88" r="9" fill={COLORS.sky} stroke="#fff" strokeWidth="2" />
      <circle cx="66" cy="8" r="7" fill={COLORS.tomato} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function TugOfWarArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="47" y="18" width="6" height="64" rx="3" fill="#D9A86C" />
      <circle cx="50" cy="56" r="6" fill={COLORS.sunny} stroke="#fff" strokeWidth="2" />
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
      <circle cx="50" cy="50" r="34" fill="none" stroke="#fff" strokeWidth="4" />
      <path d="M54 26 L38 54 L50 54 L45 74 L63 44 L51 44 Z" fill="#fff" />
    </svg>
  );
}

function SumoArt() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="53" r="42" fill="#E9B98B" />
      <circle cx="50" cy="50" r="42" fill="#F6D2AD" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#D6B273" strokeWidth="5" />
      <circle cx="40" cy="60" r="14" fill="#FFE0C2" stroke={COLORS.sky} strokeWidth="4" />
      <circle cx="36" cy="58" r="1.8" fill={INK} />
      <circle cx="44" cy="58" r="1.8" fill={INK} />
      <circle cx="60" cy="40" r="14" fill="#FFE0C2" stroke={COLORS.tomato} strokeWidth="4" />
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
      <rect x="20" y="14" width="60" height="16" rx="3" fill="#F4F1FF" stroke="#fff" strokeWidth="3" />
      <path d="M26 14 V30 M34 14 V30 M42 14 V30 M50 14 V30 M58 14 V30 M66 14 V30 M74 14 V30" stroke="#C9C2E6" strokeWidth="1" />
      <circle cx="44" cy="34" r="8" fill={COLORS.tomato} />
      <circle cx="33" cy="32" r="4" fill="#fff" />
      <circle cx="55" cy="32" r="4" fill="#fff" />
      <ellipse cx="62" cy="68" rx="6" ry="3" fill={INK} opacity="0.2" />
      <circle cx="62" cy="62" r="6.5" fill="#fff" stroke="#D9D3EA" strokeWidth="1.5" />
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
      <path d="M24 74 H48 V56 H70" fill="none" stroke={COLORS.sky} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="70" cy="56" r="8" fill={COLORS.sky} />
      <circle cx="73" cy="53" r="2.2" fill={INK} />
      <path d="M76 26 H54 V40 H34" fill="none" stroke={COLORS.tomato} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
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
            y={38 + cy * 36}
            textAnchor="middle"
            fontFamily="Fredoka, sans-serif"
            fontWeight="600"
            fontSize={label.length > 1 ? 14 : 17}
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
  solitaire: SolitaireArt,
  'sea-battle': SeaBattleArt,
  sudoku: SudokuArt,
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
        <path d="M31 50 Q38 56 45 50 M55 50 Q62 56 69 50" stroke={INK} strokeWidth="4" fill="none" {...round} />
        <circle cx="50" cy="66" r="3.5" fill={INK} />
        <text x="76" y="30" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize="16" fill={INK}>z</text>
      </Blob>
    );
  }
  if (tier === 'medium') {
    return (
      <Blob color={color}>
        <circle cx="38" cy="50" r="5" fill={INK} />
        <circle cx="62" cy="50" r="5" fill={INK} />
        <path d="M40 63 Q50 72 60 63" stroke={INK} strokeWidth="4" fill="none" {...round} />
      </Blob>
    );
  }
  if (tier === 'hard') {
    return (
      <Blob color={color}>
        <rect x="25" y="42" width="50" height="13" rx="6.5" fill={INK} />
        <rect x="31" y="45" width="10" height="3" rx="1.5" fill="#fff" opacity="0.7" />
        <path d="M42 67 Q54 71 62 62" stroke={INK} strokeWidth="4" fill="none" {...round} />
      </Blob>
    );
  }
  return (
    <Blob color={color}>
      <line x1="50" y1="14" x2="50" y2="5" stroke={INK} strokeWidth="3" {...round} />
      <circle cx="50" cy="5" r="4.5" fill={COLORS.sunny} />
      <circle cx="37" cy="50" r="10" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="63" cy="50" r="10" fill="#fff" stroke={INK} strokeWidth="3" />
      <line x1="47" y1="50" x2="53" y2="50" stroke={INK} strokeWidth="3" />
      <circle cx="38" cy="51" r="3.5" fill={INK} />
      <circle cx="64" cy="51" r="3.5" fill={INK} />
      <path d="M42 67 Q50 73 58 67" stroke={INK} strokeWidth="4" fill="none" {...round} />
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
      <path d="M41 63 Q50 72 59 63" stroke={INK} strokeWidth="4" fill="none" {...round} />
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

export function BackIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14.5 6l-6 6 6 6" />
    </svg>
  );
}
