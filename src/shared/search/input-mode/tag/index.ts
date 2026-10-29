// The mode tag at the input's start, which says where a search goes: set
// for a provider or scope with its colors and motion, cleared, and the site
// search Tab hint beside it. It opens the mode menu, made before it; what
// the menu does in turn reaches the tag as calls from the controller.
import type { EventBus } from '../../../state/events';
import { isElementVisible, setStyle } from '../page';
import type { ControllerOptions } from '../mode-options';
import { getModeTagVisual } from '../colors';
import type { ModeTagVisual } from '../colors';
import type { InputPlaceholder } from '../placeholder';
import type { InputModeProvider, InputModeTheme, PrefixContentOptions } from '../types';
import type { ModeTagStores } from './drawing';
import { ModeTagDrawing } from './drawing';
import { ModeTagFace } from './face';
import { ModeTagLayout } from './layout';
import { ModeTagMotion } from './motion';

interface ModeTagConfig {
  onModeTagActiveChange?(active: boolean): void;
  // The surface shows something else where the Tab hint goes.
  isTabHintSuppressed?(): boolean;
  // The surface's own badge on the input's right (e.g. a keyboard hint).
  getModeBadgeElement?(): HTMLElement | null | undefined;
  modeBadgeElement?: HTMLElement | null;
}

interface ModeTagOptions extends PrefixContentOptions {
  // Play the enter (or resize) motion.
  animate?: boolean;
  preserveModeMenuDoubleTab?: boolean;
}

interface ModeTagParts extends ModeTagStores {
  container: HTMLElement;
  input: HTMLInputElement;
  modePrefix: HTMLElement;
  modePrefixLineIcon: SVGElement;
  modePrefixIconFrame: HTMLElement;
  modePrefixGlyph: HTMLElement;
  modePrefixCurrent: HTMLElement;
  modeTabHint: HTMLElement;
}

// The menu as the tag uses it: clicks and keys on the tag open it, and
// clearing the mode closes it.
interface ModeTagMenu {
  toggleFromTag(event: MouseEvent): void;
  handleTagKeydown(event: KeyboardEvent): void;
  close(restoreFocus?: boolean): boolean;
}

interface ModeTagEnv {
  config: ModeTagConfig;
  parts: ModeTagParts;
  win: Window;
  options: ControllerOptions;
}

interface ModeTagEvents {
  // The mode or its text changed, or the tag was cleared.
  modeChanged: { preserveDoubleTab: boolean };
}

// How a change of the tag's text plays out.
interface ModeTagChange {
  text: string;
  options: ModeTagOptions;
  animate: boolean;
  sameMode: boolean;
  sameText: boolean;
  repeatedMode: boolean;
  // The tag changes to another mode while showing: it resizes.
  animateResize: boolean;
  // The same mode again while an animation runs: that animation goes on.
  preserveAnimation: boolean;
  // That animation is already bringing in this text.
  waitForPendingText: boolean;
}

// The aggregate search scope across several sites.
function isAggregateProvider(provider: InputModeProvider | null | undefined): boolean {
  return Boolean(provider && (
    provider._xIsAggregateSearch === true ||
    String(provider.action || '') === 'aggregateSearch' ||
    String(provider.category || '') === 'aggregateSearch'
  ));
}

function getProviderModeId(provider: InputModeProvider | null | undefined, isAggregate: boolean): string {
  if (isAggregate) {
    return `aggregate:${String(provider && provider.aggregateId ? provider.aggregateId : '')}`;
  }
  return `provider:${provider && (provider.key || provider.name) ? (provider.key || provider.name) : ''}`;
}

class ModeTag {
  readonly layout: ModeTagLayout;
  private readonly env: ModeTagEnv;
  private readonly menu: ModeTagMenu;
  private readonly placeholder: InputPlaceholder;
  private readonly events: EventBus<ModeTagEvents>;
  private readonly drawing: ModeTagDrawing;
  private readonly face: ModeTagFace;
  private readonly motion: ModeTagMotion;
  private active = false;

  constructor(env: ModeTagEnv, menu: ModeTagMenu, placeholder: InputPlaceholder, events: EventBus<ModeTagEvents>) {
    const { parts, options, win, config } = env;
    this.env = env;
    this.menu = menu;
    this.placeholder = placeholder;
    this.events = events;
    this.drawing = new ModeTagDrawing(parts, {
      onClick: (event) => menu.toggleFromTag(event),
      onKeyDown: (event) => menu.handleTagKeydown(event),
      onIconError: () => this.face.handleIconError(),
      attachIconData: (image, iconUrl, iconHost) => {
        if (options.attachFaviconData) {
          options.attachFaviconData(image, iconUrl, iconHost);
        }
      }
    });
    this.layout = new ModeTagLayout({
      tag: parts.modePrefix,
      tabHint: parts.modeTabHint,
      input: parts.input,
      win,
      getModeBadgeElement: config.getModeBadgeElement,
      modeBadgeElement: config.modeBadgeElement
    }, options);
    this.face = new ModeTagFace({
      tag: parts.modePrefix,
      lineIcon: parts.modePrefixLineIcon,
      iconFrame: parts.modePrefixIconFrame,
      glyph: parts.modePrefixGlyph,
      current: parts.modePrefixCurrent,
      win
    }, this.drawing, this.layout, options);
    this.motion = new ModeTagMotion({
      tag: parts.modePrefix,
      current: parts.modePrefixCurrent,
      win,
      transition: options.prefixTransition
    }, this.drawing, this.layout, this.face);
  }

  isActive(): boolean {
    return this.active;
  }

  // A mode is set: the tag carries its id.
  hasMode(): boolean {
    return Boolean(String(this.env.parts.modePrefix.getAttribute('data-mode-id') || ''));
  }

  setText(prefixText: string, theme?: InputModeTheme | null, tagOptions?: ModeTagOptions | null): void {
    const change = this.planChange(String(prefixText || ''), tagOptions || {});
    if (!change.sameMode || !change.sameText) {
      this.events.emit('modeChanged', { preserveDoubleTab: Boolean(change.options.preserveModeMenuDoubleTab) });
    }
    const previousWidth = change.animateResize ? this.face.renderedWidth() : 0;
    if (change.animateResize) {
      this.motion.cancel();
      this.motion.settleMenuState();
    }
    this.applyTransition(change);
    this.face.setIdentity(change.text, change.options);
    const visual = this.applyColors(theme, change.options);
    this.drawing.update({ visible: true });
    this.setActive(true);
    if (change.waitForPendingText) {
      this.finishFrame(visual.caretColor);
      return;
    }
    this.showContent(change, previousWidth, visual.caretColor);
  }

  setProvider(provider: InputModeProvider | null | undefined, theme?: InputModeTheme | null, tagOptions?: ModeTagOptions | null): void {
    const { options } = this.env;
    const isAi = options.isAiSiteSearchProvider(provider);
    const isAggregate = isAggregateProvider(provider);
    this.setText(options.getSiteSearchPrefixText(provider), theme, {
      ...tagOptions,
      iconUrl: isAggregate ? '' : options.getProviderIcon(provider),
      iconHost: isAggregate ? '' : options.getProviderThemeHost(provider),
      iconName: isAggregate ? 'ri-stack-line' : (isAi ? 'ri-search-ai-line' : 'ri-global-line'),
      modeId: getProviderModeId(provider, isAggregate),
      provider,
      isAi: isAi && !isAggregate
    });
  }

  clear(): void {
    const { input } = this.env.parts;
    this.events.emit('modeChanged', { preserveDoubleTab: false });
    this.face.cancelIconAnimation();
    this.drawing.update({ text: '', modeId: '', ariaLabel: '', icon: null, iconFailed: false });
    this.motion.setRestState({ transition: false });
    this.drawing.update({ visible: false });
    this.setActive(false);
    this.menu.close(false);
    input.placeholder = this.env.options.getDefaultPlaceholder();
    this.env.options.setInputStyle(input, 'caret-color', this.env.options.defaultCaretColor);
    this.layout.updatePrefixLayout();
  }

  // The menu opened or closed: the tag shows its open state.
  setMenuOpen(open: boolean): void {
    this.drawing.update({ expanded: open });
    this.motion.setMenuOpen(open);
  }

  setTabHintVisible(visible: boolean, provider?: InputModeProvider | null): void {
    const { win, config, options } = this.env;
    // Touch-only devices have no Tab key, so the hint would only crowd the query.
    const noTabKey = typeof win.matchMedia === 'function' && win.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!visible || noTabKey) {
      this.drawing.updateTabHint({ visible: false, title: '' });
      this.layout.updateRightPadding();
      return;
    }
    if (typeof config.isTabHintSuppressed === 'function' && config.isTabHintSuppressed()) {
      return;
    }
    const explicitLabel = provider && provider.tabHintLabel ? String(provider.tabHintLabel).trim() : '';
    const label = explicitLabel ||
      options.formatMessage('site_search_tab_hint', '使用 {site} 搜索', { site: options.getSiteSearchDisplayName(provider) });
    this.drawing.updateTabHint({ visible: true, label, title: provider ? label : '' });
    this.layout.updateRightPadding();
  }

  cancelMotion(): void {
    this.motion.cancel();
    this.face.cancelIconAnimation();
  }

  private setActive(active: boolean): void {
    if (this.active === active) {
      return;
    }
    this.active = active;
    const onActiveChange = this.env.config.onModeTagActiveChange;
    if (typeof onActiveChange === 'function') {
      onActiveChange(active);
    }
  }

  private planChange(text: string, options: ModeTagOptions): ModeTagChange {
    const model = this.drawing.model;
    const animate = Boolean(options.animate);
    const sameMode = model.modeId === (options.modeId ? String(options.modeId) : '');
    const animating = this.motion.isAnimating();
    return {
      text,
      options,
      animate,
      sameMode,
      sameText: model.text === text,
      repeatedMode: Boolean(model.modeId && sameMode),
      animateResize: Boolean(animate && model.modeId && !sameMode && isElementVisible(this.env.parts.modePrefix)),
      preserveAnimation: !animate && sameMode && animating,
      waitForPendingText: !animate && sameMode && animating && this.motion.pendingText === text
    };
  }

  private applyTransition(change: ModeTagChange): void {
    const tag = this.env.parts.modePrefix;
    if (change.animateResize) {
      setStyle(tag, 'transition', this.env.options.prefixTransition);
    } else if (!change.animate && !change.preserveAnimation) {
      setStyle(tag, 'transition', 'none');
    }
  }

  private applyColors(theme: InputModeTheme | null | undefined, tagOptions: ModeTagOptions): ModeTagVisual {
    const visual = getModeTagVisual(this.env.options, theme, tagOptions.menuIconName);
    const container = this.env.parts.container;
    setStyle(container, '--x-lumno-search-mode-accent', visual.accentColor);
    setStyle(container, '--x-lumno-search-mode-selected-bg', visual.background);
    this.drawing.update({
      colors: {
        accent: visual.accentColor,
        background: visual.background,
        color: visual.color,
        border: visual.border,
        shadow: visual.shadow
      }
    });
    return visual;
  }

  private finishFrame(caretColor: string): void {
    this.placeholder.sync();
    this.env.options.setInputStyle(this.env.parts.input, 'caret-color', caretColor);
    this.layout.updatePrefixLayout();
  }

  private showContent(change: ModeTagChange, previousWidth: number, caretColor: string): void {
    const contentOptions: PrefixContentOptions = {
      ...change.options,
      animateIcon: change.animate && !change.repeatedMode,
      animateOutgoingIcon: change.animateResize,
      preserveIconAnimation: !change.animate && change.sameMode
    };
    if (change.animateResize && this.growBeforeContent(change, previousWidth, contentOptions, caretColor)) {
      return;
    }
    this.face.setContent(change.text, contentOptions);
    const nextWidth = change.animateResize ? Number(this.env.parts.modePrefix.getBoundingClientRect().width) || 0 : 0;
    if (!change.animate && !change.preserveAnimation) {
      this.motion.setRestState({ transition: false });
    }
    this.finishFrame(caretColor);
    if (!change.animate || change.repeatedMode) {
      return;
    }
    if (change.animateResize) {
      this.motion.playResize(previousWidth, nextWidth);
    } else {
      this.motion.playEnter();
    }
  }

  // A tag growing to a longer name widens first and shows the new name once
  // it fits. Returns false when the tag does not grow.
  private growBeforeContent(change: ModeTagChange, previousWidth: number, contentOptions: PrefixContentOptions, caretColor: string): boolean {
    const targetWidth = this.face.measureWidthForText(change.text);
    if (targetWidth <= previousWidth + 0.5) {
      return false;
    }
    this.motion.pendingText = change.text;
    this.finishFrame(caretColor);
    this.motion.playResize(previousWidth, targetWidth, {
      preservePendingText: true,
      onFinish: () => {
        if (this.motion.pendingText !== change.text) {
          return;
        }
        this.motion.pendingText = '';
        this.face.setContent(change.text, contentOptions);
        this.layout.updatePrefixLayout();
      }
    });
    return true;
  }
}

export type { ModeTagConfig, ModeTagEnv, ModeTagEvents, ModeTagMenu, ModeTagOptions, ModeTagParts };
export { ModeTag };
