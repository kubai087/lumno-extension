'use strict';

// Every script the extension runs is built from one of these entries into
// build/<name>.js (scripts/build/build.js). Pages, the manifest, the
// background's injection lists and the checks name an entry by that path.
//
// Kinds:
//   page     an extension page's script: an ES module (<script type="module">)
//            that the page loads once its markup is parsed. Page entries are
//            built together, so they share chunks (React, shared UI) through
//            imports, in build/chunks/.
//   preload  a classic script a page loads in <head> before first paint. It
//            imports nothing at run time, and hands what the page needs on
//            through the boot handoff (src/platform/boot-handoff.ts).
//   classic  a self-contained classic script: the service worker, content
//            scripts, scripts the worker injects or imports, and small page
//            scripts.
//   injected an ES module the worker imports into a web page's isolated world
//            and calls run() on, built into build/injected/. Injected entries
//            are built together, so they share chunks (React) through
//            imports, in build/injected/chunks/.
//   module   an ES module code imports by URL on first use, under a fixed
//            name.
//
// Every entry is one module; an entry that runs several modules imports
// them in order.

const ENTRIES = [
  // The service worker
  { name: 'background', kind: 'classic', source: 'src/background/background.ts' },

  // New Tab
  { name: 'newtab-preload', kind: 'preload', source: 'src/newtab/newtab-preload-entry.ts' },
  { name: 'wallpaper-effect-preload', kind: 'preload', source: 'src/newtab/wallpaper/wallpaper-effect-preload.ts' },
  { name: 'newtab', kind: 'page', source: 'src/newtab/newtab-entry.ts' },
  { name: 'newtab-route-redirect', kind: 'classic', source: 'src/newtab/newtab-route-redirect.ts' },
  { name: 'lumno-newtab', kind: 'classic', source: 'src/newtab/lumno-newtab.ts' },

  // Settings
  { name: 'options-preload', kind: 'preload', source: 'src/options/options-preload-entry.ts' },
  { name: 'options', kind: 'page', source: 'src/options/options-entry.ts' },

  // Onboarding: its demo overlay is the injected overlay, loaded by the page.
  { name: 'onboarding-preload', kind: 'preload', source: 'src/shared/scrollbar-mode.ts' },
  { name: 'onboarding', kind: 'page', source: 'src/onboarding/onboarding-entry.ts' },

  // Toolbar popup
  { name: 'popup-preload', kind: 'preload', source: 'src/popup/popup-theme-preload.ts' },
  { name: 'popup', kind: 'page', source: 'src/popup/app/main.ts' },

  // Shared by the pages
  { name: 'cjk-font-faces', kind: 'classic', source: 'src/shared/cjk-font-faces.ts' },

  // Injected into web pages by the worker, which imports them in the page
  // (src/platform/injection.ts, src/domain/injected-commands.ts)
  { name: 'icon-font-preload', kind: 'injected', source: 'src/shared/icon-font-preload.ts' },
  { name: 'overlay', kind: 'injected', source: 'src/overlay/overlay-app.ts' },
  { name: 'tab-switcher', kind: 'injected', source: 'src/shared/tab-switcher/tab-switcher-app.ts' },
  { name: 'link-preview', kind: 'injected', source: 'src/content/link-preview.ts' },
  { name: 'pip-picker', kind: 'injected', source: 'src/content/document-pip-picker.ts' },
  { name: 'page-shortcut-toast', kind: 'injected', source: 'src/content/page-shortcut-toast.ts' },
  { name: 'copy-url-listener', kind: 'injected', source: 'src/content/hotkey-listener.ts' },
  { name: 'ai-prompt-submit', kind: 'injected', source: 'src/content/ai-prompt-submit.ts' },
  { name: 'selection-quick-actions', kind: 'classic', source: 'src/content/selection-quick-actions.ts' },

  // Manifest content scripts
  { name: 'shortcut-key-observer', kind: 'classic', source: 'src/content/shortcut-key-observer-entry.ts' },
  { name: 'site-auto-pip', kind: 'classic', source: 'src/content/site-auto-pip.ts' },
  { name: 'youtube-auto-pip', kind: 'classic', source: 'src/content/youtube-auto-pip.ts' },

  // Registered by the background in the page's main world
  { name: 'pip-page-bridge', kind: 'classic', source: 'src/content/pip-page-bridge.ts' },

  // Imported by URL on first use: by the pages and the overlay, and by the worker
  { name: 'han-variants', kind: 'module', source: 'src/domain/search/han-variants.generated.ts' },
  { name: 'pinyin', kind: 'module', source: 'src/shared/search/pinyin-module.ts' },
  { name: 'pinyin-data', kind: 'classic', source: 'src/background/pinyin-data.ts' }
];

const ENTRY_KINDS = ['page', 'preload', 'classic', 'injected', 'module'];

// Where the entries are built, inside the extension.
const BUILD_DIRECTORY = 'build';

ENTRIES.forEach((entry) => {
  if (!ENTRY_KINDS.includes(entry.kind)) {
    throw new Error(`Entry ${entry.name} has an unknown kind: ${entry.kind}`);
  }
  if (!/\.tsx?$/.test(entry.source)) {
    throw new Error(`Entry ${entry.name} must be a TypeScript module: ${entry.source}`);
  }
});

// Where an entry's script is built, inside the extension.
function entryOutputPath(entry) {
  return entry.kind === 'injected'
    ? `${BUILD_DIRECTORY}/injected/${entry.name}.js`
    : `${BUILD_DIRECTORY}/${entry.name}.js`;
}

function getEntry(name) {
  const entry = ENTRIES.find((candidate) => candidate.name === name);
  if (!entry) {
    throw new Error(`No entry named ${name} in scripts/build/entries.js`);
  }
  return entry;
}

module.exports = { BUILD_DIRECTORY, ENTRIES, ENTRY_KINDS, entryOutputPath, getEntry };
