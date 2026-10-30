// Real-browser layout checks for New Tab shortcut groups.
//
// Loads the unpacked extension into a headless Chromium (no window, no
// focus), seeds grouped shortcuts and runs each interaction while recording
// where the search box, group titles, tiles, slots and the bottom dock sit.
// Each check names what may move; anything else that moves fails it.
//
//   npm run e2e:shortcut-groups
//   LUMNO_E2E_CHROME=/path/to/chrome npm run e2e:shortcut-groups
//   LUMNO_E2E_ONLY=drag npm run e2e:shortcut-groups   (checks whose name contains "drag")
//
// Not part of `npm test`: it needs a Chromium build that loads extensions
// (Chrome for Testing or Chromium; branded Chrome refuses --load-extension).
const path = require('path');
const { EXTENSION_OUTPUT } = require('../build/extension-output');
const WebSocket = require('ws');
const { importSource } = require('../node/source-module');
const { findChrome, launchChrome } = require('./chrome-launcher.js');

// The shortcut storage plans the page reads, loaded at the start of main().
let shortcutsStore = null;

const repoRoot = path.resolve(__dirname, '..', '..');
// The development build (npm run build).
const extensionDir = path.join(repoRoot, EXTENSION_OUTPUT);
const EXTENSION_ID = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';
const NEWTAB_URL = `chrome-extension://${EXTENSION_ID}/newtab.html`;
const TOLERANCE_PX = 0.75;
const SETTLE_MS = 450;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpConnection {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, method } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result || {});
        return;
      }
      this.listeners.forEach((listener) => listener(message));
    });
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    try { this.socket.close(); } catch (_error) { /* already closed */ }
  }
}

async function launchBrowser() {
  const executable = findChrome(process.env.LUMNO_E2E_CHROME);
  if (!executable) {
    throw new Error('No Chromium build that loads extensions was found; set LUMNO_E2E_CHROME.');
  }
  const port = 9400 + Math.floor(Math.random() * 400);
  const browser = launchChrome({
    executable,
    profileName: 'e2e',
    args: [
      '--headless=new',
      `--load-extension=${extensionDir}`,
      `--disable-extensions-except=${extensionDir}`,
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      'about:blank'
    ]
  });
  let version = null;
  for (let attempt = 0; attempt < 100 && !version; attempt += 1) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch (_error) {
      await delay(150);
    }
  }
  if (!version) {
    await browser.close();
    throw new Error('Chromium did not open its DevTools port.');
  }
  const cdp = new CdpConnection(version.webSocketDebuggerUrl);
  const close = () => {
    cdp.close();
    return browser.close();
  };
  return { cdp, close };
}

async function openPage(cdp, viewport) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const errors = [];
  cdp.listeners.push((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
    }
  });
  const send = (method, params) => cdp.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
  const page = {
    errors,
    send,
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result.value;
    },
    async load() {
      await send('Page.navigate', { url: NEWTAB_URL });
      await send('Page.bringToFront');
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await delay(100);
        try {
          if (await page.evaluate(`document.body && document.body.getAttribute('data-nt-ready') === '1' &&
            location.search === '' && document.body.getAttribute('data-nt-enter') !== 'run'`)) break;
        } catch (_error) { /* navigating */ }
      }
      // Entry motion, favicons and the first adaptive tone pass.
      await delay(1600);
      // Loading the unpacked extension opens onboarding as a new tab on every
      // launch; when it lands after this page, this page goes to the background
      // and its CSS transitions freeze at their first frame.
      if (await page.evaluate('document.visibilityState') !== 'visible') {
        await send('Page.bringToFront');
        await delay(800);
      }
    },
    async seed(groups, items, extra = {}) {
      if (!(await page.evaluate('location.href')).startsWith(NEWTAB_URL)) {
        await page.load();
      }
      const payload = shortcutsStore.createShortcutStoragePlan({ groups, items }).payload;
      await page.evaluate(`new Promise((resolve) => chrome.storage.sync.set(${JSON.stringify({ ...payload, ...extra })}, resolve))`);
      await page.load();
    },
    async rect(selector) {
      return page.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return null;
        const r = element.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      })()`);
    },
    mouse(type, x, y, extra = {}) {
      return send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
    },
    async hover(selector, offsetX = 0) {
      const r = await page.rect(selector);
      await page.mouse('mouseMoved', r.x + offsetX, r.y, { button: 'none' });
    },
    async click(selector, clickCount = 1) {
      const r = await page.rect(selector);
      if (!r) throw new Error(`Missing ${selector}`);
      await page.mouse('mouseMoved', r.x, r.y, { button: 'none' });
      for (let count = 1; count <= clickCount; count += 1) {
        await page.mouse('mousePressed', r.x, r.y, { buttons: 1, clickCount: count });
        await page.mouse('mouseReleased', r.x, r.y, { clickCount: count });
      }
    },
    async contextMenu(selector) {
      await page.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        const r = element.getBoundingClientRect();
        element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      })()`);
    },
    async key(key, modifiers = 0) {
      const codes = { Enter: ['Enter', 13], Escape: ['Escape', 27], Backspace: ['Backspace', 8], z: ['KeyZ', 90],
        ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39] };
      const [code, keyCode] = codes[key];
      // Enter carries its character, or a form would not submit.
      const text = key === 'Enter' ? { type: 'keyDown', text: '\r', unmodifiedText: '\r' } : { type: 'rawKeyDown' };
      await send('Input.dispatchKeyEvent', { ...text, key, code, windowsVirtualKeyCode: keyCode, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
    },
    async type(text) {
      await send('Input.insertText', { text });
    },
    async drag(fromSelector, toPoint, options = {}) {
      const from = await page.rect(fromSelector);
      const steps = options.steps || 14;
      await page.mouse('mouseMoved', from.x, from.y, { button: 'none' });
      await page.mouse('mousePressed', from.x, from.y, { buttons: 1 });
      for (let step = 1; step <= steps; step += 1) {
        await page.mouse('mouseMoved', from.x + (toPoint.x - from.x) * step / steps,
          from.y + (toPoint.y - from.y) * step / steps, { buttons: 1 });
        await delay(35);
      }
      await delay(options.hold || 200);
      // `before` may move on and return where the pointer is let go.
      const releasePoint = (options.before && await options.before()) || toPoint;
      if (options.cancel) {
        await page.key('Escape');
        await page.mouse('mouseReleased', releasePoint.x, releasePoint.y, { buttons: 0 });
      } else {
        await page.mouse('mouseReleased', releasePoint.x, releasePoint.y, { buttons: 0 });
      }
    },
    // Where every part of the page that should hold still sits. Group titles
    // are keyed by group, tiles by shortcut, so a re-render keeps the keys.
    // Shortcut parts count from the top of the area's content, so scrolling
    // the area is not a move; the area itself counts by its center, since a
    // classic scrollbar widens it on both sides.
    snapshot() {
      return page.evaluate(`(() => {
        const out = {};
        const section = document.querySelector('.x-nt-shortcuts-section');
        const scrollTop = section ? section.scrollTop : 0;
        const put = (key, element, inArea) => {
          if (!element) return;
          const r = element.getBoundingClientRect();
          if (!r.width && !r.height) return;
          out[key] = { left: r.left, top: r.top + (inArea ? scrollTop : 0), width: r.width, height: r.height };
        };
        put('search', document.getElementById('_x_extension_newtab_search_layer_2024_unique_'));
        put('dock', document.getElementById('_x_extension_newtab_bottom_dock_2024_unique_'));
        if (section) {
          const r = section.getBoundingClientRect();
          out.shortcuts = { left: r.left + r.width / 2, top: r.top, width: r.width, height: r.height };
        }
        document.querySelectorAll('.x-nt-shortcut-group-header').forEach((header) => {
          put('title:' + header.getAttribute('data-shortcut-group-id'), header, true);
        });
        document.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id]').forEach((tile) => {
          put('tile:' + tile.getAttribute('data-shortcut-id'), tile, true);
        });
        document.querySelectorAll('.x-nt-shortcut-group-empty').forEach((slot) => {
          put('slot:' + slot.getAttribute('data-shortcut-group-id'), slot, true);
        });
        const add = document.querySelector('.x-nt-shortcut-tile--add:not([hidden])');
        put('add', add, true);
        return out;
      })()`);
    },
    async settle(ms = SETTLE_MS) {
      await delay(ms);
    }
  };
  return page;
}

// Keys present in both snapshots whose box moved; `allow` names keys (or
// key prefixes ending in ':') that may move.
function movedBetween(before, after, allow = []) {
  const allowed = (key) => allow.some((rule) => (rule.endsWith(':') ? key.startsWith(rule) : key === rule));
  return Object.keys(before).filter((key) => after[key] && !allowed(key)).map((key) => {
    const a = before[key];
    const b = after[key];
    return { key, dx: Math.round((b.left - a.left) * 10) / 10, dy: Math.round((b.top - a.top) * 10) / 10 };
  }).filter((entry) => Math.abs(entry.dx) > TOLERANCE_PX || Math.abs(entry.dy) > TOLERANCE_PX);
}

// A grid that hugs its longest row re-centers when that row changes: every
// shortcut part shifts by the same amount and the grid stays centered under
// the search box. Anything else that moved is reported.
async function unevenShift(page, before, after, allow) {
  const moved = movedBetween(before, after, allow);
  const parts = moved.filter((entry) => /^(tile|title|slot):|^add$/.test(entry.key));
  const others = moved.filter((entry) => !parts.includes(entry));
  const dx = parts.length ? parts[0].dx : 0;
  const uneven = parts.filter((entry) => Math.abs(entry.dx - dx) > 1 || Math.abs(entry.dy) > TOLERANCE_PX);
  const offCenter = await page.evaluate(`(() => {
    const parts = Array.from(document.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id], .x-nt-shortcut-group-empty, .x-nt-shortcut-tile--add:not([hidden])'))
      .map((element) => element.getBoundingClientRect());
    const left = Math.min(...parts.map((r) => r.left));
    const right = Math.max(...parts.map((r) => r.right));
    const search = document.getElementById('_x_extension_newtab_search_layer_2024_unique_').getBoundingClientRect();
    return Math.round(((left + right) / 2 - (search.left + search.right) / 2) * 10) / 10;
  })()`);
  return [...others, ...uneven, ...(Math.abs(offCenter) > 1 ? [{ key: 'grid off center', dx: offCenter, dy: 0 }] : [])];
}

const link = (id, groupId, title) => ({ id, title: title || id, url: `https://${id}.example.com/`, groupId });
const BASE_GROUPS = [
  { id: 'g0', title: '' },
  { id: 'work', title: '工作' },
  { id: 'read', title: '阅读' }
];
const BASE_ITEMS = [
  ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => link(id, 'g0')),
  ...['w1', 'w2', 'w3', 'w4'].map((id) => link(id, 'work')),
  ...['r1', 'r2'].map((id) => link(id, 'read'))
];
const WIDE = { width: 1440, height: 1100 };

// Where the empty bookmarks bar would cover shortcuts, a drag leaves it
// hidden; the dock check needs a screen with room under the shortcuts.

const checks = [];
function check(name, viewport, run) {
  checks.push({ name, viewport, run });
}

// Hover and menus only change what is drawn, never where things are.
check('hovering an untitled group shows its placeholder in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="g0"]', -200);
  await page.settle();
  return movedBetween(before, await page.snapshot());
});

const GROUP_DIALOG_INPUT = '.x-nt-shortcut-dialog input._x_extension_shortcut_input_2024_unique_';
const storedGroups = (page) => page.evaluate(`new Promise((resolve) => chrome.storage.sync.get(
  '_x_extension_newtab_shortcuts_v2_2026_unique_', (values) => resolve(values._x_extension_newtab_shortcuts_v2_2026_unique_.g)))`);
const dialogState = (page) => page.evaluate(`(() => {
  const dialog = document.querySelector('.x-nt-shortcut-dialog');
  const input = document.querySelector(${JSON.stringify(GROUP_DIALOG_INPUT)});
  const open = Boolean(dialog && dialog.getBoundingClientRect().height > 0 && getComputedStyle(dialog).visibility !== 'hidden');
  return { open, title: open ? (dialog.querySelector('.x-nt-shortcut-dialog-title') || {}).textContent : '',
    value: input ? input.value : null, urlFields: dialog ? dialog.querySelectorAll('input').length : 0,
    focused: document.activeElement === input };
})()`);

// Group titles are named in the shortcut dialog, never in the grid.
check('naming an untitled group opens the dialog and moves nothing', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="g0"]', -200);
  await page.settle(200);
  await page.click('[data-shortcut-group-id="g0"] .x-nt-shortcut-group-title--placeholder');
  await page.settle();
  const problems = [];
  const state = await dialogState(page);
  if (!state.open || state.value !== '' || !state.focused || state.urlFields !== 1) {
    problems.push({ key: `dialog ${JSON.stringify(state)}`, dx: 0, dy: 0 });
  }
  problems.push(...movedBetween(before, await page.snapshot()));
  await page.key('Escape');
  await page.settle();
  problems.push(...movedBetween(before, await page.snapshot()).map((entry) => ({ ...entry, key: `after Esc ${entry.key}` })));
  return problems;
});

check('renaming a group in the dialog changes only its title', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.click('[data-shortcut-group-id="work"] .x-nt-shortcut-group-title', 2);
  await page.settle();
  const problems = [];
  const state = await dialogState(page);
  if (!state.open || state.value !== '工作') problems.push({ key: `dialog ${JSON.stringify(state)}`, dx: 0, dy: 0 });
  await page.evaluate(`document.querySelector(${JSON.stringify(GROUP_DIALOG_INPUT)}).select()`);
  await page.type('工作和项目管理');
  await page.key('Enter');
  await page.settle(700);
  const titles = (await storedGroups(page)).map((group) => group[1]);
  if (titles[1] !== '工作和项目管理') problems.push({ key: `stored titles ${JSON.stringify(titles)}`, dx: 0, dy: 0 });
  if ((await dialogState(page)).open) problems.push({ key: 'dialog stayed open', dx: 0, dy: 0 });
  problems.push(...movedBetween(before, await page.snapshot()).map((e) => ({ ...e, key: `saved ${e.key}` })));
  return problems;
});

// Many shortcuts used to grow under the bottom dock, whose transparent top
// took the clicks meant for the last rows and the add tile. Whatever part of
// the area shows, at either end of its scroll, must take its own clicks.
check('many shortcuts stay clickable above the dock', { width: 1440, height: 900 }, async (page) => {
  await page.seed([{ id: 'g0', title: '' }], Array.from({ length: 60 }, (_, index) => link(`m${index}`, 'g0')));
  const problems = [];
  for (const end of ['top', 'bottom']) {
    const covered = await page.evaluate(`(() => {
      const section = document.querySelector('.x-nt-shortcuts-section');
      section.scrollTop = ${end === 'top' ? 0 : 'section.scrollHeight'};
      const area = section.getBoundingClientRect();
      return Array.from(document.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id], .x-nt-shortcut-tile--add:not([hidden])'))
        .map((tile) => {
          const r = tile.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          if (y < area.top || y > area.bottom) return null;
          const hit = document.elementFromPoint(x, y);
          return tile.contains(hit) ? null
            : (tile.getAttribute('data-shortcut-id') || 'add') + ' under ' + (hit ? hit.id || hit.className : 'nothing');
        })
        .filter(Boolean);
    })()`);
    problems.push(...covered.map((key) => ({ key: `${end}: ${key}`, dx: 0, dy: 0 })));
  }
  return problems;
});

// A row of shortcuts under the clock, over a dock full of bookmarks: the
// shortcut area is already below its minimum height, so the dock stops above
// it instead of letting its scroller's top padding take the tiles' clicks.
for (const viewport of [{ width: 1330, height: 934 }, { width: 1280, height: 720 }]) {
  check(`a row of shortcuts stays clickable above a dock of bookmarks (${viewport.width}x${viewport.height})`, viewport,
    async (page) => {
      await page.load();
      const bookmarkIds = await page.evaluate(`(async () => {
        const ids = [];
        for (let index = 0; index < 32; index += 1) {
          const node = await chrome.bookmarks.create({ parentId: '1', title: 'Bookmark ' + index,
            url: 'https://bookmark' + index + '.example.com/' });
          ids.push(node.id);
        }
        return ids;
      })()`);
      try {
        await page.seed([{ id: 'g0', title: '' }], ['s1', 's2'].map((id) => link(id, 'g0')), {
          _x_extension_bookmark_count_2024_unique_: 32,
          _x_extension_newtab_wordmark_visible_2026_unique_: 'time'
        });
        const problems = [];
        for (let pass = 0; pass < 3; pass += 1) {
          // Later layout passes must not walk the shortcuts back under the dock.
          if (pass) {
            await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
            await page.settle(500);
          }
          const covered = await page.evaluate(`Array.from(document.querySelectorAll(
            '.x-nt-shortcut-tile[data-shortcut-id], .x-nt-shortcut-tile--add:not([hidden])')).flatMap((tile) => {
            const r = tile.getBoundingClientRect();
            return [r.top + r.height / 2, r.bottom - 2].map((y) => {
              const hit = document.elementFromPoint(r.left + r.width / 2, y);
              return tile.contains(hit) ? null : (tile.getAttribute('data-shortcut-id') || 'add') +
                ' at ' + Math.round(y) + ' under ' + (hit ? hit.id || hit.className : 'nothing');
            });
          }).filter(Boolean)`);
          problems.push(...covered.map((key) => ({ key: `pass ${pass}: ${key}`, dx: 0, dy: 0 })));
        }
        return problems;
      } finally {
        await page.evaluate(`Promise.all(${JSON.stringify(bookmarkIds)}.map((id) => chrome.bookmarks.remove(id)))
          .then(() => chrome.storage.sync.remove(['_x_extension_bookmark_count_2024_unique_',
            '_x_extension_newtab_wordmark_visible_2026_unique_']))`);
      }
    });
}

// On a 13-inch screen two full rows push the add tile onto a row of its own.
// A dock holding only the recent cards needs less than its usual floor, so
// that row fits whole instead of scrolling out under the area's edge.
check('the add tile on its own row shows whole on a short screen', { width: 1180, height: 650 }, async (page) => {
  await page.load();
  const folderIds = await page.evaluate(`(async () => {
    const ids = [];
    for (const title of ['网站', '工具', '科技', '文章']) {
      const folder = await chrome.bookmarks.create({ parentId: '1', title });
      ids.push(folder.id);
      await chrome.bookmarks.create({ parentId: folder.id, title, url: 'https://' + folder.id + '.example.com/' });
    }
    return ids;
  })()`);
  // Later checks share the profile and expect an empty bookmarks bar in the
  // default view.
  try {
    return await addTileShowsWholeOnShortScreen(page);
  } finally {
    await page.evaluate(`Promise.all(${JSON.stringify(folderIds)}.map((id) => chrome.bookmarks.removeTree(id)))
      .then(() => chrome.storage.sync.remove('_x_extension_bookmark_view_mode_2026_unique_'))`);
  }
});

async function addTileShowsWholeOnShortScreen(page) {
  await page.seed([{ id: 'g0', title: '' }], Array.from({ length: 20 }, (_, index) => link(`m${index}`, 'g0')),
    { _x_extension_bookmark_view_mode_2026_unique_: 'top' });
  const state = await page.evaluate(`(() => {
    const area = document.querySelector('.x-nt-shortcuts-section').getBoundingClientRect();
    const add = document.querySelector('.x-nt-shortcut-tile--add:not([hidden])');
    if (!add) return { missing: true };
    const r = add.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { clipped: Math.round(Math.max(0, r.bottom - area.bottom)), clickable: add.contains(hit),
      dock: Boolean(document.querySelector('#_x_extension_newtab_recent_sites_2024_unique_:not([hidden])')) };
  })()`);
  return state.missing || state.clipped > 0 || !state.clickable || !state.dock
    ? [{ key: `add tile ${JSON.stringify(state)}`, dx: 0, dy: 0 }]
    : [];
}

// The add tile asks what to add on a click and has no right-click menu.
check('the add tile offers a site, a group or hiding it', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  // A closed menu keeps its options laid out; its control says whether it is open.
  const menu = () => page.evaluate(`(() => {
    const control = document.querySelector('.x-nt-shortcut-context-menu');
    if (!control || control.getAttribute('data-open') !== 'true') return [];
    return Array.from(document.querySelectorAll('.x-nt-shortcut-context-menu-portal:not(.x-nt-bookmark-context-menu-portal):not(.x-nt-recent-context-menu-portal) [data-value]'))
      .map((option) => option.getAttribute('data-value'));
  })()`);
  const problems = [];
  await page.contextMenu('.x-nt-shortcut-tile--add');
  await page.settle(300);
  if ((await menu()).length) problems.push({ key: `right-click opened ${JSON.stringify(await menu())}`, dx: 0, dy: 0 });
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  const options = await menu();
  if (JSON.stringify(options) !== JSON.stringify(['shortcut-add', 'group-create', 'hide-add'])) {
    problems.push({ key: `menu ${JSON.stringify(options)}`, dx: 0, dy: 0 });
  }
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  if ((await menu()).length) problems.push({ key: 'a second press left the menu open', dx: 0, dy: 0 });
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="shortcut-add"]');
  await page.settle(500);
  const state = await dialogState(page);
  if (!state.open || state.urlFields < 2) problems.push({ key: `add site dialog ${JSON.stringify(state)}`, dx: 0, dy: 0 });
  return problems;
});

check('group and tile menus open in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="work"] .x-nt-shortcut-group-title');
  await page.settle(150);
  await page.click('[data-shortcut-group-id="work"] .x-nt-shortcut-group-more');
  await page.settle();
  const groupMenu = movedBetween(before, await page.snapshot());
  await page.key('Escape');
  await page.contextMenu('[data-shortcut-id="w2"]');
  await page.settle();
  const tileMenu = movedBetween(before, await page.snapshot());
  await page.key('Escape');
  await page.settle();
  return [...groupMenu, ...tileMenu.map((e) => ({ ...e, key: `tile menu ${e.key}` }))];
});

// However the group menu closes, its button lets go and hides with the pointer
// away. A key that closed it leaves the button focused, showing its ring.
check('a group menu button hides once its menu closes', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const more = '[data-shortcut-group-id="work"] .x-nt-shortcut-group-more';
  const shown = () => page.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(more)});
    return button.hasAttribute('data-shortcut-context-menu-open') ||
      (getComputedStyle(button).opacity !== '0' && !button.matches(':focus-visible'));
  })()`);
  const away = { x: 8, y: 540 };
  const closers = {
    Escape: () => page.key('Escape'),
    'a press outside': async () => {
      await page.mouse('mousePressed', away.x, away.y, { buttons: 1 });
      await page.mouse('mouseReleased', away.x, away.y);
    },
    'a second press': () => page.click(more),
    'renaming': async () => {
      await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-rename"]');
      await page.settle(400);
      await page.key('Escape');
    }
  };
  const problems = [];
  for (const [how, close] of Object.entries(closers)) {
    await page.hover('[data-shortcut-group-id="work"] .x-nt-shortcut-group-title');
    await page.settle(150);
    await page.click(more);
    await page.settle(300);
    await close();
    await page.settle(300);
    await page.mouse('mouseMoved', away.x, away.y, { button: 'none' });
    await page.settle(300);
    if (await shown()) problems.push({ key: `button still shown after ${how}`, dx: 0, dy: 0 });
  }
  return problems;
});

// Alt+Arrow moves the focused tile one place, across a group's edge too,
// keeps focus on it and does not send the page back in history.
check('Alt+Arrow moves a focused tile one place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const ALT = 1;
  const read = () => page.evaluate(`(() => ({
    order: Array.from(document.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id]'))
      .map((tile) => tile.getAttribute('data-shortcut-group-id') + ':' + tile.getAttribute('data-shortcut-id'))
      .join(' '),
    focused: document.activeElement && document.activeElement.getAttribute('data-shortcut-id'),
    href: location.href
  }))()`);
  const start = await read();
  const problems = [];
  const expect = async (label, order, focused) => {
    await page.settle();
    const now = await read();
    if (now.order !== order) problems.push({ key: `${label}: ${now.order}`, dx: 0, dy: 0 });
    if (now.focused !== focused) problems.push({ key: `${label}: focus on ${now.focused}`, dx: 0, dy: 0 });
    if (now.href !== start.href) problems.push({ key: `${label}: navigated to ${now.href}`, dx: 0, dy: 0 });
  };
  const rest = 'work:w1 work:w2 work:w3 work:w4 read:r1 read:r2';
  await page.evaluate(`document.querySelector('[data-shortcut-id="a1"]').focus()`);
  await page.key('ArrowRight', ALT);
  await expect('a1 right', `g0:a2 g0:a1 g0:a3 g0:a4 g0:a5 ${rest}`, 'a1');
  await page.evaluate(`document.querySelector('[data-shortcut-id="a5"]').focus()`);
  await page.key('ArrowRight', ALT);
  await expect('a5 into work', `g0:a2 g0:a1 g0:a3 g0:a4 work:a5 ${rest}`, 'a5');
  await page.key('ArrowLeft', ALT);
  await expect('a5 back', `g0:a2 g0:a1 g0:a3 g0:a4 g0:a5 ${rest}`, 'a5');
  return problems;
});

// Settings changed elsewhere (the options page, another tab) apply live,
// and a shortcut list saved elsewhere replaces the one shown.
check('settings and shortcuts saved elsewhere apply live', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const visibleKey = '_x_extension_newtab_shortcuts_visible_2026_unique_';
  const set = (values) => page.evaluate(`new Promise((resolve) => chrome.storage.sync.set(${JSON.stringify(values)}, resolve))`);
  const shown = () => page.evaluate(`(() => {
    const section = document.querySelector('.x-nt-shortcuts-section');
    return Boolean(section) && getComputedStyle(section).display !== 'none' && section.getBoundingClientRect().height > 0;
  })()`);
  const tileIds = () => page.evaluate(`Array.from(document.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id]'))
    .map((tile) => tile.getAttribute('data-shortcut-id')).join(' ')`);
  const problems = [];
  await set({ [visibleKey]: false });
  await page.settle();
  if (await shown()) problems.push({ key: 'shortcuts still shown after hiding them elsewhere', dx: 0, dy: 0 });
  await set({ [visibleKey]: true });
  await page.settle();
  if (!(await shown())) problems.push({ key: 'shortcuts not shown again', dx: 0, dy: 0 });
  const payload = shortcutsStore.createShortcutStoragePlan({
    groups: BASE_GROUPS,
    items: BASE_ITEMS.filter((item) => item.id !== 'a3')
  }).payload;
  await set(payload);
  await page.settle(900);
  if ((await tileIds()).split(' ').includes('a3')) {
    problems.push({ key: 'a shortcut removed elsewhere is still shown', dx: 0, dy: 0 });
  }
  return problems;
});

check('dock magnification leaves tile boxes in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  for (const id of ['a3', 'w1', 'r2']) {
    await page.hover(`[data-shortcut-id="${id}"]`);
    await page.settle(250);
  }
  return movedBetween(before, await page.snapshot());
});

// A magnified icon reaches up across the row gap toward the title above.
// Its top still belongs to the icon; only the title row itself wakes the
// title, and pointing there settles the icons.
check('pointing at the top of a magnified icon leaves the title above asleep', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const state = (groupId, id) => page.evaluate(`(() => {
    const header = document.querySelector('.x-nt-shortcut-group-header[data-shortcut-group-id="${groupId}"]');
    const tile = document.querySelector('[data-shortcut-id="${id}"]');
    return { header: header.matches(':hover'), tile: tile.matches(':hover'),
      dock: tile.closest('.x-nt-shortcuts-grid').getAttribute('data-dock-active') === 'true' };
  })()`);
  const problems = [];
  for (const [groupId, id] of [['g0', 'a1'], ['work', 'w1']]) {
    await page.hover(`[data-shortcut-id="${id}"]`);
    await page.settle(400);
    const icon = await page.rect(`[data-shortcut-id="${id}"] .x-nt-shortcut-icon`);
    await page.mouse('mouseMoved', icon.x, icon.top + 2, { button: 'none' });
    await page.settle(250);
    const onIcon = await state(groupId, id);
    if (onIcon.header || !onIcon.tile || !onIcon.dock) {
      problems.push({ key: `${id} icon top ${JSON.stringify(onIcon)}`, dx: 0, dy: 0 });
    }
    const header = await page.rect(`.x-nt-shortcut-group-header[data-shortcut-group-id="${groupId}"]`);
    await page.mouse('mouseMoved', icon.x, header.top + 2, { button: 'none' });
    await page.settle(250);
    const onTitle = await state(groupId, id);
    if (!onTitle.header || onTitle.tile || onTitle.dock) {
      problems.push({ key: `${groupId} title row ${JSON.stringify(onTitle)}`, dx: 0, dy: 0 });
    }
  }
  return problems;
});

// One group is no grouping: no title row, whatever it is named. The first
// new group names the existing row "Shortcuts", and that name can be cleared.
check('a single group shows no title, and the first new group names it', WIDE, async (page) => {
  const problems = [];
  const note = (key) => problems.push({ key, dx: 0, dy: 0 });
  const headerCount = () => page.evaluate(`document.querySelectorAll('.x-nt-shortcut-group-header').length`);
  await page.seed([{ id: 'g0', title: '工作' }], BASE_ITEMS.filter((item) => item.groupId === 'g0'));
  if (await headerCount()) note('a titled single group shows a title row');
  await page.seed([{ id: 'g0', title: '' }], BASE_ITEMS.filter((item) => item.groupId === 'g0'));
  if (await headerCount()) note('an untitled single group shows a title row');
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-create"]');
  await page.settle();
  await page.type('新分组');
  await page.key('Enter');
  await page.settle(700);
  const titles = (await storedGroups(page)).map((group) => group[1]);
  const shown = await page.evaluate(`(document.querySelector('[data-shortcut-group-id="g0"] .x-nt-shortcut-group-title') || {}).textContent || ''`);
  if (titles.length !== 2 || !titles[0] || titles[1] !== '新分组' || shown !== titles[0]) {
    note(`after creating ${JSON.stringify({ titles, shown })}`);
  }
  await page.click('[data-shortcut-group-id="g0"] .x-nt-shortcut-group-title', 2);
  await page.settle();
  await page.evaluate(`document.querySelector(${JSON.stringify(GROUP_DIALOG_INPUT)}).select()`);
  await page.key('Backspace');
  await page.key('Enter');
  await page.settle(700);
  const cleared = (await storedGroups(page)).map((group) => group[1]);
  if (cleared[0] !== '' || await page.evaluate(`!document.querySelector('[data-shortcut-group-id="g0"][data-shortcut-group-untitled="true"]')`)) {
    note(`after clearing ${JSON.stringify(cleared)}`);
  }
  return problems;
});

check('a canceled tile drag puts everything back', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-id="r2"]');
  await page.drag('[data-shortcut-id="a2"]', { x: target.right + 20, y: target.y }, { cancel: true });
  await page.settle(700);
  return movedBetween(before, await page.snapshot());
});

check('reordering inside a group moves only that group\'s tiles', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-id="w3"]');
  await page.drag('[data-shortcut-id="w1"]', { x: target.right - 4, y: target.y });
  await page.settle(900);
  return movedBetween(before, await page.snapshot(), ['tile:w1', 'tile:w2', 'tile:w3', 'tile:w4']);
});

check('moving a tile into another group keeps the other groups in place', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-id="r2"]');
  await page.drag('[data-shortcut-id="w4"]', { x: target.right + 8, y: target.y });
  await page.settle(900);
  return movedBetween(before, await page.snapshot(), ['tile:w4', 'add']);
});

// The grid hugs its longest row; a tile joining that row widens the grid
// during the drag instead of wrapping the row until the drop.
check('a tile dragged into the longest row keeps it on one line', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const target = await page.rect('[data-shortcut-id="a2"]');
  let during = null;
  await page.drag('[data-shortcut-id="w1"]', { x: target.x - 10, y: target.y }, {
    before: async () => {
      await page.settle(250);
      during = await page.snapshot();
    }
  });
  await page.settle(900);
  const rows = new Set(['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => Math.round(during[`tile:${id}`].top)));
  const problems = rows.size > 1 ? [{ key: `first group took ${rows.size} rows during the drag`, dx: 0, dy: 0 }] : [];
  // What the drag showed is where the drop leaves it.
  return [...problems, ...movedBetween(during, await page.snapshot(), ['tile:w1'])];
});

// The grid re-centers as soon as the tile leaves, so the drop moves nothing.
// The pointer follows the gap past the last tile as it slides, as an eye would.
check('emptying the longest row re-centers the grid as a whole during the drag', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const pastRead = async () => {
    const r2 = await page.rect('[data-shortcut-id="r2"]');
    return { x: r2.right + 8, y: r2.y };
  };
  let during = null;
  await page.drag('[data-shortcut-id="a5"]', await pastRead(), {
    before: async () => {
      const gap = await pastRead();
      await page.mouse('mouseMoved', gap.x, gap.y, { buttons: 1 });
      await page.settle(250);
      during = await page.snapshot();
      return gap;
    }
  });
  await page.settle(900);
  const after = await page.snapshot();
  return [
    ...(after['tile:a5'] && after['tile:r2'] ? [] : [{ key: 'the drop made a folder', dx: 0, dy: 0 }]),
    ...await unevenShift(page, before, after, ['tile:a5', 'add']),
    ...movedBetween(during, after, ['tile:a5']).map((entry) => ({ ...entry, key: `on drop ${entry.key}` }))
  ];
});

// Re-centering slides tiles under a pointer that holds still. Letting go
// there drops into the gap the drag showed, not onto the tile as a folder.
check('a tile that slides under the held pointer makes no folder', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const from = await page.rect('[data-shortcut-id="a5"]');
  const w4 = await page.rect('[data-shortcut-id="w4"]');
  const w3 = await page.rect('[data-shortcut-id="w3"]');
  const r2 = await page.rect('[data-shortcut-id="r2"]');
  // First to the end of the second row, which leaves the width alone.
  await page.mouse('mouseMoved', from.x, from.y, { button: 'none' });
  await page.mouse('mousePressed', from.x, from.y, { buttons: 1 });
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse('mouseMoved', from.x + (w4.right + 8 - from.x) * step / 8, from.y + (w4.y - from.y) * step / 8, { buttons: 1 });
    await page.settle(35);
  }
  await page.settle(300);
  // Then past the last row's end, by the half column the grid re-centers by.
  const held = { x: r2.x + (w4.x - w3.x) / 2, y: r2.y };
  await page.mouse('mouseMoved', held.x, held.y, { buttons: 1 });
  await page.settle(400);
  const problems = [];
  if (await page.evaluate(`document.querySelector('[data-shortcut-id="r2"]').hasAttribute('data-bookmark-drop-target')`)) {
    problems.push({ key: 'the tile under the pointer became a folder target', dx: 0, dy: 0 });
  }
  await page.mouse('mouseReleased', held.x, held.y, { buttons: 0 });
  await page.settle(900);
  const after = await page.snapshot();
  if (!after['tile:a5'] || !after['tile:r2']) problems.push({ key: 'the drop made a folder', dx: 0, dy: 0 });
  return problems;
});

check('a drag shows the empty bookmarks bar without moving the page', { width: 1440, height: 1300 }, async (page) => {
  // The bar is shown for a drag when it is empty but other bookmarks exist.
  await page.load();
  const bookmarkId = await page.evaluate(`new Promise((resolve) => chrome.bookmarks.create(
    { parentId: '2', title: 'Elsewhere', url: 'https://elsewhere.example.com/' }, (node) => resolve(node.id)))`);
  await page.seed([{ id: 'g0', title: '' }, { id: 'work', title: '工作' }],
    [link('a1', 'g0'), link('a2', 'g0'), link('w1', 'work')]);
  try {
    return await dragShowsEmptyBookmarksBar(page);
  } finally {
    await page.evaluate(`new Promise((resolve) => chrome.bookmarks.remove(${JSON.stringify(bookmarkId)}, resolve))`);
  }
});

check('a drag leaves the empty bookmarks bar hidden where it would cover shortcuts', WIDE, async (page) => {
  await page.load();
  const bookmarkId = await page.evaluate(`new Promise((resolve) => chrome.bookmarks.create(
    { parentId: '2', title: 'Elsewhere', url: 'https://elsewhere.example.com/' }, (node) => resolve(node.id)))`);
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  try {
    const before = await page.snapshot();
    const moves = [];
    const target = await page.rect('[data-shortcut-id="r1"]');
    await page.drag('[data-shortcut-id="a2"]', { x: target.x, y: target.bottom + 4 }, {
      cancel: true,
      before: async () => {
        const shown = await page.evaluate(`document.getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_').getAttribute('data-bookmark-empty-drop-surface')`);
        if (shown === 'true') moves.push({ key: 'empty bookmarks bar covered the shortcuts', dx: 0, dy: 0 });
        // The dragged tile opens a slot among the tiles it passes, and the
        // grid re-centers as the longest row loses it.
        moves.push(...movedBetween(before, await page.snapshot(), ['tile:', 'title:', 'add']).map((e) => ({ ...e, key: `during drag ${e.key}` })));
      }
    });
    await page.settle(800);
    moves.push(...movedBetween(before, await page.snapshot()).map((e) => ({ ...e, key: `after ${e.key}` })));
    return moves;
  } finally {
    await page.evaluate(`new Promise((resolve) => chrome.bookmarks.remove(${JSON.stringify(bookmarkId)}, resolve))`);
  }
});

async function dragShowsEmptyBookmarksBar(page) {
  const before = await page.snapshot();
  const moves = [];
  await page.drag('[data-shortcut-id="a1"]', { x: (await page.rect('[data-shortcut-id="a2"]')).x, y: 60 }, {
    cancel: true,
    before: async () => {
      const shown = await page.evaluate(`document.getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_').getAttribute('data-bookmark-empty-drop-surface')`);
      if (shown !== 'true') moves.push({ key: 'empty bookmarks bar was not shown', dx: 0, dy: 0 });
      moves.push(...movedBetween(before, await page.snapshot(), ['tile:a1', 'dock'])
        .map((entry) => ({ ...entry, key: `during drag ${entry.key}` })));
    }
  });
  await page.settle(800);
  moves.push(...movedBetween(before, await page.snapshot()).map((entry) => ({ ...entry, key: `after ${entry.key}` })));
  const stillShown = await page.evaluate(`document.getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_').getAttribute('data-bookmark-empty-drop-surface')`);
  if (stillShown === 'true') moves.push({ key: 'empty bookmarks bar stayed after the drag', dx: 0, dy: 0 });
  return moves;
}

check('creating a group adds below without moving what is there', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-create"]');
  await page.settle();
  await page.type('新分组');
  await page.key('Enter');
  await page.settle();
  const titles = (await storedGroups(page)).map((group) => group[1]);
  return [...movedBetween(before, await page.snapshot(), ['add']),
    ...(titles[3] === '新分组' ? [] : [{ key: `stored titles ${JSON.stringify(titles)}`, dx: 0, dy: 0 }])];
});

check('deleting a group and undoing it restores every position', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  await page.hover('[data-shortcut-group-id="read"] .x-nt-shortcut-group-title');
  await page.settle(150);
  await page.click('[data-shortcut-group-id="read"] .x-nt-shortcut-group-more');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-delete"]');
  await page.settle(700);
  const deleted = movedBetween(before, await page.snapshot(), ['tile:', 'add', 'title:', 'shortcuts']);
  await page.key('z', 4);
  await page.settle(900);
  return [...deleted.map((e) => ({ ...e, key: `deleted ${e.key}` })), ...movedBetween(before, await page.snapshot())];
});

check('dragging a group title and canceling moves nothing', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const target = await page.rect('[data-shortcut-group-id="work"]');
  await page.drag('[data-shortcut-group-id="read"] .x-nt-shortcut-group-title', { x: target.x, y: target.top + 2 }, {
    cancel: true
  });
  await page.settle();
  return movedBetween(before, await page.snapshot());
});

check('the search box and dock hold still while groups change', WIDE, async (page) => {
  await page.seed(BASE_GROUPS, BASE_ITEMS);
  const before = await page.snapshot();
  const keep = (snap) => Object.fromEntries(Object.entries(snap).filter(([key]) => key === 'search' || key === 'dock'));
  const moves = [];
  await page.click('.x-nt-shortcut-tile--add');
  await page.settle(300);
  await page.click('.x-nt-shortcut-context-menu-portal [data-value="group-create"]');
  await page.settle();
  // An empty name makes an untitled group.
  await page.key('Enter');
  await page.settle();
  moves.push(...movedBetween(keep(before), await page.snapshot()).map((e) => ({ ...e, key: `create ${e.key}` })));
  const target = await page.rect('.x-nt-shortcut-group-empty');
  await page.drag('[data-shortcut-id="a1"]', { x: target.x, y: target.y });
  await page.settle(900);
  moves.push(...movedBetween(keep(before), await page.snapshot()).map((e) => ({ ...e, key: `drop ${e.key}` })));
  return moves;
});

check('a scrolling shortcut area keeps the search box and dock still', { width: 1280, height: 860 }, async (page) => {
  const many = Array.from({ length: 34 }, (_, index) => link(`m${index}`, index < 14 ? 'g0' : index < 28 ? 'work' : 'read'));
  await page.seed(BASE_GROUPS, many);
  const scrollable = await page.evaluate(`document.querySelector('.x-nt-shortcuts-section').getAttribute('data-shortcuts-scrollable')`);
  if (scrollable !== 'true') return [{ key: 'shortcut area did not scroll', dx: 0, dy: 0 }];
  const before = await page.snapshot();
  const keep = ['search', 'dock', 'shortcuts'];
  const only = (snap) => Object.fromEntries(Object.entries(snap).filter(([key]) => keep.includes(key)));
  await page.evaluate(`document.querySelector('.x-nt-shortcuts-section').scrollTop = 200`);
  await page.settle(300);
  const scrolled = movedBetween(only(before), await page.snapshot());
  const area = await page.rect('.x-nt-shortcuts-section');
  await page.drag('[data-shortcut-id="m15"]', { x: area.x, y: area.bottom - 12 }, { hold: 900 });
  await page.settle(900);
  return [...scrolled, ...movedBetween(only(before), await page.snapshot()).map((e) => ({ ...e, key: `after drag ${e.key}` }))];
});

async function main() {
  shortcutsStore = await importSource('src/domain/shortcuts/storage-plan.ts');
  const only = process.env.LUMNO_E2E_ONLY;
  const selected = checks.filter((entry) => !only || entry.name.includes(only));
  const { cdp, close } = await launchBrowser();
  let failures = 0;
  try {
    for (const entry of selected) {
      const page = await openPage(cdp, entry.viewport);
      let moved;
      try {
        moved = await entry.run(page);
      } catch (error) {
        moved = [{ key: `error: ${error.message.split('\n')[0]}`, dx: 0, dy: 0 }];
      }
      const problems = [...moved, ...page.errors.map((error) => ({ key: `console: ${error.slice(0, 160)}`, dx: 0, dy: 0 }))];
      if (problems.length) {
        failures += 1;
        process.stdout.write(`FAIL ${entry.name}\n${problems.map((p) => `     ${p.key}  dx=${p.dx} dy=${p.dy}`).join('\n')}\n`);
      } else {
        process.stdout.write(`ok   ${entry.name}\n`);
      }
      await cdp.send('Target.closeTarget', { targetId: (await cdp.send('Target.getTargets')).targetInfos
        .find((info) => info.url.startsWith(NEWTAB_URL))?.targetId }).catch(() => {});
    }
  } finally {
    close();
  }
  process.stdout.write(`\n${selected.length - failures}/${selected.length} shortcut group layout checks passed.\n`);
  process.exitCode = failures ? 1 : 0;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { launchBrowser, openPage, movedBetween, BASE_GROUPS, BASE_ITEMS, link };
