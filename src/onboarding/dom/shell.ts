// What the page outside the root says about the slide: the shell's data
// attributes the stylesheet keys on, the document's language and title, and
// the link's slide parameter, so a reload opens the same slide.
import * as MODEL from '../onboarding-content';
import type { OnboardingBlueprint, OnboardingState } from '../onboarding-content';

function syncSlideParam(win: Window, index: number): void {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  try {
    const url = new URL(win.location.href);
    url.searchParams.set('slide', String(safeIndex));
    const nextUrl = url.toString();
    if (nextUrl !== win.location.href) {
      win.history.replaceState(win.history.state, '', nextUrl);
    }
  } catch (error) {
    // The slide still shows when the link cannot follow it.
  }
}

function showSlide(shell: HTMLElement, blueprint: OnboardingBlueprint, state: OnboardingState): void {
  const slide = MODEL.getSlideByIndex(blueprint, state.index);
  if (!slide) {
    return;
  }
  const doc = shell.ownerDocument;
  shell.dataset.activeSlide = slide.id;
  shell.dataset.activeIndex = String(state.index);
  shell.dataset.direction = state.direction;
  shell.dataset.cursorReady = slide.cursor.enabled ? 'true' : 'false';
  shell.dataset.visualVisible = slide.visual.visible ? 'true' : 'false';
  doc.documentElement.lang = blueprint.htmlLang || 'en';
  doc.title = `${blueprint.brand} Onboarding`;
  if (doc.defaultView) {
    syncSlideParam(doc.defaultView, state.index);
  }
}

export { showSlide };
