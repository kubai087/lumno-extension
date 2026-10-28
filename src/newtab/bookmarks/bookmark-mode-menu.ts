// The bookmark section's display mode menu: the view modes and, in top bar
// mode, the bar's layout and background choices.
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import type { Translate } from '../newtab-types';
import type { RemixIconName } from '../../shared/ui/remix-icon';
import { BOOKMARK_TOPBAR_LAYOUT_ACTION, BOOKMARK_TOPBAR_PICK_COLOR_ACTION, BOOKMARK_TOPBAR_SURFACE_MODE_ACTION } from '../menu-values';

// A menu entry with its label by message key.
interface ModeMenuOptionSource {
  value: string;
  labelKey: string;
  fallback: string;
  action?: string;
  dividerBefore?: boolean;
  groupTitleKey?: string;
  groupTitleFallback?: string;
  radio?: boolean;
  checked?: boolean;
  trailingIconName?: RemixIconName;
}

interface BookmarkModeMenuDeps {
  t: Translate;
  getEffectiveBookmarkTopbarSurfaceMode(): string;
  isBookmarkTopbarMode(): boolean;
  getBookmarkTopbarLayout(): string;
}

function createBookmarkModeMenu(deps: BookmarkModeMenuDeps) {
  const {
    t,
    getEffectiveBookmarkTopbarSurfaceMode,
    isBookmarkTopbarMode,
    getBookmarkTopbarLayout,
  } = deps;

  function toMenuOption(source: ModeMenuOptionSource): SelectMenuOption {
    const option: SelectMenuOption = {
      value: source.value,
      label: t(source.labelKey, source.fallback || source.value)
    };
    if (source.action) {
      option.action = source.action;
    }
    if (source.dividerBefore) {
      option.dividerBefore = true;
    }
    if (source.groupTitleKey) {
      option.groupTitle = t(source.groupTitleKey, source.groupTitleFallback || '');
    }
    if (source.radio) {
      option.radio = true;
      option.checked = source.checked === true;
    }
    if (source.trailingIconName) {
      option.trailingIconName = source.trailingIconName;
    }
    return option;
  }

  function getBookmarkModeMenuOptions(): SelectMenuOption[] {
    const effectiveSurfaceMode = getEffectiveBookmarkTopbarSurfaceMode();
    const options: ModeMenuOptionSource[] = [
      {
        value: 'folder',
        labelKey: 'bookmark_view_mode_folder',
        fallback: 'Multi-layer folder view'
      },
      {
        value: 'list',
        labelKey: 'bookmark_view_mode_list',
        fallback: 'Multi-level list view'
      },
      {
        value: 'top',
        labelKey: 'bookmark_view_mode_top',
        fallback: 'Top bookmarks bar'
      }
    ];
    if (!isBookmarkTopbarMode()) {
      return options.map(toMenuOption);
    }
    const layout = getBookmarkTopbarLayout();
    options.push({
      value: '__bookmark_topbar_layout_docked__',
      action: `${BOOKMARK_TOPBAR_LAYOUT_ACTION}:docked`,
      labelKey: 'bookmark_topbar_layout_docked',
      fallback: 'Docked to top',
      radio: true,
      checked: layout === 'docked',
      dividerBefore: true,
      groupTitleKey: 'bookmark_topbar_layout_title',
      groupTitleFallback: 'Bar style'
    });
    options.push({
      value: '__bookmark_topbar_layout_floating__',
      action: `${BOOKMARK_TOPBAR_LAYOUT_ACTION}:floating`,
      labelKey: 'bookmark_topbar_layout_floating',
      fallback: 'Floating',
      radio: true,
      checked: layout === 'floating'
    });
    options.push({
      value: '__bookmark_topbar_surface_adaptive__',
      action: `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:adaptive`,
      labelKey: 'bookmark_topbar_surface_follow',
      fallback: 'Match style',
      radio: true,
      checked: effectiveSurfaceMode === 'adaptive',
      dividerBefore: true,
      groupTitleKey: 'bookmark_topbar_surface_title',
      groupTitleFallback: 'Bar background'
    });
    options.push({
      value: '__bookmark_topbar_surface_transparent__',
      action: `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:transparent`,
      labelKey: 'bookmark_topbar_surface_transparent',
      fallback: 'Transparent',
      radio: true,
      checked: effectiveSurfaceMode === 'transparent'
    });
    options.push({
      value: '__pick_bookmark_topbar_color__',
      action: BOOKMARK_TOPBAR_PICK_COLOR_ACTION,
      labelKey: 'bookmark_topbar_surface_custom',
      fallback: 'Custom color',
      radio: true,
      trailingIconName: 'ri-dropper-line',
      checked: effectiveSurfaceMode === 'custom'
    });
    return options.map(toMenuOption);
  }

  return { getBookmarkModeMenuOptions };
}

export { createBookmarkModeMenu };
export type { BookmarkModeMenuDeps };
