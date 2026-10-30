import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStrategyConfig } from '../domain/ai-prompt-strategy';
import { submitPromptInTab } from './ai-provider-submit';
import { injectedCommand, injectedModules } from '../../tests/fakes/worker';

// Submits with a chrome whose tab 1 is at tabUrl and whose page answers the
// injected submitter with pageResult.
async function submit(strategy: string, prompt: string, options: { expectedUrl?: string; tabUrl?: string } = {}) {
  const expectedUrl = options.expectedUrl || 'https://chatgpt.com/';
  const tabsGet = vi.fn((tabId: number, callback: (tab: { id: number; url: string }) => void) => {
    callback({ id: tabId, url: options.tabUrl || expectedUrl });
  });
  const executeScript = vi.fn((_injection: unknown, callback: (results: { result: unknown }[]) => void) => {
    callback([{ result: { ok: true, method: 'button' } }]);
  });
  vi.stubGlobal('chrome', {
    runtime: { getURL: (path: string) => `chrome-extension://lumno/${path}`, lastError: null },
    tabs: { get: tabsGet },
    scripting: { executeScript }
  });
  const result = await submitPromptInTab(chrome, 1, prompt, strategy, expectedUrl);
  return { result, tabReads: tabsGet.mock.calls.length, injections: executeScript.mock.calls.map(([injection]) => injection) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitting a prompt in an AI provider tab', () => {
  it("injects the submitter into the tab with the prompt, the strategy and the tab's origin, and answers its result", async () => {
    const { result, injections } = await submit('geminiPrompt', '  Explain Lumno ', { expectedUrl: 'https://gemini.google.com/app' });

    expect(result).toEqual({ ok: true, method: 'button' });
    expect(injections).toHaveLength(1);
    expect(injectedModules(injections[0])).toEqual(['build/injected/ai-prompt-submit.js']);
    expect(injectedCommand(injections[0])).toEqual({
      type: 'submit', allowedOrigin: 'https://gemini.google.com', prompt: 'Explain Lumno', strategy: getStrategyConfig('geminiPrompt')
    });
  });

  it('refuses an origin the strategy does not name before reading the tab', async () => {
    expect(await submit('chatgptPrompt', 'Private prompt', { expectedUrl: 'https://attacker.example/chat' }))
      .toEqual({ result: { ok: false, reason: 'unapproved-submit-origin' }, tabReads: 0, injections: [] });
    expect((await submit('chatgptPrompt', 'Private prompt', { expectedUrl: 'http://chatgpt.com/' })).result)
      .toEqual({ ok: false, reason: 'unapproved-submit-origin' });
    expect((await submit('chatgptPrompt', 'Private prompt', { expectedUrl: 'chrome://newtab/' })).result)
      .toEqual({ ok: false, reason: 'invalid-expected-origin' });
  });

  it('refuses a tab that went elsewhere, port included, before injecting the prompt', async () => {
    expect(await submit('chatgptPrompt', 'Private prompt', { tabUrl: 'https://attacker.example/redirected' }))
      .toEqual({ result: { ok: false, reason: 'unexpected-tab-origin' }, tabReads: 1, injections: [] });
    expect((await submit('chatgptPrompt', 'Private prompt', { tabUrl: 'https://chatgpt.com:444/conversation' })).result)
      .toEqual({ ok: false, reason: 'unexpected-tab-origin' });
  });

  it('injects into a tab that moved within the same origin, where the page checks its own origin', async () => {
    const { injections } = await submit('chatgptPrompt', 'Private prompt', { tabUrl: 'https://chatgpt.com/conversation' });

    expect(injections).toHaveLength(1);
  });

  it('opens a URL-only strategy without injecting anything, on its official origin only', async () => {
    expect(await submit('qianwenQuery', 'Private prompt', { expectedUrl: 'https://www.qianwen.com/?q=Private%20prompt' }))
      .toEqual({ result: { ok: true, method: 'url' }, tabReads: 0, injections: [] });
    expect(await submit('qianwenQuery', 'Private prompt', { expectedUrl: 'https://attacker.example/?q=Private%20prompt' }))
      .toEqual({ result: { ok: false, reason: 'unapproved-submit-origin' }, tabReads: 0, injections: [] });
  });
});
