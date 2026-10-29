// Slash commands in the overlay: their definitions, matching what is
// typed, the suggestion each builds, and the mode badge the theme mode and
// website appearance commands show.
import type { WebAppearanceMode } from '../../domain/messages';
import type { ThemeMode } from '../../domain/settings/appearance';
import type { FormatMessage, Translate } from './types';
import type { OverlayPanelElements } from './panel-elements';
import type { OverlayThemeMode } from './overlay-theme-mode';

type SlashCommandType =
  | 'commandNewTab'
  | 'commandSettings'
  | 'modeSwitch'
  | 'webAppearanceSwitch'
  | 'commandOpenTabs'
  | 'commandCopyUrl'
  | 'commandDocumentPip';

interface SlashCommand {
  type: SlashCommandType;
  primary: string;
  aliases: string[];
  // Words that run the command without the slash.
  legacyExactAliases?: string[];
  requiresWebAppearance?: boolean;
  requiresDocumentPipEnabled?: boolean;
}

// The suggestion row a command shows as.
interface CommandSuggestion {
  type: string;
  title: string;
  url: string;
  favicon?: string;
  commandText: string;
  commandAliases: string[];
  // The mode the row switches to.
  nextMode?: string;
}

interface WebAppearanceCommandState {
  supported: boolean;
  mode: WebAppearanceMode;
}

interface SlashCommandsDeps {
  t: Translate;
  formatMessage: FormatMessage;
  updateInputRightPadding(): void;
  detectPageTheme(): string | null;
  overlayMediaQuery: MediaQueryList;
  elements: Pick<OverlayPanelElements, 'inputParts' | 'searchInput'>;
  documentPipEnabledAtOpen: boolean;
  overlayThemeChoice: Pick<OverlayThemeMode, 'mode'>;
}

function createSlashCommands(deps: SlashCommandsDeps) {
  const {
    overlayThemeChoice,
    documentPipEnabledAtOpen,
    elements,
    overlayMediaQuery,
    t,
    formatMessage,
    updateInputRightPadding,
    detectPageTheme,
  } = deps;

  // Firefox's website appearance setting (the color scheme pages see), read
  // and switched through the background for the /appearance command.
  let webAppearanceState: WebAppearanceCommandState = { supported: false, mode: 'auto' };

  // Whether the web clip command shows: supported, and on in the settings.
  let documentPipEnabled = documentPipEnabledAtOpen;

  function setDocumentPipEnabled(enabled: boolean): void {
    documentPipEnabled = enabled;
  }

  function getThemeModeLabel(mode: string): string {
    if (mode === 'dark') {
      return t('theme_label_dark', '深色');
    }
    if (mode === 'light') {
      return t('theme_label_light', '浅色');
    }
    return t('theme_label_system', '跟随系统');
  }

  const commandDefinitions: SlashCommand[] = [
    {
      type: 'commandNewTab',
      primary: '/new',
      aliases: ['/n', '/newtab', '/nt']
    },
    {
      type: 'commandSettings',
      primary: '/settings',
      aliases: ['/set', '/settings', '/s']
    },
    {
      type: 'modeSwitch',
      primary: '/mode',
      aliases: []
    },
    {
      type: 'webAppearanceSwitch',
      primary: '/appearance',
      aliases: [],
      requiresWebAppearance: true
    },
    {
      type: 'commandOpenTabs',
      primary: '/tabs',
      aliases: ['/tab', '/t']
    },
    {
      type: 'commandCopyUrl',
      primary: '/copy',
      aliases: ['/c']
    },
    {
      type: 'commandDocumentPip',
      // legacy primary: 'clip'
      primary: '/clip',
      aliases: [],
      legacyExactAliases: ['clip', 'webclip', 'web clip'],
      requiresDocumentPipEnabled: true
    }
  ];

  function getCommandMatches(rawInput: string): SlashCommand[] {
    const input = String(rawInput || '').trim().toLowerCase();
    const matches: SlashCommand[] = [];
    for (let i = 0; i < commandDefinitions.length; i += 1) {
      const command = commandDefinitions[i];
      // The setting may sync from a browser that has Document PiP (Firefox has none).
      if (command.requiresDocumentPipEnabled && !documentPipEnabled) {
        continue;
      }
      // Only Firefox has a website appearance setting to switch.
      if (command.requiresWebAppearance && !webAppearanceState.supported) {
        continue;
      }
      const tokens = [command.primary].concat(command.aliases || []);
      if (command.legacyExactAliases) {
        if (command.legacyExactAliases.includes(input)) {
          matches.push(command);
        }
        if (!input.startsWith('/')) {
          continue;
        }
      }
      if (!input.startsWith('/')) {
        continue;
      }
      for (let j = 0; j < tokens.length; j += 1) {
        const token = String(tokens[j] || '').trim().toLowerCase();
        if (token.startsWith(input)) {
          matches.push(command);
          break;
        }
      }
    }
    return matches;
  }

  function isSlashCommandInput(input: string): boolean {
    return String(input || '').trim().startsWith('/');
  }

  function getCommandMatch(rawInput: string): { command: SlashCommand; completion: string } | null {
    const matches = getCommandMatches(rawInput);
    return matches.length > 0
      ? {
          command: matches[0],
          completion: matches[0].primary
        }
      : null;
  }

  function buildCommandSuggestion(command: SlashCommand): CommandSuggestion {
    if (command.type === 'modeSwitch') {
      return {
        ...buildModeSuggestion(),
        commandText: command.primary,
        commandAliases: command.aliases || []
      };
    }
    if (command.type === 'webAppearanceSwitch') {
      return {
        ...buildWebAppearanceSuggestion(),
        commandText: command.primary,
        commandAliases: command.aliases || []
      };
    }
    let titleText = '';
    if (command.type === 'commandSettings') {
      titleText = formatMessage('command_settings', '打开设置', {
        name: 'Lumno'
      });
    } else if (command.type === 'commandOpenTabs') {
      titleText = t('command_tabs_title', '仅搜索已打开的标签页');
    } else if (command.type === 'commandCopyUrl') {
      titleText = t('command_copy_title', '复制当前页面链接');
    } else if (command.type === 'commandDocumentPip') {
      titleText = t('document_pip_command_title', '开启网页剪裁');
    } else {
      titleText = t('command_newtab', '新建标签页');
    }
    return {
      type: command.type,
      title: titleText,
      url: '',
      commandText: command.primary,
      commandAliases: command.aliases || []
    };
  }

  function getModeBadgeText(webAppearanceCommandActive: boolean): string {
    if (webAppearanceCommandActive) {
      return formatMessage('web_appearance_badge', '网站外观：{mode}', {
        mode: getWebAppearanceModeLabel(webAppearanceState.mode)
      });
    }
    if (overlayThemeChoice.mode !== 'system') {
      return formatMessage('mode_badge', '模式：{mode}', {
        mode: getThemeModeLabel(overlayThemeChoice.mode)
      });
    }
    const pageTheme = detectPageTheme();
    if (pageTheme) {
      return formatMessage('mode_badge_follow_site', '模式：{mode}（跟随网站）', {
        mode: getThemeModeLabel(pageTheme)
      });
    }
    return formatMessage('mode_badge_follow_system', '模式：{mode}（跟随系统）', {
      mode: getThemeModeLabel(overlayMediaQuery.matches ? 'dark' : 'light')
    });
  }

  function updateModeBadge(rawValue: string): void {
    if (!elements.inputParts) {
      return;
    }
    const webAppearanceCommandActive = isWebAppearanceCommand(rawValue || '');
    if (isModeCommand(rawValue || '') || webAppearanceCommandActive) {
      elements.inputParts.setChrome({ badgeVisible: true, badgeText: getModeBadgeText(webAppearanceCommandActive) });
    } else {
      elements.inputParts.setChrome({ badgeVisible: false });
    }
    updateInputRightPadding();
  }

  function getNextThemeMode(mode: string): ThemeMode {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const index = order.findIndex((item) => item === mode);
    if (index === -1) {
      return 'light';
    }
    return order[(index + 1) % order.length];
  }

  function isModeCommand(input: string): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/mode' || raw.startsWith('/mode ');
  }

  function buildModeSuggestion(): CommandSuggestion & { nextMode: ThemeMode } {
    const nextMode = getNextThemeMode(overlayThemeChoice.mode || 'system');
    return {
      type: 'modeSwitch',
      title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
        name: 'Lumno',
        mode: getThemeModeLabel(nextMode)
      }),
      url: '',
      favicon: chrome.runtime.getURL('assets/images/lumno.png'),
      commandText: '/mode',
      commandAliases: [],
      nextMode: nextMode
    };
  }

  function getWebAppearanceMode(): WebAppearanceMode {
    return webAppearanceState.mode;
  }

  function setWebAppearanceState(state: WebAppearanceCommandState): void {
    webAppearanceState = state;
  }

  function getWebAppearanceModeLabel(mode: string): string {
    return mode === 'auto'
      ? t('web_appearance_label_auto', '自动')
      : getThemeModeLabel(mode);
  }

  function getNextWebAppearanceMode(mode: WebAppearanceMode): WebAppearanceMode {
    const order: WebAppearanceMode[] = ['auto', 'light', 'dark'];
    return order[(order.indexOf(mode) + 1) % order.length];
  }

  function isWebAppearanceCommand(input: string): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return webAppearanceState.supported &&
      (raw === '/appearance' || raw.startsWith('/appearance '));
  }

  function buildWebAppearanceSuggestion(): CommandSuggestion & { nextMode: WebAppearanceMode } {
    const nextMode = getNextWebAppearanceMode(webAppearanceState.mode);
    return {
      type: 'webAppearanceSwitch',
      title: formatMessage('web_appearance_switch_title', '网站外观：切换到{mode}', {
        mode: getWebAppearanceModeLabel(nextMode)
      }),
      url: '',
      commandText: '/appearance',
      commandAliases: [],
      nextMode: nextMode
    };
  }

  return {
    setDocumentPipEnabled,
    getCommandMatches,
    isSlashCommandInput,
    getCommandMatch,
    buildCommandSuggestion,
    updateModeBadge,
    getNextThemeMode,
    isModeCommand,
    buildModeSuggestion,
    getWebAppearanceMode,
    setWebAppearanceState,
    getNextWebAppearanceMode
  };
}

type SlashCommands = ReturnType<typeof createSlashCommands>;

export { createSlashCommands };
export type { CommandSuggestion, SlashCommand, SlashCommands, SlashCommandsDeps };
