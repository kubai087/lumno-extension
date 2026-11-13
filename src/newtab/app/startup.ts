// The New Tab's startup order: the first data pass waits until every
// preference that moves the layout has settled, the content enters once the
// wallpaper's tones are on the page's controls, and a phase that fails is
// logged without holding back the next. Each phase waits only so long: a
// phase that has not settled by then is logged with what it still waits
// for, and the page goes on without it.

interface StartupPlan {
  // What the first layout depends on, by name: the settings it reads, the
  // shortcuts, the fonts and the first images.
  layoutPreferences: Readonly<Record<string, unknown>>;
  // Starts the first data pass; settles once its sections are drawn.
  loadData(): Promise<unknown>;
  // Settles once the wallpaper's tones are on the page's controls.
  waitForWallpaperTone(): Promise<unknown>;
  // Shows what waited for the page, and marks it ready.
  markReady(): void;
}

// How long each phase may hold back the next, in milliseconds.
const STARTUP_PHASE_LIMITS = {
  layoutPreferences: 2000,
  loadData: 3000,
  wallpaperTone: 1000
} as const;

type StartupTimers = Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;

// Settles once every named task settles, or once `limit` has passed; then it
// warns with the names still pending. A rejected task rejects it.
function settleWithin(
  tasks: Readonly<Record<string, unknown>>,
  limit: number,
  phase: string,
  log: Pick<Console, 'warn'>,
  timers: StartupTimers
): Promise<void> {
  const pending = new Set(Object.keys(tasks));
  const all = Promise.all(Object.entries(tasks).map(([name, task]) =>
    Promise.resolve(task).then(() => {
      pending.delete(name);
    })
  ));
  return new Promise<void>((resolve, reject) => {
    const timer = timers.setTimeout(() => {
      log.warn(`[Lumno] New tab ${phase} still waiting after ${limit} ms; going on without:`, [...pending]);
      resolve();
    }, limit);
    all.then(() => {
      timers.clearTimeout(timer);
      resolve();
    }, (error: unknown) => {
      timers.clearTimeout(timer);
      reject(error);
    });
  });
}

function runStartup(
  plan: StartupPlan,
  log: Pick<Console, 'warn'> = console,
  timers: StartupTimers = globalThis
): Promise<void> {
  return settleWithin(
    plan.layoutPreferences, STARTUP_PHASE_LIMITS.layoutPreferences, 'layout setup', log, timers
  ).catch((error: unknown) => {
    log.warn('[Lumno] Initial new tab layout setup failed.', error);
  }).then(() => settleWithin(
    { sections: plan.loadData() }, STARTUP_PHASE_LIMITS.loadData, 'content setup', log, timers
  )).catch((error: unknown) => {
    log.warn('[Lumno] Initial new tab content setup failed.', error);
  }).then(() => settleWithin(
    { wallpaperTone: plan.waitForWallpaperTone() }, STARTUP_PHASE_LIMITS.wallpaperTone, 'wallpaper tone', log, timers
  )).catch((error: unknown) => {
    log.warn('[Lumno] Initial new tab wallpaper tone failed.', error);
  }).then(() => {
    plan.markReady();
  });
}

export { runStartup, STARTUP_PHASE_LIMITS };
export type { StartupPlan, StartupTimers };
