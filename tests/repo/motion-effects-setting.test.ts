// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { builtModules, readLocaleMessages, readRepoText } from './repository';

// The motion effects setting turns off the New Tab and overlay entrances.

// The modules every script a page loads carries.
function pageModules(page: string): string[] {
  const doc = new DOMParser().parseFromString(readRepoText(page), 'text/html');
  return Array.from(doc.scripts, (script) => script.getAttribute('src') || '')
    .map((src) => src.replace(/^\.\.\/\.\.\/build\//, ''))
    .flatMap(builtModules);
}

describe('motion effects setting', () => {
  it('preloads the synchronized entry-motion preference on New Tab before it is revealed', () => {
    expect(builtModules('newtab-preload.js')).toContain('src/shared/motion-preload.ts');
  });

  it.each(['src/options/options.html', 'src/onboarding/onboarding.html'])('leaves %s without the New Tab entry-motion preference', (page) => {
    expect(pageModules(page)).not.toContain('src/shared/motion-preload.ts');
  });

  it.each([
    ['en', 'Motion effects', 'Turn this off if performance stutters or you prefer a snappier opening experience'],
    ['ja', 'アニメーション効果', '動作が重い場合や、より素早く表示したい場合はオフにできます'],
    ['zh_CN', '动态效果', '如遇卡顿，或倾向于更利落的唤起方式，可关闭'],
    ['zh_TW', '動態效果', '若畫面不順暢，或偏好更俐落的叫出方式，可關閉']
  ])('names and explains the setting in %s', (locale, title, description) => {
    const messages = readLocaleMessages(locale);

    expect(messages.settings_motion_effects_title).toBe(title);
    expect(messages.settings_motion_effects_desc).toBe(description);
  });
});
