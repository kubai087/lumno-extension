import { describe, expect, it } from 'vitest';
import { create } from './index';
import { browserTab, installWorkerFake } from '../../../tests/fakes/worker';

type Injection = chrome.scripting.ScriptInjection<unknown[], unknown>;

// The worker's chrome, whose executeScript answers each injection with the
// given frame results, or fails with lastError.
function installScripting(answer: (injection: Injection) => unknown[] | Error) {
  const fake = installWorkerFake();
  fake.chrome.scripting.executeScript.mockImplementation((injection, callback) => {
    const results = answer(injection);
    if (results instanceof Error) {
      fake.chrome.runtime.lastError = { message: results.message };
      if (callback) callback([]);
      fake.chrome.runtime.lastError = null;
    } else if (callback) {
      callback(results);
    }
    return undefined;
  });
  return fake.chrome.scripting.executeScript;
}

describe('picture-in-picture in the main world', () => {
  it('runs nothing without a sender tab', async () => {
    const executeScript = installScripting(() => []);

    expect(await create().siteTryEnterPiPInMainWorld({})).toEqual({ ok: false, reason: 'no-tab' });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it("runs its function in the main world of the sender's frame and answers its result", async () => {
    const executeScript = installScripting(() => [{ result: { ok: true, after: true } }]);

    expect(await create().iqiyiSetupAutoPiPInMainWorld({ tab: browserTab({ id: 42 }), frameId: 7 })).toEqual({ ok: true, after: true });
    const [injection] = executeScript.mock.calls[0];
    expect(injection.target).toEqual({ tabId: 42, frameIds: [7] });
    expect(injection.world).toBe('MAIN');
    expect(injection.func).toEqual(expect.any(Function));
    expect(injection.func && injection.func.name).toBe('iqiyiSetupAutoPiPInMainWorld');
  });

  it('runs in the top frame when the sender has no frame', async () => {
    const executeScript = installScripting(() => [{ result: { ok: true } }]);
    await create().forceExitPiPInMainWorld({ tab: browserTab({ id: 9 }) });

    expect(executeScript.mock.calls[0][0].target).toEqual({ tabId: 9, frameIds: [0] });
  });

  it('answers the error when the script could not run', async () => {
    installScripting(() => new Error('execute failed'));

    expect(await create().youtubeForceExitPiPInMainWorld({ tab: browserTab({ id: 12 }), frameId: 3 }))
      .toEqual({ ok: false, reason: 'execute failed' });
  });

  it('answers no-result when the frame returned nothing', async () => {
    installScripting(() => []);

    expect(await create().iqiyiTryEnterPiPInMainWorld({ tab: browserTab({ id: 13 }), frameId: 2 }))
      .toEqual({ ok: false, reason: 'no-result' });
  });
});
