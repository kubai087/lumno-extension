
function isRestrictedUrl(url) {
  if (!url) {
    return true;
  }
  const lower = String(url).toLowerCase();
  return lower.startsWith('chrome://') ||
    lower.startsWith('chrome-extension://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('brave://') ||
    lower.startsWith('vivaldi://') ||
    lower.startsWith('opera://') ||
    lower.startsWith('about:');
}

function openNewtabFallback() {
  const newtabUrl = chrome.runtime.getURL('newtab.html');
  chrome.tabs.create({ url: newtabUrl });
}

chrome.commands.onCommand.addListener(function(command) {
  if (command === "show-search") {
    // Get all tabs in the current window
    chrome.tabs.query({currentWindow: true}, function(tabs) {
      // Get the current active tab and inject the script with tabs data
      chrome.tabs.query({active: true, currentWindow: true}, function(activeTabs) {
        const activeTab = activeTabs[0];
        if (activeTab && isRestrictedUrl(activeTab.url)) {
          openNewtabFallback();
          return;
        }
        if (activeTab) {
          chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            files: ['input-ui.js']
          }, function() {
            chrome.scripting.executeScript({
              target: {tabId: activeTab.id},
              function: toggleBlackRectangle,
              args: [tabs]
            });
          });
        }
      });
    });
  }
});

// Listen for messages from content script to switch tabs
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'switchToTab') {
    chrome.tabs.update(request.tabId, {active: true});
  } else if (request.action === 'searchOrNavigate') {
    const query = request.query ? String(request.query) : '';
    loadShortcutRules().then((rules) => {
      const shortcutUrl = getShortcutUrl(query, rules);
      if (shortcutUrl) {
        chrome.tabs.create({ url: shortcutUrl });
        sendResponse({ ok: true, url: shortcutUrl });
        return;
      }
      // Check if it's a URL - very simple and reliable
      const isUrl = query.includes('.') && !query.includes(' ');
      if (isUrl) {
        // It's a URL - navigate directly
        let url = query;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        chrome.tabs.create({ url: url });
        sendResponse({ ok: true, url: url });
      } else {
        // It's a search query - search Google
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        chrome.tabs.create({ url: searchUrl });
        sendResponse({ ok: true, url: searchUrl });
      }
    });
    return true;
  } else if (request.action === 'getSearchSuggestions') {
    const query = request.query;
    getSearchSuggestions(query).then(suggestions => {
      sendResponse({ suggestions: suggestions });
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'getTabsForOverlay') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sendResponse({ tabs: tabs });
    });
    return true;
  } else if (request.action === 'getSiteSearchProviders') {
    loadSiteSearchProviders().then((items) => {
      sendResponse({ items: items });
    });
    return true;
  } else if (request.action === 'getShortcutRules') {
    loadShortcutRules().then((items) => {
      sendResponse({ items: items });
    });
    return true;
  } else if (request.action === 'openOptionsPage') {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    sendResponse({ ok: true });
    return;
  } else if (request.action === 'createTab') {
    chrome.tabs.create({ url: request.url });
  }
});

let shortcutRulesCache = null;
let shortcutRulesPromise = null;
let siteSearchCache = null;
let siteSearchPromise = null;

function normalizeSiteSearchTemplate(template) {
  if (!template) {
    return '';
  }
  return template
    .replace(/\{\{\{s\}\}\}/g, '{query}')
    .replace(/\{s\}/g, '{query}')
    .replace(/\{searchTerms\}/g, '{query}');
}

function getTemplateDomain(template) {
  if (!template) {
    return '';
  }
  try {
    const url = template.replace(/\{query\}/g, 'test');
    return new URL(url).hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

function mergeSiteSearchProviders(localItems, bangList) {
  if (!Array.isArray(localItems) || localItems.length === 0) {
    return [];
  }
  if (!Array.isArray(bangList) || bangList.length === 0) {
    return localItems;
  }
  return localItems.map((item) => {
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    const keys = [item.key, ...aliases].filter(Boolean).map((key) => String(key).toLowerCase());
    const domain = getTemplateDomain(item.template);
    let match = bangList.find((bang) => bang && keys.includes(String(bang.t || '').toLowerCase()));
    if (!match && domain) {
      match = bangList.find((bang) => bang && String(bang.d || '').toLowerCase().includes(domain));
    }
    if (!match || !match.u) {
      return item;
    }
    return {
      key: item.key,
      aliases: item.aliases || [],
      name: item.name || match.s || item.key,
      template: normalizeSiteSearchTemplate(match.u)
    };
  });
}

function parseBangList(text) {
  if (!text) {
    return [];
  }
  let jsonText = text.trim();
  if (jsonText.startsWith('/*')) {
    jsonText = jsonText.replace(/^\/\*.*?\*\/\s*/s, '');
  }
  if (!jsonText.startsWith('[')) {
    return [];
  }
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadSiteSearchProviders() {
  if (siteSearchCache) {
    return Promise.resolve(siteSearchCache);
  }
  if (siteSearchPromise) {
    return siteSearchPromise;
  }
  const localUrl = chrome.runtime.getURL('site-search.json');
  siteSearchPromise = fetch(localUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      return items;
    })
    .catch(() => []);
  siteSearchPromise = siteSearchPromise.then((localItems) => {
    const remoteUrl = 'https://duckduckgo.com/bang.v260.js';
    return fetch(remoteUrl)
      .then((response) => response.text())
      .then((text) => parseBangList(text))
      .then((bangList) => mergeSiteSearchProviders(localItems, bangList))
      .catch(() => localItems);
  }).then((items) => {
    siteSearchCache = items;
    return items;
  });
  return siteSearchPromise;
}

function loadShortcutRules() {
  if (shortcutRulesCache) {
    return Promise.resolve(shortcutRulesCache);
  }
  if (shortcutRulesPromise) {
    return shortcutRulesPromise;
  }
  const rulesUrl = chrome.runtime.getURL('shortcut-rules.json');
  shortcutRulesPromise = fetch(rulesUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      shortcutRulesCache = items;
      return items;
    })
    .catch(() => []);
  return shortcutRulesPromise;
}

function getBrowserInternalScheme() {
  const ua = navigator.userAgent || '';
  if (ua.includes('Edg/')) {
    return 'edge://';
  }
  if (ua.includes('Brave')) {
    return 'brave://';
  }
  if (ua.includes('Vivaldi')) {
    return 'vivaldi://';
  }
  if (ua.includes('OPR/') || ua.includes('Opera')) {
    return 'opera://';
  }
  return 'chrome://';
}

function getShortcutUrl(query, rules) {
  if (!query || !Array.isArray(rules)) {
    return null;
  }
  const queryLower = query.toLowerCase();
  const scheme = getBrowserInternalScheme();
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (!rule || !Array.isArray(rule.keys)) {
      continue;
    }
    const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
    if (!isMatch) {
      continue;
    }
    if (rule.type === 'browserPage' && rule.path) {
      return `${scheme}${rule.path}`;
    }
    if (rule.type === 'url' && rule.url) {
      return rule.url;
    }
  }
  return null;
}

// Function to get search suggestions from history and top sites
async function getSearchSuggestions(query) {
  const suggestions = [];
  
  try {
    // Get Google suggestion keywords
    const googleSuggestions = await new Promise((resolve) => {
      fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data) => {
          if (Array.isArray(data) && Array.isArray(data[1])) {
            resolve(data[1].slice(0, 5));
          } else {
            resolve([]);
          }
        })
        .catch(() => resolve([]));
    });

    googleSuggestions.forEach((suggestion) => {
      if (suggestion && suggestion !== query) {
        suggestions.push({
          type: 'googleSuggest',
          title: suggestion,
          url: `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`,
          favicon: 'https://www.google.com/favicon.ico',
          score: 200
        });
      }
    });

    // Get history items with broader search
    const historyItems = await new Promise((resolve) => {
      chrome.history.search({
        text: query,
        maxResults: 50, // Increased to get more candidates
        startTime: Date.now() - (30 * 24 * 60 * 60 * 1000) // Last 30 days
      }, resolve);
    });
    
    // Get top sites
    const topSites = await new Promise((resolve) => {
      chrome.topSites.get(resolve);
    });
    
    // Get bookmarks
    const bookmarks = await new Promise((resolve) => {
      chrome.bookmarks.search({ query: query }, resolve);
    });

    const bookmarkTree = await new Promise((resolve) => {
      chrome.bookmarks.getTree(resolve);
    });

    const bookmarkNodeMap = new Map();
    function indexBookmarkNodes(node, parentId) {
      if (!node || !node.id) {
        return;
      }
      bookmarkNodeMap.set(node.id, {
        title: node.title || '',
        parentId: parentId || null,
        hasUrl: Boolean(node.url)
      });
      if (Array.isArray(node.children)) {
        node.children.forEach((child) => indexBookmarkNodes(child, node.id));
      }
    }
    if (Array.isArray(bookmarkTree)) {
      bookmarkTree.forEach((node) => indexBookmarkNodes(node, null));
    }
    
    // Helper function to calculate relevance score
    function calculateRelevanceScore(item, query) {
      const queryLower = query.toLowerCase();
      const titleLower = item.title ? item.title.toLowerCase() : '';
      const urlLower = item.url.toLowerCase();
      
      let score = 0;
      
      // Exact title match (highest priority)
      if (titleLower === queryLower) score += 100;
      
      // Title starts with query
      if (titleLower.startsWith(queryLower)) score += 50;
      
      // Query words in title
      const queryWords = queryLower.split(' ').filter(word => word.length > 0);
      queryWords.forEach(word => {
        if (titleLower.includes(word)) score += 20;
      });
      
      // Partial title match
      if (titleLower.includes(queryLower)) score += 15;
      
      // URL domain match
      try {
        const domain = new URL(item.url).hostname.toLowerCase();
        if (domain.includes(queryLower)) score += 10;
        if (domain.startsWith(queryLower)) score += 20;
      } catch (e) {
        // Invalid URL, skip domain scoring
      }
      
      // URL path match
      if (urlLower.includes(queryLower)) score += 5;
      
      // Recency bonus (for history items)
      if (item.lastVisitTime) {
        const daysSinceVisit = (Date.now() - item.lastVisitTime) / (1000 * 60 * 60 * 24);
        if (daysSinceVisit < 1) score += 10;
        else if (daysSinceVisit < 7) score += 5;
        else if (daysSinceVisit < 30) score += 2;
      }
      
      return score;
    }
    
    function isSearchEngineResultUrl(url) {
      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        const path = parsedUrl.pathname.toLowerCase();
        const searchHosts = [
          'google.',
          'bing.com',
          'baidu.com',
          'duckduckgo.com',
          'search.yahoo.com',
          'yandex.com',
          'sogou.com',
          'so.com'
        ];
        const isKnownHost = searchHosts.some((host) => hostname.includes(host));
        if (!isKnownHost) {
          return false;
        }
        const searchPaths = [
          '/search',
          '/s',
          '/s/2',
          '/web',
          '/?'
        ];
        if (path === '/' && parsedUrl.searchParams.has('q')) {
          return true;
        }
        if (path === '/' && parsedUrl.searchParams.has('wd')) {
          return true;
        }
        if (path === '/' && parsedUrl.searchParams.has('query')) {
          return true;
        }
        if (searchPaths.some((prefix) => path.startsWith(prefix))) {
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    }

    // Process history items with scoring
    const processedUrls = new Set();
    const suggestionByUrl = new Map();
    historyItems.forEach(item => {
      if (isSearchEngineResultUrl(item.url)) {
        return;
      }
      if (item.title && !processedUrls.has(item.url)) {
        const score = calculateRelevanceScore(item, query);
        if (score > 0) {
          // Get favicon URL using Google's favicon service (more reliable)
        let faviconUrl = '';
        try {
          const urlObj = new URL(item.url);
          faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
        } catch (e) {
          // Fallback to direct favicon URL
          faviconUrl = item.url + '/favicon.ico';
        }
        
          const suggestion = {
            type: 'history',
            title: item.title,
            url: item.url,
            favicon: faviconUrl,
            score: score,
            lastVisitTime: item.lastVisitTime || 0
          };
          suggestions.push(suggestion);
          processedUrls.add(item.url);
          suggestionByUrl.set(item.url, suggestion);
        }
      }
    });
    
    // Process top sites with scoring
    const fallbackTopSites = [];
    topSites.forEach(site => {
      if (!site || !site.url || processedUrls.has(site.url)) {
        if (site && site.url) {
          const existing = suggestionByUrl.get(site.url);
          if (existing) {
            existing.isTopSite = true;
            existing.score = (existing.score || 0) + 10;
          }
        }
        return;
      }
      const score = calculateRelevanceScore(site, query);
      let adjustedScore = score;
      if (score > 0) {
        adjustedScore += 20; // Boost top sites so they surface earlier
        const queryLower = query.toLowerCase();
        const titleLower = site.title ? site.title.toLowerCase() : '';
        try {
          const hostname = new URL(site.url).hostname.toLowerCase();
          if (hostname.startsWith(queryLower)) {
            adjustedScore += 15;
          }
        } catch (e) {
          // Ignore invalid URLs
        }
        if (titleLower.startsWith(queryLower)) {
          adjustedScore += 10;
        }
      }
      if (score > 0) {
        let faviconUrl = '';
        try {
          const urlObj = new URL(site.url);
          faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
        } catch (e) {
          faviconUrl = site.url + '/favicon.ico';
        }
        
        const suggestion = {
          type: 'topSite',
          title: site.title || site.url,
          url: site.url,
          favicon: faviconUrl,
          score: adjustedScore
        };
        suggestions.push(suggestion);
        processedUrls.add(site.url);
        suggestionByUrl.set(site.url, suggestion);
      } else {
        fallbackTopSites.push(site);
      }
    });
    
    // Process bookmarks with scoring
    bookmarks.forEach(bookmark => {
      if (bookmark.url && !processedUrls.has(bookmark.url)) {
        const score = calculateRelevanceScore(bookmark, query);
        // Boost bookmark score slightly to prioritize them
        if (score > 0) {
          const adjustedScore = score + 5; // Bonus for bookmarks
          
          // Get favicon URL using Google's favicon service
          let faviconUrl = '';
          try {
            const urlObj = new URL(bookmark.url);
            faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
          } catch (e) {
            // Fallback to direct favicon URL
            faviconUrl = bookmark.url + '/favicon.ico';
          }
          
          const pathParts = [];
          let parentId = bookmark.id;
          if (bookmark.parentId) {
            parentId = bookmark.parentId;
          }
          const rootFolderTitles = new Set([
            'Bookmarks bar',
            'Other bookmarks',
            'Mobile bookmarks',
            '书签栏',
            '其他书签',
            '移动设备书签'
          ]);
          while (parentId) {
            const node = bookmarkNodeMap.get(parentId);
            if (!node) {
              break;
            }
            const isRootFolder = !node.parentId && rootFolderTitles.has(node.title);
            if (!node.hasUrl && node.title && !isRootFolder) {
              pathParts.unshift(node.title);
            }
            parentId = node.parentId;
          }
          const bookmarkPath = pathParts.join('/');

          const suggestion = {
            type: 'bookmark',
            title: bookmark.title || bookmark.url,
            url: bookmark.url,
            favicon: faviconUrl,
            path: bookmarkPath,
            score: adjustedScore
          };
          suggestions.push(suggestion);
          processedUrls.add(bookmark.url);
          suggestionByUrl.set(bookmark.url, suggestion);
        }
      }
    });
    
    // Sort by top site, then recency, then relevance
    suggestions.sort((a, b) => {
      const aTop = a.isTopSite || a.type === 'topSite';
      const bTop = b.isTopSite || b.type === 'topSite';
      if (aTop !== bTop) {
        return aTop ? -1 : 1;
      }
      const aVisit = a.lastVisitTime || 0;
      const bVisit = b.lastVisitTime || 0;
      if (aVisit !== bVisit) {
        return bVisit - aVisit;
      }
      return (b.score || 0) - (a.score || 0);
    });
    
    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.url === suggestion.url)
    ).slice(0, 12); // Increased limit before title deduplication
    
    // Also remove duplicates by title to avoid similar entries
    let finalSuggestions = uniqueSuggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.title.toLowerCase() === suggestion.title.toLowerCase())
    );

    const hostCounts = new Map();
    finalSuggestions = finalSuggestions.filter((suggestion) => {
      if (!suggestion.url) {
        return true;
      }
      let hostname = '';
      try {
        hostname = new URL(suggestion.url).hostname.toLowerCase();
      } catch (e) {
        return true;
      }
      const current = hostCounts.get(hostname) || 0;
      if (current >= 2) {
        return false;
      }
      hostCounts.set(hostname, current + 1);
      return true;
    }).slice(0, 8);

    if (finalSuggestions.length === 0 && fallbackTopSites.length > 0) {
      const fallbackResults = fallbackTopSites.slice(0, 3).map((site, index) => {
        let faviconUrl = '';
        try {
          const urlObj = new URL(site.url);
          faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
        } catch (e) {
          faviconUrl = site.url + '/favicon.ico';
        }
        return {
          type: 'topSite',
          title: site.title || site.url,
          url: site.url,
          favicon: faviconUrl,
          score: 1 - index
        };
      });
      finalSuggestions = fallbackResults;
    }
    
    console.log('Search suggestions:', finalSuggestions);
    return finalSuggestions;
    
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

function toggleBlackRectangle(tabs) {
  let captureTabHandler = null;
  let overlayThemeStorageListener = null;
  let overlayThemeMediaListener = null;
  let keydownHandler = null;
  let clickOutsideHandler = null;
  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  // Helper function to remove overlay and clean up styles
  function removeOverlay(overlayElement) {
    if (overlayElement) {
      overlayElement.remove();
    }
    // Also remove the scrollbar style
    const scrollbarStyle = document.getElementById('_x_extension_scrollbar_style_2024_unique_');
    if (scrollbarStyle) {
      scrollbarStyle.remove();
    }
    const overlayThemeStyle = document.getElementById('_x_extension_overlay_theme_style_2024_unique_');
    if (overlayThemeStyle) {
      overlayThemeStyle.remove();
    }
    if (captureTabHandler) {
      document.removeEventListener('keydown', captureTabHandler, true);
      captureTabHandler = null;
    }
    if (overlayThemeStorageListener) {
      chrome.storage.onChanged.removeListener(overlayThemeStorageListener);
      overlayThemeStorageListener = null;
    }
    if (overlayThemeMediaListener) {
      overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
      overlayThemeMediaListener = null;
    }
    window.removeEventListener('resize', updateSiteSearchPrefixLayout);
  }
  
  // Check if the overlay already exists
  let overlay = document.getElementById('_x_extension_overlay_2024_unique_');
  
  if (overlay) {
    // If it exists, remove it (toggle off)
    removeOverlay(overlay);
  } else {
    // If it doesn't exist, create it (toggle on)
    overlay = document.createElement('div');
    overlay.id = '_x_extension_overlay_2024_unique_';
    overlay.style.cssText = `
      all: unset !important;
      position: fixed !important;
      top: 20vh !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 50vw !important;
      max-width: 90vw !important;
      max-height: 75vh !important;
      background: var(--x-ov-bg, rgba(255, 255, 255, 0.82)) !important;
      backdrop-filter: blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%)) !important;
      -webkit-backdrop-filter: blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%)) !important;
      border: 1px solid var(--x-ov-border, rgba(0, 0, 0, 0.08)) !important;
      border-radius: 28px !important;
      box-shadow: var(--x-ov-shadow, 0 17px 120px 0 rgba(0, 0, 0, 0.05), 0 32px 44.5px 0 rgba(0, 0, 0, 0.10), 0 80px 120px 0 rgba(0, 0, 0, 0.15)) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      color: var(--x-ov-text, #111827) !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;

    const applyOverlayTheme = (mode) => {
      overlayThemeMode = mode;
      applyOverlayThemeVariables(overlay, mode);
      suggestionItems.forEach((item) => {
        if (item && item._xTheme) {
          applyThemeVariables(item, item._xTheme);
        }
      });
      updateSelection();
      if (mode === 'system' && !overlayThemeListenerAttached) {
        overlayThemeMediaListener = function() {
          if (overlayThemeMode === 'system') {
            applyOverlayThemeVariables(overlay, overlayThemeMode);
          }
        };
        overlayMediaQuery.addEventListener('change', overlayThemeMediaListener);
        overlayThemeListenerAttached = true;
        return;
      }
      if (mode !== 'system' && overlayThemeListenerAttached) {
        overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
        overlayThemeMediaListener = null;
        overlayThemeListenerAttached = false;
      }
    };

    chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
      applyOverlayTheme(result[THEME_STORAGE_KEY] || 'system');
    });
    overlayThemeStorageListener = (changes, areaName) => {
      if (areaName !== 'local' || !changes[THEME_STORAGE_KEY]) {
        return;
      }
      applyOverlayTheme(changes[THEME_STORAGE_KEY].newValue || 'system');
    };
    chrome.storage.onChanged.addListener(overlayThemeStorageListener);
    
    // Add Inter font with unique ID
    const fontLink = document.createElement('link');
    fontLink.id = '_x_extension_font_2024_unique_';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
    
    // Add style to hide scrollbars for WebKit browsers
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.id = '_x_extension_scrollbar_style_2024_unique_';
    scrollbarStyle.textContent = `
      #_x_extension_overlay_2024_unique_ *::-webkit-scrollbar {
        display: none !important;
      }
      #_x_extension_overlay_2024_unique_ * {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
    `;
    document.head.appendChild(scrollbarStyle);

    const overlayThemeStyle = document.createElement('style');
    overlayThemeStyle.id = '_x_extension_overlay_theme_style_2024_unique_';
    overlayThemeStyle.textContent = `
      #_x_extension_search_input_2024_unique_::placeholder {
        color: var(--x-ov-placeholder, #9CA3AF) !important;
      }
    `;
    document.head.appendChild(overlayThemeStyle);
    
    if (typeof window._x_extension_createSearchInput_2024_unique_ !== 'function') {
      console.warn('Lumno: input UI helper not available.');
      removeOverlay(overlay);
      return;
    }

    const inputParts = window._x_extension_createSearchInput_2024_unique_({
      placeholder: '搜索或输入网址...',
      inputId: '_x_extension_search_input_2024_unique_',
      iconId: '_x_extension_search_icon_2024_unique_',
      containerId: '_x_extension_input_container_2024_unique_',
      rightIconUrl: chrome.runtime.getURL('lumno-input-light.png'),
      rightIconStyleOverrides: {
        cursor: 'pointer'
      },
      showUnderlineWhenEmpty: true
    });
    const searchInput = inputParts.input;
    const inputContainer = inputParts.container;
    const rightIcon = inputParts.rightIcon;

    const extensionName = (chrome.runtime.getManifest && chrome.runtime.getManifest().name) || 'Lumno';

    function getThemeModeLabel(mode) {
      if (mode === 'dark') {
        return '深色';
      }
      if (mode === 'light') {
        return '浅色';
      }
      return '跟随系统';
    }

    function getNextThemeMode(mode) {
      const order = ['system', 'light', 'dark'];
      const index = order.indexOf(mode);
      if (index === -1) {
        return 'light';
      }
      return order[(index + 1) % order.length];
    }

    function isModeCommand(input) {
      const raw = String(input || '').trim().toLowerCase();
      return raw === '/mode' || raw.startsWith('/mode ');
    }

    function buildModeSuggestion() {
      const nextMode = getNextThemeMode(overlayThemeMode || 'system');
      return {
        type: 'modeSwitch',
        title: `${extensionName}：切换到${getThemeModeLabel(nextMode)}模式`,
        url: '',
        favicon: chrome.runtime.getURL('lumno.png'),
        nextMode: nextMode
      };
    }

    function applyThemeModeChange(mode) {
      const nextMode = mode || 'system';
      chrome.storage.local.set({ [THEME_STORAGE_KEY]: nextMode });
      applyOverlayTheme(nextMode);
      if (isModeCommand(searchInput.value || '')) {
        updateSearchSuggestions([], (searchInput.value || '').trim());
      }
    }

    if (rightIcon) {
      rightIcon.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        removeOverlay(overlay);
        if (clickOutsideHandler) {
          document.removeEventListener('click', clickOutsideHandler);
        }
        if (keydownHandler) {
          document.removeEventListener('keydown', keydownHandler);
        }
        if (captureTabHandler) {
          document.removeEventListener('keydown', captureTabHandler, true);
        }
      });
    }

    // Add focus styles
    searchInput.addEventListener('focus', function() {
      selectedIndex = -1;
      updateSelection();
    });
    
    searchInput.addEventListener('blur', function() {
      // Don't change selectedIndex here to allow keyboard navigation
    });
    
    let latestOverlayQuery = '';
    let latestRawInputValue = '';
    let autocompleteState = null;
    let inlineSearchState = null;
    let siteSearchTriggerState = null;
    let isComposing = false;
    let siteSearchState = null;
    const defaultPlaceholder = searchInput.placeholder;
    let siteSearchProvidersCache = null;
    const defaultSiteSearchProviders = [
      { key: 'yt', aliases: ['youtube'], name: 'YouTube', template: 'https://www.youtube.com/results?search_query={query}' },
      { key: 'bb', aliases: ['bilibili', 'bili'], name: 'Bilibili', template: 'https://search.bilibili.com/all?keyword={query}' },
      { key: 'gh', aliases: ['github'], name: 'GitHub', template: 'https://github.com/search?q={query}' },
      { key: 'so', aliases: ['baidu', 'bd'], name: '百度', template: 'https://www.baidu.com/s?wd={query}' },
      { key: 'bi', aliases: ['bing'], name: 'Bing', template: 'https://www.bing.com/search?q={query}' },
      { key: 'gg', aliases: ['google'], name: 'Google', template: 'https://www.google.com/search?q={query}' },
      { key: 'zh', aliases: ['zhihu'], name: '知乎', template: 'https://www.zhihu.com/search?q={query}' },
      { key: 'db', aliases: ['douban'], name: '豆瓣', template: 'https://www.douban.com/search?q={query}' },
      { key: 'jd', aliases: ['juejin'], name: '掘金', template: 'https://juejin.cn/search?query={query}' },
      { key: 'tb', aliases: ['taobao'], name: '淘宝', template: 'https://s.taobao.com/search?q={query}' },
      { key: 'tm', aliases: ['tmall'], name: '天猫', template: 'https://list.tmall.com/search_product.htm?q={query}' },
      { key: 'wx', aliases: ['weixin', 'wechat'], name: '微信', template: 'https://weixin.sogou.com/weixin?query={query}' },
      { key: 'tw', aliases: ['twitter', 'x'], name: 'X', template: 'https://x.com/search?q={query}' },
      { key: 'rd', aliases: ['reddit'], name: 'Reddit', template: 'https://www.reddit.com/search/?q={query}' },
      { key: 'wk', aliases: ['wiki', 'wikipedia'], name: 'Wikipedia', template: 'https://en.wikipedia.org/wiki/Special:Search?search={query}' },
      { key: 'zw', aliases: ['zhwiki'], name: '维基百科', template: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}' }
    ];
    const defaultAccentColor = [59, 130, 246];
    const themeColorCache = new Map();
    const defaultCaretColor = searchInput.style.caretColor || '#7DB7FF';
    let baseInputPaddingLeft = null;
    const prefixGap = 6;

    function mixColor(color, target, amount) {
      return [
        Math.round(color[0] + (target[0] - color[0]) * amount),
        Math.round(color[1] + (target[1] - color[1]) * amount),
        Math.round(color[2] + (target[2] - color[2]) * amount)
      ];
    }

    function rgbToCss(rgb) {
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }

    function parseCssColor(color) {
      if (!color || typeof color !== 'string') {
        return null;
      }
      const trimmed = color.trim().toLowerCase();
      if (trimmed.startsWith('#')) {
        const hex = trimmed.slice(1);
        if (hex.length === 3) {
          const r = parseInt(hex[0] + hex[0], 16);
          const g = parseInt(hex[1] + hex[1], 16);
          const b = parseInt(hex[2] + hex[2], 16);
          if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
            return [r, g, b];
          }
        }
        if (hex.length === 6) {
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
            return [r, g, b];
          }
        }
        return null;
      }
      const rgbMatch = trimmed.match(/^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/);
      if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);
        if ([r, g, b].every((value) => Number.isFinite(value))) {
          return [r, g, b];
        }
      }
      return null;
    }

    function getHighlightColors(theme) {
      const resolvedTheme = getThemeForMode(theme);
      if (!resolvedTheme || !resolvedTheme._xIsBrand) {
        return {
          bg: 'var(--x-ov-hover-bg, #F3F4F6)',
          border: 'transparent'
        };
      }
      return {
        bg: resolvedTheme.highlightBg,
        border: resolvedTheme.highlightBorder
      };
    }

    function getLuminance(rgb) {
      const [r, g, b] = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function getReadableTextColor(bgRgb) {
      if (!bgRgb || bgRgb.length !== 3) {
        return '#111827';
      }
      const darkText = [17, 24, 39];
      const lightText = [248, 250, 252];
      const bgLum = getLuminance(bgRgb);
      const darkLum = getLuminance(darkText);
      const lightLum = getLuminance(lightText);
      const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
      const contrastWithLight = (Math.max(bgLum, lightLum) + 0.05) / (Math.min(bgLum, lightLum) + 0.05);
      return contrastWithDark >= contrastWithLight ? '#111827' : '#F8FAFC';
    }

    function normalizeAccentColor(rgb) {
      if (!rgb || rgb.length !== 3) {
        return defaultAccentColor;
      }
      const luminance = getLuminance(rgb);
      if (luminance < 0.12) {
        return mixColor(rgb, [255, 255, 255], 0.55);
      }
      if (luminance > 0.9) {
        return mixColor(rgb, [0, 0, 0], 0.2);
      }
      return rgb;
    }

    function buildThemeVariant(accent, mode) {
      const isDark = mode === 'dark';
      const base = isDark ? [48, 48, 48] : [255, 255, 255];
      const highlightBg = mixColor(accent, base, isDark ? 0.82 : 0.86);
      const highlightBorder = mixColor(accent, base, isDark ? 0.66 : 0.62);
      const markBg = mixColor(accent, base, isDark ? 0.74 : 0.78);
      const tagBg = mixColor(accent, base, isDark ? 0.76 : 0.74);
      const keyBg = mixColor(accent, base, isDark ? 0.88 : 0.9);
      const tagBorder = mixColor(accent, base, isDark ? 0.62 : 0.58);
      const keyBorder = mixColor(accent, base, isDark ? 0.7 : 0.18);
      const buttonBg = mixColor(accent, base, isDark ? 0.8 : 0.94);
      const buttonBorder = mixColor(accent, base, isDark ? 0.68 : 0.7);
      const buttonText = isDark
        ? getReadableTextColor(buttonBg)
        : (getLuminance(accent) > 0.8
          ? rgbToCss(mixColor(accent, [0, 0, 0], 0.6))
          : rgbToCss(accent));
      const placeholderText = isDark
        ? rgbToCss(mixColor(accent, [255, 255, 255], 0.2))
        : buttonText;
      return {
        accent: rgbToCss(accent),
        accentRgb: accent,
        highlightBg: rgbToCss(highlightBg),
        highlightBorder: rgbToCss(highlightBorder),
        markBg: rgbToCss(markBg),
        markText: getReadableTextColor(markBg),
        tagBg: rgbToCss(tagBg),
        tagText: getReadableTextColor(tagBg),
        tagBorder: rgbToCss(tagBorder),
        keyBg: rgbToCss(keyBg),
        keyText: getReadableTextColor(keyBg),
        keyBorder: rgbToCss(keyBorder),
        buttonText: buttonText,
        buttonBg: rgbToCss(buttonBg),
        buttonBorder: rgbToCss(buttonBorder),
        placeholderText: placeholderText
      };
    }

    function buildTheme(rgb) {
      const accent = normalizeAccentColor(rgb);
      return buildThemeVariant(accent, 'light');
    }

    const defaultTheme = buildTheme(defaultAccentColor);
    defaultTheme._xIsDefault = true;
    const overlayThemeTokens = {
      light: {
        bg: 'rgba(255, 255, 255, 0.99)',
        border: 'rgba(0, 0, 0, 0.08)',
        shadow: '0 17px 120px 0 rgba(0, 0, 0, 0.05), 0 32px 44.5px 0 rgba(0, 0, 0, 0.10), 0 80px 120px 0 rgba(0, 0, 0, 0.15)',
        text: '#111827',
        subtext: '#6B7280',
        link: '#2563EB',
        placeholder: '#9CA3AF',
        hoverBg: '#F9FAFB',
        tagBg: '#F3F4F6',
        tagText: '#6B7280',
        bookmarkTagBg: '#FEF3C7',
        bookmarkTagText: '#D97706',
        underline: '#E5E7EB',
        blur: '4px',
        saturate: '165%'
      },
      dark: {
        bg: 'rgba(20, 20, 20, 0.62)',
        border: 'rgba(255, 255, 255, 0.08)',
        shadow: '0 24px 90px rgba(0, 0, 0, 0.65)',
        text: '#E5E7EB',
        subtext: '#9CA3AF',
        link: '#D1D5DB',
        placeholder: '#9CA3AF',
        hoverBg: 'rgba(255, 255, 255, 0.08)',
        tagBg: 'rgba(255, 255, 255, 0.12)',
        tagText: '#E5E7EB',
        bookmarkTagBg: 'rgba(245, 158, 11, 0.22)',
        bookmarkTagText: '#FBBF24',
        underline: 'rgba(255, 255, 255, 0.18)',
        blur: '40px',
        saturate: '145%'
      }
    };
    const overlayMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    let overlayThemeMode = 'system';
    let overlayThemeListenerAttached = false;

    function resolveOverlayTheme(mode) {
      if (mode === 'dark') {
        return 'dark';
      }
      if (mode === 'light') {
        return 'light';
      }
      return overlayMediaQuery.matches ? 'dark' : 'light';
    }

    function applyOverlayThemeVariables(target, mode) {
      if (!target) {
        return;
      }
      const resolved = resolveOverlayTheme(mode);
      const tokens = overlayThemeTokens[resolved] || overlayThemeTokens.light;
      target.setAttribute('data-theme', resolved);
      target.style.setProperty('--x-ov-bg', tokens.bg, 'important');
      target.style.setProperty('--x-ov-border', tokens.border, 'important');
      target.style.setProperty('--x-ov-shadow', tokens.shadow, 'important');
      target.style.setProperty('--x-ov-text', tokens.text, 'important');
      target.style.setProperty('--x-ov-subtext', tokens.subtext, 'important');
      target.style.setProperty('--x-ov-link', tokens.link, 'important');
      target.style.setProperty('--x-ov-placeholder', tokens.placeholder, 'important');
      target.style.setProperty('--x-ov-hover-bg', tokens.hoverBg, 'important');
      target.style.setProperty('--x-ov-tag-bg', tokens.tagBg, 'important');
      target.style.setProperty('--x-ov-tag-text', tokens.tagText, 'important');
      target.style.setProperty('--x-ov-bookmark-tag-bg', tokens.bookmarkTagBg, 'important');
      target.style.setProperty('--x-ov-bookmark-tag-text', tokens.bookmarkTagText, 'important');
      target.style.setProperty('--x-ov-blur', tokens.blur, 'important');
      target.style.setProperty('--x-ov-saturate', tokens.saturate, 'important');
      target.style.setProperty('--x-ext-input-text', tokens.text, 'important');
      target.style.setProperty('--x-ext-input-caret', tokens.link, 'important');
      target.style.setProperty('--x-ext-input-icon', tokens.subtext, 'important');
      target.style.setProperty('--x-ext-input-underline', tokens.underline, 'important');
    }

    function isOverlayDarkMode() {
      return overlay && overlay.getAttribute('data-theme') === 'dark';
    }

    function getThemeForMode(theme) {
      if (!theme) {
        return defaultTheme;
      }
      if (!isOverlayDarkMode()) {
        return theme;
      }
      if (theme._xDark) {
        return theme._xDark;
      }
      const accentRgb = theme.accentRgb || parseCssColor(theme.accent) || defaultAccentColor;
      const darkTheme = buildThemeVariant(accentRgb, 'dark');
      darkTheme._xIsDefault = Boolean(theme._xIsDefault);
      darkTheme._xIsBrand = Boolean(theme._xIsBrand);
      theme._xDark = darkTheme;
      return darkTheme;
    }

    function getHoverColors(theme) {
      const resolvedTheme = getThemeForMode(theme);
      const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
      const isDark = isOverlayDarkMode();
      const base = isDark ? [48, 48, 48] : [255, 255, 255];
      return {
        bg: rgbToCss(mixColor(accentRgb, base, isDark ? 0.6 : 0.9)),
        border: rgbToCss(mixColor(accentRgb, base, isDark ? 0.4 : 0.72))
      };
    }
    const brandAccentMap = {
      'github.com': [36, 41, 46],
      'docs.github.com': [36, 41, 46],
      'douban.com': [0, 181, 29],
      'zhihu.com': [23, 127, 255],
      'bilibili.com': [0, 174, 236],
      'youtube.com': [255, 0, 0],
      'youtu.be': [255, 0, 0],
      'google.com': [66, 133, 244],
      'bing.com': [0, 120, 215],
      'baidu.com': [41, 98, 255],
      'taobao.com': [255, 80, 0],
      'tmall.com': [226, 35, 26],
      'juejin.cn': [30, 128, 255],
      'reddit.com': [255, 69, 0],
      'wikipedia.org': [64, 64, 64],
      'zh.wikipedia.org': [64, 64, 64],
      'x.com': [17, 24, 39],
      'twitter.com': [29, 161, 242]
    };

    function getBrandAccentForHost(hostname) {
      const host = String(hostname || '').toLowerCase();
      if (!host) {
        return null;
      }
      if (brandAccentMap[host]) {
        return brandAccentMap[host];
      }
      const entry = Object.keys(brandAccentMap).find((key) => host === key || host.endsWith(`.${key}`));
      return entry ? brandAccentMap[entry] : null;
    }

    function getBrandAccentForUrl(url) {
      if (!url) {
        return null;
      }
      try {
        const hostname = new URL(url).hostname;
        return getBrandAccentForHost(hostname);
      } catch (e) {
        return null;
      }
    }

    function extractAverageColor(image) {
      const size = 16;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        return null;
      }
      try {
        context.drawImage(image, 0, 0, size, size);
        const data = context.getImageData(0, 0, size, size).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 32) {
            continue;
          }
          const red = data[i];
          const green = data[i + 1];
          const blue = data[i + 2];
          const brightness = (red + green + blue) / 3;
          if (brightness > 245) {
            continue;
          }
          r += red;
          g += green;
          b += blue;
          count += 1;
        }
        if (!count) {
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha < 32) {
              continue;
            }
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count += 1;
          }
        }
        if (!count) {
          return null;
        }
        return [
          Math.round(r / count),
          Math.round(g / count),
          Math.round(b / count)
        ];
      } catch (e) {
        return null;
      }
    }

    function getThemeFromUrl(url) {
      if (!url) {
        return Promise.resolve(defaultTheme);
      }
      if (themeColorCache.has(url)) {
        return Promise.resolve(themeColorCache.get(url));
      }
      const brandAccent = getBrandAccentForUrl(url);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        themeColorCache.set(url, brandTheme);
        return Promise.resolve(brandTheme);
      }
      return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = function() {
          const avg = extractAverageColor(image);
          if (!avg) {
            themeColorCache.set(url, defaultTheme);
            resolve(defaultTheme);
            return;
          }
          const theme = buildTheme(avg);
          themeColorCache.set(url, theme);
          resolve(theme);
        };
        image.onerror = function() {
          themeColorCache.set(url, defaultTheme);
          resolve(defaultTheme);
        };
        image.src = url;
      });
    }

    function getThemeForProvider(provider) {
      if (provider && provider.template) {
        const brandAccent = getBrandAccentForUrl(provider.template);
        if (brandAccent) {
          const brandTheme = buildTheme(brandAccent);
          brandTheme._xIsBrand = true;
          return Promise.resolve(brandTheme);
        }
      }
      return getThemeFromUrl(getProviderIcon(provider));
    }

    function getThemeForSuggestion(suggestion) {
      if (suggestion && suggestion.provider) {
        return getThemeForProvider(suggestion.provider);
      }
      if (suggestion && suggestion.url) {
        const brandAccent = getBrandAccentForUrl(suggestion.url);
        if (brandAccent) {
          const brandTheme = buildTheme(brandAccent);
          brandTheme._xIsBrand = true;
          return Promise.resolve(brandTheme);
        }
      }
      return getThemeFromUrl(getThemeSourceForSuggestion(suggestion));
    }

    function getImmediateThemeForSuggestion(suggestion) {
      if (suggestion && suggestion.provider) {
        const brandAccent = getBrandAccentForUrl(suggestion.provider.template);
        if (brandAccent) {
          const brandTheme = buildTheme(brandAccent);
          brandTheme._xIsBrand = true;
          return brandTheme;
        }
      }
      if (suggestion && suggestion.url) {
        const brandAccent = getBrandAccentForUrl(suggestion.url);
        if (brandAccent) {
          const brandTheme = buildTheme(brandAccent);
          brandTheme._xIsBrand = true;
          return brandTheme;
        }
      }
      return null;
    }

    function applyThemeVariables(target, theme) {
      if (!target || !theme) {
        return;
      }
      const resolvedTheme = getThemeForMode(theme);
      target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg, 'important');
      target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText, 'important');
      target.style.setProperty('--x-ext-tag-bg', resolvedTheme.tagBg, 'important');
      target.style.setProperty('--x-ext-tag-text', resolvedTheme.tagText, 'important');
      target.style.setProperty('--x-ext-tag-border', resolvedTheme.tagBorder, 'important');
      target.style.setProperty('--x-ext-key-bg', resolvedTheme.keyBg, 'important');
      target.style.setProperty('--x-ext-key-text', resolvedTheme.keyText, 'important');
      target.style.setProperty('--x-ext-key-border', resolvedTheme.keyBorder, 'important');
      target.style.setProperty('--x-ext-icon-color', resolvedTheme.accent, 'important');
    }

    function applyMarkVariables(target, theme) {
      if (!target || !theme) {
        return;
      }
      const resolvedTheme = getThemeForMode(theme);
      target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg, 'important');
      target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText, 'important');
    }

    function createActionTag(labelText, keyLabel) {
      const tag = document.createElement('span');
      tag.style.cssText = `
        all: unset !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        background: var(--x-ext-tag-bg, #EEF6FF) !important;
        color: var(--x-ext-tag-text, #1E3A8A) !important;
        border: 1px solid var(--x-ext-tag-border, #BFDBFE) !important;
        padding: 4px 10px 4px 8px !important;
        border-radius: 999px !important;
        font-size: 11px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        line-height: 1 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        box-sizing: border-box !important;
        vertical-align: middle !important;
        white-space: nowrap !important;
      `;

      const label = document.createElement('span');
      label.textContent = labelText;
      label.style.cssText = `
        all: unset !important;
        font-weight: 500 !important;
        line-height: 1 !important;
      `;

      const keycap = document.createElement('span');
      keycap.textContent = keyLabel;
      keycap.style.cssText = `
        all: unset !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 2px 7px !important;
        border-radius: 6px !important;
        background: var(--x-ext-key-bg, #FFFFFF) !important;
        color: var(--x-ext-key-text, #1E3A8A) !important;
        border: 1px solid var(--x-ext-key-border, #BFDBFE) !important;
        box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12) !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        line-height: 1 !important;
      `;

      tag.appendChild(label);
      tag.appendChild(keycap);
      return tag;
    }

    function getThemeSourceForSuggestion(suggestion) {
      if (suggestion && suggestion.url) {
        try {
          const hostname = new URL(suggestion.url).hostname;
          if (hostname) {
            return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
          }
        } catch (e) {
          // Ignore malformed URLs.
        }
      }
      return suggestion && suggestion.favicon ? suggestion.favicon : '';
    }

    const siteSearchPrefix = document.createElement('span');
    siteSearchPrefix.id = '_x_extension_site_search_prefix_2024_unique_';
    siteSearchPrefix.style.cssText = `
      all: unset !important;
      position: absolute !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      left: 50px !important;
      display: none !important;
      white-space: nowrap !important;
      font-size: 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      line-height: 1 !important;
      color: var(--x-ov-subtext, #6B7280) !important;
      pointer-events: none !important;
      z-index: 1 !important;
    `;
    inputContainer.appendChild(siteSearchPrefix);

    function getBaseInputPaddingLeft() {
      if (baseInputPaddingLeft === null) {
        const computed = parseFloat(window.getComputedStyle(searchInput).paddingLeft);
        baseInputPaddingLeft = Number.isFinite(computed) ? computed : 50;
      }
      return baseInputPaddingLeft;
    }

    function updateSiteSearchPrefixLayout() {
      const basePadding = getBaseInputPaddingLeft();
      siteSearchPrefix.style.setProperty('left', `${basePadding}px`, 'important');
      if (siteSearchPrefix.style.display === 'none') {
        searchInput.style.setProperty('padding-left', `${basePadding}px`, 'important');
        return;
      }
      const prefixWidth = siteSearchPrefix.getBoundingClientRect().width;
      const paddedLeft = Math.max(basePadding + prefixWidth + prefixGap, basePadding);
      searchInput.style.setProperty('padding-left', `${paddedLeft}px`, 'important');
    }

    function setSiteSearchPrefix(provider, theme) {
      const prefixText = `在 ${getSiteSearchDisplayName(provider)} 中搜索｜`;
      siteSearchPrefix.textContent = prefixText;
      siteSearchPrefix.style.setProperty('display', 'inline-flex', 'important');
      const resolvedTheme = theme ? getThemeForMode(theme) : null;
      if (resolvedTheme && resolvedTheme.placeholderText) {
        siteSearchPrefix.style.setProperty('color', resolvedTheme.placeholderText, 'important');
      }
      searchInput.placeholder = '';
      if (resolvedTheme && resolvedTheme.placeholderText) {
        searchInput.style.setProperty('caret-color', resolvedTheme.placeholderText, 'important');
      }
      updateSiteSearchPrefixLayout();
    }

    function clearSiteSearchPrefix() {
      siteSearchPrefix.textContent = '';
      siteSearchPrefix.style.setProperty('display', 'none', 'important');
      searchInput.placeholder = defaultPlaceholder;
      searchInput.style.setProperty('caret-color', defaultCaretColor, 'important');
      updateSiteSearchPrefixLayout();
    }

    window.addEventListener('resize', updateSiteSearchPrefixLayout);

    function isEnglishQuery(query) {
      if (!query) {
        return false;
      }
      if (!/[A-Za-z]/.test(query)) {
        return false;
      }
      return /^[A-Za-z0-9\s._/-]+$/.test(query);
    }

    function getUrlDisplay(url) {
      if (!url) {
        return '';
      }
      try {
        const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        return `${host}${path}${parsed.search || ''}${parsed.hash || ''}`;
      } catch (e) {
        return url;
      }
    }

    function getAutocompleteCandidate(allSuggestions, rawQuery) {
      if (!Array.isArray(allSuggestions) || !rawQuery) {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      const passes = [true, false];
      for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
        const skipGoogleSuggest = passes[passIndex];
        for (let i = 0; i < allSuggestions.length; i += 1) {
          const suggestion = allSuggestions[i];
          if (!suggestion || suggestion.type === 'newtab') {
            continue;
          }
          if (skipGoogleSuggest && suggestion.type === 'googleSuggest') {
            continue;
          }
          const urlText = getUrlDisplay(suggestion.url);
          if (urlText && urlText.toLowerCase().startsWith(rawLower)) {
            return {
              completion: urlText,
              url: suggestion.url || '',
              title: suggestion.title || '',
              type: 'url'
            };
          }
          const titleText = suggestion.title || '';
          if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
            return {
              completion: titleText,
              url: suggestion.url || '',
              title: suggestion.title || '',
              type: 'title'
            };
          }
        }
      }
      return null;
    }

    function getDomainPrefixCandidate(allSuggestions, rawQuery) {
      if (!Array.isArray(allSuggestions) || !rawQuery) {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      for (let i = 0; i < allSuggestions.length; i += 1) {
        const suggestion = allSuggestions[i];
        if (!suggestion || suggestion.type === 'newtab') {
          continue;
        }
        const urlText = getUrlDisplay(suggestion.url);
        if (!urlText) {
          continue;
        }
        const host = urlText.split('/')[0] || '';
        if (host.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
      }
      return null;
    }

    function clearAutocomplete() {
      autocompleteState = null;
    }

    function applyAutocomplete(allSuggestions) {
      const rawQuery = latestRawInputValue;
      const trimmedQuery = rawQuery.trim();
      if (siteSearchState) {
        clearAutocomplete();
        return;
      }
      if (!isEnglishQuery(trimmedQuery) || !rawQuery) {
        clearAutocomplete();
        return;
      }
      if (!allSuggestions || !Array.isArray(allSuggestions)) {
        clearAutocomplete();
        return;
      }
      if (searchInput.selectionStart !== searchInput.value.length || searchInput.selectionEnd !== searchInput.value.length) {
        return;
      }
      const candidate = getDomainPrefixCandidate(allSuggestions, rawQuery) ||
        getAutocompleteCandidate(allSuggestions, rawQuery);
      if (!candidate || !candidate.completion) {
        clearAutocomplete();
        return;
      }
      if (candidate.completion.length <= rawQuery.length) {
        clearAutocomplete();
        return;
      }
      if (!candidate.completion.toLowerCase().startsWith(rawQuery.toLowerCase())) {
        clearAutocomplete();
        return;
      }
      let displayText = candidate.completion;
      if (candidate.type === 'url' && candidate.title) {
        displayText = `${candidate.completion} - ${candidate.title}`;
      }
      searchInput.value = displayText;
      searchInput.setSelectionRange(rawQuery.length, displayText.length);
      autocompleteState = {
        completion: candidate.completion,
        displayText: displayText,
        url: candidate.url || '',
        rawQuery: rawQuery,
        title: candidate.title || '',
        type: candidate.type || ''
      };
    }

    function buildSearchUrl(template, query) {
      if (!template) {
        return '';
      }
      return template.replace(/\{query\}/g, encodeURIComponent(query));
    }

    function getProviderIcon(provider) {
      if (provider && provider.icon) {
        return provider.icon;
      }
      const template = provider && provider.template ? provider.template : '';
      try {
        const url = template.replace(/\{query\}/g, 'test');
        const hostname = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
      } catch (e) {
        return '';
      }
    }

    function getSiteSearchProviders() {
      if (siteSearchProvidersCache) {
        return Promise.resolve(siteSearchProvidersCache);
      }
      const localUrl = chrome.runtime.getURL('site-search.json');
      const localFallback = fetch(localUrl)
        .then((response) => response.json())
        .then((data) => {
          const items = data && Array.isArray(data.items) ? data.items : [];
          if (items.length > 0) {
            siteSearchProvidersCache = items;
          }
          return items;
        })
        .catch(() => []);
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getSiteSearchProviders' }, (response) => {
          const items = response && Array.isArray(response.items) ? response.items : [];
          if (items.length > 0) {
            siteSearchProvidersCache = items;
            resolve(items);
            return;
          }
          localFallback.then((localItems) => {
            if (localItems.length > 0) {
              siteSearchProvidersCache = localItems;
              resolve(localItems);
              return;
            }
            siteSearchProvidersCache = defaultSiteSearchProviders;
            resolve(defaultSiteSearchProviders);
          });
        });
      });
    }

    getSiteSearchProviders();

    function getSiteSearchDisplayName(provider) {
      if (!provider) {
        return '站内';
      }
      return provider.name || provider.key || '站内';
    }

    function getProviderHost(provider) {
      if (!provider || !provider.template) {
        return '';
      }
      try {
        const url = provider.template.replace(/\{query\}/g, 'test');
        return new URL(url).hostname.toLowerCase();
      } catch (e) {
        return '';
      }
    }

    function normalizeHost(host) {
      return String(host || '').toLowerCase().replace(/^www\./i, '');
    }

    function suggestionMatchesProvider(suggestion, provider) {
      if (!suggestion || !provider || !suggestion.url) {
        return false;
      }
      let suggestionHost = '';
      try {
        suggestionHost = new URL(suggestion.url).hostname;
      } catch (e) {
        return false;
      }
      const normalizedSuggestion = normalizeHost(suggestionHost);
      const normalizedProvider = normalizeHost(getProviderHost(provider));
      if (!normalizedSuggestion || !normalizedProvider) {
        return false;
      }
      return normalizedSuggestion === normalizedProvider ||
        normalizedSuggestion.endsWith(`.${normalizedProvider}`) ||
        normalizedProvider.endsWith(`.${normalizedSuggestion}`);
    }

    function findSiteSearchProviderByKey(trigger, providers) {
      const key = String(trigger || '').toLowerCase();
      if (!key) {
        return null;
      }
      return (providers || []).find((provider) => String(provider.key || '').toLowerCase() === key) || null;
    }

    function findSiteSearchProvider(trigger, providers) {
      const key = String(trigger || '').toLowerCase();
      if (!key) {
        return null;
      }
      return (providers || []).find((provider) => {
        const providerKey = String(provider.key || '').toLowerCase();
        if (providerKey === key) {
          return true;
        }
        const aliases = Array.isArray(provider.aliases) ? provider.aliases : [];
        return aliases.some((alias) => String(alias).toLowerCase() === key);
      }) || null;
    }

    function findSiteSearchProviderByInput(input, providers) {
      const raw = String(input || '').trim();
      if (!raw) {
        return null;
      }
      const firstToken = raw.split(/\s+/)[0];
      const keyMatch = findSiteSearchProvider(firstToken, providers) ||
        findSiteSearchProviderByKey(firstToken, providers);
      if (keyMatch) {
        return keyMatch;
      }
      let host = '';
      if (/[./]/.test(firstToken)) {
        try {
          const url = firstToken.includes('://') ? firstToken : `https://${firstToken}`;
          host = new URL(url).hostname;
        } catch (e) {
          host = firstToken.split('/')[0] || '';
        }
      }
      if (!host) {
        return null;
      }
      const normalizedHost = normalizeHost(host);
      return (providers || []).find((provider) => {
        const providerHost = normalizeHost(getProviderHost(provider));
        if (!providerHost) {
          return false;
        }
        return normalizedHost === providerHost ||
          normalizedHost.endsWith(`.${providerHost}`) ||
          providerHost.endsWith(`.${normalizedHost}`);
      }) || null;
    }

    function getInlineSiteSearchCandidate(input, providers) {
      const raw = String(input || '').trim();
      if (!raw) {
        return null;
      }
      const tokens = raw.split(/\s+/);
      if (tokens.length < 2) {
        return null;
      }
      const provider = findSiteSearchProviderByInput(raw, providers);
      if (!provider) {
        return null;
      }
      const firstToken = tokens[0];
      const remainder = raw.slice(raw.indexOf(firstToken) + firstToken.length).trim();
      if (!remainder) {
        return null;
      }
      return { provider: provider, query: remainder };
    }

    function matchesTopSitePrefix(suggestion, input) {
      if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
        return false;
      }
      const query = String(input || '').trim().toLowerCase();
      if (!query) {
        return false;
      }
      const titleText = String(suggestion.title || '').toLowerCase();
      if (titleText.startsWith(query)) {
        return true;
      }
      const urlText = getUrlDisplay(suggestion.url || '');
      if (!urlText) {
        return false;
      }
      const host = urlText.split('/')[0] || '';
      return host.toLowerCase().startsWith(query);
    }

    function getTopSiteMatchCandidate(list, input) {
      if (!Array.isArray(list)) {
        return null;
      }
      const query = String(input || '').trim();
      if (!query || /\s/.test(query)) {
        return null;
      }
      let fallback = null;
      for (let i = 0; i < list.length; i += 1) {
        const suggestion = list[i];
        if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
          continue;
        }
        const urlText = getUrlDisplay(suggestion.url || '');
        const host = urlText ? (urlText.split('/')[0] || '') : '';
        if (host && host.toLowerCase().startsWith(query.toLowerCase())) {
          return suggestion;
        }
        if (!fallback && matchesTopSitePrefix(suggestion, query)) {
          fallback = suggestion;
        }
      }
      return fallback;
    }

    function promoteTopSiteMatch(list, queryText) {
      const match = getTopSiteMatchCandidate(list, queryText);
      if (!match) {
        return null;
      }
      const matchIndex = list.indexOf(match);
      if (matchIndex > 0) {
        const [picked] = list.splice(matchIndex, 1);
        list.unshift(picked);
        return picked;
      }
      if (matchIndex === 0) {
        return list[0];
      }
      return null;
    }

    function getSiteSearchTriggerCandidate(input, providers, topSiteMatch) {
      const trimmed = String(input || '').trim();
      if (!trimmed || /\s/.test(trimmed)) {
        return null;
      }
      const provider = findSiteSearchProvider(trimmed, providers) ||
        findSiteSearchProviderByKey(trimmed, providers);
      if (!provider) {
        return null;
      }
      if (topSiteMatch && trimmed.length <= 2 && matchesTopSitePrefix(topSiteMatch, trimmed)) {
        return null;
      }
      return provider;
    }

    function activateSiteSearch(provider) {
      if (!provider) {
        return;
      }
      siteSearchState = provider;
      inlineSearchState = null;
      searchInput.value = '';
      latestRawInputValue = '';
      latestOverlayQuery = '';
      clearAutocomplete();
      setSiteSearchPrefix(provider, defaultTheme);
      const providerIcon = getProviderIcon(provider);
      getThemeForProvider(provider).then((theme) => {
        if (siteSearchState === provider) {
          setSiteSearchPrefix(provider, theme);
        }
      });
      clearSearchSuggestions();
    }

    function clearSiteSearch() {
      if (!siteSearchState) {
        return;
      }
      siteSearchState = null;
      inlineSearchState = null;
      clearSiteSearchPrefix();
      clearAutocomplete();
    }

    // Add input event for search suggestions
    searchInput.addEventListener('compositionstart', function() {
      isComposing = true;
      clearAutocomplete();
    });

    searchInput.addEventListener('compositionend', function(e) {
      isComposing = false;
      const rawValue = e.target.value || '';
      const query = rawValue.trim();
      latestOverlayQuery = query;
      latestRawInputValue = rawValue;
      clearAutocomplete();
      if (query.length > 0) {
        chrome.runtime.sendMessage({
          action: 'getSearchSuggestions',
          query: query
        }, function(response) {
          if (response && response.suggestions) {
            updateSearchSuggestions(response.suggestions, query);
          }
        });
      } else {
        clearSearchSuggestions();
      }
    });

    searchInput.addEventListener('input', function() {
      const rawValue = this.value;
      const query = rawValue.trim();
      if (isComposing) {
        latestRawInputValue = rawValue;
        latestOverlayQuery = query;
        return;
      }
      if (!query && siteSearchState) {
        latestOverlayQuery = '';
        latestRawInputValue = '';
        clearAutocomplete();
        clearSearchSuggestions();
        return;
      }
      latestOverlayQuery = query;
      latestRawInputValue = rawValue;
      clearAutocomplete();
      if (query.length > 0) {
        // Get search suggestions
        chrome.runtime.sendMessage({
          action: 'getSearchSuggestions',
          query: query
        }, function(response) {
          if (response && response.suggestions) {
            updateSearchSuggestions(response.suggestions, query);
          }
        });
      } else {
        // Clear suggestions and show tabs
        clearSearchSuggestions();
      }
    });
    
    // Add click outside to close functionality
    clickOutsideHandler = function(e) {
      if (!overlay.contains(e.target)) {
        removeOverlay(overlay);
        document.removeEventListener('click', clickOutsideHandler);
      }
    };
    document.addEventListener('click', clickOutsideHandler);
    
    function handleTabKey(e) {
      if (siteSearchState) {
        return false;
      }
      const rawValue = searchInput.value;
      const rawTrigger = latestRawInputValue || rawValue;
      const triggerInput = (rawTrigger || rawValue).trim();
      if (siteSearchTriggerState &&
          siteSearchTriggerState.rawInput === triggerInput &&
          siteSearchTriggerState.provider) {
        e.preventDefault();
        activateSiteSearch(siteSearchTriggerState.provider);
        return true;
      }
      if (triggerInput) {
        e.preventDefault();
        const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
          ? siteSearchProvidersCache
          : defaultSiteSearchProviders;
        const topSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
        const directProvider = getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
        if (directProvider) {
          activateSiteSearch(directProvider);
          return true;
        }
        getSiteSearchProviders().then((items) => {
          const asyncTopSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
          const asyncProvider = getSiteSearchTriggerCandidate(triggerInput, items, asyncTopSiteMatch);
          if (asyncProvider) {
            activateSiteSearch(asyncProvider);
            return;
          }
          if (autocompleteState && autocompleteState.completion) {
            searchInput.value = autocompleteState.completion;
            searchInput.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
            latestRawInputValue = autocompleteState.completion;
            latestOverlayQuery = autocompleteState.completion.trim();
            autocompleteState = null;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        return true;
      }
      if (autocompleteState && autocompleteState.completion) {
        e.preventDefault();
        searchInput.value = autocompleteState.completion;
        searchInput.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
        latestRawInputValue = autocompleteState.completion;
        latestOverlayQuery = autocompleteState.completion.trim();
        autocompleteState = null;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }

    captureTabHandler = function(e) {
      if (e.key !== 'Tab') {
        return;
      }
      if (document.activeElement !== searchInput) {
        return;
      }
      handleTabKey(e);
    };
    document.addEventListener('keydown', captureTabHandler, true);

    searchInput.addEventListener('keydown', function(e) {
      if (e.key !== 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        latestRawInputValue = searchInput.value;
        latestOverlayQuery = searchInput.value.trim();
      }
      if (e.key === 'Escape' && siteSearchState) {
        e.preventDefault();
        e.stopPropagation();
        clearSiteSearch();
        return;
      }
      if (e.key === 'Backspace' && siteSearchState && !searchInput.value) {
        clearSiteSearch();
        return;
      }
      if (isComposing) {
        return;
      }
      if (e.key === 'Tab') {
        handleTabKey(e);
      }
    });

    // Add keyboard navigation
    let selectedIndex = -1; // -1 means input is focused, 0+ means suggestion is selected
    const suggestionItems = [];
    let currentSuggestions = []; // Store current suggestions for keyboard navigation

    function getAutoHighlightIndex() {
      return suggestionItems.findIndex((item) => Boolean(item && item._xIsAutocompleteTop));
    }
    
    keydownHandler = function(e) {
      if (e.key === 'Escape' && overlay) {
        removeOverlay(overlay);
        document.removeEventListener('keydown', keydownHandler);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (suggestionItems.length === 0) {
          return;
        }
        if (selectedIndex === -1) {
          // Move from auto highlight (or input) to next suggestion
          const autoIndex = getAutoHighlightIndex();
          selectedIndex = autoIndex >= 0
            ? (autoIndex + 1) % suggestionItems.length
            : 0;
          searchInput.blur();
        } else {
          // Move to next suggestion
          selectedIndex = (selectedIndex + 1) % suggestionItems.length;
        }
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (suggestionItems.length === 0) {
          return;
        }
        if (selectedIndex === 0) {
          // Move from first suggestion back to input
          selectedIndex = -1;
          searchInput.focus();
        } else if (selectedIndex === -1) {
          const autoIndex = getAutoHighlightIndex();
          if (autoIndex > 0) {
            selectedIndex = autoIndex - 1;
            searchInput.blur();
          } else if (autoIndex === 0) {
            selectedIndex = -1;
            searchInput.focus();
          } else {
            // Move from input to last suggestion
            selectedIndex = suggestionItems.length - 1;
            searchInput.blur();
          }
        } else {
          // Move to previous suggestion
          selectedIndex = selectedIndex - 1;
        }
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (isModeCommand(query) && selectedIndex === -1) {
          applyThemeModeChange(getNextThemeMode(overlayThemeMode || 'system'));
          return;
        }
        
        if (selectedIndex >= 0 && suggestionItems[selectedIndex]) {
          // Check if we're showing search suggestions or tab suggestions
          const isSearchSuggestion = query.length > 0;
          
          if (isSearchSuggestion && currentSuggestions[selectedIndex]) {
            const selectedSuggestion = currentSuggestions[selectedIndex];
            if (selectedSuggestion.type === 'modeSwitch') {
              applyThemeModeChange(selectedSuggestion.nextMode);
              searchInput.focus();
              return;
            }
            if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
              activateSiteSearch(selectedSuggestion.provider);
              searchInput.focus();
              return;
            }
            // Navigate to the suggested URL
            console.log('Opening URL from keyboard:', currentSuggestions[selectedIndex].url);
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: currentSuggestions[selectedIndex].url
            });
          } else if (!isSearchSuggestion) {
            // Switch to existing tab
            chrome.runtime.sendMessage({
              action: 'switchToTab',
              tabId: tabs[selectedIndex].id
            });
          }
          removeOverlay(overlay);
          document.removeEventListener('click', clickOutsideHandler);
          document.removeEventListener('keydown', keydownHandler);
          document.removeEventListener('keydown', captureTabHandler, true);
        } else if (query) {
          if (siteSearchState) {
            const siteUrl = buildSearchUrl(siteSearchState.template, query);
            if (siteUrl) {
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: siteUrl
              });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
          }
          const currentRawInput = (latestRawInputValue || searchInput.value || '').trim();
          if (inlineSearchState && inlineSearchState.isAuto &&
              inlineSearchState.url && inlineSearchState.rawInput === currentRawInput) {
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: inlineSearchState.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
            return;
          }
          if (autocompleteState && autocompleteState.url) {
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: autocompleteState.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
            return;
          }
          resolveQuickNavigation(query).then((targetUrl) => {
            if (targetUrl) {
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: targetUrl
              });
            } else {
              // Handle search or URL navigation
              chrome.runtime.sendMessage({
                action: 'searchOrNavigate',
                query: query
              });
            }
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
          });
        }
      }
    };
    
    document.addEventListener('keydown', keydownHandler);
    
    function applySearchSuggestionHighlight(item, theme) {
      const highlight = getHighlightColors(theme);
      item.style.setProperty('background', highlight.bg, 'important');
      item.style.setProperty('border', `1px solid ${highlight.border}`, 'important');
    }

    function resetSearchSuggestion(item) {
      item.style.setProperty('background', 'transparent', 'important');
      item.style.setProperty('border', '1px solid transparent', 'important');
    }

    function applySearchActionStyles(item, theme, isActive) {
      const resolvedTheme = getThemeForMode(theme);
      applyMarkVariables(item, isActive ? resolvedTheme : defaultTheme);
      if (item._xVisitButton) {
        const shouldHide = Boolean(item._xAlwaysHideVisitButton || (isActive && item._xHasActionTags));
        item._xVisitButton.style.setProperty('display', shouldHide ? 'none' : 'inline-flex', 'important');
        if (shouldHide) {
          item._xVisitButton.style.setProperty('background-color', 'transparent', 'important');
          item._xVisitButton.style.setProperty('border', '1px solid transparent', 'important');
        }
        if (isActive) {
          item._xVisitButton.style.setProperty('color', resolvedTheme.buttonText, 'important');
          item._xVisitButton.style.setProperty('background-color', resolvedTheme.buttonBg, 'important');
          item._xVisitButton.style.setProperty('border', `1px solid ${resolvedTheme.buttonBorder}`, 'important');
        } else {
          item._xVisitButton.style.setProperty('color', 'var(--x-ov-subtext, #9CA3AF)', 'important');
          item._xVisitButton.style.setProperty('background-color', 'transparent', 'important');
          item._xVisitButton.style.setProperty('border', '1px solid transparent', 'important');
        }
      }
      if (item._xHistoryTag) {
        if (isActive) {
          item._xHistoryTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
          item._xHistoryTag.style.setProperty('color', resolvedTheme.tagText, 'important');
          item._xHistoryTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
        } else {
          item._xHistoryTag.style.setProperty('background', item._xHistoryTag._xDefaultBg || 'var(--x-ov-tag-bg, #F3F4F6)', 'important');
          item._xHistoryTag.style.setProperty('color', item._xHistoryTag._xDefaultText || 'var(--x-ov-tag-text, #6B7280)', 'important');
          item._xHistoryTag.style.setProperty('border', `1px solid ${item._xHistoryTag._xDefaultBorder || 'transparent'}`, 'important');
        }
      }
      if (item._xBookmarkTag) {
        if (isActive) {
          item._xBookmarkTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
          item._xBookmarkTag.style.setProperty('color', resolvedTheme.tagText, 'important');
          item._xBookmarkTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
        } else {
          item._xBookmarkTag.style.setProperty('background', item._xBookmarkTag._xDefaultBg || 'var(--x-ov-bookmark-tag-bg, #FEF3C7)', 'important');
          item._xBookmarkTag.style.setProperty('color', item._xBookmarkTag._xDefaultText || 'var(--x-ov-bookmark-tag-text, #D97706)', 'important');
          item._xBookmarkTag.style.setProperty('border', `1px solid ${item._xBookmarkTag._xDefaultBorder || 'transparent'}`, 'important');
        }
      }
      if (item._xTopSiteTag) {
        if (isActive) {
          item._xTopSiteTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
          item._xTopSiteTag.style.setProperty('color', resolvedTheme.tagText, 'important');
          item._xTopSiteTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
        } else {
          item._xTopSiteTag.style.setProperty('background', item._xTopSiteTag._xDefaultBg || 'var(--x-ov-tag-bg, #F3F4F6)', 'important');
          item._xTopSiteTag.style.setProperty('color', item._xTopSiteTag._xDefaultText || 'var(--x-ov-tag-text, #6B7280)', 'important');
          item._xTopSiteTag.style.setProperty('border', `1px solid ${item._xTopSiteTag._xDefaultBorder || 'transparent'}`, 'important');
        }
      }
      if (item._xTagContainer) {
        const shouldShow = isActive && item._xHasActionTags;
        item._xTagContainer.style.setProperty('display', shouldShow ? 'inline-flex' : 'none', 'important');
      }
      if (item._xTitle) {
        item._xTitle.style.setProperty('font-weight', isActive ? '600' : '400', 'important');
      }
    }

    function updateSelection() {
      suggestionItems.forEach((item, index) => {
        const isSelected = index === selectedIndex;
        const shouldAutoHighlight = selectedIndex === -1 && item._xIsAutocompleteTop;
        const isHighlighted = isSelected || shouldAutoHighlight;
        if (item._xIsSearchSuggestion) {
          const theme = item._xTheme || defaultTheme;
          if (isHighlighted) {
            applySearchSuggestionHighlight(item, theme);
          } else {
            resetSearchSuggestion(item);
          }
          applySearchActionStyles(item, theme, isHighlighted);
          return;
        }
        const theme = item._xTheme || defaultTheme;
        if (isSelected) {
          applySearchSuggestionHighlight(item, theme);
          if (item._xSwitchButton) {
            item._xSwitchButton.style.setProperty('color', 'var(--x-ov-text, #1F2937)', 'important');
          }
        } else {
          resetSearchSuggestion(item);
          if (item._xSwitchButton) {
            item._xSwitchButton.style.setProperty('color', 'var(--x-ov-subtext, #9CA3AF)', 'important');
          }
        }
      });
    }

    function renderTabSuggestions(tabList) {
      suggestionsContainer.innerHTML = '';
      suggestionItems.length = 0;
      currentSuggestions = [];
      const list = Array.isArray(tabList) ? tabList : [];
      list.forEach((tab, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_suggestion_item_${index}_2024_unique_`;
        const isLastItem = index === list.length - 1;
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px 16px !important;
          background: transparent !important;
          border: 1px solid transparent !important;
          border-radius: 16px !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          box-sizing: border-box !important;
          margin: 0 0 ${isLastItem ? '0' : '4px'} 0 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;
        suggestionItem._xIsSearchSuggestion = false;
        
        // Store reference to suggestion item
        suggestionItems.push(suggestionItem);
        suggestionItem._xTheme = defaultTheme;

        // Create left side with icon and title
        const leftSide = document.createElement('div');
        leftSide.id = `_x_extension_left_side_${index}_2024_unique_`;
        leftSide.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex: 1 !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;

        // Create favicon
        const favicon = document.createElement('img');
        favicon.id = `_x_extension_favicon_${index}_2024_unique_`;
        favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%23E3E4E8" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
        favicon.style.cssText = `
          all: unset !important;
          width: 16px !important;
          height: 16px !important;
          border-radius: 2px !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
          display: block !important;
        `;

        // Create title
        const title = document.createElement('span');
        title.id = `_x_extension_title_${index}_2024_unique_`;
        title.textContent = tab.title || '无标题';
        title.style.cssText = `
          all: unset !important;
          color: var(--x-ov-text, #111827) !important;
          font-size: 14px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          display: inline-block !important;
          vertical-align: baseline !important;
        `;

        // Create switch button
        const switchButton = document.createElement('button');
        switchButton.id = `_x_extension_switch_button_${index}_2024_unique_`;
        switchButton.innerHTML = '切换到标签页 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
        switchButton.style.cssText = `
          all: unset !important;
          background: transparent !important;
          color: var(--x-ov-subtext, #4B5563) !important;
          border: none !important;
          border-radius: 6px !important;
          font-size: 12px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          padding: 6px 12px !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          vertical-align: baseline !important;
        `;
        suggestionItem._xSwitchButton = switchButton;

        // Add hover effects
        suggestionItem.addEventListener('mouseenter', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            const theme = this._xTheme;
          if (theme && theme._xIsBrand) {
            const hover = getHoverColors(theme);
            this.style.setProperty('background-color', hover.bg, 'important');
            this.style.setProperty('border', `1px solid ${hover.border}`, 'important');
          } else {
              this.style.setProperty('background-color', 'var(--x-ov-hover-bg, #F3F4F6)', 'important');
              this.style.setProperty('border', '1px solid transparent', 'important');
            }
          }
        });

        suggestionItem.addEventListener('mouseleave', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this.style.setProperty('background-color', 'transparent', 'important');
            this.style.setProperty('border', '1px solid transparent', 'important');
          }
        });

        // Add click handler to switch to tab
        switchButton.addEventListener('click', function(e) {
          e.stopPropagation();
          chrome.runtime.sendMessage({
            action: 'switchToTab',
            tabId: tab.id
          });
          removeOverlay(overlay);
          document.removeEventListener('keydown', keydownHandler);
        });

        // Add click handler to select item
        suggestionItem.addEventListener('click', function() {
          chrome.runtime.sendMessage({
            action: 'switchToTab',
            tabId: tab.id
          });
          removeOverlay(overlay);
          document.removeEventListener('keydown', keydownHandler);
        });

        leftSide.appendChild(favicon);
        leftSide.appendChild(title);
        suggestionItem.appendChild(leftSide);
        suggestionItem.appendChild(switchButton);
        suggestionsContainer.appendChild(suggestionItem);

        const themeSourceSuggestion = {
          url: tab.url || '',
          favicon: tab.favIconUrl || ''
        };
        const immediateTheme = getImmediateThemeForSuggestion(themeSourceSuggestion) || defaultTheme;
        suggestionItem._xTheme = immediateTheme;
        applyThemeVariables(suggestionItem, immediateTheme);
        getThemeForSuggestion(themeSourceSuggestion).then((theme) => {
          if (!suggestionItem.isConnected) {
            return;
          }
          suggestionItem._xTheme = theme;
          updateSelection();
        });
      });

      selectedIndex = -1;
    }

    function requestTabsAndRender() {
      chrome.runtime.sendMessage({ action: 'getTabsForOverlay' }, (response) => {
        const freshTabs = response && Array.isArray(response.tabs) ? response.tabs : [];
        if (freshTabs.length === 0) {
          return;
        }
        tabs = freshTabs;
        renderTabSuggestions(freshTabs);
      });
    }
    
    function getBrowserInternalScheme() {
      const ua = navigator.userAgent || '';
      if (ua.includes('Edg/')) {
        return 'edge://';
      }
      if (ua.includes('Brave')) {
        return 'brave://';
      }
      if (ua.includes('Vivaldi')) {
        return 'vivaldi://';
      }
      if (ua.includes('OPR/') || ua.includes('Opera')) {
        return 'opera://';
      }
      return 'chrome://';
    }

    function getShortcutRules() {
      const cacheKey = '_x_extension_shortcut_rules_2024_unique_';
      const promiseKey = '_x_extension_shortcut_rules_promise_2024_unique_';
      if (window[cacheKey]) {
        return Promise.resolve(window[cacheKey]);
      }
      if (window[promiseKey]) {
        return window[promiseKey];
      }
      const rulesUrl = chrome.runtime.getURL('shortcut-rules.json');
      const rulesPromise = fetch(rulesUrl)
        .then((response) => response.json())
        .then((data) => {
          const items = data && Array.isArray(data.items) ? data.items : [];
          window[cacheKey] = items;
          return items;
        })
        .catch(() => new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getShortcutRules' }, (response) => {
            const items = response && Array.isArray(response.items) ? response.items : [];
            window[cacheKey] = items;
            resolve(items);
          });
        }));
      window[promiseKey] = rulesPromise;
      return rulesPromise;
    }

    function buildKeywordSuggestions(input, rules) {
      const queryLower = input.toLowerCase();
      const scheme = getBrowserInternalScheme();
      const matches = [];
      rules.forEach((rule) => {
        if (!rule || !Array.isArray(rule.keys)) {
          return;
        }
        const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
        if (!isMatch) {
          return;
        }
        if (rule.type === 'browserPage' && rule.path) {
          const targetUrl = `${scheme}${rule.path}`;
          matches.push({
            type: 'browserPage',
            title: `打开 ${targetUrl}`,
            url: targetUrl,
            favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
          });
        } else if (rule.type === 'url' && rule.url) {
          matches.push({
            type: 'browserPage',
            title: `打开 ${rule.url}`,
            url: rule.url,
            favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
          });
        }
      });
      return matches;
    }

    function getDirectUrlSuggestion(input) {
      const queryLower = input.toLowerCase();
      const isInternal = ['chrome://', 'edge://', 'brave://', 'vivaldi://', 'opera://'].some((prefix) =>
        queryLower.startsWith(prefix)
      );
      const ipMatch = input.trim().match(/^\d{1,3}([.\s]\d{1,3}){3}$/);
      const normalizedIp = ipMatch ? input.trim().replace(/\s+/g, '.').replace(/\.{2,}/g, '.') : '';
      const looksLikeUrl = (input.includes('.') && !input.includes(' ')) || isInternal || Boolean(normalizedIp);
      if (!looksLikeUrl) {
        return null;
      }
      let targetUrl = normalizedIp || input;
      if (!isInternal && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }
      return {
        type: 'directUrl',
        title: `打开 ${targetUrl}`,
        url: targetUrl,
        favicon: 'https://img.icons8.com/?size=100&id=QeJX4E2mC0fF&format=png&color=000000'
      };
    }

    function resolveQuickNavigation(query) {
      const directUrlSuggestion = getDirectUrlSuggestion(query);
      if (directUrlSuggestion) {
        return Promise.resolve(directUrlSuggestion.url);
      }
      return getShortcutRules().then((rules) => {
        const keywordSuggestions = buildKeywordSuggestions(query, rules);
        if (keywordSuggestions.length > 0) {
          return keywordSuggestions[0].url;
        }
        return null;
      });
    }

    function updateSearchSuggestions(suggestions, query) {
      if (query !== latestOverlayQuery) {
        return;
      }
      // Clear existing suggestions
      suggestionsContainer.innerHTML = '';
      suggestionItems.length = 0;
      const rawTagInput = (latestRawInputValue || query || '').trim();
      const modeCommandActive = isModeCommand(rawTagInput);
      if (modeCommandActive) {
        chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
          const storedMode = result[THEME_STORAGE_KEY] || 'system';
          if (storedMode !== overlayThemeMode && query === latestOverlayQuery) {
            applyOverlayTheme(storedMode);
            updateSearchSuggestions([], query);
          }
        });
      }
      
      // Add New Tab suggestion as first item
      const newTabSuggestion = modeCommandActive
        ? null
        : {
          type: 'newtab',
          title: `搜索 "${query}"`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          favicon: 'https://img.icons8.com/?size=100&id=ejub91zEY6Sl&format=png&color=000000'
        };

      // Add ChatGPT suggestion as second item
      // const chatGptSuggestion = {
      //   type: 'chatgpt',
      //   title: `Ask ChatGPT: "${query}"`,
      //   url: `https://chatgpt.com/?q=${encodeURIComponent(query)}`,
      //   favicon: 'https://img.icons8.com/?size=100&id=fO5yVwARGUEB&format=png&color=ffffff'
      // };

      // Add Perplexity suggestion as third item
      // const perplexitySuggestion = {
      //   type: 'perplexity',
      //   title: `Ask Perplexity: "${query}"`,
      //   url: `https://perplexity.ai/search?q=${encodeURIComponent(query)}`,
      //   favicon: 'https://img.icons8.com/?size=100&id=kzJWN5jCDzpq&format=png&color=000000'
      // };

      function buildUrlLine(url) {
        if (!url) {
          return null;
        }
        const urlLine = document.createElement('span');
        urlLine.textContent = url;
        urlLine.style.cssText = `
          all: unset !important;
          color: var(--x-ov-link, #2563EB) !important;
          font-size: 12px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          text-decoration: none !important;
          display: inline-block !important;
          max-width: 60% !important;
          line-height: 1.4 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
        `;
        return urlLine;
      }

      getShortcutRules().then((rules) => {
        if (query !== latestOverlayQuery) {
          return;
        }
        const preSuggestions = [];
        if (modeCommandActive) {
          preSuggestions.push(buildModeSuggestion());
        } else {
          const directUrlSuggestion = getDirectUrlSuggestion(query);
          if (directUrlSuggestion) {
            preSuggestions.push(directUrlSuggestion);
          }
          const keywordSuggestions = buildKeywordSuggestions(query, rules);
          preSuggestions.push(...keywordSuggestions);
        }

        const providersForTags = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
          ? siteSearchProvidersCache
          : defaultSiteSearchProviders;
        const rawTagInput = (latestRawInputValue || searchInput.value || '').trim();
        const inlineCandidate = (!siteSearchState && !modeCommandActive)
          ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
          : null;
        let inlineSuggestion = null;
        if (inlineCandidate) {
          const inlineUrl = buildSearchUrl(inlineCandidate.provider.template, inlineCandidate.query);
          if (inlineUrl) {
            inlineSuggestion = {
              type: 'inlineSiteSearch',
              title: `在 ${getSiteSearchDisplayName(inlineCandidate.provider)} 中搜索`,
              url: inlineUrl,
              favicon: getProviderIcon(inlineCandidate.provider),
              provider: inlineCandidate.provider
            };
          }
        }

        // Add New Tab, ChatGPT and Perplexity suggestions to the beginning
        let allSuggestions = modeCommandActive
          ? [...preSuggestions]
          : [...preSuggestions, newTabSuggestion, /*chatGptSuggestion, perplexitySuggestion,*/ ...suggestions];
        if (!modeCommandActive && siteSearchState && query) {
          const siteUrl = buildSearchUrl(siteSearchState.template, query);
          if (siteUrl) {
            allSuggestions.unshift({
              type: 'siteSearch',
              title: `在 ${getSiteSearchDisplayName(siteSearchState)} 中搜索 "${query}"`,
              url: siteUrl,
              favicon: getProviderIcon(siteSearchState),
              provider: siteSearchState
            });
          }
        }
        let autocompleteCandidate = null;
        let primaryHighlightIndex = -1;
        let primaryHighlightReason = 'none';
        let topSiteMatch = null;
        let siteSearchPrompt = null;
        const inlineEnabled = Boolean(inlineSuggestion);
        let siteSearchTrigger = null;
        if (!modeCommandActive) {
          if (!siteSearchState && !inlineEnabled) {
            topSiteMatch = promoteTopSiteMatch(allSuggestions, latestRawInputValue.trim());
          }
          siteSearchTrigger = (!siteSearchState && !inlineEnabled)
            ? getSiteSearchTriggerCandidate(rawTagInput, providersForTags, topSiteMatch)
            : null;
          if (siteSearchTrigger && !topSiteMatch) {
            siteSearchPrompt = {
              type: 'siteSearchPrompt',
              title: `在 ${getSiteSearchDisplayName(siteSearchTrigger)} 中搜索`,
              url: '',
              favicon: getProviderIcon(siteSearchTrigger),
              provider: siteSearchTrigger
            };
            allSuggestions.unshift(siteSearchPrompt);
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'siteSearchPrompt';
          }
          if (!siteSearchState && !inlineEnabled && !siteSearchPrompt) {
            autocompleteCandidate = getAutocompleteCandidate(allSuggestions, latestRawInputValue);
            if (autocompleteCandidate) {
              const candidateIndex = allSuggestions.findIndex((suggestion) => {
                if (!suggestion || suggestion.type === 'newtab') {
                  return false;
                }
                if (autocompleteCandidate.url && suggestion.url === autocompleteCandidate.url) {
                  return true;
                }
                const suggestionUrlText = getUrlDisplay(suggestion.url);
                if (suggestionUrlText && suggestionUrlText.toLowerCase() === autocompleteCandidate.completion.toLowerCase()) {
                  return true;
                }
                if (suggestion.title && suggestion.title.toLowerCase().startsWith(autocompleteCandidate.completion.toLowerCase())) {
                  return true;
                }
                return false;
              });
              if (candidateIndex >= 0 && candidateIndex !== 0) {
                const [candidateSuggestion] = allSuggestions.splice(candidateIndex, 1);
                allSuggestions.unshift(candidateSuggestion);
              }
              primaryHighlightIndex = 0;
              primaryHighlightReason = 'autocomplete';
            }
          }
          if (inlineSuggestion) {
            allSuggestions.unshift(inlineSuggestion);
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'inline';
          } else if (!siteSearchPrompt && topSiteMatch) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'topSite';
          }
          if (query && primaryHighlightIndex < 0 && allSuggestions.length > 0) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'default';
          }
          applyAutocomplete(allSuggestions);
          const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
          inlineSearchState = inlineSuggestion
            ? { url: inlineSuggestion.url, rawInput: rawTagInput, isAuto: inlineAutoHighlight }
            : null;
          siteSearchTriggerState = siteSearchTrigger
            ? { provider: siteSearchTrigger, rawInput: rawTagInput }
            : null;
        } else {
          clearAutocomplete();
          inlineSearchState = null;
          siteSearchTriggerState = null;
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'modeSwitch';
        }
        currentSuggestions = allSuggestions; // Store current suggestions including ChatGPT
        
        // Add search suggestions
        allSuggestions.forEach((suggestion, index) => {
          const suggestionItem = document.createElement('div');
          suggestionItem.id = `_x_extension_suggestion_item_${index}_2024_unique_`;
          const isLastItem = index === allSuggestions.length - 1;
          const isPrimaryHighlight = index === primaryHighlightIndex;
          const immediateTheme = getImmediateThemeForSuggestion(suggestion) || defaultTheme;
          const initialHighlight = isPrimaryHighlight ? getHighlightColors(immediateTheme) : null;
          suggestionItem.style.cssText = `
            all: unset !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 12px 16px !important;
            background: ${isPrimaryHighlight ? initialHighlight.bg : 'transparent'} !important;
            border: ${isPrimaryHighlight ? `1px solid ${initialHighlight.border}` : '1px solid transparent'} !important;
            border-radius: 16px !important;
            margin-bottom: ${isLastItem ? '0' : '4px'} !important;
            cursor: pointer !important;
            transition: background-color 0.2s ease !important;
            box-sizing: border-box !important;
            margin: 0 0 ${isLastItem ? '0' : '4px'} 0 !important;
            line-height: 1.5 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            color: inherit !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          
          suggestionItems.push(suggestionItem);
          suggestionItem._xIsSearchSuggestion = true;
          suggestionItem._xIsAutocompleteTop = isPrimaryHighlight;
          suggestionItem._xTheme = immediateTheme;
          applyThemeVariables(suggestionItem, immediateTheme);
          
          // Create left side with icon and title
          const leftSide = document.createElement('div');
          leftSide.style.cssText = `
            all: unset !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            flex: 1 !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: inherit !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          
          let iconNode = null;
          if (suggestion.type === 'browserPage') {
            const themedIcon = document.createElement('span');
            themedIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--x-ext-icon-color, #6B7280)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><circle cx="7" cy="6" r="1"/><circle cx="11" cy="6" r="1"/></svg>`;
            themedIcon.style.cssText = `
              all: unset !important;
              width: 16px !important;
              height: 16px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              background: transparent !important;
              color: inherit !important;
              font-size: 100% !important;
              font: inherit !important;
              vertical-align: baseline !important;
            `;
            iconNode = themedIcon;
          } else {
            // Create icon for suggestions - always use img for all types
            const favicon = document.createElement('img');
            favicon.src = suggestion.favicon || '';
            favicon.style.cssText = `
              all: unset !important;
              width: 16px !important;
              height: 16px !important;
              border-radius: 2px !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              background: transparent !important;
              color: inherit !important;
              font-size: 100% !important;
              font: inherit !important;
              vertical-align: baseline !important;
              display: block !important;
              object-fit: contain !important;
            `;
            
            // Fallback to search icon if favicon fails to load
            favicon.onerror = function() {
              // Replace with search icon SVG if favicon fails
              const searchIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E3E4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
              const fallbackDiv = document.createElement('div');
              fallbackDiv.innerHTML = searchIconSvg;
              fallbackDiv.style.cssText = `
                all: unset !important;
                width: 16px !important;
                height: 16px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-sizing: border-box !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1 !important;
                text-decoration: none !important;
                list-style: none !important;
                outline: none !important;
                background: transparent !important;
                color: inherit !important;
                font-size: 100% !important;
                font: inherit !important;
                vertical-align: baseline !important;
              `;
              favicon.parentNode.replaceChild(fallbackDiv, favicon);
            };
            iconNode = favicon;
          }
          
          // Create text wrapper for title and tag
          const textWrapper = document.createElement('div');
          textWrapper.style.cssText = `
            all: unset !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            flex: 1 !important;
            min-width: 0 !important;
            overflow: visible !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 8px 0 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: inherit !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          
          // Create title with highlighted query
          const title = document.createElement('span');
          let highlightedTitle;
          if (suggestion.type === 'chatgpt' || suggestion.type === 'perplexity' || suggestion.type === 'newtab' || suggestion.type === 'siteSearch' || suggestion.type === 'inlineSiteSearch' || suggestion.type === 'siteSearchPrompt' || suggestion.type === 'modeSwitch') {
            // For ChatGPT, Perplexity, and New Tab, don't highlight the query part
            highlightedTitle = suggestion.title;
          } else {
            // For other suggestions, highlight the query
            highlightedTitle = suggestion.title.replace(
              new RegExp(`(${query})`, 'gi'),
              '<mark style="background: var(--x-ext-mark-bg, #CFE8FF); color: var(--x-ext-mark-text, #1E3A8A); padding: 2px 4px; border-radius: 3px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif;">$1</mark>'
            );
          }
          title.innerHTML = highlightedTitle;
          title.style.cssText = `
            all: unset !important;
            color: var(--x-ov-text, #111827) !important;
            font-size: 14px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            font-weight: 400 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1.5 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            display: inline-block !important;
            vertical-align: baseline !important;
          `;
          suggestionItem._xTitle = title;
          
          textWrapper.appendChild(title);
          
          // Add history tag if type is history
          if (suggestion.type === 'history' && !suggestion.isTopSite) {
            const urlLine = buildUrlLine(suggestion.url || '');
            if (urlLine) {
              textWrapper.appendChild(urlLine);
            }
            const historyTag = document.createElement('span');
            historyTag.textContent = '历史';
            historyTag._xDefaultBg = 'var(--x-ov-tag-bg, #F3F4F6)';
            historyTag._xDefaultText = 'var(--x-ov-tag-text, #6B7280)';
            historyTag._xDefaultBorder = 'transparent';
            historyTag.style.cssText = `
              all: unset !important;
              background: var(--x-ov-tag-bg, #F3F4F6) !important;
              color: var(--x-ov-tag-text, #6B7280) !important;
              font-size: 10px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              padding: 4px 6px !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              line-height: 1.2 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              border: 1px solid transparent !important;
              display: inline-flex !important;
              align-items: center !important;
              vertical-align: middle !important;
              flex-shrink: 0 !important;
            `;
            textWrapper.appendChild(historyTag);
            suggestionItem._xHistoryTag = historyTag;
          }
          
          // Add topSite tag if type is topSite
          if (suggestion.type === 'topSite' || suggestion.isTopSite) {
            const urlLine = buildUrlLine(suggestion.url || '');
            if (urlLine) {
              textWrapper.appendChild(urlLine);
            }
            const topSiteTag = document.createElement('span');
            topSiteTag.textContent = '常用';
            topSiteTag._xDefaultBg = 'var(--x-ov-tag-bg, #F3F4F6)';
            topSiteTag._xDefaultText = 'var(--x-ov-tag-text, #6B7280)';
            topSiteTag._xDefaultBorder = 'transparent';
            topSiteTag.style.cssText = `
              all: unset !important;
              background: var(--x-ov-tag-bg, #F3F4F6) !important;
              color: var(--x-ov-tag-text, #6B7280) !important;
              font-size: 10px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              padding: 4px 6px !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              line-height: 1.2 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              border: 1px solid transparent !important;
              display: inline-flex !important;
              align-items: center !important;
              vertical-align: middle !important;
              flex-shrink: 0 !important;
            `;
            textWrapper.appendChild(topSiteTag);
            suggestionItem._xTopSiteTag = topSiteTag;
          }
          
          // Add bookmark tag if type is bookmark
          if (suggestion.type === 'bookmark') {
            if (suggestion.path) {
              const bookmarkPath = document.createElement('span');
              bookmarkPath.textContent = suggestion.path;
              bookmarkPath.style.cssText = `
                all: unset !important;
                color: var(--x-ov-link, #2563EB) !important;
                font-size: 12px !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                text-decoration: none !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                margin: 0 !important;
                padding: 0 !important;
                line-height: 1.2 !important;
                display: inline-block !important;
                vertical-align: middle !important;
              `;
              textWrapper.appendChild(bookmarkPath);
            }
          const bookmarkTag = document.createElement('span');
          bookmarkTag.textContent = '书签';
          bookmarkTag._xDefaultBg = 'var(--x-ov-bookmark-tag-bg, #FEF3C7)';
          bookmarkTag._xDefaultText = 'var(--x-ov-bookmark-tag-text, #D97706)';
          bookmarkTag._xDefaultBorder = 'transparent';
          bookmarkTag.style.cssText = `
            all: unset !important;
            background: var(--x-ov-bookmark-tag-bg, #FEF3C7) !important;
            color: var(--x-ov-bookmark-tag-text, #D97706) !important;
            font-size: 10px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              padding: 4px 6px !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              line-height: 1.2 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              border: 1px solid transparent !important;
              display: inline-flex !important;
              align-items: center !important;
              vertical-align: middle !important;
              flex-shrink: 0 !important;
            `;
            textWrapper.appendChild(bookmarkTag);
            suggestionItem._xBookmarkTag = bookmarkTag;
          }
          
          const rightSide = document.createElement('div');
          rightSide.style.cssText = `
            all: unset !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: inherit !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;

          const actionTags = document.createElement('div');
          actionTags.style.cssText = `
            all: unset !important;
            display: none !important;
            align-items: center !important;
            gap: 6px !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: inherit !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
            flex-shrink: 0 !important;
          `;

          const isTopSiteMatch = Boolean(topSiteMatch && suggestion === topSiteMatch);
          const shouldShowEnterTag = isPrimaryHighlight &&
            (primaryHighlightReason === 'topSite' ||
              primaryHighlightReason === 'inline' ||
              primaryHighlightReason === 'autocomplete');
          const shouldShowSiteSearchTag = isPrimaryHighlight &&
            siteSearchTrigger &&
            (primaryHighlightReason === 'siteSearchPrompt' || isTopSiteMatch);
          if (shouldShowEnterTag) {
            actionTags.appendChild(createActionTag('访问', 'Enter'));
          }
          if (shouldShowSiteSearchTag) {
            actionTags.appendChild(createActionTag('搜索', 'Tab'));
          }

          // Create visit button
          const visitButton = document.createElement('button');
          visitButton.style.cssText = `
            all: unset !important;
            background: transparent !important;
            color: var(--x-ov-subtext, #9CA3AF) !important;
            border: 1px solid transparent !important;
            border-radius: 16px !important;
            font-size: 12px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            cursor: pointer !important;
            transition: background-color 0.2s ease !important;
            padding: 6px 12px !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            vertical-align: baseline !important;
          `;
          suggestionItem._xAlwaysHideVisitButton = suggestion.type === 'siteSearchPrompt' || suggestion.type === 'modeSwitch';
          if (suggestionItem._xAlwaysHideVisitButton) {
            visitButton.style.setProperty('display', 'none', 'important');
          }
          
          if (suggestion.type === 'newtab') {
            visitButton.innerHTML = '在 Google 中搜索 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
          } else if (suggestion.type === 'siteSearch') {
            visitButton.innerHTML = '搜索 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
          } else if (suggestion.type === 'directUrl' || suggestion.type === 'browserPage') {
            visitButton.innerHTML = '打开 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
          } else if (suggestion.type === 'googleSuggest') {
            visitButton.innerHTML = '搜索 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
          } else {
            visitButton.innerHTML = '访问 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
          }
          
          // Add hover effects
          suggestionItem.addEventListener('mouseenter', function() {
            if (suggestionItems.indexOf(this) !== selectedIndex) {
              this._xIsHovering = true;
              const theme = this._xTheme;
              if (theme && theme._xIsBrand) {
                const hover = getHoverColors(theme);
                this.style.setProperty('background', hover.bg, 'important');
                this.style.setProperty('border', `1px solid ${hover.border}`, 'important');
              } else {
                this.style.setProperty('background', 'var(--x-ov-hover-bg, #F9FAFB)', 'important');
                this.style.setProperty('border', '1px solid transparent', 'important');
              }
            }
          });
          
          suggestionItem.addEventListener('mouseleave', function() {
            if (suggestionItems.indexOf(this) !== selectedIndex) {
              this._xIsHovering = false;
              updateSelection();
            }
          });
          
          // Add click handler to visit URL
          visitButton.addEventListener('click', function(e) {
            e.stopPropagation();
            if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
              activateSiteSearch(suggestion.provider);
              searchInput.focus();
              return;
            }
            console.log('Opening URL:', suggestion.url);
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: suggestion.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
          });
          
          // Add click handler to select item
          suggestionItem.addEventListener('click', function() {
            if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
              activateSiteSearch(suggestion.provider);
              searchInput.focus();
              return;
            }
            if (suggestion.type === 'modeSwitch') {
              applyThemeModeChange(suggestion.nextMode);
              searchInput.focus();
              return;
            }
            console.log('Opening URL:', suggestion.url);
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: suggestion.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('keydown', captureTabHandler, true);
          });
          
          leftSide.appendChild(iconNode);
          leftSide.appendChild(textWrapper);
          suggestionItem.appendChild(leftSide);
          rightSide.appendChild(actionTags);
          rightSide.appendChild(visitButton);
          suggestionItem.appendChild(rightSide);
          suggestionItem._xVisitButton = visitButton;
          suggestionItem._xTagContainer = actionTags;
          suggestionItem._xHasActionTags = actionTags.childNodes.length > 0;
          suggestionsContainer.appendChild(suggestionItem);

          getThemeForSuggestion(suggestion).then((theme) => {
            if (!suggestionItem.isConnected) {
              return;
            }
            suggestionItem._xTheme = theme;
            applyThemeVariables(suggestionItem, theme);
            updateSelection();
          });
        });
        updateSelection();
      
      // Update keyboard navigation
      selectedIndex = -1;
      });
    }
    
    function clearSearchSuggestions() {
      inlineSearchState = null;
      siteSearchTriggerState = null;
      if (Array.isArray(tabs) && tabs.length > 0) {
        renderTabSuggestions(tabs);
      }

      requestTabsAndRender();
    }
    
    // Focus the input when created
    setTimeout(() => searchInput.focus(), 100);
    

    
    // Create suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = '_x_extension_suggestions_container_2024_unique_';
    suggestionsContainer.style.cssText = `
      all: unset !important;
      width: 100% !important;
      flex: 1 1 auto !important;
      min-height: 0 !important;
      max-height: 50vh !important;
      overflow-y: auto !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      background: transparent !important;
      border-radius: 0 0 28px 28px !important;
      padding: 12px !important;
      box-sizing: border-box !important;
      display: block !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;

    renderTabSuggestions(tabs);
    
    overlay.appendChild(inputContainer);
    overlay.appendChild(suggestionsContainer);
    document.body.appendChild(overlay);
  }
}
