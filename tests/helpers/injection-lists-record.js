'use strict';

// The recording step of runtime-scripts.js's getInjectedScripts: run as a
// child process, it boots the real background, makes it inject each of its
// in-page scripts into a fresh web tab and prints what it passed to
// chrome.scripting.executeScript, as JSON keyed by list name: the files of a
// file injection, or the module URLs an injected function imports (see
// src/platform/injection.ts), as extension paths.

const path = require('path');
const { loadBackground, wait } = require('./background-harness');

const repoRoot = path.resolve(__dirname, '..', '..');

const WEB_TAB = { id: 7, windowId: 1, index: 0, active: true, url: 'https://page.example.test/', title: 'Page', status: 'complete' };

// What an executeScript call loads: its files, or the URLs its function
// imports, as extension paths.
function loadedFiles(details) {
  if (Array.isArray(details.files)) {
    return Array.from(details.files);
  }
  const urls = Array.isArray(details.args) && Array.isArray(details.args[0]) ? details.args[0] : [];
  const normalizedRoot = repoRoot.split(path.sep).join('/');
  return urls.map((url) => String(url).split(path.sep).join('/')
    .replace(/^chrome-extension:\/\/[^/]+\//, '')
    .replace(`${normalizedRoot}/`, ''));
}

function injectedFiles(harness, predicate) {
  const call = harness.calls.find((entry) => entry.name === 'scripting.executeScript' &&
    loadedFiles(entry.args[0]).length > 0 && predicate(loadedFiles(entry.args[0]), entry.args[0]));
  return call ? loadedFiles(call.args[0]) : null;
}

async function record() {
  const lists = {};
  // A tab with nothing of Lumno's in it yet answers no runtime message, so
  // each command falls back to injecting its scripts.
  const harness = loadBackground({
    tabs: [Object.assign({}, WEB_TAB)],
    sync: {
      _x_extension_tab_switcher_enabled_2026_unique_: true,
      _x_extension_document_pip_enabled_2026_unique_: true
    },
    commands: [{ name: 'show-tab-switcher', shortcut: 'Alt+Q' }],
    configureChrome(chromeApi, calls) {
      chromeApi.tabs.sendMessage = (tabId, message, optionsOrCallback, maybeCallback) => {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        calls.push({ name: 'tabs.sendMessage', args: [tabId, message] });
        setTimeout(() => {
          chromeApi.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
          if (callback) callback(undefined);
          chromeApi.runtime.lastError = null;
        }, 0);
      };
    }
  });
  await wait(50);

  harness.chrome.commands.onCommand.dispatch('show-search');
  await wait(300);
  lists.overlay = injectedFiles(harness, (files) => files.includes('build/injected/overlay.js'));

  harness.chrome.tabs.onActivated.dispatch({ tabId: WEB_TAB.id, windowId: 1 });
  await wait(20);
  harness.calls.length = 0;
  harness.chrome.commands.onCommand.dispatch('show-tab-switcher');
  await wait(600);
  lists.shortcutObserver = injectedFiles(harness, (files, options) => options.target && options.target.allFrames === true);
  lists.tabSwitcher = injectedFiles(harness, (files) => files.includes('build/injected/tab-switcher.js'));

  harness.calls.length = 0;
  harness.chrome.commands.onCommand.dispatch('show-search-prefill-v');
  await wait(300);
  lists.copyUrlListener = injectedFiles(harness, (files) => files.includes('build/injected/copy-url-listener.js'));

  harness.calls.length = 0;
  await harness.sendMessage({ action: 'openDocumentPipPicker' }, { tab: Object.assign({}, WEB_TAB), url: WEB_TAB.url }, 600);
  // The picker is injected once no other tab turns out to be playing
  // picture-in-picture.
  await wait(600);
  lists.documentPipPicker = injectedFiles(harness, (files) => files.includes('build/injected/pip-picker.js'));

  return lists;
}

record().then((lists) => {
  process.stdout.write(JSON.stringify(lists));
  // The worker keeps timers running; the lists are all this process is for.
  process.exit(0);
}).catch((error) => {
  process.stderr.write(String(error && error.stack || error));
  process.exit(1);
});
