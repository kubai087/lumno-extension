// The overlay's startup order once its panel is in the page: the input the
// opening carried goes back in once the settings are read (with nothing to
// put back, the open tabs show once the language is in too), and the panel
// is revealed once both its stylesheets and its settings are applied. A
// step that fails holds back neither chain.

// What the style gate answered; null when it failed.
interface StyleGateAnswer {
  ok: boolean;
}

interface OverlayStartupPlan {
  settingsLoaded: Promise<unknown>;
  languageReady: Promise<unknown>;
  styleGate: Promise<StyleGateAnswer>;
  settingsApplied: Promise<unknown>;
  // Puts the opening's input in the field: 'placed', 'empty' with none to
  // put, or 'closed' when the panel has gone.
  placeInitialInput(): 'placed' | 'empty' | 'closed';
  showOpenTabs(): void;
  reveal(styleGate: StyleGateAnswer | null): void;
}

function runOverlayStartup(plan: OverlayStartupPlan): Promise<void> {
  const input = plan.settingsLoaded.then(() => {
    if (plan.placeInitialInput() !== 'empty') {
      return undefined;
    }
    return plan.languageReady.catch(() => {}).then(() => plan.showOpenTabs());
  }).catch(() => {});
  const shown = Promise.all([
    plan.styleGate.catch(() => null),
    plan.settingsApplied.catch(() => {})
  ]).then(([styleGate]) => plan.reveal(styleGate));
  return Promise.all([input, shown]).then(() => {});
}

export { runOverlayStartup };
export type { OverlayStartupPlan, StyleGateAnswer };
