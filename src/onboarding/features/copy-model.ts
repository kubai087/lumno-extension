// What the onboarding copy column shows for a slide: the step strip, the
// heading and its title cycle, the body with the search shortcut filled in,
// the interactions and the actions.
import * as MODEL from '../onboarding-content';
import type { OnboardingRuntimeCopy, OnboardingSlide } from '../onboarding-content';
import type { CopyPanelModel, CopySwapPhase } from '../react/copy-panel';
import { getRuntimeMiscText } from './visual-model';

const SHORTCUT_PLACEHOLDER = '{shortcut}';
const TITLE_CYCLE_INTERVAL_MS = 1900;
const TITLE_CYCLE_FIRST_DELAY_MS = 520;

interface CopyInputs {
  slide: OnboardingSlide;
  slideCount: number;
  index: number;
  copy: OnboardingRuntimeCopy;
  // The step strip slides in the first time it shows.
  pageStripEntering: boolean;
  shortcut: string;
  isMac: boolean;
  expandedAccordionId: string;
  copySwap: CopySwapPhase;
  reducedMotion: boolean;
  swapDurationMs: number;
}

function formatRuntimeTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

function getCopyPanelModel(inputs: CopyInputs): CopyPanelModel {
  const { slide, slideCount, index, copy, shortcut, isMac } = inputs;
  const pageCount = Math.max(1, slideCount - 1);
  const currentPageIndex = Math.max(0, index - 1);
  return {
    slideId: slide.id,
    pageStrip: {
      pageCount,
      currentPageIndex,
      hidden: index <= 0,
      entering: inputs.pageStripEntering,
      ariaLabel: formatRuntimeTemplate(
        getRuntimeMiscText(copy, 'pageStripAriaTemplate', 'Onboarding navigation, page {current} of {total}'),
        { current: currentPageIndex + 1, total: pageCount }
      ),
      segmentAriaLabels: Array.from({ length: pageCount }, (_, pageIndex) => formatRuntimeTemplate(
        getRuntimeMiscText(copy, 'pageSegmentAriaTemplate', 'Page {page}'),
        { page: pageIndex + 1 }
      ))
    },
    heading: {
      cycleFirstDelayMs: TITLE_CYCLE_FIRST_DELAY_MS,
      cycleIntervalMs: TITLE_CYCLE_INTERVAL_MS,
      eyebrow: String(slide.copy.eyebrow || ''),
      reducedMotion: inputs.reducedMotion,
      swapDurationMs: inputs.swapDurationMs,
      title: String(slide.copy.title || ''),
      titleCycle: slide.copy.titleCycle || null,
      titleLines: slide.copy.titleLines || [],
      titleLogo: slide.copy.titleLogo || null
    },
    body: {
      note: String(slide.copy.note || ''),
      shortcutLabel: MODEL.formatShortcutForDisplay(shortcut, { preferSymbols: isMac }) || shortcut,
      shortcutPlaceholder: SHORTCUT_PLACEHOLDER,
      shortcutTokens: MODEL.getShortcutDisplayTokens(shortcut, { preferSymbols: isMac }),
      shortcutValue: shortcut.trim().replace(/\s*\+\s*/g, '+'),
      value: String(slide.copy.body || '')
    },
    interactions: {
      slots: slide.left.interactionSlots,
      expandedAccordionId: inputs.expandedAccordionId
    },
    actions: slide.actions,
    copySwap: inputs.copySwap
  };
}

export { getCopyPanelModel };
export type { CopyInputs };
