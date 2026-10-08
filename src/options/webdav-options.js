(function(root) {
  'use strict';
  const EXPECTED_CLIENT_REVISION = 'dav-lock-5';
  const EXPECTED_SYNC_REVISION = 'dav-multi-1';
  function createCopy(t) {
    return {
      confirm_ok: t("confirm_ok", "确认"),
      confirm_cancel: t("confirm_cancel", "取消"),
      webdav_endpoint: t("webdav_endpoint", "服务器地址（HTTPS）"),
      webdav_directory: t("webdav_directory", "同步目录"),
      webdav_username: t("webdav_username", "用户名"),
      webdav_password: t("webdav_password", "应用密码"),
      webdav_credentials_hint: t("webdav_credentials_hint", "应用密码只保存在这台设备上。服务器地址、目录和用户名会通过浏览器同步到你的其他设备。"),
      webdav_password_hint: t("webdav_password_hint", "服务器地址、目录和用户名会通过浏览器同步到你的其他设备，应用密码不会。请记好密码，在新设备上需要重新填写。"),
      webdav_password_hint_synced: t("webdav_password_hint_synced", "服务器地址、目录和用户名已从你的其他设备同步过来。应用密码不会同步，请在这里重新填写。"),
      webdav_suggestion_label: t("webdav_suggestion_label", "来自其他设备"),
      webdav_suggestion_add: t("webdav_suggestion_add", "填写密码并连接"),
      webdav_suggestion_dismiss: t("webdav_suggestion_dismiss", "忽略"),
      webdav_password_saved: t("webdav_password_saved", "已保存"),
      webdav_password_change: t("webdav_password_change", "更换"),
      webdav_password_keep: t("webdav_password_keep", "保留原密码"),
      webdav_password_show: t("webdav_password_show", "显示密码"),
      webdav_password_hide: t("webdav_password_hide", "隐藏密码"),
      webdav_last_sync: t("webdav_last_sync", "最近同步"),
      webdav_choice_hint: t("webdav_choice_hint", "服务器上已经有 Lumno 的配置。可以选一边为准，或合并两边的壁纸、其他设置以服务器为准；本机数据会先自动备份。"),
      webdav_conflict_hint: t("webdav_conflict_hint", "本机和服务器改了同一处内容。选一个版本保留，其他不冲突的改动会自动合并。"),
      webdav_test: t("webdav_test", "测试连通性"),
      webdav_sync: t("webdav_sync", "立即同步"),
      webdav_restore_backup: t("webdav_restore_backup", "恢复替换前的本机配置"),
      webdav_use_remote: t("webdav_use_remote", "使用服务器版本"),
      webdav_use_local: t("webdav_use_local", "保留本机版本"),
      webdav_merge_wallpapers: t("webdav_merge_wallpapers", "合并壁纸"),
      webdav_test_success: t("webdav_test_success", "连接、读写和并发保护验证通过"),
      webdav_state_browser: t("webdav_state_browser", "未开启"),
      webdav_state_ready: t("webdav_state_ready", "已同步"),
      webdav_state_syncing: t("webdav_state_syncing", "正在同步…"),
      webdav_state_paused: t("webdav_state_paused", "已暂停"),
      webdav_state_pending: t("webdav_state_pending", "等待同步"),
      webdav_state_choice: t("webdav_state_choice", "需要选择"),
      webdav_state_conflict: t("webdav_state_conflict", "配置冲突"),
      webdav_state_error: t("webdav_state_error", "同步失败"),
      webdav_missing_hint: t("webdav_missing_hint", "服务器上的配置不见了。可以把本机配置重新上传，或先检查服务器地址。"),
      webdav_error_outdated: t("webdav_error_outdated", "请重新加载 Lumno 扩展，再刷新设置页以使用多连接同步。"),
      webdav_title: t("webdav_title", "WebDAV 同步"),
      webdav_beta_hint: t("webdav_beta_hint", "功能测试中：通过 WebDAV 网盘或 NAS 同步设置、自定义图标和壁纸。相比浏览器内置同步，支持跨浏览器，也能同步图标和壁纸。"),
      webdav_edit_config: t("webdav_edit_config", "编辑连接配置"),
      webdav_save: t("webdav_save", "保存"),
      webdav_enable: t("webdav_enable", "保存并开启同步"),
      webdav_never_synced: t("webdav_never_synced", "尚未同步"),
      webdav_state_recovery: t("webdav_state_recovery", "需要恢复"),
      webdav_retry: t("webdav_retry", "重试"),
      webdav_copy_diagnostic: t("webdav_copy_diagnostic", "复制诊断信息"),
      webdav_diagnostic_copied: t("webdav_diagnostic_copied", "已复制"),
      webdav_upload_local: t("webdav_upload_local", "上传本机配置"),
      webdav_provider_jianguoyun: t("webdav_provider_jianguoyun", "坚果云"),
      webdav_just_now: t("webdav_just_now", "刚刚"),
      webdav_view_diff: t("webdav_view_diff", "查看差异"),
      webdav_hide_diff: t("webdav_hide_diff", "收起差异"),
      webdav_diff_local: t("webdav_diff_local", "本机"),
      webdav_diff_remote: t("webdav_diff_remote", "服务器"),
      webdav_diff_added: t("webdav_diff_added", "新增：{items}"),
      webdav_diff_removed: t("webdav_diff_removed", "删除：{items}"),
      webdav_diff_changed: t("webdav_diff_changed", "修改：{items}"),
      webdav_diff_more: t("webdav_diff_more", "等 {count} 项"),
      webdav_diff_reordered: t("webdav_diff_reordered", "调整了顺序"),
      webdav_diff_selection: t("webdav_diff_selection", "换了当前壁纸"),
      webdav_diff_unchanged: t("webdav_diff_unchanged", "没有改动"),
      webdav_diff_shortcut_total: t("webdav_diff_shortcut_total", "共 {count} 个快捷方式"),
      webdav_diff_wallpaper_total: t("webdav_diff_wallpaper_total", "共 {count} 张壁纸"),
      webdav_diff_loading: t("webdav_diff_loading", "正在读取…"),
      webdav_value_on: t("webdav_value_on", "开启"),
      webdav_value_off: t("webdav_value_off", "关闭"),
      webdav_value_default: t("webdav_value_default", "默认"),
      webdav_value_changed: t("webdav_value_changed", "已修改"),
      webdav_value_list: t("webdav_value_list", "{count} 项"),
      webdav_choice_title: t("webdav_choice_title", "选择初始同步版本"),
      webdav_conflict_title: t("webdav_conflict_title", "同步内容存在冲突"),
      webdav_conflict_items: t("webdav_conflict_items", "有冲突的内容"),
      webdav_conflict_shortcuts: t("webdav_conflict_shortcuts", "快捷方式及图标"),
      webdav_conflict_wallpapers: t("webdav_conflict_wallpapers", "壁纸及选图"),
      webdav_conflict_preferences: t("webdav_conflict_preferences", "设置项"),
      webdav_resolve_later: t("webdav_resolve_later", "稍后处理并暂停"),
      webdav_add: t("webdav_add", "添加 WebDAV"),
      webdav_remove: t("webdav_remove", "删除 WebDAV 配置"),
      webdav_remove_confirm: t("webdav_remove_confirm", "删除这条本机连接配置？服务器上的文件会保留。")
    };
  }
  // Conflict summaries name settings by the title already shown on the
  // settings page; keys without a single visible title fall back to their tab.
  const PREFERENCE_LABELS = [
    ['theme_mode_2024', 'settings_theme_title'], ['newtab_theme', 'newtab_theme_scope_label'],
    ['language', 'settings_language_title'], ['recent_mode', 'settings_recent_title'],
    ['recent_count', 'settings_recent_sites_title'], ['recent_sites', 'settings_recent_sites_title'],
    ['newtab_width_mode', 'settings_newtab_width_title'], ['newtab_search_width', 'newtab_search_width_title'],
    ['input_auto_focus', 'newtab_input_auto_focus_title'], ['newtab_wallpaper', 'settings_wallpaper_title'],
    ['overlay_size_mode', 'settings_overlay_size_title'], ['overlay_enter_animation', 'settings_overlay_enter_animation_title'],
    ['overlay_page_theme_adaptation', 'settings_overlay_page_theme_adaptation_title'],
    ['bookmark_count', 'settings_bookmarks_title'], ['bookmark_columns', 'settings_bookmark_columns_title'],
    ['bookmark_folder_icons', 'settings_bookmark_folder_icons_visible_title'],
    ['bookmark_folder_color', 'folder_color_title'], ['bookmark_topbar_surface', 'bookmark_topbar_surface_title'],
    ['newtab_shortcuts_visible', 'settings_newtab_shortcuts_title'], ['shortcut_add_visible', 'settings_newtab_shortcut_add_title'],
    ['dock_magnification', 'settings_newtab_shortcut_dock_magnification_title'],
    ['feedback_button', 'settings_newtab_feedback_button_visible_title'],
    ['appearance_button', 'settings_newtab_appearance_button_visible_title'],
    ['shortcut_width', 'settings_newtab_shortcut_width_title'], ['shortcut_columns', 'settings_newtab_shortcut_columns_title'],
    ['shortcut_size', 'settings_newtab_shortcut_size_title'], ['shortcut_gap', 'settings_newtab_shortcut_gap_title'],
    ['update_notice', 'settings_update_notice_title'], ['motion_effects', 'settings_motion_effects_title'],
    ['simple_mode', 'settings_simple_mode_title'], ['number_shortcut_instant', 'settings_number_shortcut_instant_title'],
    ['macos_ctrl', 'settings_macos_ctrl_suggestion_navigation_title'], ['auto_pip', 'settings_auto_pip_title'],
    ['tab_switcher', 'settings_tab_switcher_title'], ['document_pip', 'settings_document_pip_title'],
    ['pinned_tab_recovery', 'settings_pinned_tab_recovery_title'],
    ['selection_quick_actions_provider', 'settings_selection_quick_actions_provider_title'],
    ['selection_quick_actions_group', 'settings_selection_quick_actions_group_title'],
    ['selection_quick_actions', 'settings_selection_quick_actions_title'],
    ['overlay_tab_priority', 'settings_overlay_tab_priority_title'],
    ['wordmark_visible', 'settings_newtab_wordmark_title'], ['time_font_weight', 'newtab_time_font_weight_title'],
    ['time_seconds', 'newtab_time_show_seconds_title'], ['restricted_action', 'settings_restricted_title'],
    ['search_result_priority', 'settings_search_result_priority_title'],
    ['search_result_source_types', 'settings_search_result_sources_title'],
    ['search_result_display_limit', 'settings_search_result_display_limit_title'],
    ['search_result_tab_position', 'settings_search_result_tab_position_title'],
    ['open_tabs_default_visible', 'settings_overlay_open_tabs_default_visible_title'],
    ['fallback_hotkey', 'settings_shortcuts_title'],
    ['aggregate_search_auto_group', 'settings_aggregate_search_auto_group_title'],
    ['site_search', 'settings_tab_shortcuts'], ['aggregate_searches', 'settings_tab_shortcuts'],
    ['default_search_engine', 'settings_tab_shortcuts'], ['favicon_enhanced_fetch', 'settings_favicon_enhanced_fetch_title'],
    ['blacklist', 'settings_tab_blacklist'], ['newtab_quote_prefs', 'newtab_quote_title'],
    ['newtab_zen_mode', 'webdav_preference_zen_mode'], ['newtab_favicon', 'newtab_favicon_title'],
    ['bookmark_view_mode', 'settings_bookmarks_title']
  ];
  // Field-merged records name each conflicting field, and enumerated text
  // values use the option names the settings controls show.
  const FIELD_LABELS = {
    newtab_quote_prefs: {
      fields: { enabled: 'newtab_quote_title', position: 'newtab_quote_position', category: 'newtab_quote_category',
        fontSize: 'newtab_quote_font_size_label' },
      values: { top: 'newtab_quote_top', input: 'newtab_quote_input', search: 'newtab_quote_search', bottom: 'newtab_quote_bottom',
        literature: 'newtab_quote_literature', poetry: 'newtab_quote_poetry' }
    },
    // Fields are folder references with no readable name; the color shows which is which.
    bookmark_folder_color_refs: { fields: null, values: {} }
  };
  function preferenceLabel(t, key) {
    const match = PREFERENCE_LABELS.find(([fragment]) => key.includes(fragment));
    const label = match ? t(match[1], '').trim() : '';
    return label || t('webdav_preference_other', '其他设置');
  }
  // Whole-value settings that need more than their title: a qualifier for
  // settings sharing one title, and the option names of enumerated values.
  const VALUE_LABELS = {
    bookmark_topbar_surface_mode: { values: { adaptive: 'bookmark_topbar_surface_adaptive', clear: 'bookmark_topbar_surface_clear',
      transparent: 'bookmark_topbar_surface_transparent', custom: 'bookmark_topbar_surface_custom' } },
    bookmark_topbar_surface_color_light: { qualifier: 'theme_label_light', values: {} },
    bookmark_topbar_surface_color_dark: { qualifier: 'theme_label_dark', values: {} }
  };
  function optionValue(t, values, summary) {
    return summary && summary.kind === 'text' && Object.hasOwn(values, summary.value)
      ? { ...summary, value: t(values[summary.value], summary.value) } : summary;
  }
  function preferenceItem(t, item) {
    const fields = Object.entries(FIELD_LABELS).find(([fragment]) => item.key.includes(fragment));
    if (!item.field || !fields) {
      const extra = Object.entries(VALUE_LABELS).find(([fragment]) => item.key.includes(fragment));
      if (!extra) return { ...item, label: preferenceLabel(t, item.key) };
      const qualifier = extra[1].qualifier ? t(extra[1].qualifier, '').trim() : '';
      return { ...item, label: [preferenceLabel(t, item.key), qualifier].filter(Boolean).join(' · '),
        local: optionValue(t, extra[1].values, item.local), remote: optionValue(t, extra[1].values, item.remote) };
    }
    const labels = fields[1];
    const label = labels.fields && Object.hasOwn(labels.fields, item.field) ? t(labels.fields[item.field], '').trim() : '';
    const value = (summary) => optionValue(t, labels.values, summary);
    const fallback = labels.fields ? `${preferenceLabel(t, item.key)} · ${item.field}` : preferenceLabel(t, item.key);
    return { ...item, label: label || fallback, local: value(item.local), remote: value(item.remote) };
  }
  function createController(options) {
    const chromeApi = options.chromeApi;
    const t = options.getMessage;
    const panel = document.getElementById('lumno-webdav-settings');
    const api = root.LumnoOptionsWebDavList;
    if (!panel || !api) return null;
    let current = { connections: [] };
    let initialized = false;
    let refreshSequence = 0;
    const infoController = root.LumnoOptionsInfoButton?.createInfoButtonController(document.getElementById('lumno-webdav-beta-info'));
    const requiresReload = () => initialized && (current.clientRevision !== EXPECTED_CLIENT_REVISION || current.syncRevision !== EXPECTED_SYNC_REVISION);
    const message = (operation, extra) => new Promise((resolve, reject) => {
      chromeApi.runtime.sendMessage({ action: 'webdav', operation, ...extra }, (response) => {
        const error = chromeApi.runtime.lastError;
        if (error || !response || response.ok === false) reject(Object.assign(new Error(response && response.error || 'sync-failed'), {
          diagnostic: response && response.diagnostic
        }));
        else resolve(response);
      });
    });
    // Data errors name the exact record kind and whether this device or the
    // server holds it; connection errors share a sentence per cause.
    const DETAILED_CODES = ['remote-unreadable', 'remote-corrupt', 'invalid-state', 'state-too-large', 'response-too-large',
      'invalid-shortcuts', 'invalid-icon', 'invalid-wallpaper', 'invalid-asset', 'asset-missing', 'asset-integrity',
      'local-invalid-state', 'local-state-too-large', 'local-invalid-shortcuts', 'local-invalid-icon', 'local-invalid-wallpaper',
      'local-invalid-asset', 'local-asset-too-large', 'shortcut-id-conflict', 'write-failed', 'directory-unavailable',
      'folder-create-refused', 'merge-too-large'];
    function errorText(code) {
      const generic = t('webdav_error_generic', '同步失败，请稍后重试。');
      if (DETAILED_CODES.includes(code)) return t(`webdav_error_${code.replace(/-/g, '_')}`, generic);
      const categories = {
        'invalid-endpoint': 'endpoint', 'invalid-directory': 'directory', 'missing-credentials': 'credentials',
        'http-401': 'auth', 'http-403': 'permission', 'http-429': 'rate', 'http-507': 'capacity',
        'conditional-write-unsupported': 'conditional', 'remote-changed': 'changed', 'local-changed': 'changed',
        'remote-locked': 'locked', 'lock-write-uncertain': 'lock_recovery', 'lock-release-failed': 'lock_recovery',
        'remote-missing': 'missing', 'chrome-capacity': 'chrome_capacity', 'timeout': 'network', 'network-error': 'network',
        'private-storage-unavailable': 'storage', 'local-storage-failed': 'storage',
        'shortcut-capacity': 'shortcuts', 'interrupted-apply': 'interrupted', 'duplicate-connection': 'duplicate'
      };
      if (categories[code]) return t(`webdav_error_${categories[code]}`, generic);
      const status = /^http-(\d{3})$/.exec(String(code || ''));
      return status ? t('webdav_error_http', generic).replace('{status}', status[1]) : generic;
    }
    // Diagnostics stay out of the sentence users read; the card offers them
    // through a copy action for bug reports. Every failure carries its exact
    // code, plus the protocol phase and HTTP statuses when the client saw them.
    function diagnosticText(code, diagnostic) {
      if (!code) return '';
      const version = chromeApi.runtime.getManifest?.()?.version;
      const parts = [version ? `Lumno ${version}` : 'Lumno', String(code)];
      if (diagnostic && diagnostic.revision === EXPECTED_CLIENT_REVISION &&
          ['state-etag', 'state-lock-create', 'directory-race', 'directory-delete', 'directory-recreate',
            'move-race', 'move-owner', 'move-delete', 'move-recreate', 'move-claim', 'state-read'].includes(diagnostic.phase)) {
        const statuses = (Array.isArray(diagnostic.statuses) ? diagnostic.statuses : []).filter((status) => Number.isInteger(status) && status >= 0 && status <= 599).slice(0, 2);
        parts.push(`${diagnostic.revision} / ${diagnostic.phase} / ${statuses.join(',')}`);
      }
      return parts.join(' · ');
    }
    function failure(error) {
      return Object.assign(new Error(errorText(error.message)), { diagnostic: diagnosticText(error.message, error.diagnostic) });
    }
    function connectionName(item) {
      try { return new URL(item.config.endpoint).host; } catch (_error) { return item.config.endpoint; }
    }
    const listController = api.createWebDavListController(document.getElementById('lumno-webdav-list'), {
      async onAction(operation, id, extra) {
        if (requiresReload() && !['pause'].includes(operation)) throw new Error(createCopy(t).webdav_error_outdated);
        try {
          const result = await message(operation, { ...(id ? { id } : {}), ...extra });
          if (operation === 'conflictDetails') {
            const copy = createCopy(t);
            return { items: (result.items || []).map((item) => item.domain === 'shortcuts' ? { ...item, label: copy.webdav_conflict_shortcuts }
              : item.domain === 'wallpapers' ? { ...item, label: copy.webdav_conflict_wallpapers } : preferenceItem(t, item)) };
          }
          await refresh();
          return result;
        } catch (error) {
          await refresh().catch(() => {});
          throw failure(error);
        }
      }
    });
    function render() {
      infoController?.render({ tooltip: createCopy(t).webdav_beta_hint, tooltipKey: 'webdav_beta_hint' });
      const copy = createCopy(t);
      const connections = (current.connections || (current.config ? [{ id: 'default', ...current }] : []))
        .map((item) => ({ ...item, needsRecovery: Boolean(item.needsRecovery || (item.error === 'interrupted-apply' && !item.enabled)) }));
      const blocking = connections.find((item) => item.needsRecovery);
      const describeError = (item) => {
        // The choice panel already explains a missing remote copy.
        if (!item.error || item.error === 'remote-missing') return '';
        if (item.error === 'interrupted-apply' && !item.needsRecovery && blocking) {
          return t('webdav_error_interrupted_other', '另一条 WebDAV 连接（{name}）需要先恢复本机配置，恢复后这里会继续同步。').replace('{name}', connectionName(blocking));
        }
        return errorText(item.error);
      };
      listController.render({
        ready: initialized, outdated: requiresReload(), copy, lang: document.documentElement.lang || '',
        suggestions: Array.isArray(current.suggestions) ? current.suggestions : [],
        connections: connections.map((item) => ({ ...item, errorText: describeError(item), remoteMissing: item.error === 'remote-missing',
          diagnosticText: diagnosticText(item.error, item.diagnostic),
          conflictsText: [...new Set((item.conflicts || []).map((key) => copy[
            key === 'shortcuts' ? 'webdav_conflict_shortcuts' : key === 'wallpapers' ? 'webdav_conflict_wallpapers' : 'webdav_conflict_preferences'
          ]))].join(/^(zh|ja)/.test(document.documentElement.lang) ? '、' : ', ') }))
      });
      document.getElementById('lumno-webdav-setup-hint').hidden = connections.length > 0;
      const version = document.getElementById('lumno-webdav-version');
      version.hidden = !requiresReload();
      version.dataset.error = 'true';
      version.textContent = requiresReload() ? copy.webdav_error_outdated : '';
    }
    async function refresh() {
      const sequence = ++refreshSequence;
      const result = await message('status');
      if (sequence !== refreshSequence) return;
      current = result;
      initialized = true;
      render();
    }
    chromeApi.storage.onChanged.addListener((changes, area) => {
      const { WEBDAV_STATUS_STORAGE_KEY: key, WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY: synced,
        WEBDAV_DISMISSED_CONNECTIONS_STORAGE_KEY: dismissed } = root.LumnoSettings;
      const names = Object.keys(changes);
      if ((area === 'local' && names.some((name) => name === key || name.startsWith(`${key}:`) || name === dismissed)) ||
          (area === 'sync' && names.includes(synced))) refresh().catch(() => {});
    });
    render();
    refresh().catch((error) => {
      const version = document.getElementById('lumno-webdav-version');
      version.hidden = false;
      version.dataset.error = 'true';
      version.textContent = failure(error).message;
    });
    return { render, refresh };
  }
  root.LumnoWebDavOptions = Object.freeze({ createController });
})(globalThis);
