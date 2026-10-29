import { act } from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { appendOverlayStyleNodes, createOverlayMount, destroyOverlayMount, findOverlayPanel } from './shell';
import { queryHtmlTag } from '../../shared/dom-lookup';

afterEach(() => {
  document.body.replaceChildren();
  document.head
    .querySelectorAll('[id^="_x_extension_"]')
    .forEach((element) => element.remove());
});

describe('Overlay React shell', () => {
  it('creates the panel inside a page-inaccessible Shadow DOM', () => {
    const holder: {
      value: ReturnType<typeof createOverlayMount>;
    } = { value: null };
    act(() => {
      holder.value = createOverlayMount(document, {
        hostId: 'overlay-host',
        id: 'overlay-panel',
        width: 800,
        maxHeightVh: 80
      });
    });
    const mount = holder.value;
    if (!mount) {
      throw new Error('Expected overlay mount');
    }
    document.body.appendChild(mount.host);
    expect(mount.host.shadowRoot).toBeNull();
    expect('_lumnoOverlayPanel' in mount.host).toBe(false);
    expect(mount.panel.dataset.reactIsland).toBe('overlay-shell');
    expect(mount.panel.id).toBe('overlay-panel');
    expect(mount.panel.getAttribute('data-lumno-overlay-panel')).toBe('true');
    expect(mount.panel.style.position).toBe('fixed');
    expect(mount.panel.style.width).toBe('800px');
    expect(mount.panel.style.maxHeight).toBe('80vh');
    expect(mount.panel.style.transform).toContain('translateX(-50%)');
    expect(mount.panel.style.transform).toContain('--x-ov-visible-scale');
    expect(mount.panel.style.transition).toBe('none');
    expect(mount.panel.style.filter).toBe('none');
    expect(mount.panel.style.willChange).toBe('auto');
    expect(mount.panel.style.getPropertyValue('transform')).toBe(
      'translateX(-50%) translateY(0) scale(var(--x-ov-visible-scale, 1))'
    );
    expect(Array.from(mount.panel.children)).toEqual([mount.inputContainer, mount.suggestionsContainer]);
    expect(mount.inputContainer.childElementCount).toBe(0);
    expect(mount.suggestionsContainer.id).toBe('_x_extension_suggestions_container_2024_unique_');
    expect(mount.suggestionsContainer.className).toBe('x-ov-suggestions-container');
    expect(mount.host.getAttribute('popover')).toBe('manual');
    expect(mount.root?.querySelectorAll('#overlay-panel')).toHaveLength(1);
    expect(
      findOverlayPanel(document, {
        hostId: 'overlay-host',
        id: 'overlay-panel'
      })
    ).toBe(mount.panel);

    act(() => destroyOverlayMount(mount.host));
    expect(mount.root?.querySelector('#overlay-panel')).toBeNull();
  });

  it('draws the panel\'s theme from its model beside its own look', () => {
    const holder: { value: ReturnType<typeof createOverlayMount> } = { value: null };
    act(() => {
      holder.value = createOverlayMount(document, { hostId: 'overlay-host', id: 'overlay-panel' });
    });
    const mount = holder.value;
    if (!mount) {
      throw new Error('Expected overlay mount');
    }

    act(() => mount.view.render({
      theme: 'dark',
      vars: { '--x-ov-text': '#E5E7EB', '--lumno-font-sans': 'Inter, sans-serif' }
    }));
    expect(mount.panel.dataset.theme).toBe('dark');
    expect(mount.panel.style.getPropertyValue('--x-ov-text')).toBe('#E5E7EB');
    expect(mount.panel.style.getPropertyValue('--lumno-font-sans')).toBe('Inter, sans-serif');

    act(() => mount.view.render({ theme: 'light', vars: { '--x-ov-text': '#111827' } }));
    expect(mount.panel.dataset.theme).toBe('light');
    expect(mount.panel.style.getPropertyValue('--x-ov-text')).toBe('#111827');
    expect(mount.panel.style.getPropertyValue('--lumno-font-sans')).toBe('');
    expect(mount.panel.style.position).toBe('fixed');
    expect(mount.panel.style.getPropertyPriority('position')).toBe('important');
    act(() => destroyOverlayMount(mount.host));
  });

  it('marks the host editable while focus is in the panel, after the page saw the focus', () => {
    const holder: { value: ReturnType<typeof createOverlayMount> } = { value: null };
    act(() => {
      holder.value = createOverlayMount(document, { hostId: 'overlay-host', id: 'overlay-panel' });
    });
    const mount = holder.value;
    if (!mount) {
      throw new Error('Expected overlay mount');
    }
    document.body.appendChild(mount.host);
    const input = document.createElement('input');
    mount.inputContainer.appendChild(input);
    const seenByPage: Array<string | null> = [];
    const recordFocus = (event: Event) => {
      if (event.target === mount.host) {
        seenByPage.push(mount.host.getAttribute('contenteditable'));
      }
    };
    window.addEventListener('focus', recordFocus, true);
    try {
      input.focus();
      expect(seenByPage).toEqual([null]);
      expect(mount.host.getAttribute('contenteditable')).toBe('plaintext-only');

      input.blur();
      expect(mount.host.hasAttribute('contenteditable')).toBe(false);
    } finally {
      window.removeEventListener('focus', recordFocus, true);
      act(() => destroyOverlayMount(mount.host));
    }
  });

  it('installs isolated styles without a legacy adapter', () => {
    const root = document.createElement('div');
    appendOverlayStyleNodes(document, {
      root,
      searchInputCssUrl: 'chrome-extension://example/search-input.css',
      remixBrush2IconSvgUrl:
        'chrome-extension://example/assets/remixicon/icons/brush-2-line.svg',
      remixSearchIconSvgUrl:
        'chrome-extension://example/assets/remixicon/icons/search-line.svg',
      remixSettingsIconSvgUrl:
        'chrome-extension://example/assets/remixicon/icons/settings-line.svg'
    });
    expect(
      root.querySelector('#_x_extension_input_component_style_2026_unique_')
    ).not.toBeNull();
    expect(
      root.querySelector('#_x_extension_overlay_theme_style_2024_unique_')
    ).not.toBeNull();
    const criticalStyle = queryHtmlTag(root, '#_x_extension_overlay_theme_style_2024_unique_', 'style');
    expect(criticalStyle?.textContent).toMatch(
      /:where\(#_x_extension_overlay_2024_unique_\)\s+:where\(\.x-ov-suggestion-switch-button\)\s*\{[\s\S]*?background:\s*var\(--x-ov-suggestion-action-button-bg,\s*transparent\);[\s\S]*?border-radius:\s*6px;[\s\S]*?font:\s*inherit;[\s\S]*?font-size:\s*12px;[\s\S]*?height:\s*var\(--x-ov-suggestion-action-height,\s*26px\);/
    );
    expect(criticalStyle?.textContent).not.toMatch(
      /#_x_extension_overlay_2024_unique_\s+\.x-ov-suggestion-switch-button/
    );
    // The mounted, closed popconfirm starts in the stylesheet's closed state,
    // so the stylesheet arriving late plays no closing transition.
    const fallbackPopconfirm = criticalStyle?.textContent?.match(
      /:where\(\.x-lumno-search-input__popconfirm\)\s*\{([^}]*)\}/
    )?.[1] || '';
    const sheetPopconfirm = readFileSync('src/shared/search/search-input.css', 'utf8')
      .match(/\n\.x-lumno-search-input__popconfirm\s*\{([^}]*)\}/)?.[1] || '';
    ['opacity', 'visibility', 'transform', 'pointer-events'].forEach((property) => {
      const pattern = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+);`);
      const fallbackValue = fallbackPopconfirm.match(pattern)?.[1]?.trim();
      expect(fallbackValue, property).toBeTruthy();
      expect(fallbackValue, property).toBe(sheetPopconfirm.match(pattern)?.[1]?.trim());
    });
    expect(criticalStyle?.textContent).toContain(
      'url("chrome-extension://example/assets/remixicon/icons/search-line.svg")'
    );
    expect(criticalStyle?.textContent).toContain(
      'url("chrome-extension://example/assets/remixicon/icons/settings-line.svg")'
    );
    expect(criticalStyle?.textContent).toContain(
      'url("chrome-extension://example/assets/remixicon/icons/brush-2-line.svg")'
    );
    expect(criticalStyle?.textContent).toMatch(
      /background-color:\s*currentColor;[\s\S]*?-webkit-mask-image:/
    );
    expect(criticalStyle?.textContent).not.toContain(
      'border: 1.5px solid currentColor'
    );
  });
});
