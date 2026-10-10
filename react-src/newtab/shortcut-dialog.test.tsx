import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShortcutDialog,
  createShortcutDialogApi,
  type ShortcutDialogController,
  type ShortcutDialogOptions,
  type ShortcutDialogPayload
} from './shortcut-dialog';

let frameCallbacks: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let controllers: ShortcutDialogController[];

function flushAnimationFrames(): void {
  const pending = Array.from(frameCallbacks.values());
  frameCallbacks.clear();
  pending.forEach((callback) => callback(performance.now()));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function iconSourceSelect(controller: ShortcutDialogController): HTMLSelectElement {
  return controller.element.querySelector<HTMLSelectElement>('.x-nt-shortcut-icon-source-select select')!;
}

function iconSourceTrigger(controller: ShortcutDialogController): HTMLButtonElement {
  return controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-source-select button')!;
}

function chooseIconSource(controller: ShortcutDialogController, source: string): void {
  const trigger = iconSourceTrigger(controller);
  if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
  const option = controller.element.querySelector<HTMLElement>(`[role="option"][data-value="${source}"]`);
  if (!option) throw new Error(`Expected icon source option: ${source}`);
  option.click();
}

function sourceKey(controller: ShortcutDialogController, key: string): void {
  iconSourceTrigger(controller).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function createController(
  onSubmit: (payload: Readonly<ShortcutDialogPayload>) => boolean | Promise<boolean>,
  overrides: Partial<ShortcutDialogOptions> = {}
): ShortcutDialogController {
  const result: { controller: ShortcutDialogController | null } = {
    controller: null
  };
  act(() => {
    result.controller = createShortcutDialog({
      documentObj: document,
      windowObj: window,
      closeDelayMs: 0,
      t: (_key, fallback) => fallback,
      onSubmit,
      getRiSvg: (id, sizeClass = 'ri-size-16') =>
        `<i class="${sizeClass} ${id}" aria-hidden="true"></i>`,
      ...overrides
    });
  });
  const controller = result.controller;
  if (!controller) {
    throw new Error('Expected the shortcut dialog controller to be created.');
  }
  controllers.push(controller);
  controller.mount(document.body);
  return controller;
}

beforeEach(() => {
  frameCallbacks = new Map();
  nextFrameId = 1;
  controllers = [];
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: vi.fn((callback: FrameRequestCallback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(frameId, callback);
      return frameId;
    })
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: vi.fn((frameId: number) => {
      frameCallbacks.delete(frameId);
    })
  });
});

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  vi.useRealTimers();
});

describe('shortcut dialog React island', () => {
  it('keeps the legacy helper and controller contract', () => {
    const api = createShortcutDialogApi();

    expect(api.implementation).toBe('react');
    expect(api.MODE_ADD).toBe('add');
    expect(api.MODE_EDIT).toBe('edit');
    expect(api.normalizeMode('edit', null)).toBe('add');
    expect(api.normalizeMode('edit', { id: 'one' })).toBe('edit');
    expect(api.clampEnterOffset(50, 28)).toBe(28);
    expect(api.getEnterOffset(90, 100)).toBe(-6);

    const controller = createController(() => false);
    expect(Object.isFrozen(controller)).toBe(true);
    expect(controller.element.dataset.reactIsland).toBe('shortcut-dialog');
    expect(controller.getState()).toEqual({
      mode: 'add',
      itemType: 'shortcut',
      editingId: '',
      open: false,
      busy: false
    });
  });

  it('opens in edit mode, submits controlled values, and restores focus', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const submissions: Readonly<ShortcutDialogPayload>[] = [];
    const controller = createController((payload) => {
      submissions.push(payload);
      return true;
    });

    act(() => {
      controller.open({
        mode: 'edit',
        shortcut: {
          id: 'shortcut-one',
          title: 'Example',
          url: 'https://example.com/'
        },
        sourceElement: trigger
      });
    });

    const inputs = controller.element.querySelectorAll<HTMLInputElement>(
      'input[type="text"]'
    );
    expect(controller.element.hidden).toBe(false);
    expect(document.activeElement).toBe(inputs[0]);

    act(() => {
      flushAnimationFrames();
    });

    expect(controller.element.dataset.open).toBe('true');
    expect(controller.getState()).toEqual({
      mode: 'edit',
      itemType: 'shortcut',
      editingId: 'shortcut-one',
      open: true,
      busy: false
    });
    expect(document.activeElement).toBe(inputs[0]);
    expect(inputs[0].value).toBe('Example');
    expect(inputs[1].value).toBe('https://example.com/');
    expect(
      controller.element.querySelector('.x-nt-shortcut-dialog-title')?.textContent
    ).toBe('Edit shortcut');

    act(() => {
      setInputValue(inputs[0], 'Edited');
      setInputValue(inputs[1], 'https://edited.example/');
    });

    let saved = false;
    await act(async () => {
      saved = await controller.submit();
    });

    expect(saved).toBe(true);
    expect(submissions).toEqual([
      {
        title: 'Edited',
        url: 'https://edited.example/',
        mode: 'edit',
        itemType: 'shortcut',
        itemId: 'shortcut-one',
        shortcutId: 'shortcut-one',
        iconAction: 'keep',
        iconDataUrl: '',
        iconSource: 'cache'
      }
    ]);
    expect(controller.element.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('isolates the page while open and redirects escaped focus into the dialog', () => {
    const pageContent = document.createElement('main');
    const searchInput = document.createElement('input');
    const backgroundButton = document.createElement('button');
    pageContent.append(searchInput, backgroundButton);
    document.body.appendChild(pageContent);
    searchInput.focus();

    const controller = createController(() => false);

    act(() => {
      controller.open({ sourceElement: backgroundButton });
    });

    const nameInput = controller.element.querySelector<HTMLInputElement>(
      'input[type="text"]'
    );
    expect(document.activeElement).toBe(nameInput);
    expect(pageContent.hasAttribute('inert')).toBe(true);

    act(() => {
      searchInput.focus();
    });
    expect(document.activeElement).toBe(nameInput);

    act(() => {
      flushAnimationFrames();
    });
    expect(controller.getState().open).toBe(true);

    act(() => {
      controller.close({ restoreFocus: true });
    });
    expect(pageContent.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(backgroundButton);
  });

  it.each(['cancel', 'Escape', 'backdrop'])('starts a fresh add form after closing via %s, even during the closing animation', async (closeMethod) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const controller = createController(() => false, {
      closeDelayMs: 180,
      prepareIconFile: async () => ({ dataUrl: 'data:image/png;base64,Y3VzdG9t' }),
      getOnlineIconUrl: (url) => url ? 'data:image/png;base64,b25saW5l' : ''
    });
    act(() => { controller.open(); flushAnimationFrames(); });
    const previousForm = controller.element.querySelector('form')!;
    const previousInputs = previousForm.querySelectorAll<HTMLInputElement>('input[type="text"]');
    act(() => {
      setInputValue(previousInputs[0], 'Abandoned shortcut');
      setInputValue(previousInputs[1], 'https://example.com/');
    });
    act(() => chooseIconSource(controller, 'custom'));
    const fileInput = controller.element.querySelector<HTMLInputElement>('.x-nt-shortcut-icon-input')!;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['icon'], 'icon.png', { type: 'image/png' })]
    });
    await act(async () => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    expect(controller.element.querySelector<HTMLElement>('.x-nt-shortcut-icon-upload-tile')?.dataset.hasIcon).toBe('true');
    act(() => {
      controller.setError('Previous validation error');
      controller.setIconError('Previous icon error');
      iconSourceTrigger(controller).click();
    });

    act(() => {
      if (closeMethod === 'cancel') {
        controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-dialog-button--secondary')!.click();
      } else if (closeMethod === 'Escape') {
        sourceKey(controller, 'Escape');
      } else {
        controller.element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }
    });
    if (closeMethod === 'Escape') act(() => sourceKey(controller, 'Escape'));
    expect(controller.getState().open).toBe(false);
    act(() => { controller.open(); flushAnimationFrames(); vi.advanceTimersByTime(180); });

    const inputs = controller.element.querySelectorAll<HTMLInputElement>('input[type="text"]');
    expect(previousForm.isConnected).toBe(false);
    expect(Array.from(inputs, (input) => input.value)).toEqual(['', '']);
    expect(document.activeElement).toBe(inputs[0]);
    expect(controller.getState()).toEqual({ mode: 'add', itemType: 'shortcut', editingId: '', open: true, busy: false });
    expect(iconSourceSelect(controller).value).toBe('cache');
    expect(iconSourceTrigger(controller).getAttribute('aria-expanded')).toBe('false');
    expect(controller.element.querySelector('.x-nt-shortcut-icon-upload-tile')).toBeNull();
    expect(controller.element.querySelector('.x-nt-shortcut-online-icon-preview img')).toBeNull();
    expect(controller.element.querySelector('.x-nt-shortcut-error')?.textContent).toBe('');
    expect(controller.element.querySelector('.x-nt-shortcut-icon-error')?.textContent).toBe('');
    const refresh = controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')!;
    expect(refresh.textContent).toBe('Refresh');
    expect(refresh.disabled).toBe(true);
    act(() => chooseIconSource(controller, 'custom'));
    expect(controller.element.querySelector<HTMLElement>('.x-nt-shortcut-icon-upload-tile')?.dataset.hasIcon).toBe('false');
  });

  it('ignores edit data and source preferences when opening a new add form', () => {
    const shortcut = { id: 'one', title: 'Saved shortcut', url: 'https://example.com/', iconSource: 'service' as const };
    const controller = createController(() => false, { getOnlineIconSource: () => 'service' });
    act(() => controller.open({ mode: 'edit', shortcut }));
    expect(iconSourceSelect(controller).value).toBe('service');
    act(() => { controller.close(); controller.open({ mode: 'add', shortcut }); flushAnimationFrames(); });
    expect(Array.from(controller.element.querySelectorAll<HTMLInputElement>('input[type="text"]'), (input) => input.value)).toEqual(['', '']);
    expect(iconSourceSelect(controller).value).toBe('cache');
    expect(controller.getState().editingId).toBe('');
  });

  it('discards an abandoned upload without interrupting the next add session', async () => {
    const uploads: Array<(icon: { dataUrl: string }) => void> = [];
    const controller = createController(() => false, {
      prepareIconFile: () => new Promise<{ dataUrl: string }>((resolve) => uploads.push(resolve))
    });
    const upload = () => {
      const input = controller.element.querySelector<HTMLInputElement>('.x-nt-shortcut-icon-input')!;
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['icon'], 'icon.png', { type: 'image/png' })]
      });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    act(() => controller.open());
    act(() => chooseIconSource(controller, 'custom'));
    act(upload);
    act(() => controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-dialog-button--secondary')!.click());
    act(() => controller.open());
    act(() => chooseIconSource(controller, 'custom'));
    act(upload);
    await act(async () => uploads[0]({ dataUrl: 'data:image/png;base64,c3RhbGU=' }));
    const tile = controller.element.querySelector<HTMLElement>('.x-nt-shortcut-icon-upload-tile')!;
    expect(tile.dataset.hasIcon).toBe('false');
    expect(tile.dataset.loading).toBe('true');
    await act(async () => uploads[1]({ dataUrl: 'data:image/png;base64,bmV3' }));
    expect(tile.dataset.hasIcon).toBe('true');
    expect(tile.dataset.loading).toBe('false');
    expect(tile.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,bmV3');
  });

  it('uses the shared form for bookmark and folder editing', async () => {
    const submissions: Readonly<ShortcutDialogPayload>[] = [];
    const controller = createController((payload) => {
      submissions.push(payload);
      return true;
    });

    act(() => {
      controller.open({
        mode: 'edit',
        itemType: 'bookmark',
        shortcut: {
          id: 'bookmark-one',
          title: 'Docs',
          url: 'https://docs.example/'
        }
      });
      flushAnimationFrames();
    });

    let inputs = controller.element.querySelectorAll<HTMLInputElement>(
      'input[type="text"]'
    );
    expect(controller.getState().itemType).toBe('bookmark');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('Docs');
    expect(inputs[1].value).toBe('https://docs.example/');
    expect(
      controller.element.querySelector('.x-nt-shortcut-dialog-title')?.textContent
    ).toBe('Edit bookmark');
    expect(
      controller.element.querySelector('.x-nt-shortcut-icon-field')
    ).toBeNull();

    act(() => {
      setInputValue(inputs[0], 'Reference');
      setInputValue(inputs[1], 'https://reference.example/');
    });
    await act(async () => {
      await controller.submit();
    });

    act(() => {
      controller.open({
        mode: 'edit',
        itemType: 'folder',
        shortcut: {
          id: 'folder-one',
          title: 'Research'
        }
      });
      flushAnimationFrames();
    });

    inputs = controller.element.querySelectorAll<HTMLInputElement>(
      'input[type="text"]'
    );
    expect(controller.getState().itemType).toBe('folder');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].value).toBe('Research');
    expect(
      controller.element.querySelector('.x-nt-shortcut-dialog-title')?.textContent
    ).toBe('Rename folder');
    expect(
      controller.element.querySelector('.x-nt-shortcut-icon-field')
    ).toBeNull();

    act(() => {
      setInputValue(inputs[0], 'Reading');
    });
    await act(async () => {
      await controller.submit();
    });

    expect(submissions).toEqual([
      {
        title: 'Reference',
        url: 'https://reference.example/',
        mode: 'edit',
        itemType: 'bookmark',
        itemId: 'bookmark-one',
        shortcutId: 'bookmark-one',
        iconAction: 'keep',
        iconDataUrl: ''
      },
      {
        title: 'Reading',
        url: '',
        mode: 'edit',
        itemType: 'folder',
        itemId: 'folder-one',
        shortcutId: 'folder-one',
        iconAction: 'keep',
        iconDataUrl: ''
      }
    ]);
  });

  it('lets websites in shortcut folders choose an icon like shortcuts', async () => {
    const custom = 'data:image/png;base64,Y3VzdG9t';
    const fresh = { dataUrl: 'data:image/png;base64,bmV3', pageUrl: 'https://docs.example/' };
    const onSubmit = vi.fn(() => true);
    const controller = createController(onSubmit, {
      getOnlineIconUrl: () => '',
      refreshOnlineIcon: vi.fn(async () => fresh)
    });
    act(() => controller.open({
      mode: 'edit',
      itemType: 'bookmark',
      iconEditable: true,
      shortcut: { id: 'bookmark-one', title: 'Docs', url: fresh.pageUrl, iconSource: 'custom', iconDataUrl: custom }
    }));
    expect(controller.element.querySelector('.x-nt-shortcut-dialog-title')?.textContent).toBe('Edit bookmark');
    expect(controller.element.querySelector('.x-nt-shortcut-icon-field')).not.toBeNull();
    expect(iconSourceSelect(controller).value).toBe('custom');
    expect(controller.element.textContent).not.toContain('Sync across devices with WebDAV.');
    await act(async () => { await controller.submit(); });
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({
      itemType: 'bookmark', iconSource: 'custom', iconAction: 'keep'
    }));

    const preview = 'https://favicon.example/docs.png';
    act(() => controller.open({
      mode: 'edit',
      itemType: 'bookmark',
      iconEditable: true,
      iconPreviewUrl: preview,
      shortcut: { id: 'bookmark-two', title: 'Docs', url: fresh.pageUrl }
    }));
    expect(iconSourceSelect(controller).value).toBe('cache');
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.src).toBe(preview);
    await act(async () => {
      controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')?.click();
    });
    await act(async () => { await controller.submit(); });
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({
      itemId: 'bookmark-two', iconSource: 'cache', onlineIcon: fresh
    }));
  });

  it('blocks close and replacement state while persistence is pending', async () => {
    let resolveSubmit: ((saved: boolean) => void) | undefined;
    const controller = createController(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        })
    );

    act(() => {
      controller.open();
      flushAnimationFrames();
    });

    let submission: Promise<boolean> = Promise.resolve(false);
    act(() => {
      submission = controller.submit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(controller.getState().busy).toBe(true);
    expect(controller.close({ restoreFocus: true })).toBe(false);
    expect(
      controller.open({
        mode: 'edit',
        shortcut: {
          id: 'second',
          title: 'Second',
          url: 'https://second.example/'
        }
      })
    ).toBe(false);
    expect(controller.getState().mode).toBe('add');

    await act(async () => {
      resolveSubmit?.(true);
      expect(await submission).toBe(true);
    });
    expect(controller.element.hidden).toBe(true);
  });

  it('processes a replacement icon and refreshes translated copy', async () => {
    let language = 'en';
    const submissions: Readonly<ShortcutDialogPayload>[] = [];
    const controller = createController(
      (payload) => {
        submissions.push(payload);
        return true;
      },
      {
        t: (key, fallback) => (
          language === 'zh' && key === 'newtab_shortcuts_dialog_title'
            ? '添加快捷方式'
            : fallback
        ),
        prepareIconFile: async () => ({
          dataUrl: 'data:image/png;base64,dGVzdA=='
        })
      }
    );

    act(() => {
      controller.open();
      flushAnimationFrames();
    });
    act(() => {
      chooseIconSource(controller, 'custom');
    });
    const fileInput = controller.element.querySelector<HTMLInputElement>(
      '.x-nt-shortcut-icon-input'
    );
    if (!fileInput) {
      throw new Error('Expected the shortcut icon input to exist.');
    }
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['icon'], 'icon.png', { type: 'image/png' })]
    });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const uploadTile = controller.element.querySelector<HTMLElement>(
      '.x-nt-shortcut-icon-upload-tile'
    );
    expect(uploadTile?.dataset.hasIcon).toBe('true');
    expect(uploadTile?.getAttribute('aria-label')).toBe('Replace image');

    language = 'zh';
    act(() => {
      controller.updateLanguage();
    });
    expect(
      controller.element.querySelector('.x-nt-shortcut-dialog-title')?.textContent
    ).toBe('添加快捷方式');

    await act(async () => {
      await controller.submit();
    });
    expect(submissions[0]).toMatchObject({
      iconAction: 'replace',
      iconDataUrl: 'data:image/png;base64,dGVzdA=='
    });
  });

  it('previews the current online icon and stages refreshed artwork until Save', async () => {
    const initial = 'data:image/png;base64,b2xk';
    const fresh = { dataUrl: 'data:image/png;base64,bmV3', pageUrl: 'https://example.com/', sourceUrl: 'https://www.gstatic.com/icon' };
    const onSubmit = vi.fn(() => true);
    const refreshOnlineIcon = vi.fn(async () => fresh);
    const controller = createController(onSubmit, { getOnlineIconUrl: () => initial, refreshOnlineIcon });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: fresh.pageUrl } }));
    expect(iconSourceSelect(controller).value).toBe('cache');
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.src).toBe(initial);
    expect(controller.element.querySelector('.x-nt-shortcut-icon-upload-tile')).toBeNull();
    await act(async () => {
      controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')?.click();
    });
    expect(refreshOnlineIcon).toHaveBeenCalledWith(fresh.pageUrl, 'cache');
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.src).toBe(fresh.dataUrl);
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => { await controller.submit(); });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ onlineIcon: fresh, iconAction: 'keep' }));
  });

  it('keeps the custom draft across mode switches and removes it only when Online is saved', async () => {
    const onSubmit = vi.fn(() => true);
    const controller = createController(onSubmit, {
      refreshOnlineIcon: async (pageUrl) => ({ dataUrl: 'data:image/png;base64,b25saW5l', pageUrl })
    });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://example.com/', iconDataUrl: 'data:image/png;base64,Y3VzdG9t' } }));
    expect(iconSourceSelect(controller).value).toBe('custom');
    await act(async () => chooseIconSource(controller, 'cache'));
    act(() => chooseIconSource(controller, 'custom'));
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-icon-upload-tile img')?.src).toBe('data:image/png;base64,Y3VzdG9t');
    await act(async () => chooseIconSource(controller, 'cache'));
    await act(async () => { await controller.submit(); });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ iconAction: 'remove', iconDataUrl: '' }));
  });

  it('discards refresh results after cancellation or a URL change', async () => {
    const requests: Array<(icon: { dataUrl: string; pageUrl: string }) => void> = [];
    const refreshOnlineIcon = vi.fn(() => new Promise<{ dataUrl: string; pageUrl: string }>((resolve) => { requests.push(resolve); }));
    const onSubmit = vi.fn((_payload: Readonly<ShortcutDialogPayload>) => true);
    const controller = createController(onSubmit, { getOnlineIconUrl: (url) => url ? 'data:image/png;base64,b2xk' : '', refreshOnlineIcon });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://example.com/' } }));
    act(() => controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')?.click());
    expect(controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-dialog-button--primary')?.disabled).toBe(true);
    act(() => setInputValue(controller.element.querySelectorAll<HTMLInputElement>('input[type="text"]')[1], 'https://second.example/'));
    await act(async () => requests[0]({ dataUrl: 'data:image/png;base64,c3RhbGU=', pageUrl: 'https://example.com/' }));
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.src).toBe('data:image/png;base64,b2xk');
    act(() => controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')?.click());
    act(() => {
      controller.close();
      controller.open({ mode: 'edit', shortcut: { id: 'two', url: 'https://third.example/' } });
    });
    await act(async () => requests[1]({ dataUrl: 'data:image/png;base64,c3RhbGU=', pageUrl: 'https://second.example/' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => { await controller.submit(); });
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('onlineIcon');
  });

  it('retains the current icon on refresh failure and validates empty custom mode', async () => {
    const onSubmit = vi.fn(() => true);
    const controller = createController(onSubmit, {
      getOnlineIconUrl: () => 'data:image/png;base64,b2xk',
      refreshOnlineIcon: async () => null
    });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://example.com/' } }));
    await act(async () => controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')?.click());
    expect(controller.element.querySelector('.x-nt-shortcut-icon-error')?.textContent).toContain('No cached icon');
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.src).toBe('data:image/png;base64,b2xk');
    act(() => chooseIconSource(controller, 'custom'));
    await act(async () => { expect(await controller.submit()).toBe(false); });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(controller.element.querySelector('.x-nt-shortcut-icon-upload-tile'));
  });

  it('supports keyboard selection and closes the dropdown before the dialog on Escape', () => {
    const controller = createController(() => false);
    act(() => { controller.open(); flushAnimationFrames(); });
    const trigger = iconSourceTrigger(controller);
    act(() => { trigger.focus(); sourceKey(controller, 'ArrowDown'); });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    act(() => sourceKey(controller, 'ArrowDown'));
    act(() => sourceKey(controller, 'Enter'));
    expect(iconSourceSelect(controller).value).toBe('custom');
    expect(controller.element.querySelector('.x-nt-shortcut-icon-upload-tile')).not.toBeNull();
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    act(() => sourceKey(controller, 'Escape'));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(controller.getState().open).toBe(true);
    expect(document.activeElement).toBe(trigger);
    act(() => sourceKey(controller, 'Escape'));
    expect(controller.getState().open).toBe(false);
  });

  it('shows success in the refresh button for two seconds and clears it on close', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const controller = createController(() => false, {
      refreshOnlineIcon: async (pageUrl) => ({ dataUrl: 'data:image/png;base64,aWNvbg==', pageUrl })
    });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://example.com/' } }));
    await act(async () => controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')!.click());
    const refresh = controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')!;
    expect(refresh.textContent).toBe('Icon acquired');
    expect(refresh.dataset.success).toBe('true');
    expect(refresh.querySelector('.ri-check-line')).not.toBeNull();
    expect(controller.element.querySelector('.x-nt-shortcut-icon-error')?.textContent).toBe('');
    act(() => vi.advanceTimersByTime(1999));
    expect(refresh.textContent).toBe('Icon acquired');
    act(() => vi.advanceTimersByTime(1));
    expect(refresh.textContent).toBe('Refresh');
    expect(refresh.dataset.success).toBe('false');
    expect(refresh.querySelector('.ri-refresh-line')).not.toBeNull();
    await act(async () => refresh.click());
    act(() => { controller.close(); controller.open(); vi.advanceTimersByTime(2000); });
    expect(controller.element.querySelector('.x-nt-shortcut-icon-refresh')?.textContent).toBe('Refresh');
  });

  it('uses the chosen source and blocks saving a failed source switch', async () => {
    const onSubmit = vi.fn(() => true);
    const refreshOnlineIcon = vi.fn(async (pageUrl: string, source?: string) => source === 'service'
      ? null : { dataUrl: 'data:image/png;base64,Y2FjaGU=', pageUrl });
    const controller = createController(onSubmit, { refreshOnlineIcon, getOnlineIconUrl: () => 'data:image/png;base64,b2xk' });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://example.com/', iconSource: 'cache' } }));
    expect(Array.from(iconSourceSelect(controller).options, (option) => option.value)).toEqual(['service', 'favicon-is', 'cache', 'custom']);
    await act(async () => chooseIconSource(controller, 'service'));
    expect(refreshOnlineIcon).toHaveBeenCalledWith('https://example.com/', 'service');
    const hint = controller.element.querySelector('.x-nt-shortcut-icon-source-hint')!;
    expect(hint.previousElementSibling?.classList.contains('x-nt-shortcut-icon-source-select')).toBe(true);
    expect(hint.textContent).toContain('site domain');
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.src).toBe('data:image/png;base64,b2xk');
    expect(controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-dialog-button--primary')?.disabled).toBe(true);
    await act(async () => expect(await controller.submit()).toBe(false));
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => chooseIconSource(controller, 'cache'));
    expect(controller.element.querySelector('.x-nt-shortcut-icon-source-hint')?.textContent).toContain('browser cache');
    expect(controller.element.querySelector('.x-nt-shortcut-icon-source-hint')?.textContent).not.toContain('Chrome');
    await act(async () => controller.submit());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ iconSource: 'cache' }));
  });

  it('refreshes and saves Favicon.is as a separate source, then restores the saved choice', async () => {
    const onSubmit = vi.fn(() => true);
    const refreshOnlineIcon = vi.fn(async (pageUrl: string) => ({
      dataUrl: 'data:image/png;base64,ZmF2aWNvbi1pcw==', pageUrl,
      sourceUrl: 'https://favicon.is/example.com?larger=true'
    }));
    const controller = createController(onSubmit, { refreshOnlineIcon });
    const shortcut = { id: 'one', url: 'https://example.com/private?view=1', iconSource: 'cache' as const };
    act(() => controller.open({ mode: 'edit', shortcut }));
    await act(async () => chooseIconSource(controller, 'favicon-is'));
    expect(refreshOnlineIcon).toHaveBeenCalledWith(shortcut.url, 'favicon-is');
    expect(iconSourceSelect(controller).value).toBe('favicon-is');
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.src)
      .toBe('data:image/png;base64,ZmF2aWNvbi1pcw==');
    await act(async () => controller.submit());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      iconSource: 'favicon-is', onlineIcon: expect.objectContaining({ sourceUrl: 'https://favicon.is/example.com?larger=true' })
    }));
    act(() => controller.open({ mode: 'edit', shortcut: { ...shortcut, iconSource: 'favicon-is' } }));
    expect(iconSourceSelect(controller).value).toBe('favicon-is');
  });

  it('restores a saved service source and skips unavailable sources in keyboard navigation', async () => {
    const controller = createController(() => false, {
      isIconSourceAvailable: (source) => source === 'cache'
    });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://example.com/', iconSource: 'service' } }));
    expect(iconSourceSelect(controller).value).toBe('service');
    expect(iconSourceSelect(controller).querySelector<HTMLOptionElement>('option[value="service"]')?.disabled).toBe(true);
    expect(controller.element.querySelector<HTMLButtonElement>('.x-nt-shortcut-icon-refresh')?.disabled).toBe(true);
    act(() => { iconSourceTrigger(controller).focus(); sourceKey(controller, 'ArrowDown'); });
    act(() => sourceKey(controller, 'ArrowDown'));
    await act(async () => sourceKey(controller, 'Enter'));
    expect(document.activeElement).toBe(iconSourceTrigger(controller));
    expect(iconSourceSelect(controller).value).toBe('cache');
  });

  it('offers packaged artwork only for supported URLs and saves it without acquiring an online icon', async () => {
    const onSubmit = vi.fn((_payload: Readonly<ShortcutDialogPayload>) => true);
    const refreshOnlineIcon = vi.fn(async () => null);
    const builtinUrl = '/assets/images/site-search/glyph-gh.svg';
    const getBuiltinIconUrl = (url: string) => {
      try { return new URL(url).hostname === 'github.com' ? builtinUrl : ''; } catch { return ''; }
    };
    const controller = createController(onSubmit, { getBuiltinIconUrl, refreshOnlineIcon });
    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://github.com/project' } }));
    expect(Array.from(iconSourceSelect(controller).options, (option) => option.value)).toEqual(['builtin', 'service', 'favicon-is', 'cache', 'custom']);
    expect(controller.element.getAttribute('role')).toBe('dialog');
    expect(controller.element.getAttribute('aria-modal')).toBe('true');
    expect(controller.element.contains(controller.element.querySelector('[role="listbox"]'))).toBe(true);
    act(() => chooseIconSource(controller, 'builtin'));
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.getAttribute('src')).toBe(builtinUrl);
    expect(controller.element.querySelector('.x-nt-shortcut-icon-refresh')).toBeNull();
    expect(controller.element.querySelector('.x-nt-shortcut-icon-source-hint')?.textContent).toContain('Lumno’s built-in high-quality icons');
    expect(refreshOnlineIcon).not.toHaveBeenCalled();
    await act(async () => controller.submit());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ iconSource: 'builtin' }));
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('onlineIcon');

    act(() => controller.open({ mode: 'edit', shortcut: { id: 'one', url: 'https://github.com/project', iconSource: 'builtin' } }));
    expect(iconSourceSelect(controller).value).toBe('builtin');
    const urlInput = controller.element.querySelectorAll<HTMLInputElement>('input[type="text"]')[1];
    act(() => setInputValue(urlInput, 'https://github.com.evil.test/'));
    expect(iconSourceSelect(controller).value).toBe('cache');
    expect(iconSourceSelect(controller).querySelector('option[value="builtin"]')).toBeNull();
    expect(controller.element.querySelector('.x-nt-shortcut-icon-refresh')).not.toBeNull();
    expect(refreshOnlineIcon).not.toHaveBeenCalled();
  });

  it('uses a built-in icon when replacing a custom icon and updates it when the supported URL changes', async () => {
    const onSubmit = vi.fn(() => true);
    const getBuiltinIconUrl = (url: string) => url.startsWith('https://github.com/') ? '/github.png'
      : url.startsWith('https://developer.mozilla.org/') ? '/mdn.png' : '';
    const controller = createController(onSubmit, { getBuiltinIconUrl });
    act(() => controller.open({ mode: 'edit', shortcut: {
      id: 'one', url: 'https://github.com/', iconDataUrl: 'data:image/png;base64,Y3VzdG9t'
    } }));
    act(() => chooseIconSource(controller, 'builtin'));
    const urlInput = controller.element.querySelectorAll<HTMLInputElement>('input[type="text"]')[1];
    act(() => setInputValue(urlInput, 'https://developer.mozilla.org/'));
    expect(iconSourceSelect(controller).value).toBe('builtin');
    expect(controller.element.querySelector<HTMLImageElement>('.x-nt-shortcut-online-icon-preview img')?.getAttribute('src')).toBe('/mdn.png');
    await act(async () => controller.submit());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ iconSource: 'builtin', iconAction: 'remove', iconDataUrl: '' }));
  });

  it('traps focus, closes on Escape, and detaches cleanly', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const controller = createController(() => false);

    act(() => {
      controller.open({ sourceElement: trigger });
      flushAnimationFrames();
    });

    const nameInput = controller.element.querySelector<HTMLInputElement>(
      'input[type="text"]'
    );
    const doneButton = controller.element.querySelector<HTMLButtonElement>(
      '.x-nt-shortcut-dialog-button--primary'
    );
    doneButton?.focus();
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    });
    act(() => {
      controller.element.dispatchEvent(tabEvent);
    });
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(nameInput);

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true
    });
    act(() => {
      controller.element.dispatchEvent(escapeEvent);
    });
    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(controller.element.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    act(() => {
      controller.destroy();
    });
    controllers = controllers.filter((candidate) => candidate !== controller);
    expect(controller.element.isConnected).toBe(false);
    expect(controller.open()).toBe(false);
  });

  it('reuses the modal for confirmation with Cancel focused and a busy confirm action', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    let resolveConfirm: ((confirmed: boolean) => void) | undefined;
    const onConfirm = vi.fn(
      () => new Promise<boolean>((resolve) => {
        resolveConfirm = resolve;
      })
    );
    const controller = createController(() => false);

    act(() => {
      controller.open({
        sourceElement: trigger,
        confirmationTitle: 'Open 3 tabs?',
        confirmationDescription:
          'All bookmarks in “Research” and its subfolders will open in one tab group.',
        confirmLabel: 'Open',
        onConfirm
      });
      flushAnimationFrames();
    });

    const cancelButton = controller.element.querySelector<HTMLButtonElement>(
      '.x-nt-shortcut-dialog-button--secondary'
    );
    const confirmButton = controller.element.querySelector<HTMLButtonElement>(
      '.x-nt-shortcut-dialog-button--primary'
    );
    expect(controller.element.querySelectorAll('input')).toHaveLength(0);
    expect(
      controller.element.querySelector('.x-nt-shortcut-dialog-title')?.textContent
    ).toBe('Open 3 tabs?');
    expect(
      controller.element.querySelector('.x-nt-shortcut-dialog-description')?.textContent
    ).toContain('Research');
    expect(cancelButton?.textContent).toBe('Cancel');
    expect(confirmButton?.textContent).toBe('Open');
    expect(document.activeElement).toBe(cancelButton);

    let submission: Promise<boolean> = Promise.resolve(false);
    act(() => {
      submission = controller.submit();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(controller.getState().busy).toBe(true);
    expect(cancelButton?.disabled).toBe(true);
    expect(confirmButton?.disabled).toBe(true);
    expect(controller.close({ restoreFocus: true })).toBe(false);

    await act(async () => {
      resolveConfirm?.(true);
      expect(await submission).toBe(true);
    });
    expect(controller.element.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});
