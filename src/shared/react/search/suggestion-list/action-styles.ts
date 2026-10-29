// Inline styles for a row as it stands in the selection: its background,
// the marks over the matched text, its action tags and search, switch and
// utility buttons. Each row applies them to its own elements whenever its
// selection, hover or theme changes.
import type {
  NormalizedOptions,
  ModeTheme,
  SuggestionActionModelResult,
  SuggestionUtilityActionElements,
  ThemeValue
} from './types';
import { setSurfaceStyle, surfaceCssValue } from './surface-options';
import type { RowSelectionState } from './row-state';

// The elements of a row the selection styles reach.
interface RowStyleElements {
  item: HTMLElement;
  iconSlot: HTMLElement | null;
  // The icon is the page's favicon, which keeps its own colors.
  iconIsFavicon: boolean;
  // The icon slot of a typed address or browser page row.
  directIconWrap: HTMLElement | null;
  title: HTMLElement | null;
  visitButton: HTMLElement | null;
  switchButton: HTMLElement | null;
  sourceTags: Array<HTMLElement | null>;
  openTabTag: HTMLElement | null;
  tagContainer: HTMLElement | null;
  utilityActions: SuggestionUtilityActionElements[];
}

// What a row is, as far as its styles go.
interface RowStyleFacts {
  // A search, history, bookmark or help row; otherwise an open tab.
  isSearch: boolean;
  actionModel: SuggestionActionModelResult | null;
  hasActionTags: boolean;
  alwaysHideVisitButton: boolean;
  hasSwitchAction: boolean;
}

function setIconEmphasis(elements: RowStyleElements, active: boolean): void {
  if (!elements.iconSlot || elements.iconIsFavicon) {
    return;
  }
  elements.iconSlot.setAttribute('data-emphasis', active ? 'true' : 'false');
}

function setPalette(
  options: NormalizedOptions,
  button: HTMLElement,
  text?: unknown,
  bg?: unknown,
  border?: unknown
): void {
  setSurfaceStyle(
    options,
    button,
    '--x-nt-suggestion-action-button-text',
    text || 'var(--x-nt-subtext, #9CA3AF)'
  );
  setSurfaceStyle(
    options,
    button,
    '--x-nt-suggestion-action-button-bg',
    bg || 'transparent'
  );
  setSurfaceStyle(
    options,
    button,
    '--x-nt-suggestion-action-button-border',
    border || 'transparent'
  );
}

interface TagColors {
  bg: string;
  text: string;
  border: string;
}

// A tag's colors: its defaults while the row is plain; while the row is
// themed, the theme's tag colors, or only its text color for source tags
// (`textOnly`).
function readTagColors(options: NormalizedOptions, theme: ModeTheme, themed: boolean, textOnly: boolean,
  themedText: string): TagColors {
  if (!themed) {
    return {
      bg: surfaceCssValue(options, 'var(--x-nt-tag-bg, #F3F4F6)'),
      text: surfaceCssValue(options, 'var(--x-nt-tag-text, #667085)'),
      border: 'transparent'
    };
  }
  if (textOnly) {
    return { bg: 'transparent', text: themedText || theme.accent || theme.tagText || '', border: 'transparent' };
  }
  return { bg: theme.tagBg || '', text: theme.tagText || '', border: theme.tagBorder || '' };
}

function applyTagStyle(
  options: NormalizedOptions,
  tag: HTMLElement | null | undefined,
  theme: ModeTheme,
  themed: boolean,
  textOnly = false,
  themedText = ''
): void {
  if (!tag) {
    return;
  }
  const colors = readTagColors(options, theme, themed, textOnly, themedText);
  setSurfaceStyle(options, tag, '--x-nt-suggestion-tag-bg', colors.bg);
  setSurfaceStyle(options, tag, '--x-nt-suggestion-tag-text', colors.text);
  setSurfaceStyle(options, tag, '--x-nt-suggestion-tag-border', colors.border);
}

// How a row stands in the selection as it is drawn now.
interface RowSelection {
  // The selected row.
  selected: boolean;
  // Selected, or the top row while nothing is selected.
  highlighted: boolean;
  hovering: boolean;
  theme: ThemeValue;
  // Drawn in its theme: highlighted, or hovered with a brand theme.
  themed: boolean;
  simpleMode: boolean;
}

// Where a row stands in the list.
interface RowPlace {
  selection: RowSelectionState;
  hovering: boolean;
  // The row is the top match, highlighted while nothing is selected.
  autoTop: boolean;
  theme: ThemeValue;
  simpleMode: boolean;
}

function readRowSelection(options: NormalizedOptions, place: RowPlace): RowSelection {
  const selected = place.selection === 'selected';
  const highlighted = selected || (place.selection === 'none' && place.autoTop);
  const theme = place.theme || options.defaultTheme;
  return {
    selected,
    highlighted,
    hovering: place.hovering,
    theme,
    themed: highlighted || (place.hovering && Boolean(theme?._xIsBrand)),
    simpleMode: place.simpleMode
  };
}

// The marks over the matched text: themed, or neutral grey.
function applyMarkStyles(options: NormalizedOptions, item: HTMLElement, row: RowSelection): void {
  options.applyMarkVariables(item, row.themed ? row.theme : options.defaultTheme, row.highlighted);
  if (!row.themed) {
    setSurfaceStyle(options, item, '--x-ext-mark-bg', 'var(--x-nt-neutral-mark-bg, #E5E7EB)');
    setSurfaceStyle(options, item, '--x-ext-mark-text', 'var(--x-nt-neutral-mark-text, #111827)');
  }
}

// The visit button shows unless the highlighted row shows its action tags.
function applyVisitButtonStyles(options: NormalizedOptions, elements: RowStyleElements, facts: RowStyleFacts,
  row: RowSelection, theme: ModeTheme): void {
  const button = elements.visitButton;
  if (!button || !facts.actionModel) {
    return;
  }
  const visible = options.actionModel.shouldShowVisitButton
    ? options.actionModel.shouldShowVisitButton(facts.actionModel, row.highlighted)
    : !facts.alwaysHideVisitButton && !(row.highlighted && facts.hasActionTags);
  button.setAttribute('data-visible', visible ? 'true' : 'false');
  if (row.themed) {
    setPalette(options, button, theme.buttonText, row.simpleMode ? theme.buttonBg : 'transparent',
      row.simpleMode ? theme.buttonBorder : 'transparent');
  } else {
    setPalette(options, button);
  }
}

// The source tags (history, bookmark, top site) show unless the row
// switches to its open tab, which shows the open tab tag instead.
function applySourceTagStyles(options: NormalizedOptions, elements: RowStyleElements, facts: RowStyleFacts,
  row: RowSelection, theme: ModeTheme): void {
  let themedText = '';
  if (row.highlighted) {
    themedText = theme.accent || theme.tagText || '';
  } else if (row.themed) {
    themedText = options.getHoverColors(row.theme).text || theme.accent || theme.tagText || '';
  }
  const showSourceTags = !row.simpleMode && !facts.hasSwitchAction;
  elements.sourceTags.forEach((tag) => {
    applyTagStyle(options, tag, theme, row.themed, true, themedText);
    tag?.setAttribute('data-visible', showSourceTags ? 'true' : 'false');
  });
  applyTagStyle(options, elements.openTabTag, theme, row.themed);
  elements.openTabTag?.setAttribute('data-visible', !row.simpleMode && facts.hasSwitchAction ? 'true' : 'false');
}

function applySearchActionStyles(options: NormalizedOptions, elements: RowStyleElements, facts: RowStyleFacts,
  row: RowSelection): void {
  const theme = options.getThemeForMode(row.theme);
  const { item } = elements;
  item.setAttribute('data-active', row.highlighted ? 'true' : 'false');
  item.setAttribute('data-has-action-tags', facts.hasActionTags ? 'true' : 'false');
  applyMarkStyles(options, item, row);
  applyVisitButtonStyles(options, elements, facts, row, theme);
  applySourceTagStyles(options, elements, facts, row, theme);
  elements.tagContainer?.setAttribute('data-visible', row.highlighted && facts.hasActionTags ? 'true' : 'false');
  if (elements.directIconWrap) {
    setSurfaceStyle(options, elements.directIconWrap, '--x-nt-suggestion-icon-color',
      row.themed && row.theme?._xIsBrand ? theme.accent || '' : 'var(--x-nt-subtext, #6B7280)');
  }
}

// An open tab row: its brand's hover color while selected or hovered; in
// the overlay, the switch action tag replaces the switch button while
// highlighted.
function applyOpenTabStyles(options: NormalizedOptions, elements: RowStyleElements, facts: RowStyleFacts,
  row: RowSelection): void {
  const { item } = elements;
  if (!row.simpleMode && row.selected && row.theme?._xIsBrand) {
    setSurfaceStyle(options, item, '--x-nt-suggestion-active-bg', options.getHoverColors(row.theme).bg || '');
  }
  if (row.hovering && !row.highlighted) {
    if (!row.simpleMode && row.theme?._xIsBrand) {
      setSurfaceStyle(options, item, '--x-nt-suggestion-hover-bg', options.getHoverColors(row.theme).bg || '');
    } else if (options.surface === 'overlay') {
      setSurfaceStyle(options, item, '--x-nt-suggestion-hover-bg', 'var(--x-ov-hover-bg, #F3F4F6)');
    }
  }
  if (options.surface !== 'overlay') {
    return;
  }
  const showsTags = row.highlighted && facts.hasActionTags;
  elements.tagContainer?.setAttribute('data-visible', showsTags ? 'true' : 'false');
  if (elements.switchButton) {
    elements.switchButton.setAttribute('data-visible', showsTags ? 'false' : 'true');
    setPalette(options, elements.switchButton, row.highlighted ? 'var(--x-ov-text, #1F2937)' : 'var(--x-ov-subtext, #9CA3AF)');
  }
}

function applyUtilityActionStyles(options: NormalizedOptions, elements: RowStyleElements, row: RowSelection): void {
  const visible = row.hovering;
  const useTheme = visible && row.themed && !row.simpleMode;
  const neutralHover = row.simpleMode ? options.getNeutralHoverActionColors() : null;
  const color = useTheme ? row.theme?.buttonText || '' : surfaceCssValue(options, 'var(--x-nt-subtext, #6B7280)');
  elements.utilityActions.forEach(({ slot, button }) => {
    slot.setAttribute('data-visible', visible ? 'true' : 'false');
    button.setAttribute('data-visible', visible ? 'true' : 'false');
    setSurfaceStyle(options, button, '--x-nt-suggestion-utility-color', color);
    setSurfaceStyle(options, button, '--x-nt-suggestion-utility-bg', 'transparent');
    setSurfaceStyle(options, button, '--x-nt-suggestion-utility-border', 'transparent');
    if (neutralHover) {
      setSurfaceStyle(options, button, '--x-nt-suggestion-utility-hover-bg', neutralHover.bg || '');
      setSurfaceStyle(options, button, '--x-nt-suggestion-utility-hover-border', neutralHover.border || '');
      setSurfaceStyle(options, button, '--x-nt-suggestion-utility-hover-color', neutralHover.text || '');
    }
  });
}

// The highlighted row's background; the overlay and simple mode draw it
// inline, New Tab from its theme variables.
function applyHighlightBackground(options: NormalizedOptions, item: HTMLElement, row: RowSelection): void {
  item.setAttribute('data-row-state', 'active');
  if (options.surface !== 'overlay' && !row.simpleMode) {
    return;
  }
  const highlightBg = row.simpleMode
    ? options.surface === 'overlay' ? 'var(--x-ov-hover-bg, #F3F4F6)' : 'var(--x-nt-hover-bg, #F3F4F6)'
    : options.getHighlightColors(row.theme).bg;
  setSurfaceStyle(options, item, '--x-nt-suggestion-active-bg', highlightBg || 'transparent');
}

// A row that is not highlighted: its hover background, in its brand's
// color when it has one.
function applyPlainBackground(options: NormalizedOptions, item: HTMLElement, row: RowSelection): void {
  if (row.hovering) {
    item.setAttribute('data-row-state', 'hover');
  } else {
    item.removeAttribute('data-row-state');
  }
  const hoverBg = !row.simpleMode && row.hovering && row.theme?._xIsBrand ? options.getHoverColors(row.theme).bg : '';
  if (options.surface === 'overlay') {
    setSurfaceStyle(options, item, '--x-nt-suggestion-active-bg',
      row.hovering ? hoverBg || 'var(--x-ov-hover-bg, #F3F4F6)' : 'transparent');
  } else {
    setSurfaceStyle(options, item, '--x-nt-suggestion-hover-bg',
      row.hovering ? hoverBg || 'var(--x-nt-hover-bg, #F3F4F6)' : '');
  }
}

// Styles the row for where it is in the selection, and returns that.
function applyRowStyles(options: NormalizedOptions, elements: RowStyleElements, facts: RowStyleFacts,
  place: RowPlace): RowSelection {
  const row = readRowSelection(options, place);
  if (row.highlighted) {
    applyHighlightBackground(options, elements.item, row);
  } else {
    applyPlainBackground(options, elements.item, row);
  }
  if (elements.title && options.surface === 'overlay') {
    elements.title.style.setProperty('--x-ov-suggestion-title-weight', row.highlighted ? '600' : '400');
  }
  setIconEmphasis(elements, row.highlighted || row.hovering);
  if (facts.isSearch) {
    applySearchActionStyles(options, elements, facts, row);
  } else {
    applyOpenTabStyles(options, elements, facts, row);
  }
  applyUtilityActionStyles(options, elements, row);
  return row;
}

export { applyRowStyles, readRowSelection };
export type { RowPlace, RowSelection, RowStyleElements, RowStyleFacts };
