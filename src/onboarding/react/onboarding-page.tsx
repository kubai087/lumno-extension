import { CopyPanel, type CopyPanelHandlers, type CopyPanelModel } from './copy-panel';
import { VisualPanel, type VisualPanelModel } from './visual-panel';

// Each column is null until the page has its slides.
export interface OnboardingPageModel {
  copy: CopyPanelModel | null;
  visual: VisualPanelModel | null;
}

// The onboarding frame: the copy column beside the visual one.
export function OnboardingPage({ model, handlers }: { model: OnboardingPageModel; handlers: CopyPanelHandlers }) {
  return (
    <main aria-labelledby="onboarding-title" className="onboarding-frame">
      <section className="copy-panel" data-slide-id={model.copy ? model.copy.slideId : undefined} id="onboarding-copy-panel">
        {model.copy ? <CopyPanel handlers={handlers} model={model.copy} /> : null}
      </section>
      <section aria-label="Onboarding visual preview" className="visual-panel-slot" id="onboarding-visual-slot">
        <div className="visual-panel" id="onboarding-visual-panel">
          <div className="visual-canvas" id="onboarding-visual-canvas">
            {model.visual ? <VisualPanel model={model.visual} /> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
