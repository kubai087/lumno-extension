// A video page for the automatic picture-in-picture content scripts: one
// playing video, a Picture-in-Picture API that records what the script asks
// of it, and the content script's extension API (content-chrome.ts). Call
// openAutoPipPage before importing the script and close() after the test.
import { vi } from 'vitest';
import { createContentChrome } from './content-chrome';
import type { ContentChromeOptions } from './content-chrome';
import { resetContentRegistry, setPageUrl, setVisibility, trackPageListeners } from './content-page';

const AUTO_PIP_KEY = '_x_extension_auto_pip_enabled_2026_unique_';

interface AutoPipPageOptions extends ContentChromeOptions {
  url: string;
}

interface PipRecord {
  pipElement: Element | null;
  exitCalls: number;
  playCalls: number;
  // disablePictureInPicture as the video's request saw it.
  requestedDisablePiP: boolean | null;
}

// The window a video's picture-in-picture request resolves with.
class FakePictureInPictureWindow extends EventTarget implements PictureInPictureWindow {
  readonly width = 640;
  readonly height = 360;
  onresize = null;
}

function openAutoPipPage(options: AutoPipPageOptions) {
  setPageUrl(options.url);
  resetContentRegistry();
  const removeListeners = trackPageListeners();
  const page: PipRecord = { pipElement: null, exitCalls: 0, playCalls: 0, requestedDisablePiP: null };
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => page.pipElement });
  Object.defineProperty(document, 'exitPictureInPicture', {
    configurable: true,
    value: () => {
      page.exitCalls += 1;
      if (!page.pipElement) {
        return Promise.reject(new DOMException('Not in Picture-in-Picture', 'InvalidStateError'));
      }
      page.pipElement = null;
      return Promise.resolve();
    }
  });
  setVisibility('visible', false);

  const video = document.createElement('video');
  let paused = false;
  Object.defineProperties(video, {
    videoWidth: { value: 1280 },
    videoHeight: { value: 720 },
    readyState: { value: 4 },
    paused: { get: () => paused },
    ended: { value: false }
  });
  video.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 640, height: 360 });
  video.play = () => {
    page.playCalls += 1;
    paused = false;
    return Promise.resolve();
  };
  video.pause = () => { paused = true; };
  video.requestPictureInPicture = () => {
    page.requestedDisablePiP = video.disablePictureInPicture;
    page.pipElement = video;
    return Promise.resolve(new FakePictureInPictureWindow());
  };
  document.body.appendChild(video);

  const fake = createContentChrome({
    ...options,
    replies: { pipRequestOwnership: () => ({ ok: true, granted: true, token: 'owner-token' }), ...options.replies }
  });
  vi.stubGlobal('chrome', fake.chrome);

  return {
    ...fake,
    page,
    video,
    setPaused(value: boolean) { paused = value; },
    setVisibility(state: DocumentVisibilityState) { setVisibility(state); },
    setAutoPipEnabled(value: boolean) { fake.changeStorage('sync', AUTO_PIP_KEY, value, !value); },
    surrender: () => fake.dispatch({ action: 'lumno:pip-force-surrender', reason: 'other-tab' }),
    // Lets the page's timers run until the check holds, or fails the test.
    async waitFor(check: () => boolean, message: string, timeoutMs = 3000) {
      for (let waited = 0; !check(); waited += 5) {
        if (waited > timeoutMs) {
          throw new Error(`Timed out waiting for ${message}`);
        }
        await vi.advanceTimersByTimeAsync(5);
      }
    },
    close() {
      removeListeners();
      ['pictureInPictureEnabled', 'pictureInPictureElement', 'exitPictureInPicture', 'visibilityState']
        .forEach((name) => Reflect.deleteProperty(document, name));
      resetContentRegistry();
    }
  };
}

type AutoPipPage = ReturnType<typeof openAutoPipPage>;

export { AUTO_PIP_KEY, openAutoPipPage };
export type { AutoPipPage };
