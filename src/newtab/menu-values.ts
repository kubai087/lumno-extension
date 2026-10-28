// The values New Tab's menus hand back when an item is chosen, and the
// actions the bookmark bar's menu runs.
// Context menu items, by the value the menu reports when one is chosen.
const NEWTAB_CONTEXT_MENU_OPEN_VALUE = 'open-in-new-tab';
const BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE = 'open-in-new-tab-group';
const BOOKMARK_CONTEXT_MENU_EDIT_VALUE = 'edit';
const FOLDER_COLOR_CONTEXT_MENU_VALUE = 'folder-color';
const SHORTCUT_CONTEXT_MENU_EDIT_VALUE = 'edit';
const SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE = 'hide-add';
const SHORTCUT_CONTEXT_MENU_REMOVE_VALUE = 'remove';
const SHORTCUT_GROUP_MENU_VALUES = Object.freeze({
  addShortcut: 'shortcut-add',
  create: 'group-create',
  rename: 'group-rename',
  addSite: 'group-add-site',
  moveUp: 'group-move-up',
  moveDown: 'group-move-down',
  delete: 'group-delete',
  deleteWithSites: 'group-delete-sites'
});
// What the shortcut dialog edits besides a site.
const SHORTCUT_DIALOG_ITEM_BOOKMARK = 'bookmark';
const SHORTCUT_DIALOG_ITEM_FOLDER = 'folder';
const BOOKMARK_TOPBAR_LAYOUT_ACTION = 'set-bookmark-topbar-layout';
const BOOKMARK_TOPBAR_PICK_COLOR_ACTION = 'pick-bookmark-topbar-color';
const BOOKMARK_TOPBAR_SURFACE_MODE_ACTION = 'set-bookmark-topbar-surface-mode';

export {
  NEWTAB_CONTEXT_MENU_OPEN_VALUE,
  BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
  BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
  FOLDER_COLOR_CONTEXT_MENU_VALUE,
  SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
  SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
  SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
  SHORTCUT_GROUP_MENU_VALUES,
  SHORTCUT_DIALOG_ITEM_BOOKMARK,
  SHORTCUT_DIALOG_ITEM_FOLDER,
  BOOKMARK_TOPBAR_LAYOUT_ACTION,
  BOOKMARK_TOPBAR_PICK_COLOR_ACTION,
  BOOKMARK_TOPBAR_SURFACE_MODE_ACTION
};
