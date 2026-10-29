// The New Tab's startup order: the first data pass waits until every
// preference that moves the layout has settled, the content enters once the
// wallpaper's tones are on the page's controls, and a phase that fails is
// logged without holding back the next.

interface StartupPlan {
  // What the first layout depends on: the settings it reads, the shortcuts,
  // the fonts and the first images.
  layoutPreferences: readonly unknown[];
  // Starts the first data pass; settles once its sections are drawn.
  loadData(): Promise<unknown>;
  // Settles once the wallpaper's tones are on the page's controls.
  waitForWallpaperTone(): Promise<unknown>;
  // Shows what waited for the page, and marks it ready.
  markReady(): void;
}

function runStartup(plan: StartupPlan, log: Pick<Console, 'warn'> = console): Promise<void> {
  return Promise.all(plan.layoutPreferences).catch((error: unknown) => {
    log.warn('[Lumno] Initial new tab layout setup failed.', error);
  }).then(() => plan.loadData()).catch((error: unknown) => {
    log.warn('[Lumno] Initial new tab content setup failed.', error);
  }).then(() => plan.waitForWallpaperTone()).then(() => {
    plan.markReady();
  });
}

export { runStartup };
export type { StartupPlan };
