import { describe, expect, it } from 'vitest';
import { runOverlayStartup } from './startup';
import type { OverlayStartupPlan } from './startup';

// A promise and the functions that settle it.
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function createPlan(steps: string[], input: 'placed' | 'empty' | 'closed') {
  const settings = deferred();
  const language = deferred();
  const styles = deferred<{ ok: boolean }>();
  const applied = deferred();
  const plan: OverlayStartupPlan = {
    settingsLoaded: settings.promise,
    languageReady: language.promise,
    styleGate: styles.promise,
    settingsApplied: applied.promise,
    placeInitialInput: () => {
      steps.push(`input:${input}`);
      return input;
    },
    showOpenTabs: () => steps.push('tabs'),
    reveal: (styleGate) => steps.push(`reveal:${styleGate ? styleGate.ok : 'failed'}`)
  };
  return { plan, settings, language, styles, applied };
}

describe('runOverlayStartup', () => {
  it('puts the input back once the settings are read, without waiting for the language', async () => {
    const steps: string[] = [];
    const { plan, settings } = createPlan(steps, 'placed');
    void runOverlayStartup(plan);
    await flush();
    expect(steps).toEqual([]);
    settings.resolve(true);
    await flush();
    expect(steps).toEqual(['input:placed']);
  });

  it('shows the open tabs only once the language is in too', async () => {
    const steps: string[] = [];
    const { plan, settings, language } = createPlan(steps, 'empty');
    void runOverlayStartup(plan);
    settings.resolve(true);
    await flush();
    expect(steps).toEqual(['input:empty']);
    language.reject(new Error('language'));
    await flush();
    expect(steps).toEqual(['input:empty', 'tabs']);
  });

  it('shows nothing in a panel that has gone', async () => {
    const steps: string[] = [];
    const { plan, settings, language } = createPlan(steps, 'closed');
    void runOverlayStartup(plan);
    settings.resolve(true);
    language.resolve(true);
    await flush();
    expect(steps).toEqual(['input:closed']);
  });

  it('reveals once both the stylesheets and the settings are applied', async () => {
    const steps: string[] = [];
    const { plan, styles, applied } = createPlan(steps, 'placed');
    void runOverlayStartup(plan);
    styles.resolve({ ok: true });
    await flush();
    expect(steps).toEqual([]);
    applied.reject(new Error('settings'));
    await flush();
    expect(steps).toEqual(['reveal:true']);
  });

  it('still reveals when the style gate fails', async () => {
    const steps: string[] = [];
    const { plan, styles, applied } = createPlan(steps, 'placed');
    void runOverlayStartup(plan);
    styles.reject(new Error('styles'));
    applied.resolve(true);
    await flush();
    expect(steps).toEqual(['reveal:failed']);
  });
});
