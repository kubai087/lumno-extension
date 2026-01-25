
chrome.commands.onCommand.addListener(function(command) {
  if (command === "show-search") {
    // Get all tabs in the current window
    chrome.tabs.query({currentWindow: true}, function(tabs) {
      // Get the current active tab and inject the script with tabs data
      chrome.tabs.query({active: true, currentWindow: true}, function(activeTabs) {
        if (activeTabs[0]) {
          chrome.scripting.executeScript({
            target: {tabId: activeTabs[0].id},
            files: ['input-ui.js']
          }, function() {
            chrome.scripting.executeScript({
              target: {tabId: activeTabs[0].id},
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
    const query = request.query;
    
    // Check if it's a URL - very simple and reliable
    const isUrl = query.includes('.') && !query.includes(' ');
    
    if (isUrl) {
      // It's a URL - navigate directly
      let url = query;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      chrome.tabs.create({ url: url });
    } else {
      // It's a search query - search Google
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      chrome.tabs.create({ url: searchUrl });
    }
  } else if (request.action === 'getSearchSuggestions') {
    const query = request.query;
    getSearchSuggestions(query).then(suggestions => {
      sendResponse({ suggestions: suggestions });
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'createTab') {
    chrome.tabs.create({ url: request.url });
  }
});

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
          faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
        } catch (e) {
          // Fallback to direct favicon URL
          faviconUrl = item.url + '/favicon.ico';
        }
        
        suggestions.push({
            type: 'history',
            title: item.title,
            url: item.url,
            favicon: faviconUrl,
            score: score
          });
          processedUrls.add(item.url);
        }
      }
    });
    
    // Process top sites with scoring
    topSites.forEach(site => {
      if (site.title && !processedUrls.has(site.url)) {
        const score = calculateRelevanceScore(site, query);
        if (score > 0) {
          // Get favicon URL using Google's favicon service (more reliable)
          let faviconUrl = '';
          try {
            const urlObj = new URL(site.url);
            faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
          } catch (e) {
            // Fallback to direct favicon URL
            faviconUrl = site.url + '/favicon.ico';
          }
          
          suggestions.push({
            type: 'topSite',
            title: site.title,
            url: site.url,
            favicon: faviconUrl,
            score: score
          });
          processedUrls.add(site.url);
        }
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
            faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
          } catch (e) {
            // Fallback to direct favicon URL
            faviconUrl = bookmark.url + '/favicon.ico';
          }
          
          suggestions.push({
            type: 'bookmark',
            title: bookmark.title || bookmark.url,
            url: bookmark.url,
            favicon: faviconUrl,
            score: adjustedScore
          });
          processedUrls.add(bookmark.url);
        }
      }
    });
    
    // Sort by relevance score (highest first)
    suggestions.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.url === suggestion.url)
    ).slice(0, 12); // Increased limit before title deduplication
    
    // Also remove duplicates by title to avoid similar entries
    const finalSuggestions = uniqueSuggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.title.toLowerCase() === suggestion.title.toLowerCase())
    ).slice(0, 8);
    
    console.log('Search suggestions:', finalSuggestions);
    return finalSuggestions;
    
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

function toggleBlackRectangle(tabs) {
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
      background: rgba(255, 255, 255, 0.9) !important;
      backdrop-filter: blur(12px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(12px) saturate(180%) !important;
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      border-radius: 24px !important;
      box-shadow: 0 17px 120px 0 rgba(0, 0, 0, 0.05), 0 32px 44.5px 0 rgba(0, 0, 0, 0.10), 0 80px 120px 0 rgba(0, 0, 0, 0.15) !important;
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
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;
    
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
    
    if (typeof window._x_extension_createSearchInput_2024_unique_ !== 'function') {
      console.warn('Arc Search: input UI helper not available.');
      removeOverlay(overlay);
      return;
    }

    const inputParts = window._x_extension_createSearchInput_2024_unique_({
      placeholder: '搜索或输入网址...',
      inputId: '_x_extension_search_input_2024_unique_',
      iconId: '_x_extension_search_icon_2024_unique_',
      containerId: '_x_extension_input_container_2024_unique_'
    });
    const searchInput = inputParts.input;
    const inputContainer = inputParts.container;

    
    // Add focus styles
    searchInput.addEventListener('focus', function() {
      selectedIndex = -1;
      updateSelection();
    });
    
    searchInput.addEventListener('blur', function() {
      // Don't change selectedIndex here to allow keyboard navigation
    });
    
    let latestOverlayQuery = '';

    // Add input event for search suggestions
    searchInput.addEventListener('input', function() {
      const query = this.value.trim();
      latestOverlayQuery = query;
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
    const clickOutsideHandler = function(e) {
      if (!overlay.contains(e.target)) {
        removeOverlay(overlay);
        document.removeEventListener('click', clickOutsideHandler);
      }
    };
    document.addEventListener('click', clickOutsideHandler);
    
    // Add keyboard navigation
    let selectedIndex = -1; // -1 means input is focused, 0+ means suggestion is selected
    const suggestionItems = [];
    let currentSuggestions = []; // Store current suggestions for keyboard navigation
    
    const keydownHandler = function(e) {
      if (e.key === 'Escape' && overlay) {
        removeOverlay(overlay);
        document.removeEventListener('keydown', keydownHandler);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIndex === -1) {
          // Move from input to first suggestion
          selectedIndex = 0;
          searchInput.blur();
        } else {
          // Move to next suggestion
          selectedIndex = (selectedIndex + 1) % suggestionItems.length;
        }
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex === 0) {
          // Move from first suggestion back to input
          selectedIndex = -1;
          searchInput.focus();
        } else if (selectedIndex === -1) {
          // Move from input to last suggestion
          selectedIndex = suggestionItems.length - 1;
          searchInput.blur();
        } else {
          // Move to previous suggestion
          selectedIndex = selectedIndex - 1;
        }
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        
        if (selectedIndex >= 0 && suggestionItems[selectedIndex]) {
          // Check if we're showing search suggestions or tab suggestions
          const isSearchSuggestion = query.length > 0;
          
          if (isSearchSuggestion && currentSuggestions[selectedIndex]) {
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
        } else if (query) {
          // Handle search or URL navigation
          chrome.runtime.sendMessage({
            action: 'searchOrNavigate',
            query: query
          });
          removeOverlay(overlay);
          document.removeEventListener('click', clickOutsideHandler);
          document.removeEventListener('keydown', keydownHandler);
        }
      }
    };
    
    document.addEventListener('keydown', keydownHandler);
    
    function updateSelection() {
      suggestionItems.forEach((item, index) => {
        if (index === selectedIndex) {
          // Add selected background
          item.style.setProperty('background-color', '#F3F4F6', 'important');
          // Update button color
          const button = item.querySelector('button');
          if (button) {
            button.style.setProperty('color', '#1F2937', 'important');
          }
        } else {
          // Reset to default background
          item.style.setProperty('background-color', '#FFFFFF', 'important');
          // Reset button color
          const button = item.querySelector('button');
          if (button) {
            button.style.setProperty('color', '#9CA3AF', 'important');
          }
        }
      });
    }
    
    function updateSearchSuggestions(suggestions, query) {
      // Clear existing suggestions
      suggestionsContainer.innerHTML = '';
      suggestionItems.length = 0;
      
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
          .catch(() => []);
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
      
      // Add New Tab suggestion as first item
      const newTabSuggestion = {
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

      getShortcutRules().then((rules) => {
        if (query !== latestOverlayQuery) {
          return;
        }
        const preSuggestions = [];
        const directUrlSuggestion = getDirectUrlSuggestion(query);
        if (directUrlSuggestion) {
          preSuggestions.push(directUrlSuggestion);
        }
        const keywordSuggestions = buildKeywordSuggestions(query, rules);
        preSuggestions.push(...keywordSuggestions);

        // Add New Tab, ChatGPT and Perplexity suggestions to the beginning
        const allSuggestions = [...preSuggestions, newTabSuggestion, /*chatGptSuggestion, perplexitySuggestion,*/ ...suggestions];
        currentSuggestions = allSuggestions; // Store current suggestions including ChatGPT
        
        // Add search suggestions
        allSuggestions.forEach((suggestion, index) => {
          const suggestionItem = document.createElement('div');
          suggestionItem.id = `_x_extension_suggestion_item_${index}_2024_unique_`;
          const isLastItem = index === allSuggestions.length - 1;
          suggestionItem.style.cssText = `
            all: unset !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 12px 16px !important;
            background: #FFFFFF !important;
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
          
          // Create text wrapper for title and tag
          const textWrapper = document.createElement('div');
          textWrapper.style.cssText = `
            all: unset !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            flex: 1 !important;
            min-width: 0 !important;
            overflow: hidden !important;
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
          
          // Create title with highlighted query
          const title = document.createElement('span');
          let highlightedTitle;
          if (suggestion.type === 'chatgpt' || suggestion.type === 'perplexity' || suggestion.type === 'newtab') {
            // For ChatGPT, Perplexity, and New Tab, don't highlight the query part
            highlightedTitle = suggestion.title;
          } else {
            // For other suggestions, highlight the query
            highlightedTitle = suggestion.title.replace(
              new RegExp(`(${query})`, 'gi'),
              '<mark style="background: #CFE8FF; color: #1E3A8A; padding: 2px 4px; border-radius: 3px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif;">$1</mark>'
            );
          }
          title.innerHTML = highlightedTitle;
          title.style.cssText = `
            all: unset !important;
            color: #111827 !important;
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
          
          textWrapper.appendChild(title);
          
          // Add history tag if type is history
          if (suggestion.type === 'history') {
            const historyTag = document.createElement('span');
            historyTag.textContent = '历史';
            historyTag.style.cssText = `
              all: unset !important;
              background: #F3F4F6 !important;
              color: #6B7280 !important;
              font-size: 10px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              padding: 4px 6px !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              line-height: 1.2 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              display: inline-flex !important;
              align-items: center !important;
              vertical-align: middle !important;
              flex-shrink: 0 !important;
            `;
            textWrapper.appendChild(historyTag);
          }
          
          // Add topSite tag if type is topSite
          if (suggestion.type === 'topSite') {
            const topSiteTag = document.createElement('span');
            topSiteTag.textContent = '常用';
            topSiteTag.style.cssText = `
              all: unset !important;
              background: #F3F4F6 !important;
              color: #6B7280 !important;
              font-size: 10px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              padding: 4px 6px !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              line-height: 1.2 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              display: inline-flex !important;
              align-items: center !important;
              vertical-align: middle !important;
              flex-shrink: 0 !important;
            `;
            textWrapper.appendChild(topSiteTag);
          }
          
          // Add bookmark tag if type is bookmark
          if (suggestion.type === 'bookmark') {
            const bookmarkTag = document.createElement('span');
            bookmarkTag.textContent = '书签';
            bookmarkTag.style.cssText = `
              all: unset !important;
              background: #FEF3C7 !important;
              color: #D97706 !important;
              font-size: 10px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              padding: 4px 6px !important;
              border-radius: 8px !important;
              box-sizing: border-box !important;
              line-height: 1.2 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              display: inline-flex !important;
              align-items: center !important;
              vertical-align: middle !important;
              flex-shrink: 0 !important;
            `;
            textWrapper.appendChild(bookmarkTag);
          }
          
          // Create visit button
          const visitButton = document.createElement('button');
          visitButton.style.cssText = `
            all: unset !important;
            background: transparent !important;
            color: #9CA3AF !important;
            border: none !important;
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
          
          if (suggestion.type === 'newtab') {
            visitButton.innerHTML = '在 Google 中搜索 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
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
              this.style.setProperty('background-color', '#F9FAFB', 'important');
            }
          });
          
          suggestionItem.addEventListener('mouseleave', function() {
            if (suggestionItems.indexOf(this) !== selectedIndex) {
              this.style.setProperty('background-color', '#FFFFFF', 'important');
            }
          });
          
          // Add click handler to visit URL
          visitButton.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('Opening URL:', suggestion.url);
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: suggestion.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
          });
          
          // Add click handler to select item
          suggestionItem.addEventListener('click', function() {
            console.log('Opening URL:', suggestion.url);
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: suggestion.url
            });
            removeOverlay(overlay);
            document.removeEventListener('click', clickOutsideHandler);
            document.removeEventListener('keydown', keydownHandler);
          });
          
          leftSide.appendChild(favicon);
          leftSide.appendChild(textWrapper);
          suggestionItem.appendChild(leftSide);
          suggestionItem.appendChild(visitButton);
          suggestionsContainer.appendChild(suggestionItem);
        });
      
      // Update keyboard navigation
      selectedIndex = -1;
      });
    }
    
    function clearSearchSuggestions() {
      // Clear suggestions and show tabs again
      suggestionsContainer.innerHTML = '';
      suggestionItems.length = 0;
      currentSuggestions = []; // Clear current suggestions
      
      // Re-add tab suggestions
      tabs.forEach((tab, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_suggestion_item_${index}_2024_unique_`;
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px 16px !important;
          background: #FFFFFF !important;
          border-radius: 16px !important;
          margin-bottom: 4px !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          box-sizing: border-box !important;
          margin: 0 0 4px 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;
        
        suggestionItems.push(suggestionItem);
        
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
        
        // Create favicon
        const favicon = document.createElement('img');
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
        title.textContent = tab.title || '无标题';
        title.style.cssText = `
          all: unset !important;
          color: #111827 !important;
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
        switchButton.textContent = 'Switch to Tab';
        switchButton.style.cssText = `
          all: unset !important;
          background: transparent !important;
          color: #9CA3AF !important;
          border: none !important;
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
          display: inline-block !important;
          vertical-align: baseline !important;
        `;
        
        // Add hover effects
        suggestionItem.addEventListener('mouseenter', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this.style.setProperty('background-color', '#F9FAFB', 'important');
          }
        });

        suggestionItem.addEventListener('mouseleave', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this.style.setProperty('background-color', '#FFFFFF', 'important');
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
          document.removeEventListener('click', clickOutsideHandler);
          document.removeEventListener('keydown', keydownHandler);
        });
        
        // Add click handler to select item
        suggestionItem.addEventListener('click', function() {
          chrome.runtime.sendMessage({
            action: 'switchToTab',
            tabId: tab.id
          });
          removeOverlay(overlay);
          document.removeEventListener('click', clickOutsideHandler);
          document.removeEventListener('keydown', keydownHandler);
        });
        
        leftSide.appendChild(favicon);
        leftSide.appendChild(title);
        suggestionItem.appendChild(leftSide);
        suggestionItem.appendChild(switchButton);
        suggestionsContainer.appendChild(suggestionItem);
      });
      
      selectedIndex = -1;
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
      background: #FFFFFF !important;
      border-radius: 0 0 24px 24px !important;
      padding: 8px !important;
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

    // Add tab suggestions
    tabs.forEach((tab, index) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.id = `_x_extension_suggestion_item_${index}_2024_unique_`;
      suggestionItem.style.cssText = `
        all: unset !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 12px 16px !important;
        background: transparent !important;
        border-radius: 16px !important;
        margin-bottom: 4px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        box-sizing: border-box !important;
        margin: 0 0 4px 0 !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        color: inherit !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;
      
      // Store reference to suggestion item
      suggestionItems.push(suggestionItem);

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
        color: #111827 !important;
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
        color: #4B5563 !important;
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

      // Add hover effects
      suggestionItem.addEventListener('mouseenter', function() {
        if (suggestionItems.indexOf(this) !== selectedIndex) {
          this.style.setProperty('background-color', '#F3F4F6', 'important');
        }
      });

      suggestionItem.addEventListener('mouseleave', function() {
        if (suggestionItems.indexOf(this) !== selectedIndex) {
          this.style.setProperty('background-color', '#FFFFFF', 'important');
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
    });
    
    overlay.appendChild(inputContainer);
    overlay.appendChild(suggestionsContainer);
    document.body.appendChild(overlay);
  }
}
