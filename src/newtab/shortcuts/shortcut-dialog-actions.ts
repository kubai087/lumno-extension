// The shortcut dialog: loaded on first use, it adds and edits shortcuts,
// names groups, edits the bookmarks inside shortcut folders, asks before a
// group is deleted with its sites, and picks an icon's plate color.
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import * as ShortcutConstants from '../../domain/shortcuts/constants';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import { getShortcutUrl, isShortcutFolder } from '../../domain/shortcuts/normalize';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import { bookmarkFolderColorPresets } from '../../domain/settings/bookmarks';
import type { ShortcutItem } from '../../domain/shortcuts/types';
import type { SettingsStore } from '../../platform/settings-store';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { bookmarkSectionEvents } from '../bookmarks/bookmark-section-events';
import type { BookmarkSectionParts } from '../bookmarks/bookmark-section-parts';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type { FolderColorPicker } from '../bookmarks/folder-colors';
import { SHORTCUT_DIALOG_ITEM_BOOKMARK, SHORTCUT_DIALOG_ITEM_FOLDER } from '../menu-values';
import type { BindTooltip, FormatMessage, ShowToast, Translate } from '../newtab-types';
import { createFolderColorPicker } from '../react/folder-color-picker-lazy';
import type {
  IconPlateColorRequest,
  OnlineShortcutIcon,
  ShortcutDialogCloseOptions,
  ShortcutDialogController,
  ShortcutDialogOpenOptions,
  ShortcutDialogPayload
} from '../react/shortcut-dialog';
import { createShortcutDialog } from '../react/shortcut-dialog-lazy';
import * as NEWTAB_SHORTCUT_ICON_PLATE from './shortcut-icon-plate';
import type { ShortcutData } from './shortcut-data';
import { shortcutEvents } from './shortcut-events';
import type { ShortcutFavicons } from './shortcut-favicons';
import type { ShortcutIconStore } from './shortcut-icon-store';
import type { ShortcutList } from './shortcut-list';
import type { ShortcutIconChange } from './shortcut-types';

interface ShortcutDialogActionsDeps {
  settings: Pick<SettingsStore, 'get' | 'include' | 'set'>;
  locale: Pick<SurfaceLocale, 'store'>;
  t: Translate;
  formatMessage: FormatMessage;
  showToast: ShowToast;
  hideShortcutTooltip(): void;
  bindShortcutDialogTooltip: BindTooltip;
  hideShortcutDialogTooltip(): void;
  shortcutList: Pick<ShortcutList, 'items'>;
  shortcutIconStore: Pick<ShortcutIconStore, 'prepareFile'>;
  shortcutData: ShortcutData;
  shortcutFavicons: ShortcutFavicons;
  bookmarksRuntime: Pick<BookmarksRuntime, 'runControlledMutation' | 'update'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade'>;
}

// The icon choice a dialog submitted.
interface DialogIconState {
  action?: ShortcutDialogPayload['iconAction'];
  dataUrl?: string;
  source?: ShortcutDialogPayload['iconSource'];
  plate?: ShortcutDialogPayload['iconPlate'];
  plateColor?: string;
}


// What the dialog submitted for a shortcut.
interface ShortcutDialogSubmission {
  mode: ShortcutDialogPayload['mode'];
  shortcutId: string;
  iconAction: ShortcutDialogPayload['iconAction'];
  iconDataUrl: string;
  iconSource?: ShortcutDialogPayload['iconSource'];
  iconPlate?: ShortcutDialogPayload['iconPlate'];
  iconPlateColor?: string;
}

// What the dialog submitted for a bookmark or folder inside a shortcut folder.
interface BookmarkDialogSubmission {
  itemType: ShortcutDialogPayload['itemType'];
  itemId: string;
  shortcutId: string;
  iconSource?: ShortcutDialogPayload['iconSource'];
  iconAction: ShortcutDialogPayload['iconAction'];
  iconDataUrl: string;
  onlineIcon?: OnlineShortcutIcon;
}

function createShortcutDialogActions(deps: ShortcutDialogActionsDeps) {
  const {
    settings,
    locale,
    t,
    formatMessage,
    showToast,
    hideShortcutTooltip,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    shortcutList,
    shortcutIconStore,
    shortcutData,
    shortcutFavicons,
    bookmarksRuntime,
    bookmarkParts
  } = deps;
  const {
    getShortcutById,
    getShortcutGroups,
    getLastShortcutGroupId,
    getShortcutGroupDisplayTitle,
    showGroupLimitToast,
    createShortcutLinkRecord,
    createShortcutGroup,
    renameShortcutGroup,
    deleteShortcutGroup,
    persistShortcuts
  } = shortcutData;
  const {
    saveShortcutFaviconSnapshot,
    getNextFolderItemIcon,
    updateFolderItemIcons,
    getShortcutDialogOnlineIconUrl,
    getShortcutDialogOnlineIconSource,
    getShortcutDialogBuiltinIconUrl,
    isShortcutDialogIconSourceAvailable,
    refreshShortcutDialogOnlineIcon
  } = shortcutFavicons;

  // The shortcut dialog, loaded on first use.
  let shortcutDialogController: ShortcutDialogController | null = null;
  // Settles the plate color request that is open.
  let shortcutPlateColorPick: ((color: string | null | undefined) => void) | null = null;
  // The folder color picker, made the first time a plate color is picked.
  let shortcutPlateColorPicker: FolderColorPicker | null = null;

  let shortcutDialogLoadPromise: Promise<void> | null = null;
  let shortcutDialogOpenRevision = 0;

  // The folder color picker, over the shortcut dialog, for an icon's plate.
  // It shares the saved colors with folders; the shortcut dialog saves the
  // result. Resolves with a color, null to follow the icon, or undefined.
  async function pickShortcutIconPlateColor(request: IconPlateColorRequest): Promise<string | null | undefined> {
    if (!shortcutPlateColorPicker) {
      try {
        shortcutPlateColorPicker = await createFolderColorPicker({
          documentObj: document, t,
          bindTooltip: bindShortcutDialogTooltip,
          hideTooltip: hideShortcutDialogTooltip,
          readSavedColors: () => settings.include(bookmarkFolderColorPresets).then(() => settings.get(bookmarkFolderColorPresets)),
          saveSavedColors: (colors) => settings.set(bookmarkFolderColorPresets, colors),
          onSubmit: (_id, color) => {
            shortcutPlateColorPick?.(color);
            return Promise.resolve();
          },
          onClose: () => shortcutPlateColorPick?.(undefined)
        });
      } catch {
        return undefined;
      }
    }
    // Narrowed here, for the promise below.
    const picker = shortcutPlateColorPicker;
    return new Promise((resolve) => {
      shortcutPlateColorPick = (color) => {
        shortcutPlateColorPick = null;
        resolve(color);
      };
      const label = t('newtab_shortcuts_icon_plate_color_label', 'Background color');
      picker.open({
        folderId: 'shortcut-icon-plate',
        title: request.title,
        color: request.color,
        presets: request.presets,
        previewImageUrl: request.imageUrl,
        labels: {
          dialog: label,
          picker: label,
          defaultColor: t('newtab_shortcuts_icon_plate_color_auto', 'From the icon')
        },
        sourceElement: request.sourceElement
      });
    });
  }

  // The dialog shows its copy in the page's language.
  locale.store.subscribe(() => {
    if (shortcutDialogController) {
      shortcutDialogController.updateLanguage();
    }
  });

  shortcutEvents.on('iconSaveFailed', () => {
    setShortcutIconError(t(
      'newtab_shortcuts_icon_storage_error',
      'The local icon could not be saved. Try another image.'
    ));
  });

  function setShortcutError(message: string): void {
    if (shortcutDialogController) {
      shortcutDialogController.setError(message);
    }
  }

  function setShortcutIconError(message: string): void {
    if (shortcutDialogController) {
      shortcutDialogController.setIconError(message);
    }
  }

  function closeShortcutDialog(options?: ShortcutDialogCloseOptions): void {
    shortcutDialogOpenRevision += 1;
    if (shortcutDialogController) {
      shortcutDialogController.close({
        ...(options || {}),
        force: true
      });
    }
  }

  async function openShortcutDialog(options: ShortcutDialogOpenOptions): Promise<void> {
    const revision = ++shortcutDialogOpenRevision;
    try {
      if (!shortcutDialogController) {
        if (!shortcutDialogLoadPromise) {
          shortcutDialogLoadPromise = createShortcutDialogComponent().then((controller) => {
            if (!controller) throw new Error('Shortcut dialog unavailable');
            shortcutDialogController = controller;
            controller.mount(document.body);
          }).finally(() => { shortcutDialogLoadPromise = null; });
        }
        await shortcutDialogLoadPromise;
      }
      if (revision === shortcutDialogOpenRevision && shortcutDialogController) {
        shortcutDialogController.open(options);
      }
    } catch (error) {
      console.warn('[Lumno] Failed to load shortcut dialog', error);
      if (revision === shortcutDialogOpenRevision) showToast(t('toast_error', 'Operation failed. Please try again.'), true);
    }
  }

  // The group a site added from the dialog joins, and the group the
  // dialog renames ('' while it creates one).
  let shortcutAddTargetGroupId = '';
  let shortcutGroupDialogTargetId = '';

  function openShortcutAddDialog(sourceElement: HTMLElement | null, groupId?: string): void {
    hideShortcutTooltip();
    shortcutAddTargetGroupId = groupId || getLastShortcutGroupId();
    void openShortcutDialog({ sourceElement });
  }

  // Groups are named in the shortcut dialog: an empty groupId creates one.
  function openShortcutGroupDialog(groupId: string, sourceElement: HTMLElement | null): void {
    const group = groupId ? getShortcutGroups().find((item) => item.id === groupId) : null;
    if (groupId && !group) {
      return;
    }
    if (!group && getShortcutGroups().length >= ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS) {
      showGroupLimitToast();
      return;
    }
    hideShortcutTooltip();
    shortcutGroupDialogTargetId = group ? group.id : '';
    void openShortcutDialog({
      sourceElement,
      itemType: 'group',
      mode: group ? 'edit' : 'add',
      shortcut: group ? { id: group.id, title: group.title } : null
    });
  }

  function saveShortcutGroupFromDialog(title: string): Promise<boolean> {
    return shortcutGroupDialogTargetId
      ? renameShortcutGroup(shortcutGroupDialogTargetId, title)
      : createShortcutGroup(title);
  }

  // Deleting a group with its sites removes them all at once, so it asks
  // first; keeping the sites is a plain move and does not.
  function confirmDeleteShortcutGroupWithSites(groupId: string, sourceElement: HTMLElement | null): Promise<boolean> {
    const count = shortcutList.items.filter((item) => item.groupId === groupId).length;
    if (!count) {
      return deleteShortcutGroup(groupId, false);
    }
    void openShortcutDialog({
      sourceElement,
      confirmationTitle: formatMessage(
        'newtab_shortcuts_group_delete_confirm_title',
        'Delete “{group}” and its sites?',
        { group: getShortcutGroupDisplayTitle(groupId) }
      ),
      confirmationDescription: formatMessage(
        'newtab_shortcuts_group_delete_confirm_description',
        'The group and its {count} sites will be deleted.',
        { count }
      ),
      confirmLabel: t('newtab_shortcuts_group_delete_confirm_button', 'Delete'),
      onConfirm() {
        return deleteShortcutGroup(groupId, false);
      }
    });
    return Promise.resolve(true);
  }

  // The change the dialog's icon choice makes; none when it kept the icon.
  function getDialogIconChange(shortcutId: string, iconState: DialogIconState): ShortcutIconChange | undefined {
    if (iconState.action === 'replace') {
      return { shortcutId, action: 'replace', dataUrl: iconState.dataUrl || '' };
    }
    return iconState.action === 'remove' ? { shortcutId, action: 'remove' } : undefined;
  }

  function saveNewShortcutFromDialog(title: string, url: string, iconState: DialogIconState): Promise<boolean> {
    const nextShortcut = createShortcutLinkRecord({ title, url,
      iconSource: iconState.source,
      iconPlate: iconState.plate,
      iconPlateColor: iconState.plateColor });
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    const withoutDuplicate = shortcutList.items.filter((item) => getShortcutUrl(item) !== nextShortcut.url);
    if (withoutDuplicate.length >= DEFAULT_MAX_SHORTCUTS) {
      setShortcutError(formatMessage(
        'newtab_shortcuts_limit_reached',
        'You can add up to {count} shortcuts.',
        { count: DEFAULT_MAX_SHORTCUTS }
      ));
      return Promise.resolve(false);
    }
    // A site added from the dialog joins the group it was added from.
    const groupId = getShortcutGroups().some((group) => group.id === shortcutAddTargetGroupId)
      ? shortcutAddTargetGroupId
      : getLastShortcutGroupId();
    shortcutAddTargetGroupId = '';
    const nextShortcuts = withoutDuplicate.concat(groupId ? { ...nextShortcut, groupId } : nextShortcut);
    return persistShortcuts(
      nextShortcuts,
      t('newtab_shortcuts_added', 'Shortcut added'),
      getDialogIconChange(nextShortcut.id, iconState),
      {
        syncOverflowShortcutId: nextShortcut.id,
        animateLayout: true
      }
    );
  }

  function saveEditedShortcutFromDialog(title: string, url: string, shortcutId: string, iconState: DialogIconState): Promise<boolean> {
    const currentShortcut = getShortcutById(shortcutId);
    // Folders are edited as bookmarks.
    if (!currentShortcut || isShortcutFolder(currentShortcut)) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    const keepsPlate = typeof iconState.plate === 'undefined';
    const nextShortcut = createShortcutLinkRecord({ title, url,
      iconSource: iconState.source || currentShortcut.iconSource,
      iconPlate: keepsPlate ? currentShortcut.iconPlate : iconState.plate,
      iconPlateColor: keepsPlate ? currentShortcut.iconPlateColor : iconState.plateColor,
      fromBookmark: currentShortcut.fromBookmark === true &&
        ShortcutNormalize.normalizeShortcutUrl(url) === currentShortcut.url });
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    nextShortcut.id = currentShortcut.id;
    if (currentShortcut.groupId) {
      nextShortcut.groupId = currentShortcut.groupId;
    }
    const nextShortcuts: ShortcutItem[] = [];
    shortcutList.items.forEach((item) => {
      if (item.id === currentShortcut.id) {
        nextShortcuts.push(nextShortcut);
        return;
      }
      if (getShortcutUrl(item) === nextShortcut.url) {
        return;
      }
      nextShortcuts.push(item);
    });
    return persistShortcuts(
      nextShortcuts,
      t('newtab_shortcuts_edited', 'Shortcut updated'),
      getDialogIconChange(nextShortcut.id, iconState)
    );
  }

  function saveShortcutFromDialog(title: string, url: string, dialogState: ShortcutDialogSubmission): Promise<boolean> {
    const iconState: DialogIconState = {
      action: dialogState.iconAction,
      dataUrl: dialogState.iconDataUrl,
      source: dialogState.iconSource,
      plate: dialogState.iconPlate,
      plateColor: dialogState.iconPlateColor
    };
    if (dialogState.mode === 'edit') {
      return saveEditedShortcutFromDialog(title, url, dialogState.shortcutId, iconState);
    }
    return saveNewShortcutFromDialog(title, url, iconState);
  }

  function saveBookmarkFromDialog(title: string, url: string, dialogState: BookmarkDialogSubmission): Promise<boolean> {
    const itemId = String(dialogState.itemId || dialogState.shortcutId || '');
    const isFolder = dialogState.itemType === SHORTCUT_DIALOG_ITEM_FOLDER;
    const nextUrl = String(url || '').trim();
    if (!itemId || (!isFolder && !nextUrl)) {
      setShortcutError(t('bookmarks_invalid_url', 'Enter a valid URL.'));
      return Promise.resolve(false);
    }
    const changes: { title: string; url?: string } = {
      title: String(title || '').trim()
    };
    if (!isFolder) {
      changes.url = nextUrl;
    }
    const iconEntry = !isFolder && dialogState.iconSource
      ? getNextFolderItemIcon(itemId, nextUrl, {
        source: dialogState.iconSource,
        action: dialogState.iconAction,
        dataUrl: dialogState.iconDataUrl,
        onlineIcon: dialogState.onlineIcon
      })
      : undefined;
    const keepCascadeOpen = Boolean(bookmarkParts.cascade && bookmarkParts.cascade.isOpen());
    return bookmarksRuntime.runControlledMutation(() => {
      return bookmarksRuntime.update(itemId, changes);
    }).then(() => {
      return iconEntry === undefined ? null : updateFolderItemIcons({ [itemId]: iconEntry });
    }).then(() => {
      bookmarkSectionEvents.emit('changed', { keepCascadeOpen: keepCascadeOpen });
      showToast(t(
        isFolder ? 'bookmarks_folder_updated' : 'bookmarks_updated',
        isFolder ? 'Folder updated' : 'Bookmark updated'
      ));
      return true;
    }).catch((error: unknown) => {
      console.warn('[Lumno] Failed to update bookmark', error);
      setShortcutError(t('bookmarks_update_failed', 'Could not update bookmark.'));
      return false;
    });
  }


  // The dialog module loads on first use.
  function createShortcutDialogComponent(): Promise<ShortcutDialogController | null> {
    return createShortcutDialog({
      documentObj: document,
      windowObj: window,
      t,
      bindTooltip: bindShortcutDialogTooltip,
      hideTooltip: hideShortcutDialogTooltip,
      prepareIconFile: shortcutIconStore.prepareFile,
      getOnlineIconUrl: getShortcutDialogOnlineIconUrl,
      getOnlineIconSource: getShortcutDialogOnlineIconSource,
      getBuiltinIconUrl: getShortcutDialogBuiltinIconUrl,
      isIconSourceAvailable: isShortcutDialogIconSourceAvailable,
      refreshOnlineIcon: refreshShortcutDialogOnlineIcon,
      analyzeIcon: (image) => NEWTAB_SHORTCUT_ICON_PLATE.analyzeImage(image, { documentObj: document }),
      resolveIconPlate: NEWTAB_SHORTCUT_ICON_PLATE.resolvePlate,
      getIconPlateColorChoices: NEWTAB_SHORTCUT_ICON_PLATE.getPlateColorChoices,
      pickIconPlateColor: pickShortcutIconPlateColor,
      onSubmit(payload) {
        if (payload.itemType === 'group') {
          return saveShortcutGroupFromDialog(payload.title);
        }
        if (payload.itemType === SHORTCUT_DIALOG_ITEM_BOOKMARK ||
            payload.itemType === SHORTCUT_DIALOG_ITEM_FOLDER) {
          return saveBookmarkFromDialog(payload.title, payload.url, {
            itemType: payload.itemType,
            itemId: payload.itemId,
            shortcutId: payload.shortcutId,
            iconSource: payload.iconSource,
            iconAction: payload.iconAction,
            iconDataUrl: payload.iconDataUrl,
            onlineIcon: payload.onlineIcon
          });
        }
        return saveShortcutFromDialog(payload.title, payload.url, {
          mode: payload.mode,
          shortcutId: payload.shortcutId,
          iconAction: payload.iconAction,
          iconDataUrl: payload.iconDataUrl,
          iconSource: payload.iconSource,
          iconPlate: payload.iconPlate,
          iconPlateColor: payload.iconPlateColor
        }).then((saved) => {
          const onlineIcon = payload.onlineIcon;
          const pageUrl = ShortcutIconCache.normalizePageUrl(
            ShortcutNormalize.normalizeShortcutUrl(payload.url)
          );
          if (saved && onlineIcon && pageUrl && pageUrl === onlineIcon.pageUrl) {
            saveShortcutFaviconSnapshot(pageUrl, onlineIcon.dataUrl, onlineIcon.sourceUrl, true);
            shortcutEvents.emit('stale', null);
          }
          return saved;
        });
      }
    });
  }

  return {
    openShortcutDialog,
    closeShortcutDialog,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    confirmDeleteShortcutGroupWithSites
  };
}

type ShortcutDialogActions = ReturnType<typeof createShortcutDialogActions>;

export { createShortcutDialogActions };
export type { ShortcutDialogActions, ShortcutDialogActionsDeps };
