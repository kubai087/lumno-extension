// End-to-end flows in a real headless Chrome with the development build
// (dist/chrome/, npm run build) loaded as an unpacked extension, each flow
// in a fresh browser and a temporary profile. A flow fails when it throws,
// and when the browser reported an extension error during it (see
// driver/browser.ts). Needs a local Chrome:
//
//   npm run test:e2e
//   npm run test:e2e -- -t 'tab switcher'            (some flows)
//   LUMNO_E2E_EXTENSION=<dir> npm run test:e2e        (another unpacked build)
//   LUMNO_E2E_CHROME=/path/to/chrome npm run test:e2e
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, it } from 'vitest';
import { isRecord } from './driver/cdp';
import { launchBrowser, type Browser, type PageSession } from './driver/browser';
import { startFixtureServer, type FixtureServer } from './driver/fixtures';
import type { ElementReader, Session } from './driver/session';

export { delay } from './driver/session';
export type { Browser, ElementReader, PageSession, Session };

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXTENSION_PATH = process.env.LUMNO_E2E_EXTENSION
  ? resolve(process.env.LUMNO_E2E_EXTENSION)
  : join(REPO_ROOT, 'dist', 'chrome');

export const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
export const OVERLAY_INPUT = '#_x_extension_search_input_2024_unique_';
export const TAB_SWITCHER_HOST_ID = '_x_extension_tab_switcher_host_2026_unique_';
export const LINK_PREVIEW_HOST_ID = '_x_extension_link_preview_host_2026_unique_';
export const LINK_PREVIEW_TOGGLE_ID = '_x_extension_link_preview_toggle_2026_unique_';
export const NEWTAB_INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';

export interface FlowContext {
  browser: Browser;
  fixtures: FixtureServer;
}

// The fixture server for the flows of one file.
function useFixtureServer(): () => FixtureServer {
  let server: FixtureServer | null = null;
  beforeAll(async () => {
    if (!existsSync(join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error(`No unpacked extension at ${EXTENSION_PATH}; run npm run build first.`);
    }
    server = await startFixtureServer();
  });
  afterAll(async () => {
    await server?.close();
  });
  return () => {
    if (!server) {
      throw new Error('The fixture server did not start');
    }
    return server;
  };
}

// Declares the flows of one file, each an it() in a fresh browser.
export function defineFlows(): (name: string, run: (context: FlowContext) => Promise<void>) => void {
  const fixtures = useFixtureServer();
  return (name, run) => {
    it(name, async () => {
      const browser = await launchBrowser({ extensionPath: EXTENSION_PATH });
      let error: unknown = null;
      try {
        await run({ browser, fixtures: fixtures() });
      } catch (caught) {
        error = caught;
      } finally {
        await browser.close();
      }
      if (browser.notes.length) {
        console.log(`other origins (not failures):\n  ${browser.notes.join('\n  ')}`);
      }
      const problems = [
        ...(error ? [error instanceof Error ? error.stack || error.message : String(error)] : []),
        ...browser.failures
      ];
      if (problems.length) {
        throw new Error(problems.join('\n'));
      }
    });
  };
}

// Reads an element's text with its whitespace collapsed.
export const getText: ElementReader = function getText() {
  return (this.textContent || '').replace(/\s+/g, ' ').trim();
};

export const isFocused: ElementReader = function isFocused() {
  const root = this.getRootNode();
  return 'activeElement' in root && root.activeElement === this;
};

export const strings = (values: unknown[]): string[] => values.map((value) => String(value));

export interface Point {
  x: number;
  y: number;
}

export function readPoint(value: unknown): Point {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') {
    throw new Error(`Expected a point, received ${JSON.stringify(value)}`);
  }
  return { x: value.x, y: value.y };
}

// The numbers a page measured, by name.
export function readNumbers(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    throw new Error(`Expected measurements, received ${JSON.stringify(value)}`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, number]) => [key, Number(number)]));
}

// The URL of the active tab, as the worker sees it.
export function activeTabUrl(browser: Browser): Promise<unknown> {
  return browser.worker.evaluate(`chrome.tabs.query({ active: true, lastFocusedWindow: true })
    .then(([tab]) => (tab ? tab.url : ''))`);
}

// Makes a tab the active one and gives it input focus.
export async function focusTab(browser: Browser, page: PageSession): Promise<void> {
  const href = JSON.stringify(await page.evaluate('location.href'));
  await browser.worker.evaluate(`(async () => {
    const tab = (await chrome.tabs.query({})).find((candidate) => candidate.url === ${href});
    if (!tab) throw new Error('no tab at ' + ${href});
    await chrome.tabs.update(tab.id, { active: true });
  })()`);
  await browser.cdp.send('Page.bringToFront', {}, page.sessionId);
}

export function dispatchCommand(browser: Browser, command: string): Promise<unknown> {
  return browser.worker.evaluate(`chrome.commands.onCommand.dispatch(${JSON.stringify(command)})`);
}

// Scrolls the element an expression finds into view, once it is visible,
// and returns its center.
export async function elementCenter(page: Session, expression: string): Promise<Point> {
  return readPoint(await page.waitFor(`(() => {
    const element = ${expression};
    if (!element || !element.checkVisibility()) return null;
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`, { message: `${expression} is not visible` }));
}

// Opens the overlay on a page with the search shortcut and waits until its
// input has focus.
export async function openOverlay(browser: Browser, page: PageSession): Promise<void> {
  await dispatchCommand(browser, 'show-search');
  await page.waitForShadow(OVERLAY_HOST_ID, OVERLAY_INPUT, isFocused,
    (results) => results.length === 1 && results[0] === true, { message: 'the overlay input was not focused' });
}
