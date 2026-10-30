import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BlacklistForm,
  SiteSearchForm,
  type BlacklistFormRenderModel,
  type BlacklistFormSaveHandler,
  type SiteSearchFormRenderModel,
  type SiteSearchFormSaveHandler
} from './settings-forms';
import { createReactRootController } from '../../shared/react/root-controller';
import { getElement, getTag, getTags } from '../../../tests/fakes/dom';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

let controllers: Array<{ destroy(): void }> = [];

const siteModel: SiteSearchFormRenderModel = {
  copy: {
    addLabel: '添加站内搜索',
    aliasLabel: '别名',
    aliasPlaceholder: '例如 油管',
    cancelLabel: '取消',
    categoryLabel: '显示位置',
    keyLabel: '触发词',
    keyPlaceholder: '例如 yt',
    nameLabel: '显示名称',
    namePlaceholder: '选填',
    queryInsertLabel: '插入查询变量',
    searchEngineCategoryLabel: '搜索引擎',
    siteCategoryLabel: '站内搜索',
    templateHelp: '模板必须包含 {query}',
    templateLabel: '搜索模板',
    templatePlaceholder: 'https://example.com?q={query}'
  }
};

const blacklistModel: BlacklistFormRenderModel = {
  copy: {
    addLabel: '添加',
    cancelLabel: '取消',
    matchLabel: '匹配方式',
    modes: [
      {
        label: '当前页面',
        labelKey: 'blacklist_match_exact',
        mode: 'exact',
        placeholder: 'example.com/page',
        prefix: '',
        tooltip: '只屏蔽这一页',
        tooltipKey: 'blacklist_match_exact_tooltip',
        urlLabel: '完整 URL',
        urlLabelKey: 'blacklist_label_full_url'
      },
      {
        label: '当前站点路径',
        labelKey: 'blacklist_match_prefix',
        mode: 'prefix',
        placeholder: 'example.com/docs/',
        prefix: 'http(s)://',
        tooltip: '屏蔽路径',
        tooltipKey: 'blacklist_match_prefix_tooltip',
        urlLabel: 'URL 规则',
        urlLabelKey: 'blacklist_label_url'
      },
      {
        label: '整个网站',
        labelKey: 'blacklist_match_suffix',
        mode: 'suffix',
        placeholder: 'example.com',
        prefix: 'http(s)://',
        tooltip: '屏蔽整个网站',
        tooltipKey: 'blacklist_match_suffix_tooltip',
        urlLabel: '网站域名',
        urlLabelKey: 'blacklist_label_domain'
      }
    ]
  }
};

const BLACKLIST_FORM_ID = 'blacklist-form';

// A site search form drawn in a host; its frame carries the open state.
function createSiteSearchFormFixture(onSave: SiteSearchFormSaveHandler, attach = true) {
  const host = document.createElement('div');
  if (attach) {
    document.body.appendChild(host);
  }
  const controller = createReactRootController(
    host,
    (value: SiteSearchFormRenderModel) => <SiteSearchForm model={value} onSave={onSave} />
  );
  controllers.push(controller);
  act(() => controller.render(siteModel));
  return { host, frame: () => getElement(host, '._x_extension_shortcut_form_2024_unique_') };
}

// A blacklist form drawn in a host, re-rendered with a new reset version on demand.
function createBlacklistFormFixture(onSave: BlacklistFormSaveHandler, attach = true) {
  const host = document.createElement('div');
  if (attach) {
    document.body.appendChild(host);
  }
  const controller = createReactRootController(
    host,
    ({ resetVersion }: { resetVersion: number }) => (
      <BlacklistForm frameId={BLACKLIST_FORM_ID} model={blacklistModel} onSave={onSave} resetVersion={resetVersion} />
    )
  );
  controllers.push(controller);
  let resetVersion = 0;
  act(() => controller.render({ resetVersion }));
  return {
    host,
    frame: () => getElement(host, `#${BLACKLIST_FORM_ID}`),
    reset() {
      resetVersion += 1;
      controller.render({ resetVersion });
    }
  };
}

afterEach(() => {
  act(() => controllers.forEach((controller) => controller.destroy()));
  controllers = [];
  document.body.textContent = '';
});

describe('Options settings forms', () => {
  it('inserts the query token and submits a site-search draft', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const { host } = createSiteSearchFormFixture(onSave);

    const buttons = getTags(host, 'button:not(._x_extension_info_button_2026_unique_)', 'button');
    act(() => buttons[0]?.click());
    const inputs = getTags(host, 'input', 'input');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(inputs[1], 'yt');
      inputs[1]?.dispatchEvent(new Event('input', { bubbles: true }));
      buttons[1]?.click();
    });
    await act(async () => {
      queryHtmlTag(host, '#_x_extension_site_search_add_2024_unique_', 'button')?.click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      key: 'yt',
      category: 'site',
      template: '{query}'
    }));
  });

  it('puts the query insert button at the right of the template header', () => {
    const { host } = createSiteSearchFormFixture(vi.fn());
    const button = getTag(host, '#_x_extension_site_search_insert_query_2026_unique_', 'button');
    const header = getElement(host, '._x_extension_site_search_template_header_2026_unique_');
    expect(header.contains(button)).toBe(true);
    expect(header.classList.contains('_x_extension_shortcut_label_row_2024_unique_')).toBe(true);
    expect(getElement(header, '._x_extension_site_search_template_label_2026_unique_').compareDocumentPosition(button) &
      Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.type).toBe('button');
    expect(['_x_extension_shortcut_submit_2024_unique_', '_x_extension_shortcut_ghost_2026_unique_',
      '_x_extension_site_search_insert_query_2026_unique_'].every((name) => button.classList.contains(name))).toBe(true);
    expect(getElement(button, 'span[data-i18n="shortcuts_insert_query"]').textContent).toBe('插入查询变量');
    expect(button.querySelector('i.ri-icon.ri-add-line')).not.toBeNull();
    expect(host.querySelector('#_x_extension_site_search_template_2024_unique_')).not.toBeNull();
  });

  it('inserts the query token at the caret and keeps editing after it', async () => {
    const { host } = createSiteSearchFormFixture(vi.fn());
    const input = getTag(host, '#_x_extension_site_search_template_2024_unique_', 'input');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'https://example.com/?q=&lang=en');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const caret = 'https://example.com/?q='.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    act(() => getTag(host, '#_x_extension_site_search_insert_query_2026_unique_', 'button').click());
    // The caret moves on the next frame, once the new value is drawn.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(input.value).toBe('https://example.com/?q={query}&lang=en');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([caret + '{query}'.length, caret + '{query}'.length]);
  });

  it('stores the selected search-engine placement in the custom draft', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const { host } = createSiteSearchFormFixture(onSave);

    const categoryControl = queryHtmlElement(host, '._x_extension_site_search_category_tabs_2026_unique_');
    expect(categoryControl?.getAttribute('role')).toBe('group');
    expect(
      categoryControl?.querySelector('[data-site-search-category="site"]')
        ?.getAttribute('aria-pressed')
    ).toBe('true');

    act(() => {
      queryHtmlTag(host, 'button', 'button')?.click();
      queryHtmlTag(host, '[data-site-search-category="searchEngine"]', 'button')
        ?.click();
    });
    expect(
      categoryControl?.querySelector('[data-site-search-category="searchEngine"]')
        ?.getAttribute('aria-pressed')
    ).toBe('true');
    await act(async () => {
      queryHtmlTag(host, '#_x_extension_site_search_add_2024_unique_', 'button')?.click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      category: 'searchEngine'
    }));
  });

  it('shows site-search validation errors without collapsing', async () => {
    const { host, frame } = createSiteSearchFormFixture(
      vi.fn().mockResolvedValue({ ok: false, error: '请填写触发词。' }),
      false
    );
    const buttons = getTags(host, 'button:not(._x_extension_info_button_2026_unique_)', 'button');
    act(() => buttons[0]?.click());
    await act(async () => {
      queryHtmlTag(host, '#_x_extension_site_search_add_2024_unique_', 'button')?.click();
      await Promise.resolve();
    });

    expect(frame().dataset.expanded).toBe('true');
    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('请填写触发词。');
  });

  it('recovers when an unexpected site-search save error rejects', async () => {
    const { host, frame } = createSiteSearchFormFixture(
      vi.fn().mockRejectedValue(new Error('Storage unavailable')),
      false
    );
    const buttons = getTags(host, 'button:not(._x_extension_info_button_2026_unique_)', 'button');
    act(() => buttons[0]?.click());

    await act(async () => {
      queryHtmlTag(host, '#_x_extension_site_search_add_2024_unique_', 'button')?.click();
      await Promise.resolve();
    });

    expect(frame().dataset.expanded).toBe('true');
    expect(queryHtmlTag(host, '#_x_extension_site_search_add_2024_unique_', 'button')?.disabled).toBe(false);
    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('Storage unavailable');
  });

  it('switches blacklist presentation and submits the selected mode', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const { host, frame } = createBlacklistFormFixture(onSave);
    expect(frame().className).toBe('_x_extension_shortcut_form_2024_unique_');
    const buttons = getTags(host, 'button:not(._x_extension_info_button_2026_unique_)', 'button');
    const checkboxes = getTags(host, 'input[type="checkbox"]', 'input');
    act(() => buttons[0]?.click());
    act(() => checkboxes[0]?.click());
    const textInput = queryHtmlTag(host, 'input:not([type="checkbox"])', 'input');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(textInput, 'example.com/page');
      textInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      buttons[2]?.click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith('example.com/page', ['exact']);
    expect(frame().dataset.expanded).toBe('false');
  });

  it('keeps a blacklist form open after adapter validation fails', async () => {
    const { host, frame } = createBlacklistFormFixture(
      vi.fn().mockResolvedValue({ ok: false, error: '请输入网站域名。' }),
      false
    );
    const buttons = getTags(host, 'button:not(._x_extension_info_button_2026_unique_)', 'button');
    act(() => buttons[0]?.click());
    await act(async () => {
      buttons[2]?.click();
      await Promise.resolve();
    });

    expect(frame().dataset.expanded).toBe('true');
    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('请输入网站域名。');
  });

  it('closes and clears a blacklist form on a new reset version', () => {
    const { host, frame, reset } = createBlacklistFormFixture(vi.fn().mockResolvedValue({ ok: true }));
    const openButton = queryHtmlTag(host, 'button', 'button');
    const textInput = queryHtmlTag(host, 'input:not([type="checkbox"])', 'input');

    act(() => openButton?.click());
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(textInput, 'example.com');
      textInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => reset());

    expect(frame().dataset.expanded).toBe('false');
    expect(queryHtmlTag(host, 'input:not([type="checkbox"])', 'input')?.value)
      .toBe('');
    expect(getTags(host, 'input[type="checkbox"]', 'input')[2]?.checked)
      .toBe(true);
  });

  it('keeps the blacklist draft while closing and starts each open empty', () => {
    const { host, frame } = createBlacklistFormFixture(vi.fn().mockResolvedValue({ ok: true }));
    const openButton = queryHtmlTag(host, 'button', 'button');
    const fields = queryHtmlElement(host, '._x_extension_shortcut_form_fields_2024_unique_');
    const textInput = queryHtmlTag(host, 'input:not([type="checkbox"])', 'input');
    const cancelButton = queryHtmlTag(host, '._x_extension_shortcut_secondary_2024_unique_', 'button');
    expect(fields?.hasAttribute('inert')).toBe(true);
    expect(cancelButton?.style.display).toBe('');

    act(() => openButton?.click());
    expect(fields?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(textInput);
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(textInput, 'example.com');
      textInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => cancelButton?.click());

    expect(frame().dataset.expanded).toBe('false');
    expect(fields?.hasAttribute('inert')).toBe(true);
    expect(textInput?.value).toBe('example.com');
    expect(cancelButton?.style.display).toBe('');
    expect(document.activeElement).toBe(openButton);

    act(() => openButton?.click());
    expect(textInput?.value).toBe('');
  });
});
