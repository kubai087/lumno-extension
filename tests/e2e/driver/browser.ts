// A throwaway headless Chrome with this extension loaded, driven over a CDP
// pipe, in a temporary profile of its own. Extensions.loadUnpacked loads
// the extension, so branded Chrome works as well as Chrome for Testing.
//
// Every uncaught exception, console error and failed load from the extension
// (its pages, worker and content scripts) is collected in `failures`; failed
// loads from other origins (remote images, wallpapers) only land in `notes`.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { arrayAt, createPipeConnection, isRecord, recordAt, stringAt, type CdpEvent } from './cdp';
import { createSession, delay, type Session } from './session';

const CHROME_CANDIDATES = [
  process.env.LUMNO_E2E_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter((candidate): candidate is string => Boolean(candidate));

export function findChrome(): string | null {
  return CHROME_CANDIDATES.find((candidate) => existsSync(candidate)) || null;
}

function shortUrl(url: string): string {
  return url.replace(/^chrome-extension:\/\/[a-z]+\//, '');
}

// A page opened in its own tab.
export interface PageSession extends Session {
  targetId: string;
}

function isWritable(stream: unknown): stream is Writable {
  return typeof stream === 'object' && stream !== null && 'write' in stream && typeof stream.write === 'function';
}

function isReadable(stream: unknown): stream is Readable {
  return typeof stream === 'object' && stream !== null && 'on' in stream && typeof stream.on === 'function' && 'read' in stream;
}

export async function launchBrowser({ extensionPath }: { extensionPath: string }) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('No Chrome found; set LUMNO_E2E_CHROME.');
  }
  const profileDir = mkdtempSync(join(tmpdir(), 'lumno-e2e-'));
  const child = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-search-engine-choice-screen',
    '--window-size=1400,900',
    // CI runners do not allow Chrome's user-namespace sandbox.
    ...(process.env.CI ? ['--no-sandbox'] : [])
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const [, , , writer, reader] = child.stdio;
  if (!isWritable(writer) || !isReadable(reader)) {
    throw new Error('Chrome did not open its debugging pipe');
  }
  const cdp = createPipeConnection(writer, reader);
  const labels = new Map<string, string>();
  const failures: string[] = [];
  const notes: string[] = [];
  let extensionId = '';

  const report = ({ method, params, sessionId }: CdpEvent) => {
    const label = labels.get(sessionId) || 'browser';
    if (method === 'Target.attachedToTarget') {
      const attached = stringAt(params, 'sessionId');
      const info = recordAt(params, 'targetInfo');
      labels.set(attached, `${stringAt(info, 'type')}:${shortUrl(stringAt(info, 'url'))}`);
      ['Runtime.enable', 'Log.enable', 'Runtime.runIfWaitingForDebugger'].forEach((command) => {
        cdp.send(command, {}, attached).catch(() => {});
      });
    } else if (method === 'Runtime.exceptionThrown') {
      const details = recordAt(params, 'exceptionDetails');
      const text = stringAt(recordAt(details, 'exception'), 'description') || stringAt(details, 'text');
      failures.push(`[${label}] uncaught ${text.split('\n').slice(0, 3).join(' | ')} (${stringAt(details, 'url')}:${String(details.lineNumber)})`);
    } else if (method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(stringAt(params, 'type'))) {
      const text = arrayAt(params, 'args').map((arg) => {
        const value = isRecord(arg) ? arg.value : undefined;
        return value ? String(value) : stringAt(arg, 'description');
      }).join(' ');
      failures.push(`[${label}] console.${stringAt(params, 'type')} ${text}`);
    } else if (method === 'Log.entryAdded' && stringAt(recordAt(params, 'entry'), 'level') === 'error') {
      const entry = recordAt(params, 'entry');
      const url = stringAt(entry, 'url');
      const line = `[${label}] ${stringAt(entry, 'source')}: ${stringAt(entry, 'text')} ${url}`;
      if (url && extensionId && !url.startsWith(`chrome-extension://${extensionId}/`)) {
        notes.push(line);
      } else {
        failures.push(line);
      }
    }
  };
  cdp.onEvent(report);

  async function attach(targetId: string, label: string): Promise<Session> {
    const sessionId = stringAt(await cdp.send('Target.attachToTarget', { targetId, flatten: true }), 'sessionId');
    labels.set(sessionId, label);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Log.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId).catch(() => {});
    return createSession(cdp, sessionId);
  }

  // Opens a URL in a new tab and waits for its load event.
  async function openPage(url: string): Promise<PageSession> {
    const targetId = stringAt(await cdp.send('Target.createTarget', { url: 'about:blank' }), 'targetId');
    const page = { ...(await attach(targetId, shortUrl(url))), targetId };
    await page.goto(url);
    return page;
  }

  async function closePage(page: PageSession): Promise<void> {
    await cdp.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
  }

  const waitForExit = (ms: number) => new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    setTimeout(resolve, ms);
  });

  // Asks Chrome to quit so its helper processes stop writing to the profile,
  // and kills it only if it does not.
  async function close(): Promise<void> {
    cdp.send('Browser.close').catch(() => {});
    await waitForExit(5000);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await waitForExit(2000);
    }
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (error) {
      console.warn(`Could not remove ${profileDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  extensionId = stringAt(await cdp.send('Extensions.loadUnpacked', { path: extensionPath }), 'id');

  // The worker, for dispatching commands and reading extension state.
  let workerTargetId = '';
  for (let attempt = 0; attempt < 50 && !workerTargetId; attempt += 1) {
    const targets = arrayAt(await cdp.send('Target.getTargets'), 'targetInfos');
    const worker = targets.find((target) => stringAt(target, 'type') === 'service_worker' && stringAt(target, 'url').includes(extensionId));
    workerTargetId = stringAt(worker, 'targetId');
    if (!workerTargetId) await delay(100);
  }
  if (!workerTargetId) {
    await close();
    throw new Error('the service worker did not start');
  }
  const worker = await attach(workerTargetId, 'service_worker');

  return {
    cdp,
    extensionId,
    extensionUrl: (file: string) => `chrome-extension://${extensionId}/${file}`,
    worker,
    openPage,
    closePage,
    failures,
    notes,
    close
  };
}

export type Browser = Awaited<ReturnType<typeof launchBrowser>>;
