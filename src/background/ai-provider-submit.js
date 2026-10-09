(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoAiProviderSubmit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const GENERIC_PROMPT_EDITOR_SELECTORS = Object.freeze([
    'textarea[placeholder*="发消息"]',
    'textarea[aria-label*="发消息"]',
    'textarea[placeholder*="输入"]',
    'textarea[aria-label*="输入"]',
    'textarea[placeholder*="消息"]',
    'textarea[aria-label*="消息"]',
    'textarea[placeholder*="Message"]',
    'textarea[aria-label*="Message"]',
    'textarea[placeholder*="message" i]',
    'textarea[aria-label*="message" i]',
    '[contenteditable="true"][data-placeholder*="发消息"]',
    '[contenteditable="true"][aria-label*="发消息"]',
    '[contenteditable="true"][data-placeholder*="输入"]',
    '[contenteditable="true"][aria-label*="输入"]',
    '[contenteditable="true"][data-placeholder*="消息"]',
    '[contenteditable="true"][aria-label*="消息"]',
    '[contenteditable="true"][data-placeholder*="Message"]',
    '[contenteditable="true"][aria-label*="Message"]',
    '[contenteditable="true"][role="textbox"]',
    '[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"]',
    'textarea'
  ]);

  const GENERIC_SEND_BUTTON_SELECTORS = Object.freeze([
    'button[aria-label*="发送消息"]',
    'button[aria-label*="发送"]',
    'button[aria-label*="提交"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="submit" i]'
  ]);

  function uniqueSelectors(groups) {
    const seen = new Set();
    const items = [];
    groups.forEach((group) => {
      (Array.isArray(group) ? group : []).forEach((selector) => {
        if (!selector || seen.has(selector)) {
          return;
        }
        seen.add(selector);
        items.push(selector);
      });
    });
    return items;
  }

  function createPromptStrategy(options) {
    const settings = options && typeof options === 'object' ? options : {};
    return {
      editorSelectors: uniqueSelectors([
        settings.editorSelectors,
        GENERIC_PROMPT_EDITOR_SELECTORS
      ]),
      sendButtonSelectors: uniqueSelectors([
        settings.sendButtonSelectors,
        GENERIC_SEND_BUTTON_SELECTORS
      ]),
      buttonWaitAttempts: Math.max(0, Number(settings.buttonWaitAttempts) || 0),
      editorWaitAttempts: Math.max(1, Number(settings.editorWaitAttempts) || 12),
      urlPrefillWaitAttempts: Math.max(0, Number(settings.urlPrefillWaitAttempts) || 0),
      enterDelayMs: Math.max(0, Number(settings.enterDelayMs) || 0),
      postEnterDelayMs: Math.max(0, Number(settings.postEnterDelayMs) || 0),
      postEnterButtonAttempts: Math.max(0, Number(settings.postEnterButtonAttempts) || 0),
      submitMode: String(settings.submitMode || '').trim(),
      contentEditableFillMode: String(settings.contentEditableFillMode || '').trim(),
      inputEventDataMode: String(settings.inputEventDataMode || '').trim(),
      useNearbySendButton: Boolean(settings.useNearbySendButton),
      postEnterUseNearbySendButton: Boolean(settings.postEnterUseNearbySendButton)
    };
  }

  function createEnterPromptStrategy(editorSelectors, options) {
    const settings = options && typeof options === 'object' ? options : {};
    return createPromptStrategy({
      editorSelectors,
      buttonWaitAttempts: 0,
      editorWaitAttempts: settings.editorWaitAttempts || 24,
      enterDelayMs: 180,
      postEnterDelayMs: 320,
      postEnterButtonAttempts: settings.postEnterButtonAttempts || 8,
      submitMode: 'enter',
      contentEditableFillMode: settings.contentEditableFillMode,
      inputEventDataMode: settings.inputEventDataMode,
      useNearbySendButton: true
    });
  }

  const STRATEGIES = Object.freeze({
    geminiPrompt: createPromptStrategy({
      editorSelectors: [
        '.ql-editor[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"][role="textbox"][aria-label*="Gemini"]',
        '[contenteditable="true"][role="textbox"][aria-label*="gemini"]',
        '[contenteditable="true"][data-placeholder*="Gemini"]',
        '[contenteditable="true"][data-placeholder*="gemini"]',
        'rich-textarea .ql-editor[contenteditable="true"]',
        'textarea[aria-label*="Gemini"]',
        'textarea[aria-label*="gemini"]',
        'div[role="textbox"][contenteditable="true"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[aria-label="发送"]',
        'button[aria-label="Send"]',
        'button[aria-label*="发送"]',
        'button[aria-label*="提交"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="send" i]',
        'button[aria-label*="submit" i]'
      ],
      buttonWaitAttempts: 24,
      postEnterDelayMs: 320,
      postEnterButtonAttempts: 12,
      postEnterUseNearbySendButton: true
    }),
    chatgptPrompt: createPromptStrategy({
      editorSelectors: [
        'textarea[aria-label*="ChatGPT"]',
        'textarea[placeholder*="ChatGPT"]',
        '[contenteditable="true"][aria-label*="ChatGPT"]',
        '[contenteditable="true"][data-placeholder*="ChatGPT"]',
        'div[role="textbox"][contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'textarea'
      ],
      sendButtonSelectors: [
        'button[aria-label="发送提示"]',
        'button[aria-label="Send prompt"]',
        'button[data-testid="send-button"]',
        'button[aria-label*="发送"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="send" i]',
        'button[aria-label*="submit" i]'
      ],
      buttonWaitAttempts: 24,
      // ChatGPT fills the composer from ?q= itself (next to the ?hints=search
      // pill). Rewriting its editor races that prefill and can send the pill alone.
      urlPrefillWaitAttempts: 20
    }),
    doubaoPrompt: createEnterPromptStrategy([
      'textarea[placeholder*="发消息"]',
      'textarea[aria-label*="发消息"]',
      '[contenteditable="true"][data-placeholder*="发消息"]',
      '[contenteditable="true"][aria-label*="发消息"]'
    ]),
    yuanbaoPrompt: createPromptStrategy({
      editorSelectors: [
        'textarea[placeholder*="腾讯元宝"]',
        'textarea[aria-label*="腾讯元宝"]',
        '[contenteditable="true"][data-placeholder*="腾讯元宝"]',
        '[contenteditable="true"][aria-label*="腾讯元宝"]',
        'textarea[placeholder*="元宝"]',
        'textarea[aria-label*="元宝"]',
        '[contenteditable="true"][data-placeholder*="元宝"]',
        '[contenteditable="true"][aria-label*="元宝"]',
        'textarea[placeholder*="有问题"]',
        'textarea[aria-label*="有问题"]',
        '[contenteditable="true"][data-placeholder*="有问题"]',
        '[contenteditable="true"][aria-label*="有问题"]'
      ],
      sendButtonSelectors: [
        '#yuanbao-send-btn',
        'a[id*="send" i]',
        'a[class*="send" i]',
        '[role="button"][id*="send" i]',
        '[role="button"][class*="send" i]',
        'button[id*="send" i]',
        'button[class*="send" i]'
      ],
      buttonWaitAttempts: 12,
      editorWaitAttempts: 36,
      enterDelayMs: 180,
      contentEditableFillMode: 'replace',
      inputEventDataMode: 'none',
      useNearbySendButton: true,
      postEnterButtonAttempts: 12
    }),
    minimaxPrompt: createEnterPromptStrategy([
      'textarea[placeholder*="MiniMax"]',
      'textarea[aria-label*="MiniMax"]',
      '[contenteditable="true"][data-placeholder*="MiniMax"]',
      '[contenteditable="true"][aria-label*="MiniMax"]',
      'textarea[placeholder*="Minimax"]',
      'textarea[aria-label*="Minimax"]',
      '[contenteditable="true"][data-placeholder*="Minimax"]',
      '[contenteditable="true"][aria-label*="Minimax"]'
    ]),
    deepseekPrompt: createEnterPromptStrategy([
      'textarea[placeholder*="DeepSeek"]',
      'textarea[aria-label*="DeepSeek"]',
      '[contenteditable="true"][data-placeholder*="DeepSeek"]',
      '[contenteditable="true"][aria-label*="DeepSeek"]',
      'textarea[placeholder*="deepseek" i]',
      'textarea[aria-label*="deepseek" i]',
      '[contenteditable="true"][data-placeholder*="deepseek" i]',
      '[contenteditable="true"][aria-label*="deepseek" i]'
    ]),
    kimiPrompt: createEnterPromptStrategy([
      '.chat-input-editor[contenteditable="true"]',
      '[data-lexical-editor="true"][contenteditable="true"]',
      'textarea[placeholder*="Kimi"]',
      'textarea[aria-label*="Kimi"]',
      '[contenteditable="true"][data-placeholder*="Kimi"]',
      '[contenteditable="true"][aria-label*="Kimi"]',
      'textarea[placeholder*="kimi" i]',
      'textarea[aria-label*="kimi" i]',
      '[contenteditable="true"][data-placeholder*="kimi" i]',
      '[contenteditable="true"][aria-label*="kimi" i]'
    ], {
      editorWaitAttempts: 48,
      inputEventDataMode: 'none'
    }),
    qianwenQuery: {
      urlOnly: true
    }
  });

  const STRATEGY_ALLOWED_ORIGINS = Object.freeze({
    geminiPrompt: Object.freeze(['https://gemini.google.com']),
    chatgptPrompt: Object.freeze(['https://chatgpt.com']),
    doubaoPrompt: Object.freeze(['https://www.doubao.com']),
    qianwenQuery: Object.freeze(['https://www.qianwen.com']),
    yuanbaoPrompt: Object.freeze(['https://yuanbao.tencent.com']),
    minimaxPrompt: Object.freeze(['https://chat.minimax.io']),
    deepseekPrompt: Object.freeze(['https://chat.deepseek.com']),
    kimiPrompt: Object.freeze(['https://www.kimi.com'])
  });

  function getStrategyConfig(strategyName) {
    const key = String(strategyName || '').trim();
    const config = STRATEGIES[key];
    if (!config) {
      return null;
    }
    return {
      ...config,
      editorSelectors: Array.isArray(config.editorSelectors) ? config.editorSelectors.slice() : [],
      sendButtonSelectors: Array.isArray(config.sendButtonSelectors) ? config.sendButtonSelectors.slice() : []
    };
  }

  function getHttpOrigin(urlValue) {
    try {
      const url = new URL(String(urlValue || ''));
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return '';
      }
      return url.origin;
    } catch (_error) {
      return '';
    }
  }

  function getAllowedStrategyOrigins(strategyName) {
    const key = String(strategyName || '').trim();
    const origins = STRATEGY_ALLOWED_ORIGINS[key];
    return Array.isArray(origins) ? origins.slice() : [];
  }

  function isAllowedStrategyOrigin(strategyName, origin) {
    const normalizedOrigin = String(origin || '').trim();
    return Boolean(
      normalizedOrigin &&
      getAllowedStrategyOrigins(strategyName).includes(normalizedOrigin)
    );
  }

  function getCurrentTab(chromeApi, tabId) {
    return new Promise((resolve) => {
      if (!chromeApi || !chromeApi.tabs || typeof chromeApi.tabs.get !== 'function') {
        resolve({ ok: false, reason: 'tab-query-unavailable' });
        return;
      }
      chromeApi.tabs.get(tabId, (tab) => {
        const runtimeError = chromeApi.runtime && chromeApi.runtime.lastError;
        if (runtimeError) {
          resolve({ ok: false, reason: runtimeError.message || 'tab-unavailable' });
          return;
        }
        resolve(tab && typeof tab === 'object'
          ? { ok: true, tab }
          : { ok: false, reason: 'tab-unavailable' });
      });
    });
  }

  async function submitPromptInTab(chromeApi, tabId, prompt, strategyName, expectedUrl) {
    const promptText = String(prompt || '').trim();
    const config = getStrategyConfig(strategyName);
    if (!promptText) {
      return Promise.resolve({ ok: false, reason: 'empty-prompt' });
    }
    if (!config) {
      return Promise.resolve({ ok: false, reason: 'unknown-submit-strategy' });
    }
    const expectedOrigin = getHttpOrigin(expectedUrl);
    if (!expectedOrigin) {
      return { ok: false, reason: 'invalid-expected-origin' };
    }
    if (!isAllowedStrategyOrigin(strategyName, expectedOrigin)) {
      return { ok: false, reason: 'unapproved-submit-origin' };
    }
    if (config.urlOnly) {
      return Promise.resolve({ ok: true, method: 'url' });
    }
    const currentTab = await getCurrentTab(chromeApi, tabId);
    if (!currentTab.ok) {
      return currentTab;
    }
    if (getHttpOrigin(currentTab.tab.url) !== expectedOrigin) {
      return { ok: false, reason: 'unexpected-tab-origin' };
    }
    return new Promise((resolve) => {
      chromeApi.scripting.executeScript({
        target: { tabId: tabId },
        func: async (allowedOrigin, rawPrompt, strategyConfig) => {
          if (!window.location || window.location.origin !== allowedOrigin) {
            return { ok: false, reason: 'unexpected-document-origin' };
          }
          const promptText = String(rawPrompt || '').trim();
          if (!promptText) {
            return { ok: false, reason: 'empty-prompt' };
          }
          const config = strategyConfig && typeof strategyConfig === 'object' ? strategyConfig : {};
          const editorSelectors = Array.isArray(config.editorSelectors) ? config.editorSelectors : [];
          const sendButtonSelectors = Array.isArray(config.sendButtonSelectors) ? config.sendButtonSelectors : [];
          const buttonWaitAttempts = Math.max(0, Number(config.buttonWaitAttempts) || 0);
          const editorWaitAttempts = Math.max(1, Number(config.editorWaitAttempts) || 12);
          const urlPrefillWaitAttempts = Math.max(0, Number(config.urlPrefillWaitAttempts) || 0);
          const enterDelayMs = Math.max(0, Number(config.enterDelayMs) || 0);
          const postEnterDelayMs = Math.max(0, Number(config.postEnterDelayMs) || 0);
          const postEnterButtonAttempts = Math.max(0, Number(config.postEnterButtonAttempts) || 0);
          const submitMode = String(config.submitMode || '').trim();
          const contentEditableFillMode = String(config.contentEditableFillMode || '').trim();
          const inputEventDataMode = String(config.inputEventDataMode || '').trim();
          const useNearbySendButton = Boolean(config.useNearbySendButton);
          const postEnterUseNearbySendButton = Boolean(config.postEnterUseNearbySendButton);
          const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
          const isVisible = (element) => {
            if (!element) {
              return false;
            }
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const isActionableButton = (element) => {
            if (!isVisible(element) || element.disabled) {
              return false;
            }
            const style = window.getComputedStyle(element);
            const ariaDisabled = String(element.getAttribute('aria-disabled') || '').toLowerCase();
            const className = String(element.className || '').toLowerCase();
            return (
              ariaDisabled !== 'true' &&
              !className.includes('disabled') &&
              style.pointerEvents !== 'none' &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              Number(style.opacity || '1') > 0.2
            );
          };
          const escapeHtml = (value) => value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          const dispatchInput = (element) => {
            if (typeof InputEvent === 'function') {
              const eventData = inputEventDataMode === 'none' ? null : promptText;
              element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                data: eventData,
                inputType: inputEventDataMode === 'none' ? 'insertReplacementText' : 'insertText'
              }));
            } else {
              element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            }
            element.dispatchEvent(new Event('change', { bubbles: true }));
          };
          const queryAll = (selector) => {
            try {
              return Array.from(document.querySelectorAll(selector));
            } catch (error) {
              return [];
            }
          };
          const queryWithin = (container, selector) => {
            try {
              return Array.from(container.querySelectorAll(selector));
            } catch (error) {
              return [];
            }
          };
          const findEditor = () => {
            for (const selector of editorSelectors) {
              const editor = queryAll(selector).find(isVisible);
              if (editor) {
                return editor;
              }
            }
            return null;
          };
          const findNearbySendButton = (editor, shouldUseNearby) => {
            if (!shouldUseNearby || !editor) {
              return null;
            }
            const editorRect = editor.getBoundingClientRect();
            const candidates = [];
            let root = editor.parentElement;
            for (let depth = 0; root && depth < 8; depth += 1, root = root.parentElement) {
              queryWithin(root, 'button,[role="button"]').forEach((button) => {
                if (!isActionableButton(button)) {
                  return;
                }
                const rect = button.getBoundingClientRect();
                const isLikelyComposerButton = (
                  rect.width <= 80 &&
                  rect.height <= 80 &&
                  rect.bottom >= editorRect.top - 24 &&
                  rect.top <= editorRect.bottom + 72 &&
                  rect.right >= editorRect.left
                );
                if (!isLikelyComposerButton) {
                  return;
                }
                const horizontal = Math.abs(rect.right - editorRect.right);
                const vertical = Math.abs(rect.bottom - editorRect.bottom);
                const sidePenalty = rect.left < editorRect.left ? 160 : 0;
                candidates.push({
                  button,
                  score: horizontal + vertical + sidePenalty + depth * 8
                });
              });
            }
            candidates.sort((a, b) => a.score - b.score);
            return candidates.length > 0 ? candidates[0].button : null;
          };
          const findSendButton = (editor, options) => {
            const shouldUseNearby = Boolean(options && options.useNearby);
            for (const selector of sendButtonSelectors) {
              const button = queryAll(selector).find(isVisible);
              if (button) {
                return button;
              }
            }
            return findNearbySendButton(editor, shouldUseNearby);
          };
          const setNativeValue = (editor, value) => {
            const prototype = editor instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
            if (descriptor && typeof descriptor.set === 'function') {
              descriptor.set.call(editor, value);
              return;
            }
            editor.value = value;
          };
          const setContentEditablePrompt = (editor) => {
            editor.innerHTML = `<p>${escapeHtml(promptText)}</p>`;
          };
          const setPrompt = (editor) => {
            editor.focus();
            if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
              setNativeValue(editor, promptText);
              dispatchInput(editor);
              return String(editor.value || '').trim() === promptText;
            }
            if (contentEditableFillMode === 'replace') {
              setContentEditablePrompt(editor);
              dispatchInput(editor);
              return String(editor.innerText || editor.textContent || '').trim() === promptText;
            }
            const selection = window.getSelection();
            if (selection) {
              const range = document.createRange();
              range.selectNodeContents(editor);
              selection.removeAllRanges();
              selection.addRange(range);
            }
            if (typeof document.execCommand === 'function') {
              document.execCommand('insertText', false, promptText);
            }
            const currentText = String(editor.innerText || editor.textContent || '').trim();
            if (currentText !== promptText) {
              setContentEditablePrompt(editor);
            }
            dispatchInput(editor);
            return String(editor.innerText || editor.textContent || '').trim() === promptText;
          };
          const getEditorText = (editor) => {
            if (!editor) {
              return '';
            }
            if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
              return String(editor.value || '').trim();
            }
            return String(editor.innerText || editor.textContent || '').trim();
          };
          const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();
          const hasUrlPrefill = (editor) => {
            const normalizedPrompt = normalizeWhitespace(promptText);
            return Boolean(normalizedPrompt) && normalizeWhitespace(getEditorText(editor)).includes(normalizedPrompt);
          };
          const waitForUrlPrefill = async () => {
            for (let attempt = 0; attempt < urlPrefillWaitAttempts; attempt += 1) {
              const editor = findEditor();
              if (editor && hasUrlPrefill(editor)) {
                // Let the page finish applying the prefill before sending.
                await sleep(200);
                const settledEditor = findEditor();
                if (settledEditor && hasUrlPrefill(settledEditor)) {
                  return settledEditor;
                }
              }
              await sleep(250);
            }
            return null;
          };
          const collapseDuplicatePrompt = (editor) => {
            const currentText = getEditorText(editor);
            if (!currentText || currentText === promptText) {
              return false;
            }
            const remainder = currentText.split(promptText).join('').trim();
            if (remainder || currentText.split(promptText).length - 1 < 2) {
              return false;
            }
            if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
              setNativeValue(editor, promptText);
              editor.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
            setContentEditablePrompt(editor);
            editor.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          };
          const pressEnter = (editor) => {
            ['keydown', 'keypress', 'keyup'].forEach((type) => {
              const event = new KeyboardEvent(type, {
                key: 'Enter',
                code: 'Enter',
                bubbles: true,
                cancelable: true,
                composed: true
              });
              [
                ['keyCode', 13],
                ['which', 13],
                ['charCode', type === 'keypress' ? 13 : 0]
              ].forEach(([name, value]) => {
                try {
                  Object.defineProperty(event, name, { get: () => value });
                } catch (error) {
                  // Some engines expose these fields as non-configurable.
                }
              });
              editor.dispatchEvent(event);
            });
          };
          const prefilledEditor = urlPrefillWaitAttempts > 0 ? await waitForUrlPrefill() : null;
          if (prefilledEditor) {
            for (let sendAttempt = 0; sendAttempt < Math.max(1, buttonWaitAttempts); sendAttempt += 1) {
              const sendButton = findSendButton(prefilledEditor, { useNearby: useNearbySendButton });
              if (sendButton && isActionableButton(sendButton)) {
                sendButton.click();
                return { ok: true, method: 'prefill-button' };
              }
              await sleep(sendAttempt < 4 ? 150 : 250);
            }
            pressEnter(prefilledEditor);
            return { ok: true, method: 'prefill-enter' };
          }
          for (let attempt = 0; attempt < editorWaitAttempts; attempt += 1) {
            const editor = findEditor();
            if (!editor) {
              await sleep(400);
              continue;
            }
            const populated = setPrompt(editor);
            if (!populated) {
              await sleep(250);
              continue;
            }
            if (submitMode !== 'enter') {
              for (let sendAttempt = 0; sendAttempt < buttonWaitAttempts; sendAttempt += 1) {
                const sendButton = findSendButton(editor, { useNearby: useNearbySendButton });
                if (sendButton && isActionableButton(sendButton)) {
                  sendButton.click();
                  return { ok: true, method: 'button' };
                }
                await sleep(sendAttempt < 4 ? 150 : 250);
              }
            }
            if (enterDelayMs > 0) {
              await sleep(enterDelayMs);
            }
            if (collapseDuplicatePrompt(editor)) {
              await sleep(80);
            }
            pressEnter(editor);
            if (postEnterDelayMs > 0) {
              await sleep(postEnterDelayMs);
            }
            if (getEditorText(editor) === promptText) {
              for (let postEnterAttempt = 0; postEnterAttempt < Math.max(1, postEnterButtonAttempts); postEnterAttempt += 1) {
                const sendButton = findSendButton(editor, {
                  useNearby: useNearbySendButton || postEnterUseNearbySendButton
                });
                if (sendButton && isActionableButton(sendButton)) {
                  sendButton.click();
                  return { ok: true, method: 'enter-button' };
                }
                if (postEnterAttempt + 1 < postEnterButtonAttempts) {
                  await sleep(180);
                }
              }
            }
            return { ok: true, method: 'enter' };
          }
          return { ok: false, reason: 'editor-not-found' };
        },
        args: [expectedOrigin, promptText, config]
      }, (results) => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          resolve({ ok: false, reason: chromeApi.runtime.lastError.message || 'execute-script-failed' });
          return;
        }
        const result = Array.isArray(results) && results[0] ? results[0].result : null;
        resolve(result && typeof result === 'object' ? result : { ok: false, reason: 'empty-script-result' });
      });
    });
  }

  return Object.freeze({
    getAllowedStrategyOrigins,
    getHttpOrigin,
    getStrategyConfig,
    isAllowedStrategyOrigin,
    submitPromptInTab
  });
});
