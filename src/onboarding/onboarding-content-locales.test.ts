import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../tests/fakes/css';
import {
  getOnboardingBlueprint,
  getOnboardingRuntimeCopy,
  getOnboardingTranslationSource,
  getSupportedLocales,
  needsOnboardingLocaleText,
  registerOnboardingLocaleText
} from './onboarding-content';

function collectStrings(value: unknown, bucket: string[] = []): string[] {
  if (typeof value === 'string') {
    bucket.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, bucket));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, bucket));
  }
  return bucket;
}

describe('Onboarding locales', () => {
  it('speaks every language the extension ships, the written ones first', () => {
    const locales = getSupportedLocales();
    expect(locales.slice(0, 4)).toEqual(['zh_CN', 'zh_TW', 'ja', 'en']);
    expect(locales).toEqual(expect.arrayContaining(['de', 'pt_BR']));
    const localesDir = join(REPO_ROOT, '_locales');
    const shipped = readdirSync(localesDir).filter((name) => existsSync(join(localesDir, name, 'messages.json'))).sort();
    expect(locales.slice().sort()).toEqual(shipped);
  });

  it('names each inline accordion link within its accordion text in every language', () => {
    getSupportedLocales().forEach((locale) => {
      getOnboardingBlueprint(locale).slides.forEach((slide) => {
        slide.left.interactionSlots.forEach((slot) => {
          (slot.accordion?.links || []).forEach((link) => {
            expect(slot.accordion?.text, `${locale} ${slot.id}`).toContain(link.label);
          });
        });
      });
    });
  });

  it('reads BCP-47 tags as extension locales and falls back to English', () => {
    expect(getOnboardingBlueprint('zh-CN').locale).toBe('zh_CN');
    const fallback = getOnboardingBlueprint('missing-locale');
    expect(fallback.locale).toBe('en');
    expect(fallback.slides[0].copy.title).toBe('Search bookmarks instantly');
  });

  it('lays a translated language over the English copy, leaving what it misses in English', () => {
    const source = getOnboardingTranslationSource();
    expect(source['intro.title']).toBe('Search bookmarks instantly');
    // Ids, URLs and icons are not offered for translation.
    expect(Object.keys(source).filter((key) => /(^|\.)(favicon|url|id)$/.test(key))).toEqual([]);
    expect(needsOnboardingLocaleText('de')).toBe(true);
    expect(needsOnboardingLocaleText('ja')).toBe(false);
    registerOnboardingLocaleText('de', {
      'intro.title': 'Lesezeichen sofort finden',
      'runtimeCopy.siteSearchDemo.cases.1.promptQuery': 'Worauf sollte ich in diesem PR achten?'
    });
    expect(needsOnboardingLocaleText('de')).toBe(false);
    const de = getOnboardingBlueprint('de-DE');
    expect([de.locale, de.htmlLang]).toEqual(['de', 'de']);
    expect(de.slides[0].copy.title).toBe('Lesezeichen sofort finden');
    const demo = de.runtimeCopy.siteSearchDemo.cases[1];
    expect(demo.promptQuery).toBe('Worauf sollte ich in diesem PR achten?');
    // A translated demo query sizes itself.
    expect(demo.promptWidth).toBeUndefined();
    expect(de.runtimeCopy.misc.openLabel).toBe('Open');
  });
});

describe('Onboarding English copy', () => {
  const en = getOnboardingBlueprint('en-US');

  it('keeps the intro compact with its rotating title', () => {
    expect([en.locale, en.htmlLang]).toEqual(['en', 'en']);
    expect(en.slides[0].copy.title).toBe('Search bookmarks instantly');
    expect(en.slides[0].copy.titleLines).toEqual(['Search bookmarks', 'instantly']);
    expect(en.slides[0].copy.titleCycle).toEqual({
      prefix: 'Search ',
      items: [
        { id: 'bookmark', label: 'bookmarks', tone: 'bookmark' },
        { id: 'history', label: 'history', tone: 'history' },
        { id: 'top-sites', label: 'top sites', tone: 'top-sites' },
        { id: 'settings', label: 'settings', tone: 'settings' }
      ]
    });
    expect(en.slides[0].copy.body).toBe('Open-source command bar + a cleaner new tab');
    expect(en.slides[0].left.interactionSlots.map((slot) => slot.label)).toEqual([
      'Open source, private by design',
      'Works in major browsers',
      'Friendly with other new-tab extensions'
    ]);
  });

  it('writes each later page as a two-line title over a short subtitle', () => {
    expect(en.slides.slice(1).map((slide) => slide.copy)).toEqual([
      {
        eyebrow: '',
        title: 'A command bar that feels native',
        titleLines: ['A command bar', 'that feels native'],
        body: 'Press {shortcut} to open Lumno anywhere.'
      },
      {
        eyebrow: '',
        title: 'A calmer new tab for where you go',
        titleLines: ['A calmer new tab', 'for where you go'],
        body: 'Make it yours. Bookmarks and history stay tidy.'
      },
      {
        eyebrow: '',
        title: 'AI / site search in one jump',
        titleLines: ['AI / site search', 'in one jump'],
        body: 'Type, hit Tab, and jump to the right search.'
      },
      {
        eyebrow: '',
        title: 'Tiny browser wins that add up',
        titleLines: ['Tiny browser wins', 'that add up'],
        body: 'Video popouts, new-tab polish, and useful extras.'
      }
    ]);
    en.slides.slice(1).forEach((slide) => {
      expect(slide.copy.titleLines).toHaveLength(2);
      (slide.copy.titleLines || []).forEach((line) => expect(line.length, line).toBeLessThanOrEqual(20));
      expect(slide.copy.body.length, slide.id).toBeLessThanOrEqual(56);
    });
  });

  it('labels the rows and actions in English', () => {
    expect(en.slides[1].left.interactionSlots[0].label).toBe('Using Dia?');
    expect(en.slides[1].actions.ghost?.label).toBe('Change shortcut');
    expect(en.slides[3].actions.ghost?.label).toBe('Supported sites');
    expect(en.slides[4].actions.primary?.label).toBe('Start using Lumno');
  });

  it('mirrors the real suggestion copy in the demos and keeps the badges to two lines', () => {
    const copy = getOnboardingRuntimeCopy('en');
    expect(copy.misc.openLabel).toBe('Open');
    expect(copy.newtabPreview.sections.bookmarks).toBe('Bookmarks');
    expect(copy.siteSearchDemo.tabHintTemplate).toBe('Search with {provider}');
    expect(copy.siteSearchDemo.cases.map(({ kind, resultTitle, actionLabel }) => ({ kind, resultTitle, actionLabel }))).toEqual([
      { kind: 'site', resultTitle: 'Search in GitHub "lumno extension"', actionLabel: 'Search' },
      { kind: 'ai', resultTitle: 'Ask ChatGPT "What should I watch for in this PR?"', actionLabel: 'Open ChatGPT web app' }
    ]);
    expect([copy.featureCards[0].title, copy.featureCards[0].body])
      .toEqual(['Auto Picture-in-Picture', 'Pops out when you leave a video tab']);
    expect(copy.featureAwards.map((award) => award.lines)).toEqual([
      ['Open source', 'Privacy first'],
      ['Free forever', 'No strings'],
      ['Feels native', 'stays light']
    ]);
  });
});

describe('Onboarding Chinese and Japanese copy', () => {
  it('reads Traditional Chinese for zh-Hant-TW', () => {
    const zhTw = getOnboardingBlueprint('zh-Hant-TW');
    expect([zhTw.locale, zhTw.htmlLang]).toEqual(['zh_TW', 'zh-TW']);
    expect(zhTw.slides[0].copy.title).toBe('讓書籤一搜即達');
    expect(zhTw.slides[1].left.interactionSlots[1].label).toBe('在本機 PDF/HTML 分頁中使用聚焦搜尋');
    expect(zhTw.slides[4].actions.secondary?.label).toBe('為我們評分');
  });

  it('writes Japanese with balanced badges and without long katakana terms', () => {
    const ja = getOnboardingBlueprint('ja-JP');
    expect([ja.locale, ja.htmlLang]).toEqual(['ja', 'ja']);
    expect(ja.slides[0].copy.title).toBe('ブックマークをすぐ検索');
    expect(ja.slides[1].copy.title).toBe('どこでも呼び出せる');
    expect(ja.slides[3].copy.body).toBe('検索語入力後に Tab。サイト内検索をすぐ開けます。');
    expect(ja.slides[4].actions.secondary?.label).toBe('評価する');
    expect(ja.slides[0].copy.titleCycle?.items[0].label).toBe('ブックマーク');
    expect(ja.slides[1].left.interactionSlots[1].label).toBe('ローカルの PDF/HTML で使う');
    expect(ja.slides[2].copy.body).toBe('見た目の調整と、ブックマークや履歴の整理をまとめて。');
    expect(ja.runtimeCopy.misc.feedbackLabel).toBe('フィードバックを送る');
    expect(ja.runtimeCopy.misc.bookmarkManagerLabel).toBe('ブックマークマネージャーを開く');
    expect(ja.runtimeCopy.newtabPreview.sections.bookmarks).toBe('ブックマーク');
    expect(ja.runtimeCopy.featureCards[0].title).toBe('動画を自動でピクチャーインピクチャー表示');
    expect(ja.runtimeCopy.featureAwards.map((award) => award.lines)).toEqual([
      ['中身を公開', '情報に配慮'],
      ['ずっと無料', '制限なし'],
      ['使いやすさ', '細部まで']
    ]);
    const strings = collectStrings(ja);
    ['ネイティブ', 'コマンドバー', 'ショートカット', 'オープンソース', 'ミニマル', 'プライバシー', 'リポジトリ',
      'カスタマイズ', 'オンボーディング', 'ナビゲーション', 'ワークスペース', 'ドキュメント', 'プレビュー'].forEach((term) => {
      expect(strings.filter((text) => text.includes(term)), term).toEqual([]);
    });
  });
});
