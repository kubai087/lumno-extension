// The onboarding's two floating tooltips: the info tooltip beside an
// interaction (for the browser list, a row of avatars beside its button),
// and the tooltip of an action button, named in its data-tooltip.
import { getTooltipViewApi } from '../../shared/react/tooltip-view';
import * as LumnoTooltip from '../../shared/ui/tooltip';
import type { InteractionBrowserAvatars, InteractionInfoTooltip } from '../react/interactions';
import type { OnboardingFlow } from '../features/flow';
import { getRuntimeMiscText } from '../features/visual-model';

class OnboardingTooltips {
  private readonly info = LumnoTooltip.createController({
    id: '_x_extension_onboarding_info_tooltip_2026_unique_',
    className: 'onboarding-info-tooltip',
    maxWidth: 360
  });
  private readonly action = LumnoTooltip.createController({
    id: '_x_extension_onboarding_action_tooltip_2026_unique_',
    className: 'onboarding-info-tooltip',
    maxWidth: 360
  });
  private readonly win: Window;
  // Whose copy the browser names are joined with.
  private readonly flow: OnboardingFlow;

  constructor(win: Window, flow: OnboardingFlow) {
    this.win = win;
    this.flow = flow;
  }

  showInfo(target: HTMLElement, infoTooltip: InteractionInfoTooltip, browserAvatars: InteractionBrowserAvatars | undefined): void {
    const { blueprint } = this.flow.store.getSnapshot();
    if (!blueprint) {
      return;
    }
    const copy = blueprint.runtimeCopy;
    const browsers = browserAvatars && browserAvatars.browsers ? browserAvatars.browsers : [];
    const separator = getRuntimeMiscText(copy, 'browserNameSeparator', ', ');
    const text = String(infoTooltip.text || browsers.map((browser) => browser.name).filter(Boolean).join(separator) || '').trim();
    if (!text) {
      return;
    }
    const avatars = infoTooltip.type === 'browser-avatars';
    const options = { placement: 'top', maxWidth: 360, spacing: avatars ? 24 : 8 };
    const element = this.info.show(target, text, options);
    if (!element) {
      return;
    }
    element.classList.toggle('onboarding-browser-tooltip', avatars);
    const tooltipView = getTooltipViewApi();
    if (avatars && tooltipView) {
      tooltipView.renderBrowserAvatarTooltip(element, {
        browsers,
        browserNameSeparator: separator,
        browserAvatarSuffix: getRuntimeMiscText(copy, 'browserAvatarSuffix', 'and more')
      });
      this.placeBeside(element, target);
    } else {
      LumnoTooltip.position(element, target, options);
    }
  }

  hideInfo(): void {
    this.info.hide();
  }

  showAction(button: HTMLElement): void {
    const text = String(button.dataset.tooltip || '').trim();
    if (!text) {
      return;
    }
    const maxWidth = Number.parseInt(button.dataset.tooltipMaxWidth || '', 10);
    this.action.show(button, text, { placement: 'top', maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : 360, spacing: 8 });
  }

  hideAction(): void {
    this.action.hide();
  }

  // The avatar row sits to the right of its button, or to the left when
  // there is no room, inside the window.
  private placeBeside(element: HTMLElement, target: HTMLElement): void {
    element.style.setProperty('max-width', '220px');
    element.style.setProperty('width', 'max-content');
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = element.getBoundingClientRect();
    const margin = 8;
    const spacing = 8;
    let left = targetRect.right + spacing;
    let top = targetRect.top + ((targetRect.height - tooltipRect.height) / 2);
    if (left + tooltipRect.width > this.win.innerWidth - margin) {
      left = targetRect.left - tooltipRect.width - spacing;
    }
    top = Math.max(margin, Math.min(top, this.win.innerHeight - tooltipRect.height - margin));
    left = Math.max(margin, Math.min(left, this.win.innerWidth - tooltipRect.width - margin));
    element.style.setProperty('left', `${Math.round(left)}px`);
    element.style.setProperty('top', `${Math.round(top)}px`);
  }
}

export { OnboardingTooltips };
