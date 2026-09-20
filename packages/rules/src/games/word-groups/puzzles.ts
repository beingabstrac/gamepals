/**
 * The puzzles for Word Groups (docs/games/word-groups.md). Written here, not generated, and
 * there is a fixed number of them. That is the opposite call from the mini crossword, and for a
 * good reason: a crossword's difficulty is in the grid, which a search can lay, while this game's
 * difficulty is entirely in the traps, and no search can write a red herring on purpose.
 *
 * Groups run from plain to sly. Every puzzle has at least two words that look like they belong
 * somewhere else, which is the check a puzzle has to pass before it goes in here.
 */
export interface Group {
  /** What the four have in common, shown once the group is found. */
  readonly name: string;
  readonly words: readonly [string, string, string, string];
}

export interface GroupPuzzle {
  /** Plainest group first, slyest last. */
  readonly groups: readonly [Group, Group, Group, Group];
}

export const PUZZLES: readonly GroupPuzzle[] = [
  {
    groups: [
      { name: 'Citrus fruit', words: ['LEMON', 'LIME', 'ORANGE', 'CITRON'] },
      { name: 'Kinds of green', words: ['OLIVE', 'MOSS', 'SAGE', 'FOREST'] },
      { name: 'Wise person', words: ['ORACLE', 'GURU', 'ELDER', 'PROPHET'] },
      { name: 'Trees', words: ['ELM', 'BEECH', 'WILLOW', 'ALDER'] },
    ],
  },
  {
    groups: [
      { name: 'Card games', words: ['RUMMY', 'HEARTS', 'SPADES', 'BRIDGE'] },
      { name: 'Garden tools', words: ['RAKE', 'HOE', 'TROWEL', 'FORK'] },
      { name: 'Parts of a river', words: ['MOUTH', 'BED', 'BANK', 'DELTA'] },
      { name: 'Words before LINE', words: ['COAST', 'DEAD', 'HEAD', 'PUNCH'] },
    ],
  },
  {
    groups: [
      { name: 'Big cats', words: ['LION', 'TIGER', 'JAGUAR', 'PUMA'] },
      { name: 'Chess pieces', words: ['ROOK', 'BISHOP', 'KNIGHT', 'PAWN'] },
      { name: 'Birds', words: ['ROBIN', 'SWIFT', 'MARTIN', 'WREN'] },
      { name: 'Machines that lift', words: ['CRANE', 'HOIST', 'JACK', 'WINCH'] },
    ],
  },
  {
    groups: [
      { name: 'Weather', words: ['HAIL', 'SLEET', 'DRIZZLE', 'GALE'] },
      { name: 'Greetings', words: ['HELLO', 'SALUTE', 'WAVE', 'BOW'] },
      { name: 'Parts of a ship', words: ['DECK', 'MAST', 'HULL', 'KEEL'] },
      { name: 'Things that break', words: ['DAWN', 'NEWS', 'RECORD', 'SWEAT'] },
    ],
  },
  {
    groups: [
      { name: 'Units of time', words: ['MINUTE', 'HOUR', 'DECADE', 'SEASON'] },
      { name: 'Kitchen things', words: ['WHISK', 'LADLE', 'SIEVE', 'GRATER'] },
      { name: 'Body of water', words: ['SOUND', 'STRAIT', 'BAY', 'GULF'] },
      { name: 'Words before BOARD', words: ['KEY', 'CUP', 'SURF', 'DASH'] },
    ],
  },
  {
    groups: [
      { name: 'Dances', words: ['TANGO', 'WALTZ', 'SALSA', 'SWING'] },
      { name: 'Sauces', words: ['PESTO', 'GRAVY', 'CURRY', 'RELISH'] },
      { name: 'Kinds of bread', words: ['RYE', 'PITA', 'NAAN', 'SODA'] },
      { name: 'Playground things', words: ['SLIDE', 'SEESAW', 'CLIMB', 'ROUNDABOUT'] },
    ],
  },
  {
    groups: [
      { name: 'Planets', words: ['MARS', 'VENUS', 'SATURN', 'NEPTUNE'] },
      { name: 'Roman gods', words: ['JUNO', 'VESTA', 'CERES', 'MINERVA'] },
      { name: 'In the night sky', words: ['COMET', 'METEOR', 'AURORA', 'ECLIPSE'] },
      { name: 'Words before LIGHT', words: ['STAR', 'MOON', 'SPOT', 'HEAD'] },
    ],
  },
  {
    groups: [
      { name: 'Musical instruments', words: ['CELLO', 'OBOE', 'HARP', 'TUBA'] },
      { name: 'Parts of a shoe', words: ['SOLE', 'HEEL', 'TONGUE', 'LACE'] },
      { name: 'Fish', words: ['PIKE', 'RAY', 'BREAM', 'CARP'] },
      { name: 'Kinds of singing voice', words: ['BASS', 'ALTO', 'TENOR', 'TREBLE'] },
    ],
  },
  {
    groups: [
      { name: 'Colours of a rainbow', words: ['RED', 'INDIGO', 'ORANGE', 'YELLOW'] },
      { name: 'Flowers', words: ['VIOLET', 'DAISY', 'POPPY', 'IRIS'] },
      { name: 'Parts of an eye', words: ['PUPIL', 'LENS', 'RETINA', 'CORNEA'] },
      { name: 'People at school', words: ['HEAD', 'PREFECT', 'TUTOR', 'MATRON'] },
    ],
  },
  {
    groups: [
      { name: 'Mountain ranges', words: ['ALPS', 'ANDES', 'URALS', 'ATLAS'] },
      { name: 'Books you look things up in', words: ['ALMANAC', 'LEXICON', 'PRIMER', 'THESAURUS'] },
      { name: 'Board games', words: ['CHESS', 'LUDO', 'DRAUGHTS', 'BACKGAMMON'] },
      { name: 'Things with a crown', words: ['TOOTH', 'ROAD', 'KING', 'JEWEL'] },
    ],
  },
  {
    groups: [
      { name: 'Coffee drinks', words: ['LATTE', 'MOCHA', 'FLATWHITE', 'RISTRETTO'] },
      { name: 'Shades of brown', words: ['TAN', 'UMBER', 'SEPIA', 'CHESTNUT'] },
      { name: 'How an old photograph looks', words: ['FADED', 'GRAINY', 'MONO', 'VIGNETTE'] },
      { name: 'Ways to cook an egg', words: ['POACH', 'SCRAMBLE', 'BOIL', 'FRY'] },
    ],
  },
  {
    groups: [
      { name: 'In a deck of cards', words: ['JOKER', 'ACE', 'SUIT', 'TRUMP'] },
      { name: 'Places to dance', words: ['CLUB', 'BALL', 'DISCO', 'RAVE'] },
      { name: 'Thrown in athletics', words: ['DISCUS', 'SHOT', 'JAVELIN', 'HAMMER'] },
      { name: 'Small drinks', words: ['DRAM', 'NIP', 'SNIFTER', 'TOT'] },
    ],
  },
  {
    groups: [
      { name: 'Parts of a book', words: ['SPINE', 'CHAPTER', 'PREFACE', 'BLURB'] },
      { name: 'Fingers', words: ['INDEX', 'THUMB', 'RING', 'PINKY'] },
      { name: 'Things you can ring', words: ['BELL', 'ALARM', 'PHONE', 'CHIME'] },
      { name: 'Ways to walk', words: ['AMBLE', 'STRIDE', 'TRUDGE', 'SAUNTER'] },
    ],
  },
  {
    groups: [
      { name: 'Types of cloud', words: ['CIRRUS', 'STRATUS', 'CUMULUS', 'NIMBUS'] },
      { name: 'A ring of light', words: ['AURA', 'GLORY', 'CORONA', 'RADIANCE'] },
      { name: 'Beers', words: ['STOUT', 'LAGER', 'PORTER', 'BITTER'] },
      { name: 'Hotel staff', words: ['CONCIERGE', 'MAID', 'BELLHOP', 'VALET'] },
    ],
  },
  {
    groups: [
      { name: 'Precious stones', words: ['OPAL', 'JADE', 'TOPAZ', 'GARNET'] },
      { name: 'Programming languages', words: ['RUBY', 'PYTHON', 'RUST', 'SWIFT'] },
      { name: 'Snakes', words: ['ADDER', 'COBRA', 'MAMBA', 'VIPER'] },
      { name: 'Things that add up', words: ['TOTAL', 'SUM', 'TALLY', 'COUNT'] },
    ],
  },
  {
    groups: [
      { name: 'Parts of a castle', words: ['MOAT', 'KEEP', 'TOWER', 'GATE'] },
      { name: 'Hold on to', words: ['RETAIN', 'HOARD', 'STORE', 'CLUTCH'] },
      { name: 'Shops', words: ['MARKET', 'OUTLET', 'STALL', 'BOUTIQUE'] },
      { name: 'Engine trouble', words: ['MISFIRE', 'KNOCK', 'SEIZE', 'OVERHEAT'] },
    ],
  },
  {
    groups: [
      { name: 'Sea creatures', words: ['SQUID', 'PRAWN', 'URCHIN', 'LIMPET'] },
      { name: 'Shades of pink', words: ['CORAL', 'ROSE', 'BLUSH', 'SALMON'] },
      { name: 'Ways to go red', words: ['FLUSH', 'BURN', 'GLOW', 'REDDEN'] },
      { name: 'Poker hands', words: ['PAIR', 'STRAIGHT', 'FULLHOUSE', 'TRIPS'] },
    ],
  },
  {
    groups: [
      { name: 'Parts of a clock', words: ['FACE', 'HAND', 'DIAL', 'PENDULUM'] },
      { name: 'Seasons', words: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] },
      { name: 'Ways to jump', words: ['LEAP', 'VAULT', 'HOP', 'BOUND'] },
      { name: 'Kinds of hop in beer', words: ['FUGGLE', 'GOLDING', 'CASCADE', 'SAAZ'] },
    ],
  },
  {
    groups: [
      { name: 'In a pencil case', words: ['RUBBER', 'SHARPENER', 'COMPASS', 'PROTRACTOR'] },
      { name: 'People in charge', words: ['RULER', 'BOSS', 'CHIEF', 'HEAD'] },
      { name: 'Ways to find north', words: ['POLESTAR', 'MOSS', 'SUN', 'SEXTANT'] },
      { name: 'Kinds of tape', words: ['MASKING', 'DUCT', 'RED', 'TICKER'] },
    ],
  },
  {
    groups: [
      { name: 'Bones', words: ['SKULL', 'FEMUR', 'SPINE', 'PELVIS'] },
      { name: 'Cuts of meat', words: ['RIB', 'LOIN', 'RUMP', 'SHANK'] },
      { name: 'Parts of a hill', words: ['CREST', 'FOOT', 'SLOPE', 'RIDGE'] },
      { name: 'Words on a toothpaste box', words: ['PEARL', 'MINT', 'SPARKLE', 'GLEAM'] },
    ],
  },
  {
    groups: [
      { name: 'Types of pasta', words: ['PENNE', 'FUSILLI', 'ORZO', 'RIGATONI'] },
      { name: 'Tiny amounts', words: ['DASH', 'PINCH', 'DROP', 'TRACE'] },
      { name: 'Punctuation', words: ['COMMA', 'COLON', 'BRACKET', 'SEMICOLON'] },
      { name: 'Parts of the gut', words: ['ILEUM', 'CAECUM', 'RECTUM', 'DUODENUM'] },
    ],
  },
  {
    groups: [
      { name: 'Things with keys', words: ['PIANO', 'MAP', 'KEYBOARD', 'TYPEWRITER'] },
      { name: 'Parts of a canal', words: ['LOCK', 'TOWPATH', 'BASIN', 'CUT'] },
      { name: 'Wrestling holds', words: ['NELSON', 'HEADLOCK', 'PIN', 'CHOKEHOLD'] },
      { name: 'Admirals', words: ['DRAKE', 'HALSEY', 'BEATTY', 'RODNEY'] },
    ],
  },
  {
    groups: [
      { name: 'Circus acts', words: ['TRAPEZE', 'JUGGLER', 'CLOWN', 'RINGMASTER'] },
      { name: 'Kinds of tent', words: ['BIGTOP', 'DOME', 'YURT', 'TEEPEE'] },
      { name: 'Ways to laugh', words: ['CHUCKLE', 'GIGGLE', 'GUFFAW', 'SNIGGER'] },
      { name: 'Words before WALK', words: ['CAKE', 'BOARD', 'SIDE', 'CAT'] },
    ],
  },
  {
    groups: [
      { name: 'Knots', words: ['BOWLINE', 'REEF', 'GRANNY', 'CLOVE'] },
      { name: 'Under the sea', words: ['WRECK', 'TRENCH', 'VENT', 'SHELF'] },
      { name: 'Problems', words: ['HITCH', 'SNAG', 'GLITCH', 'HICCUP'] },
      { name: 'Relatives', words: ['NIECE', 'COUSIN', 'UNCLE', 'NEPHEW'] },
    ],
  },
];
