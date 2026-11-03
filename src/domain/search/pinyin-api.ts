// The part of pinyin-pro's API search uses: the readings of Han text,
// without tones, and the readings a title's characters are matched by.
import { SEARCH_HAN_PATTERN, foldSearchCharacter } from './utils/text-normalize';

interface PinyinOptions {
  toneType: 'none';
  type: 'array';
  multiple?: boolean;
  v: boolean;
}

interface PinyinApi {
  pinyin(text: string, options: PinyinOptions): string[];
}

// Wraps a loaded `pinyin` function, or returns null when the value is not
// one. Readings come back as strings whatever the library returns.
function toPinyinApi(pinyin: unknown): PinyinApi | null {
  if (typeof pinyin !== 'function') {
    return null;
  }
  return {
    pinyin: (text, options) => {
      const converted: unknown = Reflect.apply(pinyin, undefined, [text, options]);
      return Array.isArray(converted) ? converted.map((item: unknown) => String(item)) : [];
    }
  };
}

// The API in a loaded module or published object that has a `pinyin`
// function, or null.
function readPinyinApi(loaded: unknown): PinyinApi | null {
  if (!loaded || typeof loaded !== 'object') {
    return null;
  }
  return toPinyinApi(Reflect.get(loaded, 'pinyin'));
}

// The title's Han characters in runs, as the text index folds them, so
// each run is read as the words it holds.
function readHanRuns(text: string, characters: readonly string[]): string[][] {
  const runs: string[][] = [];
  let run: string[] = [];
  Array.from(text).forEach((character) => {
    if (SEARCH_HAN_PATTERN.test(character)) {
      run.push(foldSearchCharacter(character));
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length > 0) {
    runs.push(run);
  }
  return runs.flat().join('') === characters.join('') ? runs : [characters.slice()];
}

// The readings a title's Han characters are matched by: the one each takes
// in the title's own words (重庆 is chongqing, 银行 yinhang) and its usual
// one (zhong, xing), so a polyphone matches as said there or as most often
// typed. Rarer readings are left out, since they let "hu" find 和平 and
// "di" find 我的.
function readSearchTitleHanReadings(
  api: PinyinApi,
  text: string,
  characters: readonly string[],
  getUsualReading: (character: string) => string
): string[][] {
  return readHanRuns(text, characters).flatMap((run) => {
    const said = api.pinyin(run.join(''), { toneType: 'none', type: 'array', v: true });
    const inContext = said.length === run.length ? said : [];
    return run.map((character, position) => {
      const readings: string[] = [];
      [inContext[position], getUsualReading(character)].forEach((reading) => {
        if (reading && !readings.includes(reading)) {
          readings.push(reading);
        }
      });
      return readings;
    });
  });
}

// A character's usual reading: the one pinyin-pro gives it alone.
function readSearchUsualHanReading(api: PinyinApi, character: string): string {
  return api.pinyin(character, { toneType: 'none', type: 'array', v: true })[0] || '';
}

export { readPinyinApi, readSearchTitleHanReadings, readSearchUsualHanReading, toPinyinApi };
export type { PinyinApi, PinyinOptions };
