// The onboarding page's one root: the frame drawn from where the flow is and
// the browser's search shortcut. The columns stay empty until the slides
// are read.
import { useLayoutEffect, useMemo } from 'react';
import { useStore } from '../../shared/react/use-store';
import * as MODEL from '../onboarding-content';
import type { CopyPanelHandlers } from '../react/copy-panel';
import { OnboardingPage, type OnboardingPageModel } from '../react/onboarding-page';
import type { OnboardingLayout } from '../dom/layout';
import { getTextSwapDurationMs, prefersReducedMotion } from '../dom/motion';
import type { OnboardingTooltips } from '../dom/tooltips';
import { getCopyPanelModel } from '../features/copy-model';
import type { OnboardingFlow } from '../features/flow';
import { isMacPlatform, type SearchShortcut } from '../features/search-shortcut';
import { runSlideAction } from '../features/slide-actions';
import { getVisualSurfaceModel } from '../features/visual-model';

interface OnboardingAppProps {
  flow: OnboardingFlow;
  shortcut: SearchShortcut;
  layout: OnboardingLayout;
  tooltips: OnboardingTooltips;
}

function OnboardingApp({ flow, shortcut, layout, tooltips }: OnboardingAppProps) {
  const state = useStore(flow.store);
  const { shortcut: shortcutValue } = useStore(shortcut.store);
  const { blueprint, slide: slideState } = state;
  const slide = blueprint && slideState ? MODEL.getSlideByIndex(blueprint, slideState.index) : null;

  const copy = useMemo(() => (blueprint && slideState && slide ? getCopyPanelModel({
    slide,
    slideCount: blueprint.slides.length,
    index: slideState.index,
    copy: blueprint.runtimeCopy,
    pageStripEntering: state.pageStripEntering,
    shortcut: shortcutValue,
    isMac: isMacPlatform(),
    expandedAccordionId: state.expandedAccordionId,
    copySwap: state.copySwap,
    reducedMotion: prefersReducedMotion(),
    swapDurationMs: getTextSwapDurationMs()
  }) : null), [blueprint, slideState, slide, state.pageStripEntering, state.expandedAccordionId, state.copySwap, shortcutValue]);

  const surface = useMemo(() => (blueprint && slide && slide.visual.visible
    ? getVisualSurfaceModel(blueprint.runtimeCopy, slide.visual.kind, prefersReducedMotion())
    : null), [blueprint, slide]);

  const model: OnboardingPageModel = {
    copy,
    visual: slide ? {
      slideId: slide.id,
      kind: slide.visual.kind,
      surface,
      cursor: { enabled: slide.cursor.enabled, mode: slide.cursor.enabled ? slide.id : '' },
      exiting: state.visualExiting
    } : null
  };

  const handlers = useMemo<CopyPanelHandlers>(() => ({
    onNavigate: (index) => flow.dispatch({ type: 'GOTO', index }),
    onTitleFitNeeded: () => layout.scheduleTitleFitUpdate(),
    onAction: (actionId, event) => runSlideAction(flow, actionId, event),
    onShowTooltip: (button) => tooltips.showAction(button),
    onHideTooltip: () => tooltips.hideAction(),
    onToggleAccordion: (accordionId) => flow.toggleAccordion(accordionId),
    onShowInfoTooltip: (target, infoTooltip, browserAvatars) => tooltips.showInfo(target, infoTooltip, browserAvatars),
    onHideInfoTooltip: () => tooltips.hideInfo()
  }), [flow, layout, tooltips]);

  // An info tooltip left open would point at a row that may have moved.
  useLayoutEffect(() => {
    if (copy) {
      tooltips.hideInfo();
      layout.scheduleTitleFitUpdate();
    }
  }, [copy, layout, tooltips]);

  useLayoutEffect(() => {
    if (slide) {
      layout.scheduleVisualCanvasScaleUpdate();
    }
  }, [slide, layout]);

  return <OnboardingPage handlers={handlers} model={model} />;
}

export { OnboardingApp };
