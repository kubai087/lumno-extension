// Spelling a query through an index's units: the steps a unit allows, runs
// of units and initials, and pieces taken from across a title.
import type { SearchRange, SearchTextIndex } from '../types';
import { HANGUL_INITIAL_JAMO, addHangulSteps, getHangulParts } from './keyboard-layouts';
import { SEARCH_UNIT_CHAR, SEARCH_UNIT_DIGIT, SEARCH_UNIT_HAN, SEARCH_UNIT_WORD } from './text-index';
import { SEARCH_HAN_PATTERN } from './text-normalize';


type UnitStepType = 'full' | 'partial' | 'initial';

// One unit spelling part of the query.
interface UnitStep {
  unit: number;
  length: number;
  type: UnitStepType;
  // Spelled through a Han reading.
  reading: boolean;
  // Spelled through the unit's second spelling.
  alternate: boolean;
}

interface UnitPathShape {
  segmentStart: boolean;
  usesInitial: boolean;
  initialThenSpelled: boolean;
  singleHan: boolean;
  hasHan: boolean;
  literal: boolean;
  usesPinyin: boolean;
  abbreviation: boolean;
  anchored: boolean;
  exact: boolean;
}

interface UnitRun {
  path: UnitStep[];
  shape: UnitPathShape;
}


// The ways one unit can spell the query from position p: the whole word
// or reading, its initial ("zh", "ch" and "sh" count as initials), or any
// prefix when the query ends inside it.
type AddUnitStep = (length: number, type: UnitStepType, reading: boolean, alternate?: boolean) => void;

// Where the query is matched from: the query, its position and what is left.
interface StepCursor {
  query: string;
  position: number;
  tail: string;
}

// A Han character: itself, or its readings in full, cut short, by their
// zh/ch/sh initial or by their first letter.
function addHanSteps(text: string, readings: readonly string[], cursor: StepCursor, add: AddUnitStep): void {
  const { query, position, tail } = cursor;
  if (query.charAt(position) === text) {
    add(1, 'full', false);
  }
  readings.forEach((reading) => {
    if (query.startsWith(reading, position)) {
      add(reading.length, 'full', true);
    }
  });
  readings.forEach((reading) => {
    if (tail.length > 1 && tail.length < reading.length && reading.startsWith(tail)) {
      add(tail.length, 'partial', true);
    }
  });
  readings.forEach((reading) => {
    if (/^[zcs]h./.test(reading) && query.startsWith(reading.slice(0, 2), position)) {
      add(2, 'initial', true);
    }
  });
  readings.forEach((reading) => {
    if (reading.length > 1 && query.charAt(position) === reading.charAt(0)) {
      add(1, 'initial', true);
    }
  });
}

// A word or digit run: its second spelling, a prefix, or its initial.
function addWordSteps(text: string, kind: string, alternate: string | undefined, cursor: StepCursor, add: AddUnitStep): void {
  const { query, position, tail } = cursor;
  if (alternate) {
    if (query.startsWith(alternate, position)) {
      add(alternate.length, 'full', false, true);
    } else if (tail.length > 1 && tail.length < alternate.length && alternate.startsWith(tail)) {
      add(tail.length, 'partial', false, true);
    }
  }
  if (tail.length > 1 && tail.length < text.length && text.startsWith(tail)) {
    add(tail.length, 'partial', false);
  }
  // A digit run is not abbreviated: "1" only spells "15" where the query ends.
  if (text.length > 1 && query.charAt(position) === text.charAt(0)) {
    if (kind === SEARCH_UNIT_WORD) {
      add(1, 'initial', false);
    } else if (tail.length === 1) {
      add(1, 'partial', false);
    }
  }
}

function getSearchUnitSteps(index: SearchTextIndex, unit: number, query: string, position: number): UnitStep[] {
  const steps: UnitStep[] = [];
  const rest = query.length - position;
  const cursor: StepCursor = { query, position, tail: query.slice(position) };
  const add: AddUnitStep = (length, type, reading, alternate) => {
    if (length > 0 && length <= rest &&
        !steps.some((step) => step.length === length && step.type === type)) {
      steps.push({ unit, length, type, reading, alternate: Boolean(alternate) });
    }
  };
  const kind = index.kinds.charAt(unit);
  const text = index.texts[unit];
  if (kind === SEARCH_UNIT_HAN) {
    addHanSteps(text, (index.readings && index.readings[unit]) || [], cursor, add);
    return steps;
  }
  if (query.startsWith(text, position)) {
    add(text.length, 'full', false);
  }
  if (kind === SEARCH_UNIT_CHAR) {
    // A letter whose vowel sign is still being typed ("भ" for "भा").
    if (cursor.tail.length < text.length && text.startsWith(cursor.tail)) {
      add(cursor.tail.length, 'partial', false);
    }
    addHangulSteps(text, query, position, add);
    return steps;
  }
  addWordSteps(text, kind, index.alternates ? index.alternates[unit] : undefined, cursor, add);
  return steps;
}

// A mark is drawn with the letter it sits on, so a highlight never ends
// before it: splitting a word there would also break the joining of Arabic
// letters.
function extendSearchRangesOverMarks(text: string, ranges: SearchRange[]): SearchRange[] {
  const isMark = (position: number) => position < text.length && /^\p{M}$/u.test(text.charAt(position));
  const extended = ranges.map(([start, end]): SearchRange => {
    let stop = end;
    while (isMark(stop)) {
      stop += 1;
    }
    return [start, stop];
  });
  return mergeSearchRanges(extended);
}

function mergeSearchRanges(ranges: SearchRange[]): SearchRange[] {
  const sorted = (Array.isArray(ranges) ? ranges : [])
    .filter((range) => Array.isArray(range) && range[1] > range[0])
    .map((range): SearchRange => [range[0], range[1]])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged: SearchRange[] = [];
  sorted.forEach((range) => {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push(range);
    }
  });
  return merged;
}

function describeSearchUnitPath(index: SearchTextIndex, path: UnitStep[]): UnitPathShape {
  const firstUnit = path[0].unit;
  const lastStep = path[path.length - 1];
  const abbreviation = path.every((step) => (
    step.type === 'initial' ||
    (step.type === 'full' && index.kinds.charAt(step.unit) === SEARCH_UNIT_WORD &&
      index.texts[step.unit].length === 1)
  ));
  const anchored = firstUnit === 0;
  const firstInitial = path.findIndex((step) => step.type === 'initial');
  return {
    segmentStart: index.segments.charAt(firstUnit) === '1',
    usesInitial: firstInitial >= 0,
    // An initial followed by a spelled unit: "t" + "he" (他和), "wx" + "dushu".
    initialThenSpelled: firstInitial >= 0 &&
      path.slice(firstInitial + 1).some((step) => step.type !== 'initial'),
    singleHan: path.length === 1 && index.kinds.charAt(firstUnit) === SEARCH_UNIT_HAN,
    hasHan: path.some((step) => index.kinds.charAt(step.unit) === SEARCH_UNIT_HAN),
    // Characters typed as themselves ("文档"), not read through pinyin.
    literal: path.every((step) => (
      !step.reading && step.type === 'full' &&
      (index.kinds.charAt(step.unit) === SEARCH_UNIT_HAN || index.kinds.charAt(step.unit) === SEARCH_UNIT_CHAR)
    )),
    usesPinyin: path.some((step) => step.reading),
    abbreviation,
    anchored,
    exact: anchored && lastStep.unit === index.count - 1 && (lastStep.type === 'full' || abbreviation)
  };
}

function getSearchUnitStepRange(index: SearchTextIndex, step: UnitStep): SearchRange {
  const start = index.spans[step.unit * 2];
  const kind = index.kinds.charAt(step.unit);
  if (step.type === 'full' || step.alternate || (kind !== SEARCH_UNIT_WORD && kind !== SEARCH_UNIT_DIGIT)) {
    return [start, index.spans[step.unit * 2 + 1]];
  }
  const letterEnds = index.letterEnds && index.letterEnds[step.unit];
  return [start, letterEnds ? letterEnds[step.length - 1] : start + step.length];
}

// Whether a unit can spell the given first letter or character at all; a
// quick test before working out its steps.
function canSearchUnitStartWith(index: SearchTextIndex, unit: number, character: string): boolean {
  const text = index.texts[unit];
  if (index.kinds.charAt(unit) !== SEARCH_UNIT_HAN) {
    if (text.charAt(0) === character) {
      return true;
    }
    // A Hangul syllable starts with its initial consonant, typed alone or
    // as the first part of the syllable being typed.
    const unitParts = text.length === 1 ? getHangulParts(text) : null;
    if (!unitParts) {
      return false;
    }
    const typedParts = getHangulParts(character);
    return character.charCodeAt(0) === HANGUL_INITIAL_JAMO[unitParts.initial] ||
      Boolean(typedParts && typedParts.initial === unitParts.initial);
  }
  if (text === character) {
    return true;
  }
  const readings = index.readings && index.readings[unit];
  return Boolean(readings && readings.some((reading) => reading.charAt(0) === character));
}

// Whether a run may go on from this step to the next unit. Across
// punctuation only whole words and syllables carry on ("wifi" for Wi-Fi,
// "gpt4" for GPT-4): initials there are a coincidence of the title and its
// site name, as "dd" in "Dribbble - Discover". This checks the step before
// a break; walk drops initials after one.
function canSearchRunContinue(index: SearchTextIndex, step: UnitStep, next: number, position: number, query: string): boolean {
  return position >= query.length || index.breaks.charAt(next) !== '1' || step.type === 'full';
}

// The first place the query reads as consecutive units of the text, each
// spelled in full, by its initial, or by a prefix where the query ends.
function findSearchUnitRun(index: SearchTextIndex, compact: string): UnitRun | null {
  const failed = new Set<number>();
  const path: UnitStep[] = [];
  const walk = (unit: number, position: number, afterBreak: boolean): boolean => {
    if (position === compact.length) {
      return true;
    }
    if (unit >= index.count) {
      return false;
    }
    const key = (unit * (compact.length + 1) + position) * 2 + (afterBreak ? 1 : 0);
    if (failed.has(key) || !canSearchUnitStartWith(index, unit, compact.charAt(position))) {
      return false;
    }
    const steps = getSearchUnitSteps(index, unit, compact, position)
      .filter((step) => !afterBreak || step.type !== 'initial');
    for (let i = 0; i < steps.length; i += 1) {
      const next = position + steps[i].length;
      if (!canSearchRunContinue(index, steps[i], unit + 1, next, compact)) {
        continue;
      }
      path.push(steps[i]);
      if (walk(unit + 1, next, next < compact.length && index.breaks.charAt(unit + 1) === '1')) {
        return true;
      }
      path.pop();
    }
    failed.add(key);
    return false;
  };

  for (let start = 0; start < index.count; start += 1) {
    path.length = 0;
    if (!walk(start, 0, false)) {
      continue;
    }
    const shape = describeSearchUnitPath(index, path);
    // Initials, a lone syllable and two letters are weak evidence: inside a
    // phrase "js" would find every 技术 and "pin" every 品牌, so they have to
    // start one. Spelling across units ("shipin", "iphone15") and Han
    // characters typed as themselves may sit anywhere.
    if (!shape.literal && (compact.length <= 2 || shape.usesInitial || shape.singleHan) &&
        !shape.segmentStart) {
      continue;
    }
    // Mixing an initial with spelling needs three units: "wxdushu" is typed
    // for 微信读书, while English words such as "the" read as 他和.
    if (shape.initialThenSpelled && path.length < 3) {
      continue;
    }
    return { path: path.slice(), shape };
  }
  return null;
}

// Longer queries are split into pieces only up to this length, which keeps
// the split search small.
const SEARCH_PIECES_QUERY_MAX_LENGTH = 24;

// A query that is not in the title as one run may still be there in pieces
// with other text between or around them: "飞书文档" in 飞书云文档 and in
// "文档 - 飞书", "feishuwendang" in 飞书云文档. Each piece has to hold on its
// own: two characters at least, under the same rules as a whole query, so
// initials still start a phrase. Every character of the query is covered,
// nothing is skipped, and no two pieces share a unit, so "中国银行" does not
// find 美国银行. Pieces typed as letters have to read Han characters, since
// English already separates its words with spaces. The split with the
// fewest pieces wins.
function findSearchUnitPieces(index: SearchTextIndex, compact: string): UnitRun[] | null {
  if (compact.length < 4 || compact.length > SEARCH_PIECES_QUERY_MAX_LENGTH) {
    return null;
  }
  const queryHasHan = SEARCH_HAN_PATTERN.test(compact);
  const runs = new Map<number, UnitRun | null>();
  const getRun = (from: number, to: number): UnitRun | null => {
    const key = from * (compact.length + 1) + to;
    const known = runs.get(key);
    if (known !== undefined) {
      return known;
    }
    const run = findSearchUnitRun(index, compact.slice(from, to));
    const usable = run && (queryHasHan || run.shape.hasHan) ? run : null;
    runs.set(key, usable);
    return usable;
  };
  // How far a piece starting at `from` could reach at most, from one pass
  // over the units without the piece rules. Splits that end beyond it
  // cannot match, so most titles are rejected after one short walk.
  const getReach = (from: number): number => {
    let reach = from;
    const seen = new Set<number>();
    // Unit and query position pairs still to walk.
    const stack: Array<[number, number]> = [];
    for (let unit = 0; unit < index.count; unit += 1) {
      if (canSearchUnitStartWith(index, unit, compact.charAt(from))) {
        stack.push([unit, from]);
      }
    }
    for (let entry = stack.pop(); entry; entry = stack.pop()) {
      const [unit, position] = entry;
      const key = unit * (compact.length + 1) + position;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const spellings = index.kinds.charAt(unit) === SEARCH_UNIT_HAN
        ? [index.texts[unit]].concat((index.readings && index.readings[unit]) || [])
        : [index.texts[unit]];
      spellings.forEach((spelling) => {
        let shared = 0;
        while (shared < spelling.length && compact.charAt(position + shared) === spelling.charAt(shared)) {
          shared += 1;
        }
        reach = Math.max(reach, position + shared);
      });
      getSearchUnitSteps(index, unit, compact, position).forEach((step) => {
        const next = position + step.length;
        if (next < compact.length && unit + 1 < index.count &&
            canSearchUnitStartWith(index, unit + 1, compact.charAt(next))) {
          stack.push([unit + 1, next]);
        }
      });
    }
    return reach;
  };
  const covers = new Map<number, UnitRun[] | null>();
  const cover = (from: number): UnitRun[] | null => {
    if (from === compact.length) {
      return [];
    }
    const known = covers.get(from);
    if (known !== undefined) {
      return known;
    }
    let best: UnitRun[] | null = null;
    for (let to = getReach(from); to >= from + 2; to -= 1) {
      const run = getRun(from, to);
      const rest = run ? cover(to) : null;
      if (run && rest && (!best || rest.length + 1 < best.length)) {
        best = [run].concat(rest);
      }
    }
    covers.set(from, best);
    return best;
  };
  const pieces = cover(0);
  if (!pieces || pieces.length < 2) {
    return null;
  }
  const used = new Set<number>();
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = 0; j < pieces[i].path.length; j += 1) {
      const unit = pieces[i].path[j].unit;
      if (used.has(unit)) {
        return null;
      }
      used.add(unit);
    }
  }
  return pieces;
}

export {
  SEARCH_PIECES_QUERY_MAX_LENGTH,
  addHanSteps,
  addWordSteps,
  canSearchUnitStartWith,
  describeSearchUnitPath,
  extendSearchRangesOverMarks,
  findSearchUnitPieces,
  findSearchUnitRun,
  getSearchUnitStepRange,
  getSearchUnitSteps,
  mergeSearchRanges
};
export type {
  AddUnitStep,
  StepCursor,
  UnitPathShape,
  UnitRun,
  UnitStep,
  UnitStepType
};
