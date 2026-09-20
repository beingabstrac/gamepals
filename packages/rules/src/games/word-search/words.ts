/**
 * Themed word lists for Word Search (docs/games/word-search.md). Written for this game, so no
 * licence and no dictionary to ship: a themed puzzle reads better than a bag of random words,
 * and a short list per theme keeps the grid full of letters that look like they belong.
 * Every word is 3 to 9 letters, plain, and spelled the same either side of the Atlantic where
 * that was possible.
 */
export interface Theme {
  readonly name: string;
  readonly words: readonly string[];
}

export const THEMES: readonly Theme[] = [
  {
    name: 'Animals',
    words: ['otter', 'badger', 'camel', 'donkey', 'falcon', 'gecko', 'hamster', 'iguana', 'jaguar', 'koala', 'lizard', 'moose', 'newt', 'ostrich', 'panda', 'rabbit', 'seal', 'tiger', 'walrus', 'zebra'],
  },
  {
    name: 'Food',
    words: ['bread', 'butter', 'cheese', 'noodle', 'olive', 'pasta', 'pepper', 'rice', 'salad', 'soup', 'stew', 'sugar', 'toast', 'waffle', 'yogurt', 'honey', 'pie', 'jam'],
  },
  {
    name: 'Space',
    words: ['comet', 'crater', 'earth', 'galaxy', 'lunar', 'mars', 'meteor', 'moon', 'nebula', 'orbit', 'planet', 'rocket', 'saturn', 'solar', 'star', 'venus'],
  },
  {
    name: 'Weather',
    words: ['breeze', 'cloud', 'damp', 'drizzle', 'flood', 'fog', 'frost', 'gale', 'hail', 'ice', 'mist', 'rain', 'shower', 'sleet', 'snow', 'storm', 'sunny', 'thunder', 'wind'],
  },
  {
    name: 'Sport',
    words: ['archery', 'boxing', 'cricket', 'diving', 'golf', 'hockey', 'judo', 'karate', 'medal', 'rowing', 'rugby', 'runner', 'skating', 'soccer', 'tennis', 'umpire'],
  },
  {
    name: 'Music',
    words: ['banjo', 'bass', 'cello', 'chord', 'drum', 'flute', 'guitar', 'harp', 'lyric', 'melody', 'oboe', 'organ', 'piano', 'rhythm', 'singer', 'tempo', 'tuba', 'violin'],
  },
  {
    name: 'Jobs',
    words: ['artist', 'baker', 'builder', 'chef', 'dentist', 'doctor', 'driver', 'farmer', 'guard', 'judge', 'nurse', 'pilot', 'plumber', 'sailor', 'teacher', 'vet', 'writer'],
  },
  {
    name: 'Colours',
    words: ['amber', 'beige', 'black', 'blue', 'bronze', 'brown', 'coral', 'cream', 'golden', 'green', 'grey', 'indigo', 'ivory', 'lemon', 'lilac', 'olive', 'orange', 'pink', 'purple', 'silver'],
  },
  {
    name: 'The house',
    words: ['attic', 'carpet', 'chair', 'closet', 'couch', 'curtain', 'door', 'garage', 'garden', 'hallway', 'kettle', 'kitchen', 'lamp', 'mirror', 'pillow', 'roof', 'shelf', 'stairs', 'table', 'window'],
  },
  {
    name: 'The sea',
    words: ['anchor', 'beach', 'coral', 'crab', 'current', 'diver', 'dolphin', 'harbour', 'island', 'lagoon', 'lobster', 'oyster', 'pearl', 'sailor', 'shark', 'shell', 'tide', 'wave', 'whale'],
  },
  {
    name: 'Fruit',
    words: ['apple', 'apricot', 'banana', 'berry', 'cherry', 'date', 'fig', 'grape', 'guava', 'lemon', 'lime', 'mango', 'melon', 'olive', 'orange', 'papaya', 'peach', 'pear', 'plum'],
  },
  {
    name: 'Travel',
    words: ['airport', 'bus', 'cabin', 'ferry', 'flight', 'hotel', 'journey', 'luggage', 'map', 'passport', 'platform', 'railway', 'suitcase', 'taxi', 'ticket', 'tourist', 'train', 'visa'],
  },
];
