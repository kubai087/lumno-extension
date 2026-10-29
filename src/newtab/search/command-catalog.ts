// The New Tab's slash commands: what typed input matches, the suggestion
// rows they show, and the mode badge's text for the theme, zen and website
// appearance commands.
import type { ThemeMode } from '../../domain/settings';
import type { WebAppearanceMode } from '../../domain/messages';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type { FormatMessage, Translate } from '../newtab-types';
import type { SlashCommand } from './search-types';
import type { SettingsStore } from '../../platform/settings-store';
import { newtabZenMode } from '../../domain/settings/newtab-page';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';
import type { WebAppearance } from './web-appearance';

interface CommandCatalogDeps {
  settings: Pick<SettingsStore, 'get'>;
  t: Translate;
  formatMessage: FormatMessage;
  getExtensionResourceUrl(path: string): string;
  appliedTheme: Pick<AppliedThemeMode, 'mode'>;
  webAppearance: Pick<WebAppearance, 'state'>;
}

const THEME_MODE_ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];
const WEB_APPEARANCE_ORDER: readonly WebAppearanceMode[] = ['auto', 'light', 'dark'];

function createCommandCatalog(deps: CommandCatalogDeps) {
  const {
    settings,
    t,
    formatMessage,
    getExtensionResourceUrl,
    appliedTheme,
    webAppearance
  } = deps;

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
      type: 'zenSwitch',
      primary: '/zen',
      aliases: []
    },
    {
      type: 'webAppearanceSwitch',
      primary: '/appearance',
      aliases: [],
      requiresWebAppearance: true
    }
  ];

  function getThemeModeLabel(mode: string): string {
    if (mode === 'dark') {
      return t('theme_label_dark', '深色');
    }
    if (mode === 'light') {
      return t('theme_label_light', '浅色');
    }
    return t('theme_label_system', '跟随系统');
  }
  function getCommandMatches(rawInput: unknown): SlashCommand[] {
    const input = String(rawInput || '').trim().toLowerCase();
    if (!input.startsWith('/')) {
      return [];
    }
    const matches: SlashCommand[] = [];
    for (let i = 0; i < commandDefinitions.length; i += 1) {
      const command = commandDefinitions[i];
      // Only Firefox has a website appearance setting to switch.
      if (command.requiresWebAppearance && !webAppearance.state.supported) {
        continue;
      }
      const tokens = [command.primary].concat(command.aliases || []);
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
  function getCommandMatch(rawInput: unknown): { command: SlashCommand; completion: string } | null {
    const matches = getCommandMatches(rawInput);
    return matches.length > 0
      ? {
          command: matches[0],
          completion: matches[0].primary
        }
      : null;
  }
  function buildCommandSuggestion(command: SlashCommand): Suggestion {
    if (command.type === 'modeSwitch') {
      return {
        ...buildModeSuggestion(),
        commandText: command.primary,
        commandAliases: command.aliases || []
      };
    }
    if (command.type === 'zenSwitch') {
      return {
        ...buildZenSuggestion(),
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
  function getModeBadgeText(zenCommandActive: boolean, webAppearanceCommandActive: boolean): string {
    if (webAppearanceCommandActive) {
      return formatMessage('web_appearance_badge', '网站外观：{mode}', {
        mode: getWebAppearanceModeLabel(webAppearance.state.mode)
      });
    }
    if (zenCommandActive) {
      return t(
        settings.get(newtabZenMode) ? 'zen_badge_on' : 'zen_badge_off',
        settings.get(newtabZenMode) ? 'Zen：已开启' : 'Zen：已关闭'
      );
    }
    return formatMessage('mode_badge', '模式：{mode}', {
      mode: getThemeModeLabel(appliedTheme.mode)
    });
  }
  function getNextThemeMode(mode: unknown): ThemeMode {
    const index = THEME_MODE_ORDER.findIndex((item) => item === mode);
    if (index === -1) {
      return 'light';
    }
    return THEME_MODE_ORDER[(index + 1) % THEME_MODE_ORDER.length];
  }
  function isModeCommand(input: unknown): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/mode' || raw.startsWith('/mode ');
  }
  function isZenCommand(input: unknown): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/zen' || raw.startsWith('/zen ');
  }
  function isSlashCommandInput(input: unknown): boolean {
    const raw = String(input || '').trim();
    return raw.startsWith('/');
  }
  function isWebAppearanceCommand(input: unknown): boolean {
    const raw = String(input || '').trim().toLowerCase();
    return webAppearance.state.supported &&
      (raw === '/appearance' || raw.startsWith('/appearance '));
  }
  function getWebAppearanceModeLabel(mode: WebAppearanceMode): string {
    return mode === 'auto'
      ? t('web_appearance_label_auto', '自动')
      : getThemeModeLabel(mode);
  }
  function getNextWebAppearanceMode(mode: WebAppearanceMode): WebAppearanceMode {
    return WEB_APPEARANCE_ORDER[(WEB_APPEARANCE_ORDER.indexOf(mode) + 1) % WEB_APPEARANCE_ORDER.length];
  }
  function buildModeSuggestion(): Suggestion {
    const nextMode = getNextThemeMode(appliedTheme.mode);
    return {
      type: 'modeSwitch',
      title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
        name: 'Lumno',
        mode: getThemeModeLabel(nextMode)
      }),
      url: '',
      favicon: getExtensionResourceUrl('assets/images/lumno.png'),
      commandText: '/mode',
      commandAliases: [],
      nextMode: nextMode
    };
  }
  function buildZenSuggestion(): Suggestion {
    return {
      type: 'zenSwitch',
      title: settings.get(newtabZenMode)
        ? formatMessage('zen_disable_title', '{name}：退出 Zen 模式', { name: 'Lumno' })
        : formatMessage('zen_enable_title', '{name}：进入 Zen 模式', { name: 'Lumno' }),
      url: '',
      favicon: getExtensionResourceUrl('assets/images/lumno.png'),
      commandText: '/zen',
      commandAliases: [],
      nextEnabled: !settings.get(newtabZenMode)
    };
  }
  function buildWebAppearanceSuggestion(): Suggestion {
    const nextMode = getNextWebAppearanceMode(webAppearance.state.mode);
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
    getCommandMatches,
    getCommandMatch,
    buildCommandSuggestion,
    getModeBadgeText,
    getNextThemeMode,
    isModeCommand,
    isZenCommand,
    isSlashCommandInput,
    isWebAppearanceCommand,
    buildModeSuggestion,
    buildZenSuggestion
  };
}

type CommandCatalog = ReturnType<typeof createCommandCatalog>;

export { createCommandCatalog };
export type { CommandCatalog, CommandCatalogDeps };
