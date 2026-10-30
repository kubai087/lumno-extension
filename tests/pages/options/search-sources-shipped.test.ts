import { describe, expect, it } from 'vitest';
import { parseCss, parsePageCss, readRepoFile, readStylesheetSource, type CssRule, type ParsedCss } from '../../fakes/css';

// The Search sources tab as shipped: the page's styles for its editors and
// its add form, and the copy each core locale gives it.

const GHOST = '._x_extension_shortcut_ghost_2026_unique_';
const EDITOR = '._x_extension_shortcut_editor_2024_unique_';
const FORM_FIELDS = '._x_extension_shortcut_form_fields_2024_unique_';

function requireRule(css: ParsedCss, selector: string): CssRule {
  const found = css.rule(selector);
  if (!found) {
    throw new Error(`No rule for ${selector}`);
  }
  return found;
}

function readMessages(locale: string): Record<string, { message?: string } | undefined> {
  const parsed: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${locale} has no messages`);
  }
  return Object.fromEntries(Object.entries(parsed));
}

describe('Options search sources styles', () => {
  const pageCss = parsePageCss('src/options/options.html');
  // As written, so the shared accordion tokens stay visible.
  const optionsCss = parseCss(readStylesheetSource('src/options/options.css'));

  it('spreads the template header so the query button sits at its right', () => {
    const header = requireRule(pageCss, '._x_extension_site_search_template_header_2026_unique_');
    expect([header.get('justify-content'), header.get('width')]).toEqual(['space-between', '100%']);
    const insert = requireRule(pageCss, '._x_extension_shortcut_submit_2024_unique_._x_extension_site_search_insert_query_2026_unique_');
    expect(insert.get('margin-left')).toBe('auto');
    // It moves as a control; its label stays left-aligned.
    expect(insert.has('text-align')).toBe(false);
  });

  it('keeps ghost buttons quiet until hovered, in both themes', () => {
    const ghost = requireRule(pageCss, GHOST);
    expect(['--settings-button-bg', '--settings-button-shadow', '--settings-button-hover-bg'].map((name) => ghost.get(name)))
      .toEqual(['transparent', 'none', 'rgba(15, 23, 42, 0.045)']);
    // The compound selector outweighs the base button's `all: unset`.
    expect(requireRule(pageCss, `._x_extension_shortcut_submit_2024_unique_${GHOST}`).get('white-space')).toBe('nowrap');
    const dark = requireRule(pageCss, `body[data-theme="dark"] ${GHOST}`);
    expect(['--settings-button-color', '--settings-button-bg', '--settings-button-shadow', '--settings-button-hover-bg',
      '--settings-button-hover-color'].map((name) => dark.get(name))).toEqual([
      'var(--panel-subtext)',
      'transparent',
      'none',
      'color-mix(in srgb, var(--control-hover-bg) 72%, transparent)',
      'var(--panel-text)'
    ]);
    // The hover is the variant's tokens, not a rule of its own.
    expect(pageCss.rule(`body[data-theme="dark"] ${GHOST}:hover`)).toBeNull();
  });

  it('sizes editors and add forms to their content, with no height cap to clip them', () => {
    const capped = optionsCss.entries.filter((entry) => entry.selectors.some((selector) => [EDITOR, FORM_FIELDS,
      '._x_extension_shortcut_form_2024_unique_'].some((name) => selector.includes(name))) && entry.style.names.includes('max-height'));
    expect(capped.map((entry) => entry.selectors.join(', '))).toEqual([]);
  });

  it('opens and closes editors and add forms on the shared accordion timing', () => {
    const editor = requireRule(optionsCss, EDITOR);
    expect([editor.get('height'), editor.get('interpolate-size')]).toEqual(['0', 'allow-keywords']);
    expect(editor.get('transition')).toContain('height var(--lumno-accordion-close)');
    const openEditor = requireRule(optionsCss, `._x_extension_shortcut_item_2024_unique_[data-expanded="true"] ${EDITOR}`);
    expect(openEditor.get('height')).toBe('auto');
    expect(openEditor.get('transition')).toContain('height var(--lumno-accordion-open)');
    const fields = requireRule(optionsCss, FORM_FIELDS);
    expect([fields.get('height'), fields.get('interpolate-size')]).toEqual(['0', 'allow-keywords']);
    expect(fields.get('transition')).toContain('height var(--lumno-accordion-close)');
    const openFields = requireRule(optionsCss, `._x_extension_shortcut_form_2024_unique_[data-expanded="true"] ${FORM_FIELDS}`);
    expect(openFields.get('height')).toBe('auto');
    expect(openFields.get('transition')).toContain('height var(--lumno-accordion-open)');
  });

  it('stops rendering closed editors and add forms once their close has played out', () => {
    [EDITOR, FORM_FIELDS].forEach((selector) => {
      const closed = requireRule(optionsCss, selector);
      expect(closed.get('content-visibility')).toBe('hidden');
      expect(closed.get('transition')).toContain('content-visibility 0s linear var(--lumno-duration-xl) allow-discrete');
    });
  });

  it('isolates the aggregate source list so its card animates without dropped frames', () => {
    expect(requireRule(optionsCss, '._x_extension_aggregate_search_sources_2026_unique_').get('contain')).toBe('layout paint');
  });
});

describe('Options search sources copy', () => {
  it.each([
    ['en', 'Insert query variable'],
    ['ja', '検索変数を挿入'],
    ['zh_CN', '插入查询变量'],
    ['zh_TW', '插入查詢變數']
  ])('names the query insert button in %s', (locale, label) => {
    expect(readMessages(locale).shortcuts_insert_query?.message).toBe(label);
  });

  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('words the search engine group in %s', (locale) => {
    const messages = readMessages(locale);
    ['search_scope_group_engines', 'shortcuts_empty_engines', 'shortcuts_label_display_group'].forEach((key) => {
      expect(messages[key]?.message, `${locale} ${key}`).toBeTruthy();
    });
  });
});
