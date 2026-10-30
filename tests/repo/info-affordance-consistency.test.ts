// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parsePageCss, parseStylesheet, type CssRule, type ParsedCss } from '../fakes/css';
import { readRepoText } from './repository';

// Info buttons look the same on every page. (Settings drawing every info
// affordance with the shared InfoButton is checked in tests/pages/options.)

const INFO = '._x_extension_info_button_2026_unique_';

function rule(css: ParsedCss, selector: string): CssRule {
  const found = css.rule(selector);
  if (!found) {
    throw new Error(`missing CSS rule for ${selector}`);
  }
  return found;
}

describe('info buttons', () => {
  const onboarding = parsePageCss('src/onboarding/onboarding.html');
  const shared = parseStylesheet('src/shared/ui/info-button.css');

  it.each([
    ['onboarding', () => rule(onboarding, '.interaction-info-button')],
    ['the shared InfoButton', () => rule(shared, INFO)]
  ])('give %s a 20px circular hit area', (_owner, read) => {
    const button = read();

    expect([button.get('width'), button.get('height'), button.get('border-radius')]).toEqual(['20px', '20px', '999px']);
  });

  it('share one color and one hover background between onboarding and Settings', () => {
    expect(rule(onboarding, '.interaction-info-button').get('color')).toBe(rule(shared, INFO).get('color'));
    expect(rule(onboarding, '.interaction-info-button:hover').get('background')).toBe(rule(shared, `${INFO}:hover`).get('background'));
  });

  it.each(['src/options/options.html', 'newtab.html'])('load the shared info styles in %s', (page) => {
    const doc = new DOMParser().parseFromString(readRepoText(page), 'text/html');

    expect(doc.querySelector('link[href="../shared/ui/info-button.css"]')).not.toBeNull();
  });
});
