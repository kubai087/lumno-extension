(function(root, factory) {
  const shortcutKeyMatcher = root.LumnoShortcutKeyMatcher ||
    (typeof module === 'object' && module.exports
      ? require('../shared/shortcut-key-matcher.js')
      : {});
  const settings = root.LumnoSettings ||
    (typeof module === 'object' && module.exports
      ? require('../shared/settings.js')
      : {});
  const api = factory(shortcutKeyMatcher, settings);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoOnboardingContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(SHORTCUT_KEY_MATCHER, SETTINGS) {
  const SUPPORTED_LOCALES = Object.freeze(['zh_CN', 'zh_TW', 'ja', 'en']);
  const LUMNO_GITHUB_HOMEPAGE_URL = 'https://github.com/kubai087/lumno-extension';
  const EMPTY_COPY = Object.freeze({ eyebrow: '', title: '', body: '' });
  const SHORTCUTS_PAGE_URL = 'chrome://extensions/shortcuts';
  const EXTENSION_DETAILS_URL = 'chrome://extensions/?id=nkbkcafoocmnnconoijmhloecgamfcai';
  const VISUAL_MOUNT_ID = 'onboarding-visual-stage';
  const CURSOR_MOUNT_ID = 'onboarding-cursor-layer';
  const TITLE_LOGO = Object.freeze({
    label: 'Lumno',
    src: '../../assets/images/lumno.png'
  });
  const BROWSER_AVATARS = Object.freeze([
    Object.freeze({ id: 'chrome', name: 'Chrome', src: '../../assets/images/browser-logos/google-chrome-2022.svg' }),
    Object.freeze({ id: 'edge', name: 'Edge', src: '../../assets/images/browser-logos/microsoft-edge-2019.svg' }),
    Object.freeze({ id: 'dia', name: 'Dia', src: '../../assets/images/browser-logos/dia.jpg' }),
    Object.freeze({ id: 'comet', name: 'Comet', src: '../../assets/images/browser-logos/comet.jpg' })
  ]);

  const LOCALE_META = Object.freeze({
    zh_CN: Object.freeze({ locale: 'zh_CN', htmlLang: 'zh-CN' }),
    zh_TW: Object.freeze({ locale: 'zh_TW', htmlLang: 'zh-TW' }),
    ja: Object.freeze({ locale: 'ja', htmlLang: 'ja' }),
    en: Object.freeze({ locale: 'en', htmlLang: 'en' })
  });

  const LOCALE_TEXT = Object.freeze({
    zh_CN: Object.freeze({
      intro: Object.freeze({
        title: '让浏览器的书签一搜即达',
        titleLines: Object.freeze(['让浏览器的书签', '一搜即达']),
        titleCycle: Object.freeze({
          prefix: '让浏览器的',
          items: Object.freeze([
            Object.freeze({ id: 'bookmark', label: '书签', tone: 'bookmark' }),
            Object.freeze({ id: 'history', label: '历史', tone: 'history' }),
            Object.freeze({ id: 'top-sites', label: '常用网站', tone: 'top-sites' }),
            Object.freeze({ id: 'settings', label: '设置项', tone: 'settings' })
          ])
        }),
        body: '开源浏览器聚焦搜索 & 极简新标签页',
        rows: Object.freeze({
          trust: '开源、隐私边界透明、注重用户体验',
          browser: '支持主流浏览器',
          compatibility: '兼容其他新标签页插件',
          githubLabel: 'GitHub 仓库',
          githubTooltip: '以 GPL-3.0 许可证开源，点击访问 GitHub 仓库。',
          browserTooltipLabel: '支持的浏览器',
          compatibilityTooltipLabel: '兼容说明',
          compatibilityTooltip: '受 Chrome 限制，Lumno 无法提供单独关闭新标签页的入口，但它可以与其他新标签页插件同时使用。\n具体而言，安装 Lumno 后，再覆盖安装或重新启用你正在使用的新标签页插件，让它继续接管新标签页即可。',
          browserAvatarPrefix: '支持',
          browserAvatarSuffix: '主流浏览器'
        }),
        primaryAction: '快速上手'
      }),
      setup: Object.freeze({
        title: '原生聚焦搜索体验',
        body: '在任意网站按下快捷键{shortcut}，唤起聚焦搜索悬浮窗。',
        diaLabel: '致 Dia 浏览器用户',
        diaText: '在 Dia 中，若聚焦搜索浮窗的快捷键不可用，请进入浏览器的快捷键设置页面，将“Open command bar”从“In Dia”改为“Global”。',
        shortcutsLink: '快捷键设置页面',
        localFileLabel: '在本地 PDF/HTML 标签页中使用聚焦搜索',
        localFileText: '请前往扩展程序详情页，为 Lumno 开启“允许访问文件网址”，开启后刷新对应标签页。',
        detailsLink: '扩展程序详情页',
        shortcutActionTooltip: '由于浏览器限制，请在「扩展程序 / 键盘快捷键」页面修改 Lumno 的快捷键，点击前往。'
      }),
      search: Object.freeze({
        title: '精美新标签页',
        body: '支持海量自定义样式，轻松管理你的书签、访问记录。'
      }),
      newtab: Object.freeze({
        title: 'AI / 站内搜索一键直达',
        body: '输入关键词，按下 Tab，直接搜索站点内结果。',
        supportList: '支持列表',
        supportTooltip: '支持自定义，点击前往设置。'
      }),
      finish: Object.freeze({
        title: '更多实用功能',
        body: '围绕浏览器提效领域，做最关心用户体验的插件。',
        primaryAction: '开始体验',
        ratingAction: '为我们评分',
        settingsAction: '设置'
      }),
      actions: Object.freeze({
        next: '下一页',
        back: '返回',
        changeShortcut: '更换快捷键'
      }),
      runtimeCopy: Object.freeze({
        misc: Object.freeze({
          infoLabel: '说明',
          browserNameSeparator: '、',
          browserAvatarSuffix: '等',
          openLabel: '新开',
          searchLabel: '搜索',
          goLabel: '前往',
          removeHistoryLabel: '移除该历史',
          newtabSearchPlaceholder: '搜索或输入网址…',
          settingsLabel: '设置',
          previousLabelTemplate: '{label} 上一页',
          nextLabelTemplate: '{label} 下一页',
          debugBookmarkCascadeLabel: '调试书签级联',
          feedbackLabel: '反馈',
          wallpaperLabel: '壁纸',
          siteSearchDemoAriaLabel: 'Lumno 站内搜索演示',
          newtabSearchPreviewAriaLabel: 'Lumno 新标签页搜索预览',
          newtabPreviewAriaLabel: 'Lumno 新标签页预览',
          openItemAriaTemplate: '打开 {title}',
          sectionModeRecentLabel: '最近访问显示模式',
          sectionModeBookmarksLabel: '书签显示模式',
          bookmarkManagerLabel: '打开书签管理页',
          pageStripAriaTemplate: '引导页导航，第 {current} / {total} 页',
          pageSegmentAriaTemplate: '第 {page} 页',
          featureCardAriaJoiner: '，',
          principlesAriaLabel: 'Lumno 产品原则',
          practicalFeaturesAriaLabel: 'Lumno 实用功能'
        }),
        lumnoOverlay: Object.freeze({
          query: 'extension',
          results: Object.freeze([
            Object.freeze({
              type: 'topSite',
              title: 'Chrome Web Store - Extensions',
              detail: 'https://chromewebstore.google.com/category/extensions',
              sourceTag: '常用',
              favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchromewebstore.google.com%2F&size=32',
              actionTagLabel: '新开',
              visitButtonLabel: '新开',
              active: true
            }),
            Object.freeze({
              type: 'bookmark',
              title: 'Chrome Extensions API Reference',
              detail: '书签 / 开发 / Browser extensions',
              sourceTag: '书签',
              sourceTagKind: 'bookmark',
              favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32',
              visitButtonLabel: '新开'
            }),
            Object.freeze({
              type: 'history',
              title: 'Extensions - Chrome for Developers',
              detail: 'https://developer.chrome.com/docs/extensions',
              sourceTag: '历史',
              favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32',
              visitButtonLabel: '新开',
              historyDeletable: true
            }),
            Object.freeze({ type: 'newtab', title: '搜索 "extension"', visitButtonLabel: '搜索' }),
            Object.freeze({ type: 'browserPage', title: '打开 chrome://extensions/', visitButtonLabel: '打开' })
          ])
        }),
        newtabPreview: Object.freeze({
          query: '',
          sections: Object.freeze({ bookmarks: '书签', recent: '最近访问' }),
          bookmarks: Object.freeze([
            Object.freeze({
              title: '工作台',
              type: 'folder',
              previewUrls: Object.freeze([
                'https://developer.chrome.com/docs/extensions/',
                'https://chromewebstore.google.com/category/extensions',
                'https://github.com/',
                'https://figma.com/'
              ])
            }),
            Object.freeze({
              title: '设计素材',
              type: 'folder',
              previewUrls: Object.freeze([
                'https://www.figma.com/',
                'https://www.framer.com/',
                'https://dribbble.com/',
                'https://mobbin.com/'
              ])
            }),
            Object.freeze({
              title: '开发文档',
              type: 'folder',
              previewUrls: Object.freeze([
                'https://developer.chrome.com/docs/extensions/',
                'https://developer.mozilla.org/',
                'https://github.com/',
                'https://web.dev/'
              ])
            })
          ]),
          recentSites: Object.freeze([
            Object.freeze({ title: 'Lumno - Chrome Web Store', siteName: 'Chrome Web Store', url: 'chromeWebStore', urlText: 'chromewebstore.google.com', accentRgb: Object.freeze([66, 133, 244]) }),
            Object.freeze({ title: 'kubai087/lumno-extension', siteName: 'GitHub', url: 'https://github.com/kubai087/lumno-extension', urlText: 'github.com', accentRgb: Object.freeze([36, 41, 46]) }),
            Object.freeze({ title: 'Tailwind CSS Docs', siteName: 'Tailwind CSS', url: 'https://tailwindcss.com/docs', urlText: 'tailwindcss.com', accentRgb: Object.freeze([6, 182, 212]) }),
            Object.freeze({ title: 'New tab polish', siteName: 'Figma', url: 'https://www.figma.com/', urlText: 'figma.com', accentRgb: Object.freeze([162, 89, 255]) })
          ])
        }),
        siteSearchDemo: Object.freeze({
          tabHintTemplate: '使用 {provider} 搜索',
          cases: Object.freeze([
            Object.freeze({
              kind: 'site',
              label: '站内搜索',
              triggerQuery: 'github',
              modeLabel: 'GitHub',
              prefixLabel: 'GitHub',
              promptQuery: 'lumno extension',
              promptWidth: '15ch',
              favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fgithub.com%2F&size=64',
              iconClass: 'ri-github-fill',
              resultTitle: '在 GitHub 中搜索 "lumno extension"',
              actionLabel: '搜索',
              brandAccentRgb: Object.freeze([36, 41, 46])
            }),
            Object.freeze({
              kind: 'ai',
              label: 'AI',
              triggerQuery: 'chatgpt',
              modeLabel: 'ChatGPT',
              prefixLabel: 'ChatGPT',
              promptQuery: '这个 PR 有哪些隐藏风险？',
              promptWidth: '14em',
              favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchatgpt.com%2F&size=64',
              iconClass: 'ri-sparkling-2-line',
              resultTitle: '向 ChatGPT 提问 "这个 PR 有哪些隐藏风险？"',
              actionLabel: '打开 ChatGPT 网页版',
              brandAccentRgb: Object.freeze([16, 163, 127])
            })
          ])
        }),
        featureCards: Object.freeze([
          Object.freeze({ art: 'homepage-pip', tone: 'pip', title: '自动视频画中画', body: '切走视频页时自动开启' }),
          Object.freeze({ art: 'newtab-filters', artSize: Object.freeze({ width: 298, height: 120 }), tone: 'newtab', title: '打造你的个性新标签页', body: '可更换壁纸，支持海量滤镜效果' })
        ]),
        featureAwards: Object.freeze([
          Object.freeze({ lines: Object.freeze(['开源', '隐私透明']) }),
          Object.freeze({ lines: Object.freeze(['永久免费']) }),
          Object.freeze({ lines: Object.freeze(['专注', '用户体验']) })
        ])
      })
    }),
    zh_TW: Object.freeze({
      intro: Object.freeze({
        title: '讓書籤一搜即達',
        titleLines: Object.freeze(['讓書籤', '一搜即達']),
        titleCycle: Object.freeze({
          prefix: '讓瀏覽器的',
          items: Object.freeze([
            Object.freeze({ id: 'bookmark', label: '書籤', tone: 'bookmark' }),
            Object.freeze({ id: 'history', label: '歷史', tone: 'history' }),
            Object.freeze({ id: 'top-sites', label: '常用網站', tone: 'top-sites' }),
            Object.freeze({ id: 'settings', label: '設定', tone: 'settings' })
          ])
        }),
        body: '開源聚焦搜尋 & 極簡新分頁',
        rows: Object.freeze({
          trust: '開源、隱私範圍透明、重視體驗',
          browser: '支援主流瀏覽器',
          compatibility: '可與其他新分頁擴充功能並用',
          githubLabel: 'GitHub 倉庫',
          githubTooltip: '以 GPL-3.0 授權開源，點按前往 GitHub 倉庫。',
          browserTooltipLabel: '支援的瀏覽器',
          compatibilityTooltipLabel: '相容說明',
          compatibilityTooltip: '受 Chrome 限制，Lumno 無法單獨關閉新分頁接管，但可與其他新分頁擴充功能一起使用。\n安裝 Lumno 後，再覆蓋安裝或重新啟用你慣用的新分頁擴充功能即可。',
          browserAvatarPrefix: '支援',
          browserAvatarSuffix: '主流瀏覽器'
        }),
        primaryAction: '快速上手'
      }),
      setup: Object.freeze({
        title: '原生聚焦搜尋體驗',
        body: '在任意網站按下快速鍵{shortcut}，叫出聚焦搜尋浮動視窗。',
        diaLabel: '致 Dia 瀏覽器使用者',
        diaText: '在 Dia 中，若聚焦搜尋浮動視窗快速鍵不可用，請到瀏覽器快速鍵設定頁面，將「Open command bar」從「In Dia」改為「Global」。',
        shortcutsLink: '快速鍵設定頁面',
        localFileLabel: '在本機 PDF/HTML 分頁中使用聚焦搜尋',
        localFileText: '請前往擴充功能詳細資料頁，為 Lumno 開啟「允許存取檔案網址」，開啟後重新整理該分頁。',
        detailsLink: '擴充功能詳細資料頁',
        shortcutActionTooltip: '受瀏覽器限制，請在「擴充功能 / 鍵盤快速鍵」頁面修改 Lumno 快速鍵，點按前往。'
      }),
      search: Object.freeze({
        title: '精美新分頁',
        body: '自訂樣式，輕鬆管理書籤與瀏覽紀錄。'
      }),
      newtab: Object.freeze({
        title: 'AI / 站內搜尋一鍵直達',
        body: '輸入關鍵字後按 Tab，直接搜尋站內結果。',
        supportList: '支援列表',
        supportTooltip: '可自訂，點按前往設定。'
      }),
      finish: Object.freeze({
        title: '更多實用功能',
        body: '專注瀏覽器提效，也重視每一次體驗。',
        primaryAction: '開始體驗',
        ratingAction: '為我們評分',
        settingsAction: '設定'
      }),
      actions: Object.freeze({ next: '下一頁', back: '返回', changeShortcut: '更換快速鍵' }),
      runtimeCopy: Object.freeze({
        misc: Object.freeze({
          infoLabel: '說明',
          browserNameSeparator: '、',
          browserAvatarSuffix: '等',
          openLabel: '開啟',
          searchLabel: '搜尋',
          goLabel: '前往',
          removeHistoryLabel: '移除此歷史紀錄',
          newtabSearchPlaceholder: '搜尋或輸入網址…',
          settingsLabel: '設定',
          previousLabelTemplate: '{label} 上一頁',
          nextLabelTemplate: '{label} 下一頁',
          debugBookmarkCascadeLabel: '偵錯書籤級聯',
          feedbackLabel: '回饋',
          wallpaperLabel: '桌布',
          siteSearchDemoAriaLabel: 'Lumno 站內搜尋示範',
          newtabSearchPreviewAriaLabel: 'Lumno 新分頁搜尋預覽',
          newtabPreviewAriaLabel: 'Lumno 新分頁預覽',
          openItemAriaTemplate: '開啟 {title}',
          sectionModeRecentLabel: '最近造訪顯示模式',
          sectionModeBookmarksLabel: '書籤顯示模式',
          bookmarkManagerLabel: '開啟書籤管理員',
          pageStripAriaTemplate: '引導頁導覽，第 {current} / {total} 頁',
          pageSegmentAriaTemplate: '第 {page} 頁',
          featureCardAriaJoiner: '，',
          principlesAriaLabel: 'Lumno 產品原則',
          practicalFeaturesAriaLabel: 'Lumno 實用功能'
        }),
        lumnoOverlay: Object.freeze({
          query: 'extension',
          results: Object.freeze([
            Object.freeze({ type: 'topSite', title: 'Chrome Web Store - Extensions', detail: 'https://chromewebstore.google.com/category/extensions', sourceTag: '常用', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchromewebstore.google.com%2F&size=32', actionTagLabel: '開啟', visitButtonLabel: '開啟', active: true }),
            Object.freeze({ type: 'bookmark', title: 'Chrome Extensions API Reference', detail: '書籤 / 開發 / Browser extensions', sourceTag: '書籤', sourceTagKind: 'bookmark', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32', visitButtonLabel: '開啟' }),
            Object.freeze({ type: 'history', title: 'Extensions - Chrome for Developers', detail: 'https://developer.chrome.com/docs/extensions', sourceTag: '歷史', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32', visitButtonLabel: '開啟', historyDeletable: true }),
            Object.freeze({ type: 'newtab', title: '搜尋 "extension"', visitButtonLabel: '搜尋' }),
            Object.freeze({ type: 'browserPage', title: '開啟 chrome://extensions/', visitButtonLabel: '開啟' })
          ])
        }),
        newtabPreview: Object.freeze({
          query: '',
          sections: Object.freeze({ bookmarks: '書籤', recent: '最近造訪' }),
          bookmarks: Object.freeze([
            Object.freeze({ title: '工作台', type: 'folder', previewUrls: Object.freeze(['https://developer.chrome.com/docs/extensions/', 'https://chromewebstore.google.com/category/extensions', 'https://github.com/', 'https://figma.com/']) }),
            Object.freeze({ title: '設計素材', type: 'folder', previewUrls: Object.freeze(['https://www.figma.com/', 'https://www.framer.com/', 'https://dribbble.com/', 'https://mobbin.com/']) }),
            Object.freeze({ title: '開發文件', type: 'folder', previewUrls: Object.freeze(['https://developer.chrome.com/docs/extensions/', 'https://developer.mozilla.org/', 'https://github.com/', 'https://web.dev/']) })
          ]),
          recentSites: Object.freeze([
            Object.freeze({ title: 'Lumno - Chrome Web Store', siteName: 'Chrome Web Store', url: 'chromeWebStore', urlText: 'chromewebstore.google.com', accentRgb: Object.freeze([66, 133, 244]) }),
            Object.freeze({ title: 'kubai087/lumno-extension', siteName: 'GitHub', url: 'https://github.com/kubai087/lumno-extension', urlText: 'github.com', accentRgb: Object.freeze([36, 41, 46]) }),
            Object.freeze({ title: 'Tailwind CSS Docs', siteName: 'Tailwind CSS', url: 'https://tailwindcss.com/docs', urlText: 'tailwindcss.com', accentRgb: Object.freeze([6, 182, 212]) }),
            Object.freeze({ title: 'New tab polish', siteName: 'Figma', url: 'https://www.figma.com/', urlText: 'figma.com', accentRgb: Object.freeze([162, 89, 255]) })
          ])
        }),
        siteSearchDemo: Object.freeze({
          tabHintTemplate: '使用 {provider} 搜尋',
          cases: Object.freeze([
            Object.freeze({ kind: 'site', label: '站內搜尋', triggerQuery: 'github', modeLabel: 'GitHub', prefixLabel: 'GitHub', promptQuery: 'lumno extension', promptWidth: '15ch', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fgithub.com%2F&size=64', iconClass: 'ri-github-fill', resultTitle: '在 GitHub 中搜尋「lumno extension」', actionLabel: '在 GitHub 中搜尋', brandAccentRgb: Object.freeze([36, 41, 46]) }),
            Object.freeze({ kind: 'ai', label: 'AI', triggerQuery: 'chatgpt', modeLabel: 'ChatGPT', prefixLabel: 'ChatGPT', promptQuery: '這個 PR 有哪些隱藏風險？', promptWidth: '14em', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchatgpt.com%2F&size=64', iconClass: 'ri-sparkling-2-line', resultTitle: '向 ChatGPT 提問「這個 PR 有哪些隱藏風險？」', actionLabel: '開啟 ChatGPT 網頁版', brandAccentRgb: Object.freeze([16, 163, 127]) })
          ])
        }),
        featureCards: Object.freeze([
          Object.freeze({ art: 'homepage-pip', tone: 'pip', title: '自動影片子母畫面', body: '離開影片分頁時自動開啟' }),
          Object.freeze({ art: 'newtab-filters', artSize: Object.freeze({ width: 298, height: 120 }), tone: 'newtab', title: '打造你的個性新分頁', body: '可更換桌布，支援多種濾鏡效果' })
        ]),
        featureAwards: Object.freeze([
          Object.freeze({ lines: Object.freeze(['開源', '隱私透明']) }),
          Object.freeze({ lines: Object.freeze(['永久免費']) }),
          Object.freeze({ lines: Object.freeze(['專注', '使用者體驗']) })
        ])
      })
    }),
    ja: Object.freeze({
      intro: Object.freeze({
        title: 'ブックマークをすぐ検索',
        titleLines: Object.freeze(['ブックマークを', 'すぐ検索']),
        titleCycle: Object.freeze({
          prefix: 'ブラウザの',
          items: Object.freeze([
            Object.freeze({ id: 'bookmark', label: 'ブックマーク', tone: 'bookmark' }),
            Object.freeze({ id: 'history', label: '履歴', tone: 'history' }),
            Object.freeze({ id: 'top-sites', label: 'よく使うサイト', tone: 'top-sites' }),
            Object.freeze({ id: 'settings', label: '設定', tone: 'settings' })
          ])
        }),
        body: 'コード公開。検索も新しいタブもすっきり',
        rows: Object.freeze({
          trust: 'コード公開・個人情報に配慮・使いやすさ重視',
          browser: '主要ブラウザに対応',
          compatibility: '他の新しいタブ拡張と併用可',
          githubLabel: 'GitHub で見る',
          githubTooltip: 'GPL-3.0 で公開中。GitHub を開きます。',
          browserTooltipLabel: '対応ブラウザ',
          compatibilityTooltipLabel: '互換性について',
          compatibilityTooltip: 'Chrome の制限により、Lumno だけで新しいタブの上書きをオフにはできませんが、他の新しいタブ拡張と併用できます。\nLumno を入れたあと、使いたい新しいタブ拡張をもう一度有効にしてください。',
          browserAvatarPrefix: '対応',
          browserAvatarSuffix: '主要ブラウザ'
        }),
        primaryAction: '始める'
      }),
      setup: Object.freeze({
        title: 'どこでも呼び出せる',
        body: 'どのサイトでも{shortcut}を押すだけで、Lumno を呼び出せます。',
        diaLabel: 'Dia をお使いの方へ',
        diaText: 'Dia でキーが反応しない場合は、ブラウザのキー設定で「Open command bar」を「In Dia」から「Global」に変更してください。',
        shortcutsLink: 'キー設定',
        localFileLabel: 'ローカルの PDF/HTML で使う',
        localFileText: '拡張機能の詳細ページで Lumno の「ファイルの URL へのアクセスを許可する」をオンにし、タブを読み込み直してください。',
        detailsLink: '拡張機能の詳細',
        shortcutActionTooltip: 'ブラウザの制限により、Lumno のキー設定は拡張機能のキー設定ページで変更します。押すと開きます。'
      }),
      search: Object.freeze({
        title: 'すっきり新しいタブ',
        body: '見た目の調整と、ブックマークや履歴の整理をまとめて。'
      }),
      newtab: Object.freeze({
        title: 'AI / サイト内検索へ直行',
        body: '検索語入力後に Tab。サイト内検索をすぐ開けます。',
        supportList: '対応リスト',
        supportTooltip: '自由に追加できます。押すと設定を開きます。'
      }),
      finish: Object.freeze({
        title: '便利な機能をさらに',
        body: 'ブラウザ作業を軽くし、使い心地まで丁寧に。',
        primaryAction: '使い始める',
        ratingAction: '評価する',
        settingsAction: '設定'
      }),
      actions: Object.freeze({ next: '次へ', back: '戻る', changeShortcut: 'キーを変更' }),
      runtimeCopy: Object.freeze({
        misc: Object.freeze({
          infoLabel: '説明',
          browserNameSeparator: '、',
          browserAvatarSuffix: 'など',
          openLabel: '開く',
          searchLabel: '検索',
          goLabel: '移動',
          removeHistoryLabel: 'この履歴を削除',
          newtabSearchPlaceholder: '検索または URL を入力…',
          settingsLabel: '設定',
          previousLabelTemplate: '{label} 前へ',
          nextLabelTemplate: '{label} 次へ',
          debugBookmarkCascadeLabel: 'ブックマーク階層を調整',
          feedbackLabel: 'フィードバックを送る',
          wallpaperLabel: '壁紙',
          siteSearchDemoAriaLabel: 'Lumno サイト内検索デモ',
          newtabSearchPreviewAriaLabel: 'Lumno 新しいタブ検索の表示例',
          newtabPreviewAriaLabel: 'Lumno 新しいタブの表示例',
          openItemAriaTemplate: '{title}を開く',
          sectionModeRecentLabel: '最近使ったサイトの表示モード',
          sectionModeBookmarksLabel: 'ブックマークの表示方法',
          bookmarkManagerLabel: 'ブックマークマネージャーを開く',
          pageStripAriaTemplate: '案内ページ、{current} / {total}ページ',
          pageSegmentAriaTemplate: '{page}ページ目',
          featureCardAriaJoiner: '、',
          principlesAriaLabel: 'Lumno の原則',
          practicalFeaturesAriaLabel: 'Lumno の便利機能'
        }),
        lumnoOverlay: Object.freeze({
          query: 'extension',
          results: Object.freeze([
            Object.freeze({ type: 'topSite', title: 'Chrome Web Store - Extensions', detail: 'https://chromewebstore.google.com/category/extensions', sourceTag: 'よく使う', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchromewebstore.google.com%2F&size=32', actionTagLabel: '開く', visitButtonLabel: '開く', active: true }),
            Object.freeze({ type: 'bookmark', title: 'Chrome Extensions API Reference', detail: 'ブックマーク / 開発 / Browser extensions', sourceTag: 'ブックマーク', sourceTagKind: 'bookmark', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32', visitButtonLabel: '開く' }),
            Object.freeze({ type: 'history', title: 'Extensions - Chrome for Developers', detail: 'https://developer.chrome.com/docs/extensions', sourceTag: '履歴', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32', visitButtonLabel: '開く', historyDeletable: true }),
            Object.freeze({ type: 'newtab', title: '"extension" を検索', visitButtonLabel: '検索' }),
            Object.freeze({ type: 'browserPage', title: 'chrome://extensions/ を開く', visitButtonLabel: '開く' })
          ])
        }),
        newtabPreview: Object.freeze({
          query: '',
          sections: Object.freeze({ bookmarks: 'ブックマーク', recent: '最近使ったサイト' }),
          bookmarks: Object.freeze([
            Object.freeze({ title: '作業場', type: 'folder', previewUrls: Object.freeze(['https://developer.chrome.com/docs/extensions/', 'https://chromewebstore.google.com/category/extensions', 'https://github.com/', 'https://figma.com/']) }),
            Object.freeze({ title: 'デザイン素材', type: 'folder', previewUrls: Object.freeze(['https://www.figma.com/', 'https://www.framer.com/', 'https://dribbble.com/', 'https://mobbin.com/']) }),
            Object.freeze({ title: '開発資料', type: 'folder', previewUrls: Object.freeze(['https://developer.chrome.com/docs/extensions/', 'https://developer.mozilla.org/', 'https://github.com/', 'https://web.dev/']) })
          ]),
          recentSites: Object.freeze([
            Object.freeze({ title: 'Lumno - Chrome Web Store', siteName: 'Chrome Web Store', url: 'chromeWebStore', urlText: 'chromewebstore.google.com', accentRgb: Object.freeze([66, 133, 244]) }),
            Object.freeze({ title: 'kubai087/lumno-extension', siteName: 'GitHub', url: 'https://github.com/kubai087/lumno-extension', urlText: 'github.com', accentRgb: Object.freeze([36, 41, 46]) }),
            Object.freeze({ title: 'Tailwind CSS Docs', siteName: 'Tailwind CSS', url: 'https://tailwindcss.com/docs', urlText: 'tailwindcss.com', accentRgb: Object.freeze([6, 182, 212]) }),
            Object.freeze({ title: 'New tab polish', siteName: 'Figma', url: 'https://www.figma.com/', urlText: 'figma.com', accentRgb: Object.freeze([162, 89, 255]) })
          ])
        }),
        siteSearchDemo: Object.freeze({
          tabHintTemplate: '{provider}で検索',
          cases: Object.freeze([
            Object.freeze({ kind: 'site', label: 'サイト内検索', triggerQuery: 'github', modeLabel: 'GitHub', prefixLabel: 'GitHub', promptQuery: 'lumno extension', promptWidth: '15ch', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fgithub.com%2F&size=64', iconClass: 'ri-github-fill', resultTitle: 'GitHub で「lumno extension」を検索', actionLabel: 'GitHub で検索', brandAccentRgb: Object.freeze([36, 41, 46]) }),
            Object.freeze({ kind: 'ai', label: 'AI', triggerQuery: 'chatgpt', modeLabel: 'ChatGPT', prefixLabel: 'ChatGPT', promptQuery: 'この PR の隠れたリスクは？', promptWidth: '14em', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchatgpt.com%2F&size=64', iconClass: 'ri-sparkling-2-line', resultTitle: 'ChatGPT に「この PR の隠れたリスクは？」と質問', actionLabel: 'ChatGPT Web版を開く', brandAccentRgb: Object.freeze([16, 163, 127]) })
          ])
        }),
        featureCards: Object.freeze([
          Object.freeze({ art: 'homepage-pip', tone: 'pip', title: '動画を自動でピクチャーインピクチャー表示', body: '動画タブを離れると自動で表示' }),
          Object.freeze({ art: 'newtab-filters', artSize: Object.freeze({ width: 298, height: 120 }), tone: 'newtab', title: '新しいタブを自分好みに', body: '壁紙と多彩な効果を選べます' })
        ]),
        featureAwards: Object.freeze([
          Object.freeze({ lines: Object.freeze(['中身を公開', '情報に配慮']) }),
          Object.freeze({ lines: Object.freeze(['ずっと無料', '制限なし']) }),
          Object.freeze({ lines: Object.freeze(['使いやすさ', '細部まで']) })
        ])
      })
    }),
    en: Object.freeze({
      intro: Object.freeze({
        title: 'Search bookmarks instantly',
        titleLines: Object.freeze(['Search bookmarks', 'instantly']),
        titleCycle: Object.freeze({
          prefix: 'Search ',
          items: Object.freeze([
            Object.freeze({ id: 'bookmark', label: 'bookmarks', tone: 'bookmark' }),
            Object.freeze({ id: 'history', label: 'history', tone: 'history' }),
            Object.freeze({ id: 'top-sites', label: 'top sites', tone: 'top-sites' }),
            Object.freeze({ id: 'settings', label: 'settings', tone: 'settings' })
          ])
        }),
        body: 'Open-source command bar + a cleaner new tab',
        rows: Object.freeze({
          trust: 'Open source, private by design',
          browser: 'Works in major browsers',
          compatibility: 'Friendly with other new-tab extensions',
          githubLabel: 'GitHub repo',
          githubTooltip: 'Open-sourced under GPL-3.0. View the repo on GitHub.',
          browserTooltipLabel: 'Supported browsers',
          compatibilityTooltipLabel: 'Compatibility',
          compatibilityTooltip: 'Chrome does not let Lumno disable its new-tab override on its own, but Lumno can live alongside another new-tab extension.\nAfter installing Lumno, reinstall or re-enable your favorite new-tab extension so it stays in charge.',
          browserAvatarPrefix: 'Works in',
          browserAvatarSuffix: 'major browsers'
        }),
        primaryAction: 'Get started'
      }),
      setup: Object.freeze({
        title: 'A command bar that feels native',
        titleLines: Object.freeze(['A command bar', 'that feels native']),
        body: 'Press {shortcut} to open Lumno anywhere.',
        diaLabel: 'Using Dia?',
        diaText: 'If the shortcut does not respond in Dia, click Open shortcut settings and change "Open command bar" from "In Dia" to "Global".',
        shortcutsLink: 'Open shortcut settings',
        localFileLabel: 'Working with local files?',
        localFileText: 'Click Open extension details, allow Lumno to access file URLs, then refresh the PDF or HTML tab.',
        detailsLink: 'Open extension details',
        shortcutActionTooltip: 'Browser shortcuts live on the Extensions / Keyboard shortcuts page. Click to open it.'
      }),
      search: Object.freeze({
        title: 'A calmer new tab for where you go',
        titleLines: Object.freeze(['A calmer new tab', 'for where you go']),
        body: 'Make it yours. Bookmarks and history stay tidy.'
      }),
      newtab: Object.freeze({
        title: 'AI / site search in one jump',
        titleLines: Object.freeze(['AI / site search', 'in one jump']),
        body: 'Type, hit Tab, and jump to the right search.',
        supportList: 'Supported sites',
        supportTooltip: 'Add your own sites in settings.'
      }),
      finish: Object.freeze({
        title: 'Tiny browser wins that add up',
        titleLines: Object.freeze(['Tiny browser wins', 'that add up']),
        body: 'Video popouts, new-tab polish, and useful extras.',
        primaryAction: 'Start using Lumno',
        ratingAction: 'Rate Lumno',
        settingsAction: 'Settings'
      }),
      actions: Object.freeze({ next: 'Next', back: 'Back', changeShortcut: 'Change shortcut' }),
      runtimeCopy: Object.freeze({
        misc: Object.freeze({
          infoLabel: 'Info',
          browserNameSeparator: ', ',
          browserAvatarSuffix: 'and more',
          openLabel: 'Open',
          searchLabel: 'Search',
          goLabel: 'Go',
          removeHistoryLabel: 'Remove from history',
          newtabSearchPlaceholder: 'Search or enter a URL…',
          settingsLabel: 'Settings',
          previousLabelTemplate: '{label}, previous',
          nextLabelTemplate: '{label}, next',
          debugBookmarkCascadeLabel: 'Debug bookmark menu',
          feedbackLabel: 'Send feedback',
          wallpaperLabel: 'Wallpaper',
          siteSearchDemoAriaLabel: 'Lumno site-search demo',
          newtabSearchPreviewAriaLabel: 'Lumno new-tab search preview',
          newtabPreviewAriaLabel: 'Lumno new-tab preview',
          openItemAriaTemplate: 'Open {title}',
          sectionModeRecentLabel: 'Recent sites view',
          sectionModeBookmarksLabel: 'Bookmarks view',
          bookmarkManagerLabel: 'Open bookmark manager',
          pageStripAriaTemplate: 'Onboarding, page {current} of {total}',
          pageSegmentAriaTemplate: 'Page {page}',
          featureCardAriaJoiner: ', ',
          principlesAriaLabel: 'Lumno principles',
          practicalFeaturesAriaLabel: 'Lumno extras'
        }),
        lumnoOverlay: Object.freeze({
          query: 'extension',
          results: Object.freeze([
            Object.freeze({ type: 'topSite', title: 'Chrome Web Store - Extensions', detail: 'https://chromewebstore.google.com/category/extensions', sourceTag: 'Top', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchromewebstore.google.com%2F&size=32', actionTagLabel: 'Open', visitButtonLabel: 'Open', active: true }),
            Object.freeze({ type: 'bookmark', title: 'Chrome Extensions API Reference', detail: 'Bookmarks / Dev / Browser extensions', sourceTag: 'Bookmark', sourceTagKind: 'bookmark', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32', visitButtonLabel: 'Open' }),
            Object.freeze({ type: 'history', title: 'Extensions - Chrome for Developers', detail: 'https://developer.chrome.com/docs/extensions', sourceTag: 'History', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fdeveloper.chrome.com%2F&size=32', visitButtonLabel: 'Open', historyDeletable: true }),
            Object.freeze({ type: 'newtab', title: 'Search "extension"', visitButtonLabel: 'Search' }),
            Object.freeze({ type: 'browserPage', title: 'Open chrome://extensions/', visitButtonLabel: 'Open' })
          ])
        }),
        newtabPreview: Object.freeze({
          query: '',
          sections: Object.freeze({ bookmarks: 'Bookmarks', recent: 'Recent' }),
          bookmarks: Object.freeze([
            Object.freeze({ title: 'Workbench', type: 'folder', previewUrls: Object.freeze(['https://developer.chrome.com/docs/extensions/', 'https://chromewebstore.google.com/category/extensions', 'https://github.com/', 'https://figma.com/']) }),
            Object.freeze({ title: 'Design kit', type: 'folder', previewUrls: Object.freeze(['https://www.figma.com/', 'https://www.framer.com/', 'https://dribbble.com/', 'https://mobbin.com/']) }),
            Object.freeze({ title: 'Dev docs', type: 'folder', previewUrls: Object.freeze(['https://developer.chrome.com/docs/extensions/', 'https://developer.mozilla.org/', 'https://github.com/', 'https://web.dev/']) })
          ]),
          recentSites: Object.freeze([
            Object.freeze({ title: 'Lumno - Chrome Web Store', siteName: 'Chrome Web Store', url: 'chromeWebStore', urlText: 'chromewebstore.google.com', accentRgb: Object.freeze([66, 133, 244]) }),
            Object.freeze({ title: 'kubai087/lumno-extension', siteName: 'GitHub', url: 'https://github.com/kubai087/lumno-extension', urlText: 'github.com', accentRgb: Object.freeze([36, 41, 46]) }),
            Object.freeze({ title: 'Tailwind CSS Docs', siteName: 'Tailwind CSS', url: 'https://tailwindcss.com/docs', urlText: 'tailwindcss.com', accentRgb: Object.freeze([6, 182, 212]) }),
            Object.freeze({ title: 'New tab polish', siteName: 'Figma', url: 'https://www.figma.com/', urlText: 'figma.com', accentRgb: Object.freeze([162, 89, 255]) })
          ])
        }),
        siteSearchDemo: Object.freeze({
          tabHintTemplate: 'Search with {provider}',
          cases: Object.freeze([
            Object.freeze({ kind: 'site', label: 'Site search', triggerQuery: 'github', modeLabel: 'GitHub', prefixLabel: 'GitHub', promptQuery: 'lumno extension', promptWidth: '15ch', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fgithub.com%2F&size=64', iconClass: 'ri-github-fill', resultTitle: 'Search in GitHub "lumno extension"', actionLabel: 'Search', brandAccentRgb: Object.freeze([36, 41, 46]) }),
            Object.freeze({ kind: 'ai', label: 'Ask AI', triggerQuery: 'chatgpt', modeLabel: 'ChatGPT', prefixLabel: 'ChatGPT', promptQuery: 'What should I watch for in this PR?', promptWidth: '16em', favicon: 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fchatgpt.com%2F&size=64', iconClass: 'ri-sparkling-2-line', resultTitle: 'Ask ChatGPT "What should I watch for in this PR?"', actionLabel: 'Open ChatGPT web app', brandAccentRgb: Object.freeze([16, 163, 127]) })
          ])
        }),
        featureCards: Object.freeze([
          Object.freeze({ art: 'homepage-pip', tone: 'pip', title: 'Auto Picture-in-Picture', body: 'Pops out when you leave a video tab' }),
          Object.freeze({ art: 'newtab-filters', artSize: Object.freeze({ width: 298, height: 120 }), tone: 'newtab', title: 'Make the new tab yours', body: 'Wallpapers, filters, and a softer view' })
        ]),
        featureAwards: Object.freeze([
          Object.freeze({ lines: Object.freeze(['Open source', 'Privacy first']) }),
          Object.freeze({ lines: Object.freeze(['Free forever', 'No strings']) }),
          Object.freeze({ lines: Object.freeze(['Feels native', 'stays light']) })
        ])
      })
    })
  });

  function normalizeLocale(locale) {
    return SETTINGS.normalizeLocale(locale);
  }

  function normalizeShortcutValue(value) {
    return String(value || '').trim().replace(/\s*\+\s*/g, '+');
  }

  function getShortcutKeyLabel(keyToken, preferSymbols) {
    const keyMapMac = {
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Enter: '↩',
      Return: '↩',
      Escape: '⎋',
      Esc: '⎋',
      Tab: '⇥',
      Space: 'Space',
      Spacebar: 'Space',
      Comma: ',',
      Period: '.',
      Slash: '/',
      Semicolon: ';',
      Quote: '\'',
      Minus: '-',
      Plus: '+',
      Backslash: '\\',
      Backquote: '`',
      BracketLeft: '[',
      BracketRight: ']'
    };
    const keyMapDefault = {
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Escape: 'Esc',
      Comma: ',',
      Period: '.',
      Slash: '/',
      Semicolon: ';',
      Quote: '\'',
      Minus: '-',
      Plus: '+',
      Backslash: '\\',
      Backquote: '`',
      BracketLeft: '[',
      BracketRight: ']'
    };
    return preferSymbols
      ? (keyMapMac[keyToken] || keyToken)
      : (keyMapDefault[keyToken] || keyToken);
  }

  function getModifierSymbol(token) {
    const lower = String(token || '').toLowerCase();
    if (lower === 'command' || lower === 'cmd' || lower === 'meta' || lower === 'super' || token === '⌘') {
      return '⌘';
    }
    if (lower === 'shift' || token === '⇧') {
      return '⇧';
    }
    if (lower === 'ctrl' || lower === 'control' || lower === 'macctrl' || token === '⌃') {
      return '⌃';
    }
    if (lower === 'alt' || lower === 'option' || token === '⌥') {
      return '⌥';
    }
    return '';
  }

  function normalizeShortcutTokenText(token) {
    const text = String(token || '');
    return text.length > 1 ? text.toUpperCase() : text;
  }

  function getCompactMacShortcutTokens(value) {
    const compact = String(value || '').trim().replace(/\s+/g, '');
    if (!compact || compact.includes('+') || !/[⌘⇧⌃⌥]/.test(compact)) {
      return null;
    }
    const tokens = [];
    let index = 0;
    while (index < compact.length) {
      const symbol = getModifierSymbol(compact[index]);
      if (!symbol) {
        break;
      }
      tokens.push(symbol);
      index += 1;
    }
    const keyToken = compact.slice(index);
    if (tokens.length === 0 || !keyToken) {
      return null;
    }
    tokens.push(getShortcutKeyLabel(keyToken, true));
    return tokens.map(normalizeShortcutTokenText);
  }

  function getShortcutDisplayTokens(shortcut, options) {
    const value = normalizeShortcutValue(shortcut);
    if (!value) {
      return [];
    }
    const compactTokens = getCompactMacShortcutTokens(value);
    if (compactTokens) {
      return compactTokens;
    }
    const parts = value.split('+').filter(Boolean);
    if (parts.length === 0) {
      return [];
    }
    const preferSymbols = Boolean(options && options.preferSymbols) ||
      parts.some((part) => /^[⌘⇧⌃⌥]$/.test(String(part || ''))) ||
      parts.some((part) => /^(?:Command|Cmd|Meta|Super)$/i.test(String(part || '')));
    const keyToken = parts.pop();
    const tokens = [];
    parts.forEach((token) => {
      const symbol = getModifierSymbol(token);
      if (preferSymbols && symbol) {
        tokens.push(symbol);
        return;
      }
      tokens.push(/^Command$/i.test(token) ? 'Cmd' : token);
    });
    tokens.push(getShortcutKeyLabel(keyToken, preferSymbols));
    return tokens.map(normalizeShortcutTokenText);
  }

  function formatShortcutForDisplay(shortcut, options) {
    const tokens = getShortcutDisplayTokens(shortcut, options);
    if (tokens.length === 0) {
      return '';
    }
    const shouldUseCompactSymbols = tokens.some((token) => /[⌘⇧⌃⌥]/.test(token));
    return tokens.join(shouldUseCompactSymbols ? '' : '+');
  }

  function parseShortcutHotkey(shortcut) {
    return SHORTCUT_KEY_MATCHER.parseShortcut(normalizeShortcutValue(shortcut));
  }

  function shortcutHotkeyMatchesEvent(shortcut, event) {
    return SHORTCUT_KEY_MATCHER.eventMatchesShortcut(event, parseShortcutHotkey(shortcut));
  }

  function cloneCopy(copy) {
    const source = copy || EMPTY_COPY;
    const cloned = {
      eyebrow: source.eyebrow || '',
      title: source.title || '',
      body: source.body || ''
    };
    if (source.note) {
      cloned.note = String(source.note || '');
    }
    if (Array.isArray(source.titleLines) && source.titleLines.length > 0) {
      cloned.titleLines = Object.freeze(source.titleLines.map((line) => String(line || '')));
    }
    const titleLogo = cloneTitleLogo(source.titleLogo);
    if (titleLogo) {
      cloned.titleLogo = titleLogo;
    }
    const titleCycle = cloneTitleCycle(source.titleCycle);
    if (titleCycle) {
      cloned.titleCycle = titleCycle;
    }
    return cloned;
  }

  function cloneTitleLogo(titleLogo) {
    const src = String(titleLogo && titleLogo.src || '').trim();
    if (!src) {
      return null;
    }
    return Object.freeze({
      label: String(titleLogo && titleLogo.label || ''),
      src
    });
  }

  function cloneTitleCycle(titleCycle) {
    if (!titleCycle || !Array.isArray(titleCycle.items) || titleCycle.items.length === 0) {
      return null;
    }
    const items = titleCycle.items.map((item) => ({
      id: String(item && item.id || ''),
      label: String(item && item.label || ''),
      tone: String(item && item.tone || '')
    })).filter((item) => item.id && item.label && item.tone);
    if (items.length === 0) {
      return null;
    }
    return Object.freeze({
      prefix: String(titleCycle.prefix || ''),
      items: Object.freeze(items.map((item) => Object.freeze(item)))
    });
  }

  function cloneAction(action) {
    if (!action || typeof action !== 'object') {
      return null;
    }
    const label = String(action.label || '').trim();
    const actionId = String(action.actionId || '').trim();
    if (!label || !actionId) {
      return null;
    }
    const cloned = {
      actionId,
      label,
      icon: String(action.icon || '').trim()
    };
    const tooltip = String(action.tooltip || '').trim();
    if (tooltip) {
      cloned.tooltip = tooltip;
    }
    const tooltipMaxWidth = Number(action.tooltipMaxWidth);
    if (Number.isFinite(tooltipMaxWidth) && tooltipMaxWidth > 0) {
      cloned.tooltipMaxWidth = Math.round(tooltipMaxWidth);
    }
    return Object.freeze(cloned);
  }

  function cloneActions(actions) {
    const source = actions || {};
    return Object.freeze({
      primary: cloneAction(source.primary),
      secondary: cloneAction(source.secondary),
      ghost: cloneAction(source.ghost)
    });
  }

  function cloneBrowserAvatars(browserAvatars) {
    if (!browserAvatars || !Array.isArray(browserAvatars.browsers) || browserAvatars.browsers.length === 0) {
      return null;
    }
    return {
      prefix: String(browserAvatars.prefix || ''),
      suffix: String(browserAvatars.suffix || ''),
      browsers: browserAvatars.browsers.map((browser) => ({
        id: String(browser && browser.id || ''),
        name: String(browser && browser.name || ''),
        src: String(browser && browser.src || '')
      })).filter((browser) => browser.id && browser.name && browser.src)
    };
  }

  function cloneInfoTooltip(infoTooltip) {
    if (!infoTooltip || typeof infoTooltip !== 'object') {
      return null;
    }
    const text = String(infoTooltip.text || '').trim();
    const type = String(infoTooltip.type || '').trim();
    if (!text && !type) {
      return null;
    }
    return {
      icon: String(infoTooltip.icon || 'ri-information-line').trim() || 'ri-information-line',
      label: String(infoTooltip.label || '说明').trim() || '说明',
      type,
      text
    };
  }

  function cloneLinkButton(linkButton) {
    if (!linkButton || typeof linkButton !== 'object') {
      return null;
    }
    const href = String(linkButton.href || '').trim();
    const label = String(linkButton.label || '').trim();
    if (!href || !label || !/^https?:\/\//i.test(href)) {
      return null;
    }
    const tooltip = String(linkButton.tooltip || label).trim() || label;
    return {
      icon: String(linkButton.icon || 'ri-github-fill').trim() || 'ri-github-fill',
      label,
      tooltip,
      href
    };
  }

  function cloneAccordionLinks(links) {
    if (!Array.isArray(links)) {
      return [];
    }
    return links
      .map((link) => {
        const label = String(link && link.label || '').trim();
        const href = String(link && link.href || '').trim();
        const actionId = String(link && link.actionId || '').trim();
        if (!label || !href || !/^(?:https?:\/\/|chrome:\/\/)/i.test(href)) {
          return null;
        }
        const clonedLink = { label, href };
        if (actionId) {
          clonedLink.actionId = actionId;
        }
        return Object.freeze(clonedLink);
      })
      .filter(Boolean);
  }

  function getLocaleText(locale) {
    const normalized = normalizeLocale(locale);
    return LOCALE_TEXT[normalized] || LOCALE_TEXT.en;
  }

  function cloneDeepFrozen(value) {
    if (Array.isArray(value)) {
      return Object.freeze(value.map(cloneDeepFrozen));
    }
    if (value && typeof value === 'object') {
      const cloned = {};
      Object.keys(value).forEach((key) => {
        cloned[key] = cloneDeepFrozen(value[key]);
      });
      return Object.freeze(cloned);
    }
    return value;
  }

  function createCompatibilityRow(text, options = {}) {
    const rows = text.intro.rows || {};
    const row = {
      kind: 'compatibility-row',
      icon: 'ri-puzzle-line',
      label: rows.compatibility
    };
    if (options.showDescription === true) {
      row.description = rows.compatibilityTooltip;
    } else {
      row.infoTooltip = Object.freeze({
        icon: 'ri-information-line',
        label: rows.compatibilityTooltipLabel,
        text: rows.compatibilityTooltip
      });
    }
    return Object.freeze(row);
  }

  function createIntroRows(text) {
    const rows = text.intro.rows || {};
    return Object.freeze([
      Object.freeze({
        kind: 'trust-row',
        icon: 'ri-shield-check-line',
        label: rows.trust,
        linkButton: Object.freeze({
          icon: 'ri-github-fill',
          label: rows.githubLabel,
          tooltip: rows.githubTooltip,
          href: LUMNO_GITHUB_HOMEPAGE_URL
        })
      }),
      Object.freeze({
        kind: 'browser-row',
        icon: 'ri-chrome-line',
        label: rows.browser,
        browserAvatars: Object.freeze({
          prefix: rows.browserAvatarPrefix,
          suffix: rows.browserAvatarSuffix,
          browsers: BROWSER_AVATARS
        }),
        infoTooltip: Object.freeze({
          icon: 'ri-information-line',
          label: rows.browserTooltipLabel,
          type: 'browser-avatars'
        })
      }),
      createCompatibilityRow(text)
    ]);
  }

  function createSetupRows(text) {
    return Object.freeze([
      Object.freeze({
        kind: 'accordion-row',
        actionId: 'toggleInteractionAccordion',
        accordionId: 'dia-browser',
        icon: 'ri-information-line',
        label: text.setup.diaLabel,
        accordion: Object.freeze({
          icon: 'ri-arrow-left-s-line',
          text: text.setup.diaText,
          links: Object.freeze([
            Object.freeze({
              label: text.setup.shortcutsLink,
              href: SHORTCUTS_PAGE_URL,
              actionId: 'openShortcuts'
            })
          ]),
          expandedByDefault: false
        })
      }),
      Object.freeze({
        kind: 'accordion-row',
        actionId: 'toggleInteractionAccordion',
        accordionId: 'local-file-search',
        icon: 'ri-information-line',
        label: text.setup.localFileLabel,
        accordion: Object.freeze({
          icon: 'ri-arrow-left-s-line',
          text: text.setup.localFileText,
          links: Object.freeze([
            Object.freeze({
              label: text.setup.detailsLink,
              href: EXTENSION_DETAILS_URL,
              actionId: 'openExtensionDetails'
            })
          ]),
          expandedByDefault: false
        })
      })
    ]);
  }

  function createSlideSlots(text) {
    const actions = text.actions || {};
    return Object.freeze([
      Object.freeze({
        id: 'intro',
        copy: Object.freeze({
          eyebrow: '',
          title: text.intro.title,
          titleLines: text.intro.titleLines,
          titleLogo: TITLE_LOGO,
          titleCycle: text.intro.titleCycle,
          body: text.intro.body
        }),
        visualKind: 'lumno-web-wordmark-surface',
        visualVisible: true,
        interactionRows: createIntroRows(text),
        cursorEnabled: true,
        actions: Object.freeze({
          primary: Object.freeze({
            actionId: 'next',
            label: text.intro.primaryAction,
            icon: 'ri-arrow-right-line'
          })
        })
      }),
      Object.freeze({
        id: 'setup',
        copy: Object.freeze({
          eyebrow: '',
          title: text.setup.title,
          titleLines: text.setup.titleLines,
          body: text.setup.body
        }),
        visualKind: 'bookmark-focus-surface',
        visualVisible: true,
        interactionRows: createSetupRows(text),
        cursorEnabled: true,
        actions: Object.freeze({
          primary: Object.freeze({
            actionId: 'next',
            label: actions.next,
            icon: 'ri-arrow-right-line'
          }),
          secondary: Object.freeze({
            actionId: 'prev',
            label: actions.back
          }),
          ghost: Object.freeze({
            actionId: 'openShortcuts',
            label: actions.changeShortcut,
            icon: 'ri-external-link-line',
            tooltip: text.setup.shortcutActionTooltip,
            tooltipMaxWidth: 260
          })
        })
      }),
      Object.freeze({
        id: 'search',
        copy: Object.freeze({
          eyebrow: '',
          title: text.search.title,
          titleLines: text.search.titleLines,
          body: text.search.body
        }),
        visualKind: 'newtab-preview-surface',
        visualVisible: true,
        interactionRows: Object.freeze([
          createCompatibilityRow(text, { showDescription: true })
        ]),
        cursorEnabled: true,
        actions: Object.freeze({
          primary: Object.freeze({
            actionId: 'next',
            label: actions.next,
            icon: 'ri-arrow-right-line'
          })
        })
      }),
      Object.freeze({
        id: 'newtab',
        copy: Object.freeze({
          eyebrow: '',
          title: text.newtab.title,
          titleLines: text.newtab.titleLines,
          body: text.newtab.body
        }),
        visualKind: 'site-search-demo-surface',
        visualVisible: true,
        cursorEnabled: true,
        actions: Object.freeze({
          primary: Object.freeze({
            actionId: 'next',
            label: actions.next,
            icon: 'ri-arrow-right-line'
          }),
          ghost: Object.freeze({
            actionId: 'openSiteSearchOptions',
            label: text.newtab.supportList,
            icon: 'ri-external-link-line',
            tooltip: text.newtab.supportTooltip
          })
        })
      }),
      Object.freeze({
        id: 'finish',
        copy: Object.freeze({
          eyebrow: '',
          title: text.finish.title,
          titleLines: text.finish.titleLines,
          body: text.finish.body
        }),
        visualKind: 'feature-cards-surface',
        visualVisible: true,
        cursorEnabled: true,
        actions: Object.freeze({
          primary: Object.freeze({
            actionId: 'openNewtab',
            label: text.finish.primaryAction,
            icon: 'ri-arrow-right-line'
          }),
          secondary: Object.freeze({
            actionId: 'openChromeWebStore',
            label: text.finish.ratingAction
          }),
          ghost: Object.freeze({
            actionId: 'openOptions',
            label: text.finish.settingsAction,
            icon: 'ri-external-link-line'
          })
        })
      })
    ]);
  }

  function createInteractionSlots(slot, slideId) {
    if (Array.isArray(slot.interactionRows)) {
      return slot.interactionRows.map((row, index) => {
        const interactionSlot = {
          id: `${slideId}-interaction-${index + 1}`,
          kind: row.kind || 'info-row',
          actionId: String(row.actionId || ''),
          accordionId: String(row.accordionId || '').trim(),
          icon: row.icon || '',
          label: row.label || '',
          description: String(row.description || '')
        };
        const browserAvatars = cloneBrowserAvatars(row.browserAvatars);
        if (browserAvatars && browserAvatars.browsers.length > 0) {
          interactionSlot.browserAvatars = Object.freeze({
            prefix: browserAvatars.prefix,
            suffix: browserAvatars.suffix,
            browsers: Object.freeze(browserAvatars.browsers.map((browser) => Object.freeze(browser)))
          });
        }
        const infoTooltip = cloneInfoTooltip(row.infoTooltip);
        if (infoTooltip) {
          interactionSlot.infoTooltip = Object.freeze(infoTooltip);
        }
        const linkButton = cloneLinkButton(row.linkButton);
        if (linkButton) {
          interactionSlot.linkButton = Object.freeze(linkButton);
        }
        if (row.accordion && typeof row.accordion === 'object') {
          const accordionLinks = cloneAccordionLinks(row.accordion.links);
          const accordion = {
            icon: String(row.accordion.icon || 'ri-arrow-left-s-line').trim() || 'ri-arrow-left-s-line',
            text: String(row.accordion.text || ''),
            expandedByDefault: row.accordion.expandedByDefault === true
          };
          if (accordionLinks.length > 0) {
            accordion.links = Object.freeze(accordionLinks);
          }
          interactionSlot.accordion = Object.freeze(accordion);
        }
        return Object.freeze(interactionSlot);
      });
    }
    const kinds = Array.isArray(slot.interactionKinds) ? slot.interactionKinds : [];
    return kinds.map((kind, index) => Object.freeze({
      id: `${slideId}-interaction-${index + 1}`,
      kind,
      actionId: index === 0 ? 'next' : '',
      label: '',
      description: ''
    }));
  }

  function createSlide(slot, index) {
    return Object.freeze({
      id: slot.id,
      sequence: index + 1,
      copy: Object.freeze(cloneCopy(slot.copy)),
      left: Object.freeze({
        copySlotId: 'onboarding-copy-panel',
        interactionMountId: 'onboarding-interaction-slots',
        interactionSlots: Object.freeze(createInteractionSlots(slot, slot.id))
      }),
      visual: Object.freeze({
        mountId: VISUAL_MOUNT_ID,
        kind: slot.visualKind,
        renderer: 'placeholder',
        acceptsRealUi: true,
        visible: slot.visualVisible !== false
      }),
      actions: cloneActions(slot.actions),
      cursor: Object.freeze({
        mountId: CURSOR_MOUNT_ID,
        enabled: slot.cursorEnabled,
        path: Object.freeze([])
      })
    });
  }

  function getSupportedLocales() {
    return SUPPORTED_LOCALES.slice();
  }

  function getOnboardingRuntimeCopy(locale) {
    const text = getLocaleText(locale);
    return cloneDeepFrozen(text.runtimeCopy || LOCALE_TEXT.en.runtimeCopy);
  }

  function getOnboardingBlueprint(locale) {
    const normalized = normalizeLocale(locale);
    const meta = LOCALE_META[normalized] || LOCALE_META.en;
    const text = getLocaleText(meta.locale);
    return Object.freeze({
      brand: 'Lumno',
      locale: meta.locale,
      htmlLang: meta.htmlLang,
      mode: 'paginated',
      shell: Object.freeze({
        rootId: 'onboarding-root',
        copyPanelId: 'onboarding-copy-panel',
        interactionMountId: 'onboarding-interaction-slots',
        visualStageId: VISUAL_MOUNT_ID,
        cursorLayerId: CURSOR_MOUNT_ID
      }),
      runtimeCopy: getOnboardingRuntimeCopy(meta.locale),
      slides: Object.freeze(createSlideSlots(text).map(createSlide))
    });
  }

  function clampIndex(count, index) {
    const safeCount = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);
    if (safeCount <= 0) {
      return 0;
    }
    const numericIndex = Number.isFinite(index) ? Math.floor(index) : 0;
    return Math.min(Math.max(0, numericIndex), safeCount - 1);
  }

  function getDirection(previousIndex, nextIndex) {
    if (nextIndex > previousIndex) {
      return 'forward';
    }
    if (nextIndex < previousIndex) {
      return 'back';
    }
    return 'none';
  }

  function createOnboardingState(count, initialIndex) {
    const safeCount = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);
    const index = clampIndex(safeCount, initialIndex);
    return {
      index,
      previousIndex: index,
      direction: 'none',
      count: safeCount
    };
  }

  function reduceOnboardingState(state, event) {
    const current = state || createOnboardingState(0, 0);
    const count = Math.max(0, Number.isFinite(current.count) ? Math.floor(current.count) : 0);
    const currentIndex = clampIndex(count, current.index);
    const type = event && event.type ? String(event.type) : '';
    let nextIndex = currentIndex;

    if (type === 'NEXT') {
      nextIndex = clampIndex(count, currentIndex + 1);
    } else if (type === 'PREV') {
      nextIndex = clampIndex(count, currentIndex - 1);
    } else if (type === 'GOTO') {
      nextIndex = clampIndex(count, event.index);
    } else if (type === 'HOME') {
      nextIndex = 0;
    } else if (type === 'END') {
      nextIndex = clampIndex(count, count - 1);
    }

    return {
      index: nextIndex,
      previousIndex: currentIndex,
      direction: getDirection(currentIndex, nextIndex),
      count
    };
  }

  function getSlideByIndex(blueprint, index) {
    const slides = blueprint && Array.isArray(blueprint.slides) ? blueprint.slides : [];
    return slides[clampIndex(slides.length, index)] || null;
  }

  return Object.freeze({
    normalizeLocale,
    getShortcutDisplayTokens,
    formatShortcutForDisplay,
    parseShortcutHotkey,
    shortcutHotkeyMatchesEvent,
    getSupportedLocales,
    getOnboardingRuntimeCopy,
    getOnboardingBlueprint,
    getOnboardingContent: getOnboardingBlueprint,
    createOnboardingState,
    reduceOnboardingState,
    getSlideByIndex
  });
});
