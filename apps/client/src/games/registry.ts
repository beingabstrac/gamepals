import {
  airHockey,
  checkers,
  chess,
  type ChessState,
  backgammon,
  type BackgammonState,
  seaBattle,
  type SeaBattleState,
  classicSnake,
  COLORS_BY_PLAYERS,
  colorSort,
  dotsAndBoxes,
  echo,
  fourInARow,
  ludo,
  mancala,
  snakesAndLadders,
  type SnakesState,
  ultimateTtt,
  type UltimateState,
  yatzy,
  type YatzyState,
  shutTheBox,
  type ShutState,
  dominoes,
  type DominoState,
  memory,
  penaltyKicks,
  pingPong,
  reflexRace,
  reversi,
  REVERSI_PASS,
  snakeBattle,
  solitaire,
  freecell,
  type FreeCellState,
  spider,
  type SpiderState,
  pyramid,
  type PyramidState,
  crazyEights,
  type EightsState,
  goFish,
  type FishState,
  war,
  type WarState,
  oldMaid,
  type MaidState,
  hearts,
  type HeartsState,
  spades,
  type SpadesState,
  callbreak,
  type CallbreakState,
  ginRummy,
  type GinState,
  wordGuessGame,
  type WordState,
  rummy,
  type RummyState,
  tripeaks,
  type TriPeaksState,
  slidingPuzzle,
  sudoku,
  SUDOKU_HINTS,
  SUDOKU_LEVELS,
  sumo,
  ticTacToe,
  tugOfWar,
  twenty48,
  type CheckersState,
  type ColorSortState,
  type DotsState,
  type GameResult,
  type EchoState,
  type GameDefinition,
  type GameState,
  type LudoState,
  type MancalaState,
  type MemoryState,
  type PlayMode,
  type RealtimeGameDefinition,
  type ReversiState,
  type SlidingState,
  type SolitaireState,
  type SudokuLevel,
  type SudokuState,
  type Twenty48State,
} from '@gamepals/rules';
import type { Scene } from 'phaser';
import type { ComponentType } from 'preact';
import type { Session } from '../session';
import type { SoundName } from '../sfx';
import { storage } from '../platform';
import { COLORS, DARK } from '../theme';
import { AIR_HOCKEY_COLORS, AIR_HOCKEY_SIZE, AirHockeyScene, type RealtimeSceneOptions } from './air-hockey/AirHockeyScene';
import { CHECKERS_SIZE, CheckersScene } from './checkers/CheckersScene';
import { CHESS_SIZE, ChessScene } from './chess/ChessScene';
import { BackgammonControls } from './backgammon/BackgammonControls';
import { BACKGAMMON_COLORS, BACKGAMMON_NAMES, BACKGAMMON_SIZE, BackgammonScene } from './backgammon/BackgammonScene';
import { SeaControls } from './sea-battle/SeaControls';
import { SEA_BATTLE_SIZE, SEA_COLORS, SEA_NAMES, SeaScene } from './sea-battle/SeaScene';
import { CLASSIC_SNAKE_BEST_KEY, CLASSIC_SNAKE_SIZE, ClassicSnakeScene } from './classic-snake/ClassicSnakeScene';
import { ColorSortControls } from './color-sort/ColorSortControls';
import { COLOR_SORT_SIZE, ColorSortScene } from './color-sort/ColorSortScene';
import { DOTS_COLORS, DOTS_NAMES, DOTS_SIZE, DotsScene } from './dots-and-boxes/DotsScene';
import { DUEL_COLORS } from './duel';
import { ECHO_SIDE_COLORS, ECHO_SIDE_NAMES, ECHO_SIZE, EchoScene } from './echo/EchoScene';
import { FOUR_IN_A_ROW_SIZE, FourInARowScene } from './four-in-a-row/FourInARowScene';
import { LudoControls } from './ludo/LudoControls';
import { LUDO_COLOR_NAMES, LUDO_COLORS, LUDO_SIZE, LudoScene } from './ludo/LudoScene';
import { PENALTY_SIZE, PenaltyScene } from './penalty-kicks/PenaltyScene';
import { PING_PONG_SIZE, PingPongScene } from './ping-pong/PingPongScene';
import { REFLEX_RACE_SIZE, ReflexRaceScene } from './reflex-race/ReflexRaceScene';
import { ReversiControls } from './reversi/ReversiControls';
import { REVERSI_SIZE, ReversiScene } from './reversi/ReversiScene';
import { SNAKE_SIZE, SnakeScene } from './snake-battle/SnakeScene';
import { MANCALA_SIZE, MancalaScene } from './mancala/MancalaScene';
import { SnakesControls } from './snakes-and-ladders/SnakesControls';
import { SNAKES_SEAT_COLORS, SNAKES_SEAT_NAMES, SNAKES_SIZE, SnakesScene } from './snakes-and-ladders/SnakesScene';
import { BOARD_NAMES, ULTIMATE_SIZE, UltimateScene } from './ultimate-ttt/UltimateScene';
import { yatzyColors, yatzyNames } from './yatzy/table';
import { YatzyControls } from './yatzy/YatzyControls';
import { YATZY_SIZE, YatzyScene } from './yatzy/YatzyScene';
import { ShutControls } from './shut-the-box/ShutControls';
import { SHUT_SIZE, ShutScene } from './shut-the-box/ShutScene';
import { DominoControls } from './dominoes/DominoControls';
import { DOMINO_COLORS, DOMINO_NAMES, DOMINO_SIZE, DominoScene } from './dominoes/DominoScene';
import { MEMORY_COLORS, MEMORY_NAMES, MEMORY_SIZE, MemoryScene } from './memory/MemoryScene';
import { SLIDING_SIZE, SlidingScene } from './sliding-puzzle/SlidingScene';
import { FreeCellControls } from './freecell/FreeCellControls';
import { FREECELL_SIZE, freeCellStatus, FreeCellScene } from './freecell/FreeCellScene';
import { SpiderControls } from './spider/SpiderControls';
import { SPIDER_SIZE, spiderStatus, SpiderScene } from './spider/SpiderScene';
import { EIGHTS_COLORS, EIGHTS_NAMES, EIGHTS_SIZE, eightsStatus, EightsScene } from './crazy-eights/EightsScene';
import { FISH_COLORS, FISH_NAMES, FISH_SIZE, fishStatus, FishScene } from './go-fish/FishScene';
import { WAR_COLORS, WAR_NAMES, WAR_SIZE, warResult, warStatus, WarScene } from './war/WarScene';
import { MAID_COLORS, MAID_NAMES, MAID_SIZE, maidResult, maidStatus, MaidScene } from './old-maid/MaidScene';
import { HEARTS_COLORS, HEARTS_NAMES, HEARTS_SIZE, heartsStatus, HeartsScene } from './hearts/HeartsScene';
import { SPADES_COLORS, SPADES_NAMES, SPADES_SIZE, spadesResult, spadesStatus, SpadesScene } from './spades/SpadesScene';
import { CALLBREAK_COLORS, CALLBREAK_NAMES, CALLBREAK_SIZE, callbreakStatus, CallbreakScene } from './callbreak/CallbreakScene';
import { GIN_COLORS, GIN_NAMES, GIN_SIZE, ginResult, ginStatus, GinScene } from './gin-rummy/GinScene';
import { WORD_COLORS, WORD_NAMES, WORD_SIZE, wordResult, wordStatus, WordScene } from './word-guess/WordScene';
import { RUMMY_COLORS, RUMMY_NAMES, RUMMY_SIZE, rummyResult, rummyStatus, RummyScene } from './rummy/RummyScene';
import { PyramidControls } from './pyramid/PyramidControls';
import { PYRAMID_SIZE, pyramidStatus, PyramidScene } from './pyramid/PyramidScene';
import { TriPeaksControls } from './tripeaks/TriPeaksControls';
import { TRIPEAKS_SIZE, triPeaksStatus, TriPeaksScene } from './tripeaks/TriPeaksScene';
import { SolitaireControls } from './solitaire/SolitaireControls';
import { SOLITAIRE_SIZE, SolitaireScene } from './solitaire/SolitaireScene';
import { SudokuControls } from './sudoku/SudokuControls';
import { SUDOKU_SIZE, SudokuScene } from './sudoku/SudokuScene';
import { SUMO_SIZE, SumoScene } from './sumo/SumoScene';
import { TIC_TAC_TOE_SIZE, TicTacToeScene } from './tic-tac-toe/TicTacToeScene';
import { TUG_OF_WAR_SIZE, TugOfWarScene } from './tug-of-war/TugOfWarScene';
import { TWENTY48_SIZE, Twenty48Scene } from './twenty48/Twenty48Scene';

/** Short, plain-language rules shown before a game starts. No jargon, no long sentences. */
export interface HowTo {
  readonly goal: string;
  readonly controls: string;
  readonly win: string;
  readonly draw?: string;
  readonly tip?: string;
}

/** What the home shelf and the table setup need to know about any game. */
export interface EntryBase {
  readonly definition: {
    readonly id: string;
    readonly name: string;
    readonly minPlayers: number;
    readonly maxPlayers: number;
    readonly modes: readonly PlayMode[];
  };
  readonly tagline: string;
  /**
   * Roughly how long one game takes, in the words a person would use. Ponder Club puts this on
   * every tile and it answers the question people actually have when they open a games app:
   * have I got time for this right now.
   */
  readonly minutes: string;
  readonly howTo: HowTo;
  /** One line to get going, shown the first time this game is opened. Defaults to the
   *  first sentence of `howTo.controls`, which is already written as the thing to do first. */
  readonly tryIt?: string;
  /** Levels picked at the table (passed to the rules as the game variant). */
  readonly levels?: readonly { readonly id: string; readonly label: string }[];
  /** Name of each seat's side for a given player count, e.g. X and O. */
  sideNames(players: number): readonly string[];
  /** CSS color of each seat's side for a given player count. */
  sideColors(players: number): readonly string[];
  /** Logical canvas size; rendered at device pixel density and scaled to fit. */
  readonly size: { readonly width: number; readonly height: number };
  /** The game's own flat candy color (tile, table, Play button). */
  readonly color: string;
}

/** Turn-based game driven by a `Session`. */
export interface GameEntry<M = unknown> extends EntryBase {
  readonly kind: 'turn';
  readonly definition: GameDefinition<M>;
  /** Pause before bot actions (longer for games with long animations). */
  readonly botDelayMs?: number;
  /** Game-specific sound for a state change; defaults to place/bot place. */
  moveCue?(before: GameState<M>, after: GameState<M>): SoundName | undefined;
  /** Extra controls rendered under the board (e.g. dice). */
  readonly Controls?: ComponentType<{ session: Session<M> }>;
  /** How to play in one short line, shown under the board until the first move. For games
   *  where the controls are not obvious from looking (swipe, drag) and there are no buttons. */
  readonly hint?: string;
  /** Replaces "X to move" (e.g. a score for solo puzzles); undefined keeps the default. */
  status?(state: GameState<M>): string | undefined;
  /** Replaces the result headline (e.g. "No more moves. 2,340 points"); undefined keeps the default. */
  resultText?(state: GameState<M>): string | undefined;
  createScene(session: Session<M>): Scene;
}

/** Real-time game whose scene runs its own fixed-step simulation. */
export interface RealtimeEntry extends EntryBase {
  readonly kind: 'realtime';
  readonly definition: RealtimeGameDefinition;
  /** Replaces the result headline (e.g. a solo score); undefined keeps the default. */
  resultText?(result: GameResult, scores: readonly number[]): string | undefined;
  createScene(options: RealtimeSceneOptions): Scene;
}

export type AnyEntry = GameEntry | RealtimeEntry;

function entry<M>(value: Omit<GameEntry<M>, 'kind'>): GameEntry {
  return { ...value, kind: 'turn' } as unknown as GameEntry;
}

const LEVEL_LABEL: Record<SudokuLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

const ludoSides = (players: number) => COLORS_BY_PLAYERS[players] ?? COLORS_BY_PLAYERS[4]!;
const duelSides = { sideNames: () => ['Blue', 'Red'], sideColors: () => DUEL_COLORS } as const;

export const GAMES: readonly AnyEntry[] = [
  entry({
    definition: ticTacToe,
    tagline: 'Three in a row wins',
    minutes: '1 min',
    howTo: {
      goal: 'Get three of your marks in a row.',
      controls: 'Tap an empty square to put your mark there. On a keyboard: press 1 to 9, or move with the arrow keys and press Enter.',
      win: 'Three in a row across, down, or corner to corner.',
      draw: 'If all nine squares fill up and nobody has three in a row, it is a draw.',
    },
    sideNames: () => ['X', 'O'],
    sideColors: () => [COLORS.tomato, COLORS.sky],
    size: TIC_TAC_TOE_SIZE,
    color: COLORS.grape,
    createScene: (session) => new TicTacToeScene(session),
  }),
  entry({
    definition: checkers,
    tagline: 'Jump, capture, crown a king',
    minutes: '10 min',
    howTo: {
      goal: "Take all of the other player's pieces, or leave them with no move.",
      controls: 'Tap one of your pieces, then tap a glowing square. On a keyboard: arrow keys and Enter.',
      win: 'The other side has no pieces left, or no piece can move.',
      draw: 'If 40 moves each go by with no capture and no plain piece moving, or the same position comes up three times, it is a draw.',
      tip: 'Pieces move diagonally forward. If you can jump, you must, and you keep jumping while you can. Reach the far row to become a king that moves both ways.',
    },
    sideNames: () => ['Black', 'Red'],
    sideColors: () => [COLORS.ink, COLORS.tomato],
    size: CHECKERS_SIZE,
    color: COLORS.peach,
    botDelayMs: 700,
    status: (state) => {
      const s = state as CheckersState;
      if (s.result) return undefined;
      const jump = s.legalMoves(s.currentSeat).some((m) => {
        const [a, b] = m.split('-').map(Number) as [number, number];
        return Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) === 2;
      });
      return jump ? `${s.currentSeat === 0 ? 'Black' : 'Red'} must jump` : undefined;
    },
    moveCue: (_before, after) => {
      const event = (after as CheckersState).last;
      if (!event) return undefined;
      if (event.crowned) return 'go';
      return event.captured.length ? 'capture' : undefined;
    },
    createScene: (session) => new CheckersScene(session),
  }),
  entry({
    definition: chess,
    tagline: 'The classic. Trap the king',
    minutes: '15+ min',
    howTo: {
      goal: 'Trap the other king so that it cannot get out of attack: checkmate.',
      controls: 'Tap a piece, then tap a dot. Tap it again to put it down. On a keyboard: arrows move the ring, Enter picks up and puts down. A pawn reaching the far row asks what it becomes.',
      win: 'Checkmate: the king is attacked and has no legal move left.',
      draw: 'Stalemate (no legal move but not in check), the same position three times, 50 moves each with no capture or pawn move, or too few pieces left to mate.',
      tip: 'You may never leave your own king attacked. Castling moves the king two squares towards a rook that has not moved, if the squares between are empty and the king is safe all the way.',
    },
    sideNames: () => ['White', 'Black'],
    sideColors: () => [COLORS.sunny, DARK.grape],
    size: CHESS_SIZE,
    color: DARK.grape,
    botDelayMs: 350,
    status: (state) => {
      const s = state as ChessState;
      if (s.result) return undefined;
      const who = s.currentSeat === 0 ? 'White' : 'Black';
      return s.check ? `${who} to move. Check!` : `${who} to move`;
    },
    resultText: (state) => (state as ChessState).ending ?? undefined,
    moveCue: (_before, after) => {
      const event = (after as ChessState).last;
      if (!event) return undefined;
      if (event.captured !== 0) return 'capture';
      if (event.castleRook) return 'go';
      return event.check ? 'clang' : 'place';
    },
    createScene: (session) => new ChessScene(session),
  }),
  entry({
    definition: backgammon,
    tagline: 'Race your checkers home',
    minutes: '12 min',
    howTo: {
      goal: 'Bring all 15 of your checkers home, then take them off before the other player does.',
      controls: 'Tap Roll, then tap a checker and tap where it goes. On a keyboard: Space or Enter rolls, arrows pick a point, Enter moves.',
      win: 'The first player to take off all 15 checkers wins.',
      tip: 'Play both dice if you can, and the higher one if only one fits. Doubles give four moves. Landing on a lone checker sends it to the bar, and it must come back in before that player does anything else. No doubling cube here.',
    },
    sideNames: () => BACKGAMMON_NAMES,
    sideColors: () => BACKGAMMON_COLORS,
    size: BACKGAMMON_SIZE,
    color: COLORS.mint,
    botDelayMs: 600,
    status: (state) => {
      const s = state as BackgammonState;
      if (s.result) return undefined;
      const name = BACKGAMMON_NAMES[s.currentSeat];
      if (s.phase === 'roll') return `${name} to roll`;
      if (s.board.bar[s.currentSeat]! > 0) return `${name} must come in from the bar`;
      return `${name} to move: ${s.dice.join(' and ')}`;
    },
    moveCue: (_before, after) => {
      const event = (after as BackgammonState).last;
      if (!event) return undefined;
      if (event.kind === 'roll') return 'roll';
      if (event.kind === 'pass') return 'buzz';
      return event.hit ? 'capture' : 'place';
    },
    Controls: BackgammonControls,
    createScene: (session) => new BackgammonScene(session),
  }),
  entry({
    definition: seaBattle,
    tagline: 'Hide your fleet, sink theirs',
    minutes: '8 min',
    howTo: {
      goal: 'Find and sink all five of the other fleet before they sink yours.',
      controls: 'Place your ships on your own grid: tap a square to drop one, Turn to change its direction, or let us place them for you. Then tap a square on their waters to fire. On a keyboard: arrows move, Enter drops or fires, R turns.',
      win: 'Sink all five ships: seventeen squares in all.',
      tip: 'A miss shows a white dot, a hit shows a red burst, and you are told which ship went down. Ships may touch here, and a hit does not give you another shot.',
    },
    sideNames: () => SEA_NAMES,
    sideColors: () => SEA_COLORS,
    size: SEA_BATTLE_SIZE,
    color: COLORS.sky,
    botDelayMs: 500,
    status: (state) => {
      const s = state as SeaBattleState;
      if (s.result) return undefined;
      const name = SEA_NAMES[s.currentSeat];
      if (s.phase === 'place') return `${name} is placing their fleet`;
      const left = 5 - s.sunkShips(s.currentSeat === 0 ? 1 : 0).length;
      return `${name} to fire. ${left} of their ships left`;
    },
    moveCue: (_before, after) => {
      const event = (after as SeaBattleState).last;
      if (!event) return undefined;
      if (event.kind === 'place') return 'tap';
      if (event.sunk !== undefined) return 'capture';
      return event.hit ? 'hit' : 'wall';
    },
    Controls: SeaControls,
    createScene: (session) => new SeaScene(session),
  }),
  entry({
    definition: reversi,
    tagline: 'Trap and flip, most discs wins',
    minutes: '8 min',
    howTo: {
      goal: 'Finish the game with more discs of your color on the board.',
      controls: 'Tap a dot to place a disc. On a keyboard: arrow keys and Enter.',
      win: 'When neither player can move, the one with more discs wins.',
      draw: 'Equal counts at the end are a draw.',
      tip: 'Your disc must trap a straight line of the other color between it and another of your discs. Every trapped disc flips to your color. Corners can never be flipped back. If you have no move, you pass.',
    },
    sideNames: () => ['Dark', 'Light'],
    sideColors: () => [COLORS.ink, COLORS.sky],
    size: REVERSI_SIZE,
    color: COLORS.mint,
    botDelayMs: 700,
    status: (state) => {
      const s = state as ReversiState;
      if (s.result) return undefined;
      const who = s.currentSeat === 0 ? 'Dark' : 'Light';
      const counts = `Dark ${s.count(0)}, Light ${s.count(1)}`;
      return s.legalMoves(s.currentSeat)[0] === REVERSI_PASS ? `${who} has no moves. ${counts}` : `${who} to move. ${counts}`;
    },
    resultText: (state) => {
      const s = state as ReversiState;
      return s.result?.draw ? `A draw, ${s.count(0)} to ${s.count(1)}! 🤝` : undefined;
    },
    moveCue: (_before, after) => {
      const event = (after as ReversiState).last;
      if (!event) return undefined;
      if (event.square === null) return 'tap';
      return event.flipped.length >= 4 ? 'capture' : 'place';
    },
    Controls: ReversiControls,
    createScene: (session) => new ReversiScene(session),
  }),
  entry({
    definition: dotsAndBoxes,
    tagline: 'Close a box, take another turn',
    minutes: '6 min',
    levels: [
      { id: 'small', label: '3 by 3' },
      { id: 'medium', label: '4 by 4' },
      { id: 'large', label: '5 by 5' },
    ],
    howTo: {
      goal: 'Claim more boxes than anyone else.',
      controls: 'Tap between two dots to draw a line. On a keyboard: arrow keys move between line spots, Enter draws.',
      win: 'When every line is drawn, the player with the most boxes wins.',
      draw: 'If everyone ends with the same number of boxes, it is a draw.',
      tip: 'Close the fourth side of a box to claim it, and you go again. Try not to draw the third side of a box, because the next player gets it.',
    },
    sideNames: (players) => DOTS_NAMES.slice(0, players),
    sideColors: (players) => DOTS_COLORS.slice(0, players),
    size: DOTS_SIZE,
    color: COLORS.sky,
    botDelayMs: 500,
    moveCue: (_before, after) => {
      const event = (after as DotsState).last;
      if (!event) return undefined;
      return event.completed.length ? 'capture' : 'tap';
    },
    createScene: (session) => new DotsScene(session),
  }),
  entry({
    definition: mancala,
    tagline: 'Sow seeds, fill your store',
    minutes: '6 min',
    levels: [
      { id: 'four', label: '4 seeds (classic)' },
      { id: 'three', label: '3 seeds' },
      { id: 'six', label: '6 seeds' },
    ],
    howTo: {
      goal: 'Get more seeds into your store than the other player.',
      controls: 'Tap one of your glowing pits to sow its seeds. On a keyboard: press 1 to 6, or arrows and Enter.',
      win: 'When one side runs out of seeds, each player adds the seeds left on their side to their store. Most seeds wins.',
      draw: 'Equal stores at the end are a draw.',
      tip: 'Seeds go one by one to the right, into your own store but never the other store. Land your last seed in your store to go again. Land it in an empty pit on your side to take the seeds across from it.',
    },
    sideNames: () => ['Blue', 'Red'],
    sideColors: () => DUEL_COLORS,
    size: MANCALA_SIZE,
    color: DARK.peach,
    botDelayMs: 800,
    status: (state) => {
      const s = state as MancalaState;
      if (s.result) return undefined;
      return `${s.currentSeat === 0 ? 'Blue' : 'Red'} to move. Blue ${s.store(0)}, Red ${s.store(1)}`;
    },
    moveCue: (_before, after) => {
      const event = (after as MancalaState).last;
      if (!event) return undefined;
      if (event.capture) return 'capture';
      return event.extraTurn ? 'go' : 'place';
    },
    createScene: (session) => new MancalaScene(session),
  }),
  entry({
    definition: snakesAndLadders,
    tagline: 'Climb ladders, dodge snakes',
    minutes: '6 min',
    levels: [
      { id: 'classic', label: 'Exact roll to 100' },
      { id: 'quick', label: 'Quick finish' },
    ],
    howTo: {
      goal: 'Be the first to reach square 100.',
      controls: 'Tap Roll, or tap the board. Your token moves by itself. On a keyboard: press Space, Enter or R.',
      win: 'The first token on square 100 wins.',
      tip: "Land at the foot of a ladder to climb it. Land on a snake's head and you slide down. A 6 rolls again, but three 6s in a row end your turn. With Exact roll to 100, a roll that is too big bounces you back. It is all luck, so every bot plays the same.",
    },
    sideNames: (players) => SNAKES_SEAT_NAMES.slice(0, players),
    sideColors: (players) => SNAKES_SEAT_COLORS.slice(0, players),
    size: SNAKES_SIZE,
    color: COLORS.grape,
    botDelayMs: 900,
    status: (state) => {
      const s = state as SnakesState;
      if (s.result) return undefined;
      // Only mention tokens that have actually set off, so a fresh game reads "Red to roll".
      const moved = s.positions.flatMap((square, seat) => (square > 0 ? [`${SNAKES_SEAT_NAMES[seat]} ${square}`] : []));
      const lead = moved.slice(-2).join(', ');
      return lead ? `${SNAKES_SEAT_NAMES[s.currentSeat]} to roll. ${lead}` : `${SNAKES_SEAT_NAMES[s.currentSeat]} to roll`;
    },
    moveCue: (_before, after) => {
      const event = (after as SnakesState).last;
      if (!event?.jump) return 'roll';
      return event.jump.kind === 'snake' ? 'thud' : 'go';
    },
    Controls: SnakesControls,
    createScene: (session) => new SnakesScene(session),
  }),
  entry({
    definition: ultimateTtt,
    tagline: 'Nine boards, one big game',
    minutes: '8 min',
    howTo: {
      goal: 'Win three small boards in a row on the big board.',
      controls: 'Tap a square in a glowing board. On a keyboard: move with the arrow keys and press Enter.',
      win: 'Three in a row inside a small board wins it. Win three small boards in a row to win the game.',
      draw: 'If every small board is won or full and nobody has three in a row, it is a draw.',
      tip: 'The square you pick sends the other player to the board in the same spot. If that board is already won or full, they may play in any open board.',
    },
    sideNames: () => ['X', 'O'],
    sideColors: () => [COLORS.tomato, COLORS.sky],
    size: ULTIMATE_SIZE,
    color: COLORS.sky,
    status: (state) => {
      const s = state as UltimateState;
      if (s.result) return undefined;
      const who = s.currentSeat === 0 ? 'X' : 'O';
      if (s.active !== null) return `${who}: play in the ${BOARD_NAMES[s.active]} board`;
      return s.last === null ? `${who}: play anywhere` : `${who}: that board is closed, play in any open board`;
    },
    moveCue: (before, after) => {
      const b = before as UltimateState;
      const a = after as UltimateState;
      if (a.last === null) return undefined;
      const board = Math.floor(a.last / 9);
      return b.boards[board] === null && typeof a.boards[board] === 'number' ? 'capture' : 'place';
    },
    createScene: (session) => new UltimateScene(session),
  }),
  entry({
    definition: yatzy,
    tagline: 'Roll five dice, fill your card',
    minutes: '8 min',
    howTo: {
      goal: 'Score the most points by filling all 15 boxes on your card.',
      controls: 'Tap Roll. Tap dice to keep them, then roll the rest again, up to 3 rolls. Then tap a box to score it. On a keyboard: Space or R rolls, 1 to 5 keep dice, Tab to a box and press Enter.',
      win: 'After 15 turns each, the highest total wins.',
      draw: 'Equal totals share the win.',
      tip: 'Every box is used once, even if it scores 0. Score 63 or more in Ones to Sixes (three of each) for a bonus of 50. Five the same is a Yatzy: 50 points.',
    },
    sideNames: yatzyNames,
    sideColors: yatzyColors,
    size: YATZY_SIZE,
    color: COLORS.tomato,
    botDelayMs: 700,
    status: (state) => {
      const s = state as YatzyState;
      if (s.result) return undefined;
      const who = s.players === 1 ? '' : `${yatzyNames(s.players)[s.currentSeat]}: `;
      const left = 3 - s.rollsUsed;
      const now = s.rollsUsed === 0 ? 'roll the dice' : left > 0 ? `${left} ${left === 1 ? 'roll' : 'rolls'} left, or pick a box` : 'pick a box to score';
      return who ? `${who}${now}` : `${now[0]!.toUpperCase()}${now.slice(1)}`;
    },
    resultText: (state) => {
      const s = state as YatzyState;
      return s.players === 1 ? `You scored ${s.total(0)} points` : undefined;
    },
    moveCue: (_before, after) => {
      const event = (after as YatzyState).last;
      if (!event) return undefined;
      if (event.kind === 'roll') return 'roll';
      if (event.bonus || (event.box === 'yatzy' && event.points > 0)) return 'capture';
      return event.points > 0 ? 'place' : 'tap';
    },
    Controls: YatzyControls,
    createScene: (session) => new YatzyScene(session),
  }),
  entry({
    definition: shutTheBox,
    tagline: 'Roll, then flip the tiles down',
    minutes: '4 min',
    levels: [
      { id: 'nine', label: '9 tiles' },
      { id: 'twelve', label: '12 tiles' },
    ],
    howTo: {
      goal: 'Shut as many tiles as you can. Your score is the tiles left open, and low is good.',
      controls: 'Tap Roll. Then tap open tiles that add up to the roll; they shut when the sum is right. On a keyboard: Space or R rolls, number keys pick tiles (0, - and = for 10, 11 and 12), Backspace clears.',
      win: 'Shut every tile to win at once. Otherwise the lowest score wins.',
      draw: 'Equal lowest scores share the win.',
      tip: "Your turn goes on until you roll a number you can't make. Once 7 and up are all shut you may roll just 1 die (press 1). Keep small tiles open: they are the easiest to use later.",
    },
    sideNames: yatzyNames,
    sideColors: yatzyColors,
    size: SHUT_SIZE,
    color: COLORS.peach,
    botDelayMs: 800,
    status: (state) => {
      const s = state as ShutState;
      if (s.result) return undefined;
      const names = yatzyNames(s.scores.length);
      const who = s.scores.length === 1 ? '' : `${names[s.currentSeat]} `;
      const done = s.scores.flatMap((score, seat) => (score === null ? [] : [`${names[seat]} ${score}`]));
      // The hint under the board says what to do, so the status says what just happened.
      const what = s.phase === 'roll' ? 'to roll' : `rolled ${s.dice.join(' and ')}`;
      const now = who ? `${who}${what}` : `${what[0]!.toUpperCase()}${what.slice(1)}`;
      return done.length ? `${now}. Scores: ${done.join(', ')}` : now;
    },
    resultText: (state) => {
      const s = state as ShutState;
      const names = yatzyNames(s.scores.length);
      if (s.last?.kind === 'shut' && s.last.shutBox) return s.scores.length === 1 ? 'You shut the box!' : `${names[s.last.seat]} shut the box!`;
      return s.scores.length === 1 ? `You finished with ${s.scores[0]} points` : undefined;
    },
    moveCue: (_before, after) => {
      const event = (after as ShutState).last;
      if (!event) return undefined;
      if (event.kind === 'roll') return event.stuck ? 'buzz' : 'roll';
      return event.shutBox ? 'capture' : 'thud';
    },
    Controls: ShutControls,
    createScene: (session) => new ShutScene(session),
  }),
  entry({
    definition: dominoes,
    tagline: 'Match the ends, go out first',
    minutes: '8 min',
    levels: [
      { id: 'draw-100', label: 'Draw, to 100' },
      { id: 'draw-50', label: 'Draw, to 50' },
      { id: 'block-100', label: 'Block, to 100' },
      { id: 'block-50', label: 'Block, to 50' },
    ],
    howTo: {
      goal: 'Play all your tiles first. Win hands to score points.',
      controls: 'Tap a glowing tile to play it. If it fits both ends, tap the end you want. On a keyboard: arrows pick a tile, Up and Down switch the end, Enter plays.',
      win: 'Going out scores the pips left in everyone else\'s hands. The first to the target score wins the match.',
      draw: 'If nobody can play, the fewest pips wins the hand. A tie scores nothing.',
      tip: 'Your tile must match the number at one end of the line. In the Draw game you draw when stuck; in the Block game you pass. Watch which numbers the others pass on.',
    },
    sideNames: (players) => DOMINO_NAMES.slice(0, players),
    sideColors: (players) => DOMINO_COLORS.slice(0, players),
    size: DOMINO_SIZE,
    color: COLORS.sky,
    botDelayMs: 900,
    status: (state) => {
      const s = state as DominoState;
      if (s.result) return undefined;
      const name = DOMINO_NAMES[s.currentSeat];
      const now = s.phase === 'handOver' ? `${name} deals the next hand` : `${name} to play`;
      const pile = s.drawGame && s.phase === 'play' ? `. Boneyard ${s.boneyard.length}` : '';
      return `${now}${pile}. To ${s.target}`;
    },
    moveCue: (_before, after) => {
      const event = (after as DominoState).last;
      if (!event) return undefined;
      if (event.kind === 'play') return 'place';
      if (event.kind === 'pass') return 'buzz';
      if (event.kind === 'handEnd') return 'capture';
      return event.kind === 'deal' ? 'roll' : 'tap';
    },
    Controls: DominoControls,
    createScene: (session) => new DominoScene(session),
  }),
  entry({
    definition: fourInARow,
    tagline: 'Drop discs, connect four',
    minutes: '3 min',
    howTo: {
      goal: 'Line up four of your discs.',
      controls: 'Tap a column. Your disc drops to the lowest empty spot. On a keyboard: press 1 to 7, or pick with the arrow keys and press Enter.',
      win: 'Four in a row across, down, or on a slant.',
      draw: 'If the board fills up first, it is a draw.',
    },
    sideNames: () => ['Yellow', 'Red'],
    sideColors: () => [COLORS.sunny, COLORS.tomato],
    size: FOUR_IN_A_ROW_SIZE,
    color: COLORS.sky,
    createScene: (session) => new FourInARowScene(session),
  }),
  entry({
    definition: ludo,
    tagline: 'Race your four tokens home',
    minutes: '10+ min',
    howTo: {
      goal: 'Move all four of your tokens around the board and into the middle.',
      controls: 'Tap Roll. Then tap a bouncing token to move it. On a keyboard: press R or Space to roll, then 1 to 4 to pick a token.',
      win: 'The first player with all four tokens home wins.',
      tip: 'You need a 6 to bring a token out. A 6 gives you another roll, but three 6s in a row ends your turn. Land on someone to send them back. Star squares are safe.',
    },
    sideNames: (players) => ludoSides(players).map((color) => LUDO_COLOR_NAMES[color]!),
    sideColors: (players) => ludoSides(players).map((color) => LUDO_COLORS[color]!),
    size: LUDO_SIZE,
    color: COLORS.mint,
    botDelayMs: 1000,
    moveCue: (_before, after) => {
      const state = after as LudoState;
      if (!state.lastEvent) return 'roll';
      return state.lastEvent.captured.length > 0 ? 'capture' : undefined;
    },
    Controls: LudoControls,
    createScene: (session) => new LudoScene(session),
  }),
  entry({
    definition: twenty48,
    tagline: 'Slide, merge, reach 2048',
    minutes: '5 min',
    hint: 'Swipe to slide the tiles',
    howTo: {
      goal: 'Join tiles with the same number to make bigger numbers.',
      controls: 'Swipe up, down, left or right. Every tile slides that way. On a keyboard: use the arrow keys.',
      win: 'Make a 2048 tile. You can keep going for a higher score.',
      tip: 'A new tile appears after every move. The game ends when nothing can move.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.peach],
    size: TWENTY48_SIZE,
    color: COLORS.peach,
    status: (state) => `Score ${(state as Twenty48State).score.toLocaleString()}`,
    resultText: (state) => {
      const s = state as Twenty48State;
      return s.best >= 2048 ? `You made 2048! ${s.score.toLocaleString()} points 🎉` : `No more moves. ${s.score.toLocaleString()} points`;
    },
    createScene: (session) => new Twenty48Scene(session),
  }),
  entry({
    definition: sudoku,
    tagline: 'Fill the grid with 1 to 9',
    minutes: '10+ min',
    levels: SUDOKU_LEVELS.map((id) => ({ id, label: LEVEL_LABEL[id] })),
    howTo: {
      goal: 'Fill every empty square with a number from 1 to 9.',
      controls: 'Tap a square, then tap a number. Turn on Notes to jot down small guesses. On a keyboard: arrow keys, 1 to 9, Backspace to erase, N for notes.',
      win: 'Every row, every column and every 3 by 3 box has 1 to 9 exactly once.',
      tip: 'Each puzzle has only one answer, so you never have to guess. A repeated number turns red. Stuck? You get 3 hints.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.sunny],
    size: SUDOKU_SIZE,
    color: DARK.sky,
    status: (state) => {
      const s = state as SudokuState;
      return `${LEVEL_LABEL[s.level]}: ${s.remaining} squares left`;
    },
    resultText: (state) => {
      const used = SUDOKU_HINTS - (state as SudokuState).hintsLeft;
      return used === 0 ? 'Solved with no hints! 🌟' : `Solved! You used ${used} hint${used === 1 ? '' : 's'}.`;
    },
    moveCue: (before, after) => {
      const a = after as SudokuState;
      if (a.lastHint) return 'go';
      if (a.conflicts().size > (before as SudokuState).conflicts().size) return 'buzz';
      return a.values.some((v, i) => v !== (before as SudokuState).values[i]) ? 'place' : 'tap';
    },
    Controls: SudokuControls,
    createScene: (session) => new SudokuScene(session),
  }),
  entry({
    definition: solitaire,
    tagline: 'Sort the deck, Ace to King',
    minutes: '8 min',
    levels: [
      { id: 'draw1', label: 'Draw 1' },
      { id: 'draw3', label: 'Draw 3' },
    ],
    howTo: {
      goal: 'Move all 52 cards onto the four piles at the top. Each pile is one suit, from Ace up to King.',
      controls: 'Tap a card to send it to the best spot, or drag it where you want. Tap the deck to draw. On a keyboard: arrow keys pick a card, Enter moves it, D draws.',
      win: 'You win when every card is on the four piles.',
      tip: 'In the columns, stack cards going down and switch between red and black. Only a King can go in an empty column. Draw 3 is harder than Draw 1.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.mint],
    size: SOLITAIRE_SIZE,
    color: DARK.mint,
    status: (state) => `Score ${(state as SolitaireState).score}`,
    resultText: (state) => {
      const s = state as SolitaireState;
      return `You won! ${s.score} points in ${s.moveCount} moves.`;
    },
    moveCue: (before, after) => {
      const a = after as SolitaireState;
      const b = before as SolitaireState;
      if (a.moveCount < b.moveCount) return 'tap';
      if (a.stock.length !== b.stock.length) return 'tap';
      const home = (s: SolitaireState) => s.foundations.reduce((n, pile) => n + pile.length, 0);
      return home(a) > home(b) ? 'go' : 'place';
    },
    Controls: SolitaireControls,
    createScene: (session) => new SolitaireScene(session),
  }),
  entry({
    definition: freecell,
    tagline: 'Every card face up, four cells to think with',
    minutes: '8 min',
    howTo: {
      goal: 'Move all 52 cards onto the four piles at the top, each one suit from Ace up to King.',
      controls: 'Tap a card to send it to the best spot, or drag it where you want. The four free cells hold one card each. On a keyboard: arrow keys pick a card, Enter moves it.',
      win: 'You win when every card is on the four piles.',
      tip: 'In the columns, stack cards going down and switch between red and black. The more free cells and empty columns you keep, the more cards you can move at once.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.sky],
    size: FREECELL_SIZE,
    color: DARK.sky,
    status: (state) => freeCellStatus(state as FreeCellState),
    resultText: (state) => `You won! Every card home in ${(state as FreeCellState).moves} moves.`,
    moveCue: (before, after) => {
      const home = (s: FreeCellState) => s.foundations.reduce((sum, rank) => sum + rank, 0);
      return home(after as FreeCellState) > home(before as FreeCellState) ? 'go' : 'place';
    },
    Controls: FreeCellControls,
    createScene: (session) => new FreeCellScene(session),
  }),
  entry({
    definition: spider,
    tagline: 'Build eight runs, King down to Ace',
    minutes: '15 min',
    levels: [
      { id: 'one', label: 'One suit' },
      { id: 'two', label: 'Two suits' },
      { id: 'four', label: 'Four suits' },
    ],
    howTo: {
      goal: 'Build eight runs from King down to Ace in one suit. Each finished run leaves the board.',
      controls: 'Tap a card to move it, or drag it where you want. Tap the deck for a new row. On a keyboard: arrow keys pick a card, Enter moves it, D deals.',
      win: 'You win when all eight runs are done.',
      tip: 'Cards only travel together when they are one suit going down. Uncover the face-down cards early, and keep a column empty if you can. One suit is the gentle way in.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.peach],
    size: SPIDER_SIZE,
    color: DARK.peach,
    status: (state) => spiderStatus(state as SpiderState),
    resultText: (state) => `You won! All eight runs in ${(state as SpiderState).moves} moves.`,
    moveCue: (before, after) => ((after as SpiderState).done > (before as SpiderState).done ? 'go' : 'place'),
    Controls: SpiderControls,
    createScene: (session) => new SpiderScene(session),
  }),
  entry({
    definition: pyramid,
    tagline: 'Pairs that add up to 13',
    minutes: '5 min',
    howTo: {
      goal: 'Clear the whole pyramid by taking away pairs of cards that add up to 13.',
      controls: 'Tap a card, then tap the one that goes with it. A King goes on its own. Tap the deck to turn a card. On a keyboard: arrow keys pick a card, Enter takes it, D turns a card.',
      win: 'You win when every card in the pyramid is gone.',
      tip: 'Ace is 1, Jack is 11, Queen is 12, King is 13. A card is only free once both cards below it are gone, so take the pairs that open the most. You get three passes through the deck.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.bubblegum],
    size: PYRAMID_SIZE,
    color: DARK.bubblegum,
    status: (state) => pyramidStatus(state as PyramidState),
    resultText: (state) => `You cleared it! The whole pyramid in ${(state as PyramidState).moves} moves.`,
    moveCue: (before, after) => ((after as PyramidState).left < (before as PyramidState).left ? 'go' : 'tap'),
    Controls: PyramidControls,
    createScene: (session) => new PyramidScene(session),
  }),
  entry({
    definition: tripeaks,
    tagline: 'One up or one down, over and over',
    minutes: '5 min',
    howTo: {
      goal: 'Clear all three peaks by taking cards one rank above or below the card on the pile.',
      controls: 'Tap any card that is one rank above or below the pile. Tap the deck to turn a card. On a keyboard: arrow keys pick a card, Enter takes it, D turns a card.',
      win: 'You win when all 28 cards on the peaks are gone.',
      tip: 'An Ace goes on a King or a two, so it is the card that keeps a run going. The cards you can take sit a little proud of the rest. Every card you take without touching the deck makes your run longer.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.mint],
    size: TRIPEAKS_SIZE,
    color: DARK.mint,
    status: (state) => triPeaksStatus(state as TriPeaksState),
    resultText: (state) => `You cleared the peaks! Best run of ${(state as TriPeaksState).best}.`,
    moveCue: (before, after) => ((after as TriPeaksState).left < (before as TriPeaksState).left ? 'go' : 'tap'),
    Controls: TriPeaksControls,
    createScene: (session) => new TriPeaksScene(session),
  }),
  entry({
    definition: crazyEights,
    tagline: 'Match it, or play an eight',
    minutes: '6 min',
    howTo: {
      goal: 'Be the first to get rid of all your cards.',
      controls: 'Tap a card that matches the pile by suit or by number. An eight goes on anything, and then you pick the next suit. Tap the deck when you have nothing. On a keyboard: arrows pick a card, Enter plays it, D draws.',
      win: 'The first player with no cards left wins.',
      tip: 'An eight can be played at any time and changes the suit, so it is worth keeping for when you are stuck. Watch how many cards everybody else is holding.',
    },
    sideNames: (players) => EIGHTS_NAMES.slice(0, players),
    sideColors: (players) => EIGHTS_COLORS.slice(0, players),
    size: EIGHTS_SIZE,
    color: DARK.sky,
    status: (state) => eightsStatus(state as EightsState),
    resultText: (state) => `Out of cards! ${(state as EightsState).score} points left in the other hands.`,
    moveCue: (before, after) => ((after as EightsState).discard.length > (before as EightsState).discard.length ? 'place' : 'tap'),
    createScene: (session) => new EightsScene(session),
  }),
  entry({
    definition: goFish,
    tagline: 'Ask for a card, make a book',
    minutes: '6 min',
    howTo: {
      goal: 'Collect four of a kind, over and over. Most books wins.',
      controls: 'Tap a card in your hand to pick that number, then tap the player you want it from. If they have none, tap the pool to go fishing. On a keyboard: arrows pick a number, Enter asks, D draws.',
      win: 'When all thirteen books are down, whoever laid the most wins.',
      draw: 'Level books is a draw.',
      tip: 'You can only ask for a number you already hold. Listen to what everybody else asks for: that is how you know who has what.',
    },
    sideNames: (players) => FISH_NAMES.slice(0, players),
    sideColors: (players) => FISH_COLORS.slice(0, players),
    size: FISH_SIZE,
    color: COLORS.sky,
    status: (state) => fishStatus(state as FishState),
    moveCue: (before, after) =>
      (after as FishState).books.flat().length > (before as FishState).books.flat().length ? 'go' : 'tap',
    createScene: (session) => new FishScene(session),
  }),
  entry({
    definition: war,
    tagline: 'Turn it over. Highest wins',
    minutes: '5 min',
    tryIt: 'Tap anywhere to turn the cards over.',
    howTo: {
      goal: 'Win all 52 cards.',
      controls: 'Tap anywhere to turn the top card of each stack over. Nothing else to do.',
      win: 'Take every card, or hold the most after 300 battles.',
      draw: 'Level stacks after 300 battles is a draw.',
      tip: 'Aces are high. Equal cards mean war: one card face down each, then one face up to settle it.',
    },
    sideNames: () => WAR_NAMES,
    sideColors: () => WAR_COLORS,
    size: WAR_SIZE,
    color: COLORS.tomato,
    botDelayMs: 620,
    status: (state) => warStatus(state as WarState),
    resultText: (state) => warResult(state as WarState),
    moveCue: (_before, after) => ((after as WarState).last?.wars ? 'go' : 'place'),
    createScene: (session) => new WarScene(session),
  }),
  entry({
    definition: oldMaid,
    tagline: 'Do not be left with the queen',
    minutes: '5 min',
    howTo: {
      goal: 'Pair off all your cards. Do not be the one left holding the odd queen.',
      controls: 'Tap any card in the fan held out to you. If it matches one of yours, the pair goes down. On a keyboard: arrows pick a card in the fan, Enter takes it.',
      win: 'Everybody who runs out of cards has won. The last player, holding the odd queen, is the old maid.',
      tip: 'One queen was taken out of the deck, so the third one can never be paired. The fan is face down, so there is nothing to work out: just pick.',
    },
    sideNames: (players) => MAID_NAMES.slice(0, players),
    sideColors: (players) => MAID_COLORS.slice(0, players),
    size: MAID_SIZE,
    color: COLORS.grape,
    status: (state) => maidStatus(state as MaidState),
    resultText: (state) => maidResult(state as MaidState, MAID_NAMES),
    moveCue: (before, after) => ((after as MaidState).pairs.some((n, i) => n > ((before as MaidState).pairs[i] ?? 0)) ? 'go' : 'tap'),
    createScene: (session) => new MaidScene(session),
  }),
  entry({
    definition: hearts,
    tagline: 'Points are bad. Dodge the queen',
    minutes: '10 min',
    levels: [
      { id: 'hand', label: 'One hand' },
      { id: '50', label: 'To 50' },
      { id: '100', label: 'To 100' },
    ],
    howTo: {
      goal: 'Take as few points as you can. Every heart is one point and the queen of spades is thirteen.',
      controls: 'First pick three cards to pass on, then tap the card you want to play. Cards you cannot play sit back and say why. On a keyboard: arrows pick a card, Enter plays it.',
      win: 'The lowest score wins when somebody reaches the target.',
      draw: 'Level scores share the win.',
      tip: 'You must follow the suit that was led. Hearts cannot be led until one has been thrown away on another suit. Take all 26 points yourself and everybody else takes them instead.',
    },
    sideNames: () => HEARTS_NAMES,
    sideColors: () => HEARTS_COLORS,
    size: HEARTS_SIZE,
    color: DARK.tomato,
    status: (state) => heartsStatus(state as HeartsState),
    resultText: (state) => {
      const s2 = state as HeartsState;
      const low = Math.min(...s2.scores);
      return `${HEARTS_NAMES[s2.scores.indexOf(low)]} wins with ${low}.`;
    },
    moveCue: (before, after) =>
      (after as HeartsState).trick.length === 0 && (before as HeartsState).trick.length > 0 ? 'go' : 'place',
    createScene: (session) => new HeartsScene(session),
  }),
  entry({
    definition: spades,
    tagline: 'Say what you will take, then take it',
    minutes: '12 min',
    levels: [
      { id: 'hand', label: 'One hand' },
      { id: '200', label: 'To 200' },
      { id: '500', label: 'To 500' },
    ],
    howTo: {
      goal: 'With your partner across the table, take the number of tricks the two of you bid.',
      controls: 'First say how many tricks you will take, then tap a card to play it. Cards you cannot play sit back and say why. On a keyboard: arrows pick a bid or a card, Enter chooses.',
      win: 'Making your bid scores ten a trick, with one more for each extra. The first side to the target wins.',
      draw: 'Level scores share the win.',
      tip: 'Spades are always trump and cannot be led until one has trumped a trick. Nil says you will take nothing at all: worth a hundred if you manage it and a hundred off if you do not. Every ten extra tricks cost you a hundred.',
    },
    sideNames: () => SPADES_NAMES,
    sideColors: () => SPADES_COLORS,
    size: SPADES_SIZE,
    color: DARK.grape,
    status: (state) => spadesStatus(state as SpadesState),
    resultText: (state) => spadesResult(state as SpadesState),
    moveCue: (before, after) =>
      (after as SpadesState).trick.length === 0 && (before as SpadesState).trick.length > 0 ? 'go' : 'place',
    createScene: (session) => new SpadesScene(session),
  }),
  entry({
    definition: callbreak,
    tagline: 'Call your tricks, then go and win them',
    minutes: '10 min',
    levels: [
      { id: 'one', label: 'One round' },
      { id: 'five', label: 'Five rounds' },
    ],
    howTo: {
      goal: 'Say how many tricks you will take, then take at least that many. Spades are always trump.',
      controls: 'First say how many tricks you will take, then tap a card to play it. Cards you cannot play sit back and say why. On a keyboard: arrows pick a call or a card, Enter chooses.',
      win: 'Making your call scores it, plus a tenth for each extra trick. The highest score after the last round wins.',
      draw: 'Level scores share the win.',
      tip: 'You must beat the highest card of the suit led if you hold a higher one. With none of that suit you must play a spade that beats any spade already there.',
    },
    sideNames: () => CALLBREAK_NAMES,
    sideColors: () => CALLBREAK_COLORS,
    size: CALLBREAK_SIZE,
    color: DARK.mint,
    status: (state) => callbreakStatus(state as CallbreakState),
    moveCue: (before, after) =>
      (after as CallbreakState).trick.length === 0 && (before as CallbreakState).trick.length > 0 ? 'go' : 'place',
    createScene: (session) => new CallbreakScene(session),
  }),
  entry({
    definition: ginRummy,
    tagline: 'Make sets and runs, then knock',
    minutes: '8 min',
    levels: [
      { id: 'hand', label: 'One hand' },
      { id: '100', label: 'Game to 100' },
    ],
    howTo: {
      goal: 'Get your ten cards into sets and runs. A set is three or four of a kind, a run is three or more in a row in one suit.',
      controls: 'Take a card from the deck or the pile, then throw one away. Your hand sorts itself, and the number under it is what you are still holding loose. On a keyboard: arrows pick a card, Enter throws it, K knocks.',
      win: 'Knock when your loose cards come to ten or less and you score the difference between the two hands.',
      draw: 'If the deck runs down to two cards, nobody scores.',
      tip: 'Gin is no loose cards at all and pays twenty more. Knock too soon and the other player can lay their cards on your sets and undercut you.',
    },
    sideNames: () => GIN_NAMES,
    sideColors: () => GIN_COLORS,
    size: GIN_SIZE,
    color: DARK.grape,
    status: (state) => ginStatus(state as GinState),
    resultText: (state) => ginResult(state as GinState),
    moveCue: (before, after) =>
      (after as GinState).hands[0]!.length > (before as GinState).hands[0]!.length ? 'tap' : 'place',
    createScene: (session) => new GinScene(session),
  }),
  entry({
    definition: rummy,
    tagline: 'Sets and runs, and first one out wins',
    minutes: '10 min',
    levels: [
      { id: 'hand', label: 'One deal' },
      { id: '100', label: 'Game to 100' },
    ],
    howTo: {
      goal: 'Get rid of all your cards by making sets and runs. A set is three or four of a kind, a run is three or more in a row in one suit.',
      controls: 'Take a card from the deck or the pile, put down any melds the buttons offer, then tap a card to throw it away. A card that fits a meld on the table goes there instead. On a keyboard: arrows pick a card, Enter plays it, number keys put melds down.',
      win: 'The first player out takes the value of every other hand. Court cards are ten, aces one.',
      draw: 'If the cards run out twice, the hand is thrown in and nobody scores.',
      tip: 'You never have to put a meld down. Holding your whole hand back and laying it all down in one turn is a rummy, and it doubles what you score.',
    },
    sideNames: (players) => RUMMY_NAMES.slice(0, players),
    sideColors: (players) => RUMMY_COLORS.slice(0, players),
    size: RUMMY_SIZE,
    color: DARK.sky,
    status: (state) => rummyStatus(state as RummyState),
    resultText: (state) => rummyResult(state as RummyState),
    moveCue: (before, after) =>
      (after as RummyState).table.length > (before as RummyState).table.length ? 'go' : 'place',
    createScene: (session) => new RummyScene(session),
  }),
  entry({
    definition: wordGuessGame,
    tagline: 'Six goes at the word of the day',
    minutes: '3 min',
    howTo: {
      goal: 'Find the five-letter word in six goes.',
      controls: 'Type a word and press Enter. Green means the letter is in the right place, yellow means it is in the word somewhere else, grey means it is not in the word. On a phone, use the keyboard on screen.',
      win: 'Guess the word before the six goes run out.',
      tip: 'Start with a word full of common letters. A letter can show up twice, and the colours tell you when it does not.',
    },
    sideNames: () => WORD_NAMES,
    sideColors: () => WORD_COLORS,
    size: WORD_SIZE,
    color: DARK.mint,
    status: (state) => wordStatus(state as WordState),
    resultText: (state) => wordResult(state as WordState),
    moveCue: () => 'place',
    createScene: (session) => new WordScene(session),
  }),
  entry({
    definition: slidingPuzzle,
    tagline: 'Slide the tiles back in order',
    minutes: '5 min',
    hint: 'Tap a tile next to the gap',
    levels: [
      { id: '3x3', label: '3 by 3' },
      { id: '4x4', label: '4 by 4' },
      { id: '5x5', label: '5 by 5' },
    ],
    howTo: {
      goal: 'Put the tiles back in order: 1 in the top left, and the empty space in the bottom right.',
      controls: 'Tap a tile in the same row or column as the empty space to slide it. Tiles in between slide too. You can also swipe. On a keyboard: the arrow keys slide a tile.',
      win: 'Every tile is back in its place. Try to use as few moves as you can.',
      tip: 'Finish the top row first, then the next row. Each color shows which row a tile belongs in. Every puzzle here can be solved.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.tomato],
    size: SLIDING_SIZE,
    color: DARK.tomato,
    status: (state) => `Moves ${(state as SlidingState).moves}`,
    resultText: (state) => `Solved in ${(state as SlidingState).moves} moves!`,
    createScene: (session) => new SlidingScene(session),
  }),
  entry({
    definition: colorSort,
    tagline: 'Pour until every tube is one color',
    minutes: '4 min',
    levels: [
      { id: 'easy', label: 'Easy' },
      { id: 'medium', label: 'Medium' },
      { id: 'hard', label: 'Hard' },
    ],
    howTo: {
      goal: 'Sort the colors so each tube holds just one color.',
      controls: 'Tap a tube to lift it, then tap another tube to pour. On a keyboard: press 1 to 9 (0 for the tenth tube), or use the arrow keys and Enter.',
      win: 'Every tube is full of one color, or empty.',
      tip: 'You can only pour onto the same color or into an empty tube. Use the empty tubes to make room. Undo as much as you like. Every puzzle here can be solved.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.sky],
    size: COLOR_SORT_SIZE,
    color: DARK.sky,
    status: (state) => `Pours ${(state as ColorSortState).moves}`,
    resultText: (state) => `Sorted in ${(state as ColorSortState).moves} pours!`,
    moveCue: (before, after) => {
      const pour = (after as ColorSortState).last;
      if (!pour) return 'tap';
      const tube = (after as ColorSortState).tubes[pour.to]!;
      return tube.length === 4 && tube.every((c) => c === tube[0]) && (before as ColorSortState).tubes[pour.to]!.length < 4 ? 'capture' : 'pull';
    },
    Controls: ColorSortControls,
    createScene: (session) => new ColorSortScene(session),
  }),
  entry({
    definition: echo,
    tagline: 'Watch, listen, repeat',
    minutes: '3 min',
    hint: 'Watch the pads, then tap them back in order',
    levels: [
      { id: 'short', label: 'Short (8)' },
      { id: 'classic', label: 'Classic (14)' },
      { id: 'long', label: 'Long (20)' },
      { id: 'marathon', label: 'Marathon (31)' },
    ],
    howTo: {
      goal: 'Remember the pads as they light up and play them back in the same order.',
      controls: 'Watch and listen, then tap the pads. On a keyboard: press 1 to 4, or the arrow keys.',
      win: 'Alone: repeat the whole sequence up to the level goal. With friends: take turns, repeat the sequence, then add one step of your own. Miss and you are out; the last player in wins.',
      tip: 'Every round adds one more step. You have 5 seconds for each press, and the ring shows the time left. Humming the tune helps!',
    },
    sideNames: (players) => ECHO_SIDE_NAMES.slice(0, players),
    sideColors: (players) => ECHO_SIDE_COLORS.slice(0, players),
    size: ECHO_SIZE,
    color: DARK.grape,
    botDelayMs: 650,
    status: (state) => {
      const s = state as EchoState;
      if (!s.party) return `Round ${s.sequence.length}`;
      return s.phase === 'add' ? 'Add a step of your own' : undefined;
    },
    resultText: (state) => {
      const s = state as EchoState;
      if (s.party) return undefined;
      return s.result?.winners.length ? `You echoed all ${s.sequence.length} steps! 🎉` : `You repeated ${s.sequence.length - 1} steps in a row.`;
    },
    moveCue: (_before, after) => {
      const press = (after as EchoState).last;
      if (!press) return undefined;
      if (!press.correct) return 'buzz';
      return press.pad === null ? undefined : (`echo${press.pad}` as SoundName);
    },
    createScene: (session) => new EchoScene(session),
  }),
  entry({
    definition: memory,
    tagline: 'Flip two, find the pairs',
    minutes: '4 min',
    hint: 'Tap two cards to find a pair',
    levels: [
      { id: 'small', label: '12 cards' },
      { id: 'medium', label: '20 cards' },
      { id: 'large', label: '30 cards' },
    ],
    howTo: {
      goal: 'Find the matching pairs of cards.',
      controls: 'Tap a card to flip it over, then tap a second card. On a keyboard: arrow keys and Enter.',
      win: 'Whoever finds the most pairs wins. Playing alone, clear the board in as few turns as you can.',
      draw: 'If everyone ends with the same number of pairs, it is a draw.',
      tip: 'Find a pair and you go again. Miss, and both cards flip back, so remember where they were.',
    },
    sideNames: (players) => MEMORY_NAMES.slice(0, players),
    sideColors: (players) => MEMORY_COLORS.slice(0, players),
    size: MEMORY_SIZE,
    color: DARK.bubblegum,
    botDelayMs: 1100,
    status: (state) => {
      const s = state as MemoryState;
      return s.players === 1 ? `Turns ${s.turns}` : undefined;
    },
    resultText: (state) => {
      const s = state as MemoryState;
      return s.players === 1 ? `All pairs found in ${s.turns} turns!` : undefined;
    },
    moveCue: (before, after) => {
      const event = (after as MemoryState).last;
      if (!event || event === (before as MemoryState).last) return 'tap';
      return event.match ? 'capture' : 'thud';
    },
    createScene: (session) => new MemoryScene(session),
  }),
  {
    kind: 'realtime',
    definition: airHockey,
    tagline: 'Fast 1-on-1, first to 7',
    minutes: '3 min',
    howTo: {
      goal: 'Knock the puck into the other goal.',
      controls: 'Drag your paddle around your half of the table. On a keyboard: the arrow keys for the bottom player, W A S D for the top.',
      win: 'First to 7 goals wins.',
    },
    sideNames: () => ['Blue', 'Red'],
    sideColors: () => AIR_HOCKEY_COLORS,
    size: AIR_HOCKEY_SIZE,
    color: COLORS.tomato,
    createScene: (options) => new AirHockeyScene(options),
  },
  {
    kind: 'realtime',
    definition: pingPong,
    tagline: 'Swipe to hit, first to 11',
    minutes: '3 min',
    howTo: {
      goal: 'Hit the ball over the net so it bounces on the other side.',
      controls: 'When the ball bounces on your side, swipe toward the net. Swipe faster to hit harder. Swipe to serve too. On a keyboard: Left and Right move, Space hits (the top player uses A, D and Shift).',
      win: 'First to 11 points. You must be 2 points ahead.',
      tip: 'The ball must bounce once on each side. Hitting it long, wide or into the net loses the point.',
    },
    ...duelSides,
    size: PING_PONG_SIZE,
    color: COLORS.peach,
    createScene: (options) => new PingPongScene(options),
  },
  {
    kind: 'realtime',
    definition: tugOfWar,
    tagline: 'Tap faster to pull them over',
    minutes: '1 min',
    howTo: {
      goal: 'Pull the yellow knot over to your side.',
      controls: 'Tap your half of the screen as fast as you can. On a keyboard: Space for the bottom player, Shift for the top.',
      win: 'Pull the knot past your dashed line.',
    },
    ...duelSides,
    size: TUG_OF_WAR_SIZE,
    color: COLORS.bubblegum,
    createScene: (options) => new TugOfWarScene(options),
  },
  {
    kind: 'realtime',
    definition: reflexRace,
    tagline: 'Wait for green, then tap first',
    minutes: '1 min',
    howTo: {
      goal: 'Tap faster than the other player.',
      controls: 'Wait until the big circle turns green. Then tap your half. On a keyboard: Space for the bottom player, Shift for the top.',
      win: 'First to 3 points wins.',
      tip: 'Tap too soon and the other player gets the point.',
    },
    ...duelSides,
    size: REFLEX_RACE_SIZE,
    color: COLORS.grape,
    createScene: (options) => new ReflexRaceScene(options),
  },
  {
    kind: 'realtime',
    definition: sumo,
    tagline: 'Shove them out of the ring',
    minutes: '2 min',
    howTo: {
      goal: 'Push the other wrestler out of the ring.',
      controls: 'Hold and drag in your half to move. Tap to shove. On a keyboard: the arrow keys move and Space shoves (the top player uses W A S D and Shift).',
      win: 'Win 2 rounds to win the match.',
      tip: 'Stay away from the edge. A big shove that misses can carry you out.',
    },
    ...duelSides,
    size: SUMO_SIZE,
    color: DARK.peach,
    createScene: (options) => new SumoScene(options),
  },
  {
    kind: 'realtime',
    definition: penaltyKicks,
    tagline: 'Shoot, dive, five kicks each',
    minutes: '2 min',
    howTo: {
      goal: 'Score more goals than the other player.',
      controls: 'Kicking: swipe toward the goal. Saving: drag to move, then flick left or right to dive. On a keyboard: hold Left or Right to aim or move, and press Space to kick or dive (the top player uses A, D and Shift).',
      win: 'Five kicks each. If it is tied, keep going until one scores and the other misses.',
      tip: 'You take turns kicking and saving. A very hard kick can fly over the bar.',
    },
    ...duelSides,
    size: PENALTY_SIZE,
    color: DARK.mint,
    createScene: (options) => new PenaltyScene(options),
  },
  {
    kind: 'realtime',
    definition: snakeBattle,
    tagline: 'Trap them before they trap you',
    minutes: '3 min',
    howTo: {
      goal: 'Make the other snake crash first.',
      controls: 'Tap the arrow buttons to turn left or right. On a keyboard: the arrow keys for the bottom snake, A and D for the top.',
      win: 'Win 3 rounds to win the match.',
      draw: 'If both snakes crash into each other head first, nobody gets the round.',
      tip: 'Hitting a wall, yourself or the other snake ends the round. Eat fruit to grow longer.',
    },
    ...duelSides,
    size: SNAKE_SIZE,
    color: DARK.grape,
    createScene: (options) => new SnakeScene(options),
  },
  {
    kind: 'realtime',
    definition: classicSnake,
    tagline: "Eat, grow, don't crash",
    minutes: '3 min',
    howTo: {
      goal: 'Steer the snake to the fruit. Every fruit makes it one longer.',
      controls: 'Swipe up, down, left or right to steer. On a keyboard: the arrow keys or W A S D.',
      win: 'Eat as much fruit as you can. Fill the whole board to win outright.',
      tip: 'Hitting a wall or your own tail ends the game. The snake speeds up as it grows, so turn early.',
    },
    sideNames: () => ['You'],
    sideColors: () => [COLORS.sky],
    size: CLASSIC_SNAKE_SIZE,
    color: DARK.mint,
    resultText: (result, scores) => {
      const eaten = scores[0] ?? 0;
      if (result.winners.length) return `You filled the board! ${eaten} fruit 🎉`;
      const best = Number(storage.get(CLASSIC_SNAKE_BEST_KEY) ?? 0) || 0;
      return `Game over! You ate ${eaten} fruit. Your best: ${best}.`;
    },
    createScene: (options) => new ClassicSnakeScene(options),
  },
];

/** Shown on the home shelf so the catalog direction is visible from day one (docs/12). */
export const COMING_SOON: readonly { id: string; name: string; color: string }[] = [];
