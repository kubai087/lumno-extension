// What the page says about the keyboard shortcuts, from the browser's
// commands: the search shortcut's chip, the shortcut list, and the tab
// switcher row's link to the Ctrl+Tab guide.
import * as ShortcutDisplay from '../../../domain/shortcut-display';
import * as LumnoShortcutReference from '../../../domain/shortcut-reference';
import type { ShortcutReferenceGroup } from '../../../domain/shortcut-reference';
import { formatTemplate } from '../../format-template';
import type { GetMessage } from '../../options-types';
import type { ShortcutReferenceRenderModel } from '../../react/shortcut-reference';
import type { BrowserCommandsState } from './browser-commands';

interface CtrlTabLink {
  href: string;
  label: string;
  // Ctrl+Tab already opens the tab switcher; the link then explains it.
  bound: boolean;
}

function platformOf(isMac: boolean): 'mac' | 'windows' {
  return isMac ? 'mac' : 'windows';
}

function formatShortcut(shortcut: string, isMac: boolean): string {
  return ShortcutDisplay.formatShortcutChord(shortcut, { platform: platformOf(isMac) });
}

// The search window's shortcut: the bound chord, the platform default when
// the browser binds none or cannot say, and "not set" until it answers.
function getSearchShortcutLabel(state: BrowserCommandsState, isMac: boolean, t: GetMessage): string {
  if (!state.read) {
    return t('settings_shortcuts_unset', '未设置');
  }
  const command = (state.commands || []).find((item) => item && item.name === 'show-search');
  const bound = command && typeof command.shortcut === 'string' ? command.shortcut.trim() : '';
  const shortcut = (state.commands && bound) || (isMac ? 'Command+Shift+K' : 'Ctrl+Shift+K');
  return formatShortcut(shortcut, isMac) || shortcut;
}

function getShortcutGroups(state: BrowserCommandsState, isMac: boolean): ShortcutReferenceGroup[] {
  return LumnoShortcutReference.getShortcutReferenceGroups({
    commands: state.commands,
    platform: isMac ? 'mac' : 'default'
  });
}

function getShortcutParts(shortcut: string, isMac: boolean): string[] {
  const value = shortcut.trim();
  if (!value) {
    return [];
  }
  return value
    .split(/\s+\/\s+/)
    .map((part) => (part.trim()
      ? ShortcutDisplay.formatShortcutReferencePart(part.trim(), { platform: platformOf(isMac) })
      : ''))
    .filter(Boolean);
}

// The list of shortcuts, without the search shortcut, which has its own row.
function buildShortcutReference(state: BrowserCommandsState, isMac: boolean, t: GetMessage): ShortcutReferenceRenderModel {
  const groups = getShortcutGroups(state, isMac).map((group) => ({
    ...group,
    items: group.items.filter((item) => item.commandName !== 'show-search')
  })).filter((group) => group.items.length > 0);
  return {
    groups: groups.map((group) => ({
      id: group.id,
      titleKey: group.titleKey,
      title: t(group.titleKey, group.titleFallback),
      // The search group hangs off the "show-search" row above the list.
      nested: group.id === 'search',
      items: group.items.map((item) => {
        const parts = getShortcutParts(item.shortcut, isMac);
        const customLabel = item.shortcutLabelKey
          ? formatTemplate(t(item.shortcutLabelKey, item.shortcutLabelFallback || ''), { modifier: isMac ? '⌘' : 'Ctrl' })
          : '';
        return {
          id: item.id,
          commandName: item.commandName || '',
          editable: item.editable,
          titleKey: item.titleKey,
          title: t(item.titleKey, item.titleFallback),
          shortcutEmpty: !customLabel && parts.length === 0,
          shortcutLabel: customLabel || (parts.length > 0 ? parts.join(' / ') : t('shortcut_reference_unset', '未设置'))
        };
      })
    }))
  };
}

function isCtrlTabShortcut(shortcut: string | undefined): boolean {
  const value = String(shortcut || '').replace(/\s+/g, '').toLowerCase();
  return value === '⌃⇥' || value === 'ctrl+tab' || value === 'macctrl+tab';
}

// The browser's shortcuts page cannot take Ctrl+Tab, so the tab switcher row
// links to the help center's console snippet; once bound, it links there as
// the place to read how to change it back. Null until the commands are read.
function getCtrlTabLink(state: BrowserCommandsState, isMac: boolean, t: GetMessage, helpUrl: string): CtrlTabLink | null {
  if (!state.read) {
    return null;
  }
  const item = getShortcutGroups(state, isMac)
    .flatMap((group) => group.items)
    .find((entry) => entry.commandName === 'show-tab-switcher');
  const bound = isCtrlTabShortcut(item && item.shortcut);
  const label = formatTemplate(bound
    ? t('settings_tab_switcher_ctrl_tab_guide', 'Arc 式 {shortcut} 切换说明')
    : t('settings_tab_switcher_ctrl_tab_link', '像 Arc 一样用 {shortcut} 切换'), {
    shortcut: isMac ? '⌃Tab' : 'Ctrl+Tab'
  });
  return { href: helpUrl, label, bound };
}

export { buildShortcutReference, formatShortcut, getCtrlTabLink, getSearchShortcutLabel };
export type { CtrlTabLink };
