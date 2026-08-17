import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createOverlayShellApi } from './shell';

afterEach(() => {
  document.body.innerHTML = '';
  document.head
    .querySelectorAll('[id^="_x_extension_"]')
    .forEach((element) => element.remove());
});

describe('Overlay React shell', () => {
  it('creates the panel inside a page-inaccessible Shadow DOM', () => {
    const api = createOverlayShellApi();
    const holder: {
      value: ReturnType<typeof api.createOverlayMount>;
    } = { value: null };
    act(() => {
      holder.value = api.createOverlayMount(document, {
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

    expect(api.implementation).toBe('react');
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
    expect(mount.host.getAttribute('popover')).toBe('manual');
    expect(mount.root?.querySelectorAll('#overlay-panel')).toHaveLength(1);
    expect(
      api.findOverlayPanel(document, {
        hostId: 'overlay-host',
        id: 'overlay-panel'
      })
    ).toBe(mount.panel);

    const externalChild = document.createElement('input');
    mount.panel.appendChild(externalChild);
    expect(mount.panel.contains(externalChild)).toBe(true);

    act(() => api.destroyOverlayMount(mount.host));
    expect(mount.root?.querySelector('#overlay-panel')).toBeNull();
  });

  it('installs isolated styles without a legacy adapter', () => {
    const api = createOverlayShellApi();
    const root = document.createElement('div');
    api.appendOverlayStyleNodes(document, {
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
    const criticalStyle = root.querySelector<HTMLStyleElement>(
      '#_x_extension_overlay_theme_style_2024_unique_'
    );
    expect(criticalStyle?.textContent).toMatch(
      /:where\(#_x_extension_overlay_2024_unique_\)\s+:where\(\.x-ov-suggestion-switch-button\)\s*\{[\s\S]*?background:\s*var\(--x-ov-suggestion-action-button-bg,\s*transparent\);[\s\S]*?border-radius:\s*6px;[\s\S]*?font:\s*inherit;[\s\S]*?font-size:\s*12px;[\s\S]*?height:\s*var\(--x-ov-suggestion-action-height,\s*26px\);/
    );
    expect(criticalStyle?.textContent).not.toMatch(
      /#_x_extension_overlay_2024_unique_\s+\.x-ov-suggestion-switch-button/
    );
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
