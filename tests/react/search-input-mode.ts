// What the search input mode tests share: a pinyin stand-in, the input's
// parts as a surface renders them, and the controller with that stand-in.
import { vi } from 'vitest';
import { HAN_VARIANT_PAIRS } from '../../src/domain/search/han-variants.generated';
import { installHanVariantPairs } from '../../src/domain/search/han-variants';
import type { PinyinApi } from '../../src/domain/search/pinyin-api';
import * as searchInputModeModule from '../../src/shared/search/search-input-mode';
import { createSearchInput } from '../../src/shared/react/search-input';
import { getTestPortals } from './portals';

// A pinyin-pro stand-in with the readings these tests type.
export const testPinyinApi: PinyinApi = {
  pinyin(value: string) {
    const syllables: Record<string, string> = {
      包: 'bao',
      书: 'shu',
      签: 'qian',
      豆: 'dou'
    };
    return Array.from(String(value || '')).map((character) => (
      syllables[character] || ''
    )).filter(Boolean);
  }
};

export function getTestContrastRatio(firstRgb: number[], secondRgb: number[]) {
  const getLuminance = (rgb: number[]) => rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }).reduce((total, channel, index) => (
    total + (channel * [0.2126, 0.7152, 0.0722][index])
  ), 0);
  const firstLuminance = getLuminance(firstRgb);
  const secondLuminance = getLuminance(secondRgb);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

installHanVariantPairs(HAN_VARIANT_PAIRS);
// Every menu starts with the stand-in unless a test passes its own pinyinApi.
export const LumnoSearchInputMode = {
  ...searchInputModeModule,
  createInputModeController: (
    parts: Parameters<typeof searchInputModeModule.createInputModeController>[0],
    config?: Parameters<typeof searchInputModeModule.createInputModeController>[1]
  ) => searchInputModeModule.createInputModeController(parts, { pinyinApi: testPinyinApi, ...config })
};

// The search input's parts as a surface renders them.
export function createModeParts(surface: 'newtab' | 'overlay' = 'newtab') {
  const parts = createSearchInput({
    portals: getTestPortals(),
    modeBadge: { id: `${surface}-mode-badge`, surface }
  });
  parts.input.style.paddingLeft = '44px';
  document.body.appendChild(parts.container);
  return parts;
}

export function resetModeTest(): void {
  vi.useRealTimers();
  document.body.replaceChildren();
}
