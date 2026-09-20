/**
 * The seven-letter words an Anagram Hunt is built from (docs/games/anagram-hunt.md).
 *
 * Seven, because six is not a game: measured against the words we already ship, a five-letter
 * base hides a median of three findable words and a six-letter base six, while seven hides
 * fifteen. This was the one thing our word lists did not have, and it is the cheapest kind of
 * list to write, being words with no clues attached.
 *
 * Every base here hides at least eight words a person knows. The ones that did not were dropped,
 * and the test checks the property again rather than trusting that they were.
 */
const PACKED: readonly string[] = [
  'absence account accused acquire address adviser airport already',
  'amateur america analyse ancient another apology apparel appears',
  'arrange article assumed athlete attempt attract auction average',
  'balance bandage banquet barrier battery bearing because bedroom',
  'beneath benefit blanket brother builder cabinet capable capital',
  'caption capture careful carrier cartoon caution central century',
  'certain chamber chapter charity charter chatter cheaper chicken',
  'cleaner clearly climate clothes combine comment company compare',
  'compete concept concert confirm connect consent contain content',
  'contest context control convert cottage counter country courage',
  'crystal current custody darling dealing decline default deliver',
  'density deposit desktop despite destroy details develop diagram',
  'diamond dilemma diploma display dispute distant diverse dolphin',
  'drawing dynasty eastern edition educate elevate embrace enclose',
  'endless ensured entered entitle episode erosion exactly examine',
  'example explain extract factory faculty failure feature feeling',
  'finance fixture flavour foreign formula fortune forward founder',
  'fragile freedom freight friends funding furnace gallery gateway',
  'general gesture glacier glimpse granite gravity greater gymnast',
  'halfway hallway hamster handles harbour harvest healthy hearing',
  'herbage history holiday honesty hostage housing however hundred',
  'hunting husband imagine imitate impulse inbound include inflate',
  'inhabit inherit insight inspect install integer intense interim',
  'involve jackpot janitor justice keeping kindred kingdom kitchen',
  'knowing lantern laptops largely lasting laundry lawyers leading',
  'learned lecture legally library lighter limited lobster lodging',
  'logical machine magnify mailbox mandate marking meaning measure',
  'medical meeting melting mention mineral mistake mixture mobiles',
  'modular monarch monitor monster monthly musical natural neither',
  'nervous network neutral nominal nothing nuclear numeric obscure',
  'observe operate optical organic outside overall package painter',
  'palette panther parents partner passage passion patient pattern',
  'payment penalty pending pension perhaps persist picture pioneer',
  'pitcher plastic playful pleased plunger pointer portion posture',
  'pottery poverty precise predict present prevent primary printer',
  'privacy problem produce profile program project promise promote',
  'protect proudly provide publish purpose pursuit quarter rainbow',
  'rampart readily reading realise rebuild receipt recital reflect',
  'refusal regards regular related release remains remnant removal',
  'renewal replace reptile resolve respect respond restore retreat',
  'returns reunion revised rewrite ribbons routine royalty running',
  'scatter scholar scratch section segment seminar senator setting',
  'seventh several shallow shelter shorter showers silence similar',
  'sincere sixteen skilled skipper slender slipper society soldier',
  'someone soprano special spinner station stellar stomach storage',
  'stories student subject sunrise support surface surgeon sustain',
  'swallow sweater symptom tangent teacher teenage tempest tenants',
  'tension terrace terrain textile theatre therapy thermal thinker',
  'thunder tickets tonight torture tourist towards tractor traffic',
  'tragedy trailer trainer transit trapped travels treason treated',
  'trellis tribute trolley trouble trusted twisted typical uncover',
  'uniform upgrade urgency valleys variety venture veteran village',
  'vintage violent voltage voyager waiting walking wanting warfare',
  'warning warrant washing watched weather webpage wedding welfare',
  'western wetland whisper witness worried wrapped writing younger',
];

export const BASES: readonly string[] = PACKED.join(' ').split(' ');
