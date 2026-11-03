// The search text index: the word, digit, Han and kana units of a title
// with their readings, built once and matched against many queries.
import type { SearchTextIndex, SearchTextIndexOptions, SearchUnitKind } from '../types';
import { SEARCH_HAN_PATTERN, SEARCH_LETTER_ALTERNATES, SEARCH_WORD_CHARACTERS_PATTERN, SEARCH_WORD_PART_PATTERN, foldSearchCharacter, normalizeSearchHanReadings } from './text-normalize';

// A run of letters of the scripts that write words apart, before it is
// split into words: per letter, where it starts and ends in the source and
// its second spelling.
interface WordRun {
  text: string;
  starts: number[];
  ends: number[];
  alternates: string[];
  // Each letter is one source character.
  simple: boolean;
  hasAlternate: boolean;
}

const SEARCH_UNIT_WORD: SearchUnitKind = 'w';
const SEARCH_UNIT_DIGIT: SearchUnitKind = 'd';
const SEARCH_UNIT_HAN: SearchUnitKind = 'h';
const SEARCH_UNIT_CHAR: SearchUnitKind = 'c';

// Hiragana (katakana fold to it), except の, which Chinese titles borrow.
function isSearchKanaCode(code: number): boolean {
  return (code >= 0x3041 && code <= 0x3096 && code !== 0x306e) || (code >= 0x30f7 && code <= 0x30fa);
}

// A title as the sequence of units a query spells: words of the scripts
// that write words apart (split at camel case and digits), digit runs, and
// single characters. A Han character carries its pinyin readings, every
// reading of a polyphone. Marks stay with the letter they sit on. Units
// remember where they sit in the original text for highlighting. Thousands
// of these stay cached, so each field is one compact value: kinds and
// segment starts as strings, spans as start/end pairs.
// The index while it is being built from a title, character by character.
interface IndexBuilder {
  kinds: string;
  segments: string;
  breaks: string;
  texts: string[];
  spans: number[];
  // Per word: where each of its letters ends, when the letters are not one
  // source character each ("ﬁ", accents typed apart), and its second
  // spelling ("mueller" for Müller).
  letterEnds: Record<number, number[]> | null;
  alternates: Record<number, string> | null;
  segmentStart: boolean;
  breakBefore: boolean;
  spaceBefore: boolean;
  lastKind: string;
  attachable: boolean;
  hasKana: boolean;
  run: WordRun | null;
}

function isCjkKind(kind: string): boolean {
  return kind === SEARCH_UNIT_HAN || kind === SEARCH_UNIT_CHAR;
}

function pushUnit(
  builder: IndexBuilder,
  kind: SearchUnitKind,
  unitText: string,
  span: readonly [number, number],
  ends?: number[] | null,
  alternate?: string
): void {
  if (ends) {
    builder.letterEnds = builder.letterEnds || {};
    builder.letterEnds[builder.texts.length] = ends;
  }
  if (alternate) {
    builder.alternates = builder.alternates || {};
    builder.alternates[builder.texts.length] = alternate;
  }
  // A space next to Han text separates word groups ("GitHub 仓库",
  // "微信 读书"); between words of other scripts it only separates words.
  const startsSegment = builder.segmentStart || (builder.spaceBefore && (isCjkKind(kind) || isCjkKind(builder.lastKind)));
  builder.kinds += kind;
  builder.segments += startsSegment ? '1' : '0';
  builder.breaks += builder.breakBefore ? '1' : '0';
  builder.texts.push(unitText);
  builder.spans.push(span[0], span[1]);
  builder.segmentStart = false;
  builder.breakBefore = false;
  builder.spaceBefore = false;
  builder.lastKind = kind;
  builder.attachable = true;
}

// The word run so far becomes word and digit units.
function flushRun(builder: IndexBuilder): void {
  const current = builder.run;
  if (!current) {
    return;
  }
  SEARCH_WORD_PART_PATTERN.lastIndex = 0;
  let match = SEARCH_WORD_PART_PATTERN.exec(current.text);
  while (match) {
    const from = match.index;
    const to = from + match[0].length;
    const word = match[0].toLowerCase();
    const alternate = current.hasAlternate ? current.alternates.slice(from, to).join('').toLowerCase() : '';
    pushUnit(
      builder,
      /^\d/.test(match[0]) ? SEARCH_UNIT_DIGIT : SEARCH_UNIT_WORD,
      word,
      [current.starts[from], current.ends[to - 1]],
      current.simple ? null : current.ends.slice(from, to),
      alternate && alternate !== word ? alternate : ''
    );
    match = SEARCH_WORD_PART_PATTERN.exec(current.text);
  }
  builder.run = null;
}

// A mark belongs to the letter before it: an accent typed on its own folds
// away, a Devanagari or Thai vowel sign stays part of it.
function addMark(builder: IndexBuilder, folded: string, start: number, offset: number): void {
  if (builder.run) {
    builder.run.simple = false;
    builder.run.ends[builder.run.ends.length - 1] = offset;
  } else if (builder.attachable && builder.texts.length > 0) {
    const last = builder.texts.length - 1;
    builder.spans[last * 2 + 1] = offset;
    builder.texts[last] += folded.toLowerCase();
  } else if (folded) {
    pushUnit(builder, SEARCH_UNIT_CHAR, folded.toLowerCase(), [start, offset]);
  }
}

function addWordCharacter(builder: IndexBuilder, character: string, folded: string, start: number, offset: number): void {
  if (!builder.run) {
    builder.run = { text: '', starts: [], ends: [], alternates: [], simple: true, hasAlternate: false };
  }
  const run = builder.run;
  if (folded.length !== 1 || character.length !== 1) {
    run.simple = false;
  }
  const alternate = SEARCH_LETTER_ALTERNATES.get(character);
  if (alternate) {
    run.hasAlternate = true;
  }
  run.text += folded;
  for (let i = 0; i < folded.length; i += 1) {
    run.starts.push(start);
    run.ends.push(offset);
    run.alternates.push(i === 0 && alternate ? alternate : (i === 0 ? folded : ''));
  }
}

// A letter of another script becomes a unit of its own; punctuation such as
// the "-" or "|" in "Home - Visual Studio Code" starts a new segment.
function addOtherCharacter(builder: IndexBuilder, character: string, folded: string, start: number, offset: number): void {
  flushRun(builder);
  const lower = folded.toLowerCase();
  if (/^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*$/u.test(lower)) {
    if (isSearchKanaCode(lower.codePointAt(0) ?? 0)) {
      builder.hasKana = true;
    }
    pushUnit(builder, SEARCH_UNIT_CHAR, lower, [start, offset]);
    return;
  }
  builder.attachable = false;
  if (/[^\s\p{M}]/u.test(character)) {
    builder.segmentStart = true;
    builder.breakBefore = builder.texts.length > 0;
  } else if (/\s/.test(character)) {
    builder.spaceBefore = true;
  }
}

function addCharacter(builder: IndexBuilder, character: string, start: number, offset: number): void {
  if (SEARCH_HAN_PATTERN.test(character)) {
    flushRun(builder);
    pushUnit(builder, SEARCH_UNIT_HAN, foldSearchCharacter(character), [start, offset]);
    return;
  }
  const folded = foldSearchCharacter(character);
  if (!folded || /^\p{M}+$/u.test(folded)) {
    addMark(builder, folded, start, offset);
  } else if (SEARCH_WORD_CHARACTERS_PATTERN.test(folded)) {
    addWordCharacter(builder, character, folded, start, offset);
  } else {
    addOtherCharacter(builder, character, folded, start, offset);
  }
}

function buildSearchTextIndex(text: unknown, options?: SearchTextIndexOptions | null): SearchTextIndex {
  const settings: SearchTextIndexOptions = options && typeof options === 'object' ? options : {};
  const source = String(text || '');
  const builder: IndexBuilder = {
    kinds: '',
    segments: '',
    breaks: '',
    texts: [],
    spans: [],
    letterEnds: null,
    alternates: null,
    segmentStart: true,
    breakBefore: false,
    spaceBefore: false,
    lastKind: '',
    attachable: false,
    hasKana: false,
    run: null
  };
  let offset = 0;
  Array.from(source).forEach((character) => {
    const start = offset;
    offset += character.length;
    addCharacter(builder, character, start, offset);
  });
  flushRun(builder);
  return {
    text: source,
    count: builder.texts.length,
    kinds: builder.kinds,
    segments: builder.segments,
    breaks: builder.breaks,
    texts: builder.texts.slice(),
    spans: builder.spans.slice(),
    letterEnds: builder.letterEnds,
    alternates: builder.alternates,
    readings: null,
    getHanReadings: typeof settings.getHanReadings === 'function' ? settings.getHanReadings : null,
    // Kanji in a Japanese title are not read as Chinese pinyin.
    readingsResolved: !builder.kinds.includes(SEARCH_UNIT_HAN) || builder.hasKana
  };
}

// Readings are looked up the first time a typed letter meets the index, so
// a query of Han characters never needs the pinyin data.
function resolveSearchTextIndexReadings(index: SearchTextIndex): void {
  if (index.readingsResolved) {
    return;
  }
  index.readingsResolved = true;
  if (!index.getHanReadings) {
    return;
  }
  const hanUnits: number[] = [];
  for (let unit = 0; unit < index.count; unit += 1) {
    if (index.kinds.charAt(unit) === SEARCH_UNIT_HAN) {
      hanUnits.push(unit);
    }
  }
  let readings: unknown = null;
  try {
    readings = index.getHanReadings(index.text, hanUnits.map((unit) => index.texts[unit]));
  } catch (error) {
    readings = null;
  }
  if (Array.isArray(readings)) {
    const lookedUp = readings;
    const resolved: Array<string[] | null> = new Array(index.count).fill(null);
    hanUnits.forEach((unit, position) => {
      resolved[unit] = normalizeSearchHanReadings(lookedUp[position]);
    });
    index.readings = resolved;
  }
}

export {
  SEARCH_UNIT_CHAR,
  SEARCH_UNIT_DIGIT,
  SEARCH_UNIT_HAN,
  SEARCH_UNIT_WORD,
  buildSearchTextIndex,
  resolveSearchTextIndexReadings
};
