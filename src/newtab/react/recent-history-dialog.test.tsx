import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRecentHistoryDialog,
  type RecentHistoryDialogController
} from './recent-history-dialog';
import { expectTag, getTags } from '../../../tests/fakes/dom';
import { queryHtmlTag } from '../../shared/dom-lookup';

let controller: RecentHistoryDialogController | null = null;

afterEach(() => {
  act(() => controller?.destroy());
  controller = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('recent change history dialog', () => {
  it('shows current and retained versions and restores any selected version', async () => {
    const restore = vi.fn().mockResolvedValue(true);
    act(() => {
      controller = createRecentHistoryDialog({
        documentObj: document,
        windowObj: window,
        t: (_key, fallback) => fallback,
        onRestore: restore
      });
      controller?.mount(document.body);
      controller?.open({
        item: {
          cardId: 'card-1',
          title: 'Episode C',
          url: 'https://series.example/c',
          updateHistory: [
            { title: 'Episode B', url: 'https://series.example/b', updatedAt: 200 },
            { title: 'Episode A', url: 'https://series.example/a', updatedAt: 100 }
          ]
        }
      });
    });

    expect(document.querySelector('.x-nt-recent-history-current')?.textContent).toContain('Episode C');
    expect(Array.from(document.querySelectorAll('.x-nt-recent-history-version')).map((node) => node.textContent))
      .toEqual(expect.arrayContaining([expect.stringContaining('Episode B'), expect.stringContaining('Episode A')]));

    const buttons = getTags(document, '[data-history-index]', 'button');
    expect(buttons[0].closest('.x-nt-recent-history-version-actions')?.querySelector('time')).not.toBeNull();
    await act(async () => buttons[1].click());
    expect(restore).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'card-1' }),
      expect.objectContaining({ title: 'Episode A', url: 'https://series.example/a' }),
      1
    );
  });

  it('animates close and restore into the existing toast handoff', async () => {
    vi.useFakeTimers();
    const restoreSuccess = vi.fn();
    act(() => {
      controller = createRecentHistoryDialog({
        documentObj: document,
        windowObj: window,
        closeDelayMs: 200,
        restoredToastDelayMs: 120,
        t: (_key, fallback) => fallback,
        onRestore: () => true,
        onRestoreSuccess: restoreSuccess
      });
      controller?.mount(document.body);
      controller?.open({
        item: {
          cardId: 'card-1', title: 'Episode B', url: 'https://series.example/b',
          updateHistory: [{ title: 'Episode A', url: 'https://series.example/a', updatedAt: 100 }]
        }
      });
    });

    const host = expectTag(controller?.element, 'div');
    const restoreButton = queryHtmlTag(host, '[data-history-index="0"]', 'button');
    await act(async () => restoreButton?.click());
    expect(host.hidden).toBe(false);
    expect(host.dataset.state).toBe('restored');

    act(() => host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.dataset.state).toBe('restored');

    act(() => vi.advanceTimersByTime(120));
    expect(restoreSuccess).toHaveBeenCalledOnce();
    expect(host.hidden).toBe(false);
    act(() => vi.advanceTimersByTime(80));
    expect(host.hidden).toBe(true);

    act(() => controller?.open({
      item: {
        cardId: 'card-1', title: 'Episode B', url: 'https://series.example/b',
        updateHistory: [{ title: 'Episode A', url: 'https://series.example/a', updatedAt: 100 }]
      }
    }));
    act(() => controller?.close());
    expect(host.hidden).toBe(false);
    expect(host.dataset.state).toBe('closing');
    act(() => vi.advanceTimersByTime(200));
    expect(host.hidden).toBe(true);
  });

  it('does not move focus back into a dialog that closes during its opening frame', () => {
    vi.useFakeTimers();
    const source = document.createElement('button');
    document.body.appendChild(source);
    source.focus();
    act(() => {
      controller = createRecentHistoryDialog({
        documentObj: document,
        windowObj: window,
        closeDelayMs: 0,
        t: (_key, fallback) => fallback
      });
      controller?.mount(document.body);
      controller?.open({
        sourceElement: source,
        item: {
          cardId: 'card-1', title: 'Episode B', url: 'https://series.example/b',
          updateHistory: [{ title: 'Episode A', url: 'https://series.example/a' }]
        }
      });
      controller?.close({ restoreFocus: true });
      vi.advanceTimersByTime(20);
    });

    expect(document.activeElement).toBe(source);
  });
});
