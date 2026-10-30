import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackgroundAction, BackgroundReply, BackgroundRequest } from '../domain/messages';
import { PopupActions } from './actions';
import type { PopupPorts } from './browser';
import type { PopupActionId } from './react/popup-view';
import { missingMessages } from '../../tests/fakes/locale-messages';

const t = (_key: string, fallback: string) => fallback;
const tab = { id: 7, url: 'https://example.com/a', title: 'A' };

// Each action's reply as the worker sends it.
type ReplyTable = { [A in BackgroundAction]?: BackgroundReply<A> };

// Answers the worker's actions from a table; an action left out gets no answer.
function createPorts(replies: ReplyTable = {}) {
  const sent: string[] = [];
  const closePopup = vi.fn();
  const ports: PopupPorts = {
    sendMessage<A extends BackgroundAction>(payload: BackgroundRequest<A>): Promise<BackgroundReply<A> | null> {
      sent.push(payload.action);
      const reply: ReplyTable[A] = replies[payload.action];
      return Promise.resolve(reply === undefined ? null : reply);
    },
    executeInTab: vi.fn(() => Promise.resolve(null)),
    writeClipboard: vi.fn(() => Promise.resolve()),
    closePopup
  };
  return { ports, sent, closePopup };
}

function createActions(ports: PopupPorts) {
  const toast = { show: vi.fn() };
  const actions = new PopupActions(ports, {
    tab,
    pip: { supported: true, hasVideo: true, active: false },
    recentPin: { pinned: false, full: false }
  }, t, toast);
  return { actions, toast };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Popup actions', () => {
  it('copies the link and closes once the page shows the toast', async () => {
    const { ports, sent, closePopup } = createPorts({ popupShowPageToast: { ok: true } });
    const { actions, toast } = createActions(ports);
    await actions.run('copy');
    expect(ports.writeClipboard).toHaveBeenCalledWith('https://example.com/a');
    expect(sent).toEqual(['popupShowPageToast']);
    expect(toast.show).not.toHaveBeenCalled();
    expect(closePopup).toHaveBeenCalledTimes(1);
  });

  it('shows the toast itself when the page cannot, then closes', async () => {
    vi.useFakeTimers();
    const { ports, closePopup } = createPorts({ popupShowPageToast: { ok: false } });
    const { actions, toast } = createActions(ports);
    await actions.run('copy');
    expect(toast.show).toHaveBeenCalledWith('Current page URL copied', 1400);
    expect(actions.store.getSnapshot().busyAction).toBe('');
    expect(closePopup).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1400);
    expect(closePopup).toHaveBeenCalledTimes(1);
  });

  it('marks the action busy while it runs and ignores others meanwhile', async () => {
    const { ports, sent } = createPorts({ popupShowPageToast: { ok: true } });
    const { actions } = createActions(ports);
    const running = actions.run('copy');
    expect(actions.store.getSnapshot().busyAction).toBe('copy');
    await actions.run('shortcut');
    await running;
    expect(sent).toEqual(['popupShowPageToast']);
  });

  it('turns a failed copy into a notice', async () => {
    const { ports } = createPorts();
    ports.writeClipboard = () => Promise.reject(new Error('denied'));
    const { actions } = createActions(ports);
    await actions.run('copy');
    expect(actions.store.getSnapshot()).toMatchObject({
      busyAction: '',
      notice: { text: 'Couldn’t copy the link. Try again.', tone: 'error' }
    });
  });

  it('keeps the new pin state while the popup stays open', async () => {
    vi.useFakeTimers();
    const { ports } = createPorts({
      popupToggleRecentPin: { status: 'pinned', tracking: false },
      popupShowPageToast: { ok: false }
    });
    const { actions, toast } = createActions(ports);
    await actions.run('pin');
    expect(actions.store.getSnapshot().recentPin).toEqual({ pinned: true, full: false });
    expect(toast.show).toHaveBeenCalledWith('Pinned to Recent on your New Tab', 1400);
  });

  it('says when the pinned cards are full', async () => {
    const { ports } = createPorts({ popupToggleRecentPin: { status: 'limit' } });
    const { actions } = createActions(ports);
    await actions.run('pin');
    expect(actions.store.getSnapshot().notice).toEqual({ text: 'You can pin up to 3 cards.', tone: 'error' });
    expect(actions.store.getSnapshot().recentPin).toEqual({ pinned: false, full: false });
  });

  it('finds every string its outcomes ask for in every language', async () => {
    vi.useFakeTimers();
    const keys = new Set<string>();
    const record = (key: string, fallback: string) => {
      keys.add(key);
      return fallback;
    };
    const outcomes: Array<[PopupActionId, ReplyTable]> = [
      ['copy', { popupShowPageToast: { ok: false } }],
      ['pip', {}],
      ['pin', { popupToggleRecentPin: { status: 'limit' } }],
      ['pin', {}],
      ['pin', { popupToggleRecentPin: { status: 'pinned', tracking: true }, popupShowPageToast: { ok: true } }],
      ['pin', { popupToggleRecentPin: { status: 'pinned', tracking: false }, popupShowPageToast: { ok: true } }],
      ['pin', { popupToggleRecentPin: { status: 'unpinned' }, popupShowPageToast: { ok: true } }],
      ['shortcut', {}]
    ];
    for (const [id, replies] of outcomes) {
      const actions = new PopupActions(createPorts(replies).ports, {
        tab,
        pip: { supported: true, hasVideo: true, active: false },
        recentPin: { pinned: false, full: false }
      }, record, { show: vi.fn() });
      await actions.run(id);
    }
    const failedCopy = createPorts().ports;
    failedCopy.writeClipboard = () => Promise.reject(new Error('denied'));
    await new PopupActions(failedCopy, { tab, pip: { supported: true, hasVideo: true, active: false }, recentPin: null }, record, { show: vi.fn() })
      .run('copy');
    expect(keys.size).toBeGreaterThan(5);
    expect(missingMessages(keys)).toEqual([]);
  });
});
