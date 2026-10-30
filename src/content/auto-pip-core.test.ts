import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autoPipEnabled } from '../domain/settings/features';
import { PIP_PAGE_BRIDGE_REQUEST_EVENT } from '../domain/pip-page-bridge';
import { createSettingsStore } from '../platform/settings-store';
import { createAutoPipCore, isVideoPlaying } from './auto-pip-core';
import type { AutoPipHooks, AutoPipState } from './auto-pip-core';
import { createContentChrome } from '../../tests/fakes/content-chrome';
import type { ContentChromeOptions } from '../../tests/fakes/content-chrome';
import { setVisibility } from '../../tests/fakes/content-page';

const KEY = '_x_extension_auto_pip_enabled_2026_unique_';

let pipElement: Element | null = null;
let exitCalls = 0;

function setExit(exit: () => Promise<void>): void {
  Object.defineProperty(document, 'exitPictureInPicture', { configurable: true, value: exit });
}

function defaultExit(): Promise<void> {
  exitCalls += 1;
  if (!pipElement) {
    return Promise.reject(new Error('InvalidStateError'));
  }
  pipElement = null;
  return Promise.resolve();
}

interface MediaOptions {
  paused?: boolean;
  readyState?: number;
}

function createMedia<K extends 'video' | 'audio'>(tag: K, options: MediaOptions = {}): HTMLElementTagNameMap[K] {
  const media = document.createElement(tag);
  let paused = options.paused ?? false;
  Object.defineProperties(media, {
    paused: { configurable: true, get: () => paused },
    ended: { configurable: true, value: false },
    readyState: { configurable: true, value: options.readyState ?? 4 }
  });
  media.pause = () => { paused = true; };
  return media;
}

function setPaused(media: HTMLMediaElement, paused: boolean): void {
  Object.defineProperty(media, 'paused', { configurable: true, get: () => paused });
}

const areas = new WeakMap<HTMLVideoElement, number>();
const rejected = new WeakSet<HTMLVideoElement>();

function createVideo(area: number, options: MediaOptions = {}): HTMLVideoElement {
  const video = createMedia('video', options);
  areas.set(video, area);
  document.body.appendChild(video);
  return video;
}

// Lets the fake worker answer, then hands back the call's result.
async function answered<T>(promise: Promise<T>, ms = 0): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

function createState(): AutoPipState {
  return {
    autoPipEnabled: false,
    activeVideo: null,
    lastManagedVideo: null,
    enteringPiP: false,
    exitingPiP: false,
    managedPiP: false,
    recoveryTimer: null,
    suppressEnterUntil: 0,
    hiddenRetryBudget: 0,
    shouldResumeInlinePlayback: false,
    wasPlayingBeforeHide: false
  };
}

function createHarness(options: ContentChromeOptions & { hooks?: Partial<AutoPipHooks> } = {}) {
  const fake = createContentChrome({
    ...options,
    replies: { pipRequestOwnership: () => ({ ok: true, granted: true, token: 'token-1' }), ...options.replies }
  });
  vi.stubGlobal('chrome', fake.chrome);
  const enterReasons: string[] = [];
  const recoveries: number[] = [];
  const state = createState();
  const core = createAutoPipCore({
    state,
    window,
    document,
    navigator,
    chrome,
    settingsStore: createSettingsStore({ chromeApi: chrome, settings: [autoPipEnabled] }),
    config: {
      mainWorldExitAction: 'forceExitPiPInMainWorld',
      enterSuppressAfterExitMs: 1100,
      enterSuppressAfterVisibleMs: 1300
    },
    hooks: {
      maybeEnterPiP: (reason) => {
        enterReasons.push(reason);
        return Promise.resolve(false);
      },
      scheduleVisibleRecovery: () => { recoveries.push(Date.now()); },
      isVideoCandidate: (video) => !rejected.has(video),
      scoreVideo: (video) => {
        const area = areas.get(video) ?? 0;
        return area > 0 ? area + (isVideoPlaying(video) ? 1e9 : 0) : null;
      },
      ...options.hooks
    }
  });
  return { core, state, fake, enterReasons, recoveries };
}

beforeEach(() => {
  vi.useFakeTimers();
  pipElement = null;
  exitCalls = 0;
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => pipElement });
  setExit(defaultExit);
  setVisibility('hidden', false);
});

afterEach(() => {
  ['pictureInPictureEnabled', 'pictureInPictureElement', 'exitPictureInPicture', 'visibilityState']
    .forEach((name) => Reflect.deleteProperty(document, name));
  Reflect.deleteProperty(navigator, 'mediaSession');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('auto PiP setting', () => {
  it('defaults to on and only a stored false turns it off', () => {
    expect(autoPipEnabled.parse(undefined)).toBe(true);
    expect(autoPipEnabled.parse(false)).toBe(false);
    expect(autoPipEnabled.parse('false')).toBe(true);
  });

  it('reads a missing setting as on without writing it back', async () => {
    const { core, state, fake } = createHarness();
    core.syncAutoPipEnabledSetting();
    await vi.advanceTimersByTimeAsync(5);
    expect(state.autoPipEnabled).toBe(true);
    expect(fake.storageWrites).toEqual([]);
  });

  it('reads a stored false as off without writing it', async () => {
    const { core, state, fake } = createHarness({ sync: { [KEY]: false } });
    core.syncAutoPipEnabledSetting();
    await vi.advanceTimersByTimeAsync(5);
    expect(state.autoPipEnabled).toBe(false);
    expect(fake.storageWrites).toEqual([]);
  });

  it('clears recovery and leaves a managed window when turned off in the active area', async () => {
    const { core, state, fake } = createHarness({
      replies: { forceExitPiPInMainWorld: () => { pipElement = null; return { ok: true }; } }
    });
    core.syncAutoPipEnabledSetting();
    await vi.advanceTimersByTimeAsync(5);
    await answered(core.requestPiPOwnership('video'));
    fake.messages.length = 0;
    state.managedPiP = true;
    state.shouldResumeInlinePlayback = true;
    state.hiddenRetryBudget = 3;
    pipElement = document.createElement('video');

    fake.changeStorage('local', KEY, true);
    expect(state.autoPipEnabled).toBe(true);
    fake.changeStorage('sync', KEY, false);
    expect(state.autoPipEnabled).toBe(false);
    expect(state.shouldResumeInlinePlayback).toBe(false);
    expect(state.hiddenRetryBudget).toBe(0);

    await vi.advanceTimersByTimeAsync(20);
    expect(pipElement).toBeNull();
    expect(fake.takeActions()).toEqual(['forceExitPiPInMainWorld', 'pipReleaseOwnership']);
  });
});

describe('auto PiP core', () => {
  it('counts a video as playing only with enough data', () => {
    expect(isVideoPlaying(createMedia('video'))).toBe(true);
    expect(isVideoPlaying(createMedia('video', { readyState: 1 }))).toBe(false);
    expect(isVideoPlaying(null)).toBe(false);
  });

  it('resolves a runtime message with a reason instead of rejecting', async () => {
    const { core, fake } = createHarness({ replies: { pipReleaseOwnership: 'never', pipRequestOwnership: () => undefined } });
    await expect(answered(core.sendRuntimeMessage({ action: 'pipRequestOwnership', kind: 'video' })))
      .resolves.toEqual({ ok: false, reason: 'empty-response' });

    let timedOut: unknown = null;
    void core.sendRuntimeMessage({ action: 'pipReleaseOwnership', token: 't' }, { ms: 0, minMs: 30 })
      .then((result) => { timedOut = result; });
    await vi.advanceTimersByTimeAsync(29);
    expect(timedOut).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(timedOut).toEqual({ ok: false, reason: 'timeout' });

    fake.chrome.runtime.sendMessage = () => { throw new Error('Extension context invalidated.'); };
    await expect(core.sendRuntimeMessage({ action: 'pipReleaseOwnership', token: 't' }))
      .resolves.toEqual({ ok: false, reason: 'Error: Extension context invalidated.' });
    Reflect.deleteProperty(fake.chrome.runtime, 'sendMessage');
    await expect(core.sendRuntimeMessage({ action: 'pipReleaseOwnership', token: 't' }))
      .resolves.toEqual({ ok: false, reason: 'no-runtime-sendMessage' });
  });

  it('keeps the granted ownership token and releases it exactly once', async () => {
    const { core, fake } = createHarness();
    await expect(answered(core.requestPiPOwnership('video'))).resolves.toEqual({ ok: true, granted: true });
    expect(core.hasOwnership()).toBe(true);
    await answered(core.releasePiPOwnership());
    expect(core.hasOwnership()).toBe(false);
    await expect(core.releasePiPOwnership()).resolves.toEqual({ ok: true, released: false, reason: 'no-owner-token' });
    expect(fake.messages).toEqual([
      { action: 'pipRequestOwnership', kind: 'video' },
      { action: 'pipReleaseOwnership', token: 'token-1' }
    ]);
  });

  it('counts nothing to exit as success and skips the after-exit hook', async () => {
    const afterExit = vi.fn();
    const { core } = createHarness({ hooks: { afterExitAttempt: afterExit } });
    await expect(core.maybeExitPiP()).resolves.toBe(true);
    expect(afterExit).not.toHaveBeenCalled();
  });

  it('falls through the main world and the page bridge to exitPictureInPicture', async () => {
    const afterExit = vi.fn(() => pipElement);
    const { core, state, fake } = createHarness({ hooks: { afterExitAttempt: afterExit } });
    const bridgeRequests = vi.fn();
    window.addEventListener(PIP_PAGE_BRIDGE_REQUEST_EVENT, bridgeRequests);
    state.managedPiP = true;
    await answered(core.requestPiPOwnership('video'));
    fake.messages.length = 0;
    pipElement = document.createElement('video');
    const before = Date.now();

    await expect(answered(core.maybeExitPiP(), 1000)).resolves.toBe(true);
    window.removeEventListener(PIP_PAGE_BRIDGE_REQUEST_EVENT, bridgeRequests);
    expect(bridgeRequests).toHaveBeenCalledTimes(1);
    expect(exitCalls).toBe(1);
    expect(state.managedPiP).toBe(false);
    expect(state.exitingPiP).toBe(false);
    expect(state.suppressEnterUntil).toBeGreaterThanOrEqual(before + 1100);
    // After the attempt and again in cleanup.
    expect(afterExit).toHaveBeenCalledTimes(2);
    expect(fake.takeActions()).toEqual(['forceExitPiPInMainWorld', 'pipReleaseOwnership']);
  });

  it('reports a rejected exitPictureInPicture as a failed exit', async () => {
    const { core, state } = createHarness();
    state.managedPiP = true;
    setExit(() => Promise.reject(new Error('InvalidStateError')));
    pipElement = document.createElement('video');
    await expect(answered(core.maybeExitPiP(), 1000)).resolves.toBe(false);
    expect(state.managedPiP).toBe(false);
  });

  it('retries entering while hidden until the retry budget is spent', async () => {
    const { core, state, enterReasons } = createHarness();
    state.autoPipEnabled = true;
    state.hiddenRetryBudget = 2;
    core.scheduleDeferredEnterPiP('visibility_hidden_retry');
    await vi.advanceTimersByTimeAsync(400);
    expect(enterReasons).toEqual([
      'visibility_hidden_retry',
      'visibility_hidden_retry_loop',
      'visibility_hidden_retry_loop_loop'
    ]);
    expect(state.hiddenRetryBudget).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(enterReasons).toHaveLength(3);
  });

  it('does not retry while disabled or visible', async () => {
    const { core, state, enterReasons } = createHarness();
    core.scheduleDeferredEnterPiP('off');
    state.autoPipEnabled = true;
    setVisibility('visible', false);
    core.scheduleDeferredEnterPiP('visible');
    await vi.advanceTimersByTimeAsync(60);
    expect(enterReasons).toEqual([]);
  });

  it('picks the video by the hooks candidate filter and score', () => {
    const { core, state } = createHarness();
    const small = createVideo(10, { paused: true });
    const large = createVideo(500, { paused: true });
    const reject = createVideo(9999);
    rejected.add(reject);
    expect(core.pickPrimaryVideo()).toBe(large);

    const playing = createVideo(20);
    expect(core.syncActiveVideo()).toBe(playing);
    expect(core.syncActiveVideo(small)).toBe(small);
    expect(core.syncActiveVideo(reject)).toBe(playing);
    expect(state.activeVideo).toBe(playing);

    document.body.replaceChildren(reject);
    expect(core.pickPrimaryVideo()).toBe(reject);
  });

  it('records on hide whether inline playback should resume', () => {
    const { core, state } = createHarness();
    const playing = createVideo(20);
    state.autoPipEnabled = true;
    state.lastManagedVideo = playing;
    core.capturePlaybackStateOnHide();
    expect(state.wasPlayingBeforeHide).toBe(true);
    expect(state.shouldResumeInlinePlayback).toBe(true);
    setPaused(playing, true);
    core.capturePlaybackStateOnHide();
    expect(state.shouldResumeInlinePlayback).toBe(false);
  });

  it('gives up PiP when the background asks and pauses media in a hidden tab', async () => {
    const { core, state, fake } = createHarness();
    const audio = createMedia('audio');
    document.body.appendChild(audio);
    const pause = vi.spyOn(audio, 'pause');
    core.bindRuntimeMessageListener();
    core.bindRuntimeMessageListener();
    expect(fake.messageListeners).toHaveLength(1);
    expect(fake.messageListeners[0]({ action: 'other' }, {}, () => {})).toBeUndefined();

    state.shouldResumeInlinePlayback = true;
    await expect(answered(fake.dispatch({ action: 'lumno:pip-force-surrender', reason: 'r' }), 10)).resolves.toEqual({ ok: true, reason: 'r' });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(state.shouldResumeInlinePlayback).toBe(false);
  });

  it('enters through maybeEnterPiP on the Media Session enterpictureinpicture action', async () => {
    const handlers = new Map<string, () => Promise<void>>();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: { setActionHandler: (name: string, handler: () => Promise<void>) => { handlers.set(name, handler); } }
    });
    const { core, enterReasons } = createHarness();
    core.bindMediaSessionAutoPiP();
    const handler = handlers.get('enterpictureinpicture');
    expect(handler).toBeTypeOf('function');
    if (handler) await handler();
    expect(enterReasons).toEqual(['media_session_action']);
  });

  it('starts visible recovery when PiP is left while the tab is visible', () => {
    const { core, state, recoveries } = createHarness();
    state.managedPiP = true;
    setVisibility('visible', false);
    core.onLeavePictureInPicture();
    expect(state.managedPiP).toBe(false);
    expect(recoveries).toHaveLength(1);
  });
});
