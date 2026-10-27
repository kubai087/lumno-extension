const assert = require('assert');
const { createTabSwitcherPage, switcherTabs } = require('../helpers/tab-switcher-page');
const { getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

// Extension pages (New Tab, Settings, Onboarding) cannot take injected
// scripts, so they run the tab switcher themselves and talk to the background
// over a named port. This drives that bridge through a fake port the way the
// background does.

const PORT_NAME = 'lumno-tab-switcher-extension-page';

function createPort() {
  const sent = [];
  const listeners = { message: [], disconnect: [] };
  return {
    sent,
    port: {
      postMessage(message) {
        sent.push(JSON.parse(JSON.stringify(message)));
      },
      onMessage: { addListener: (listener) => listeners.message.push(listener) },
      onDisconnect: { addListener: (listener) => listeners.disconnect.push(listener) }
    },
    deliver(message) {
      listeners.message.forEach((listener) => listener(message));
    },
    disconnect() {
      listeners.disconnect.forEach((listener) => listener());
    }
  };
}

function createExtensionPage(options) {
  const ports = [];
  const connects = [];
  const page = createTabSwitcherPage(Object.assign({
    url: 'chrome-extension://lumno-test/src/options/options.html',
    bridge: true,
    connect(info) {
      connects.push(JSON.parse(JSON.stringify(info)));
      const port = createPort();
      ports.push(port);
      return port.port;
    },
    tabsGetCurrent(callback) {
      callback({ id: 42, windowId: 1 });
    }
  }, options || {}));
  page.document.title = 'Lumno Settings';
  return { page, ports, connects };
}

let nextRequestId = 1;
function request(port, message) {
  const requestId = nextRequestId++;
  port.deliver(Object.assign({ requestId }, message));
  return port.sent.find((sent) => sent.requestId === requestId);
}

function testRegistersItsTabOverANamedPort() {
  const { page, ports, connects } = createExtensionPage();
  assert.deepStrictEqual(connects, [{ name: PORT_NAME }], 'the page should connect once over the switcher port');
  assert.deepStrictEqual(ports[0].sent[0], {
    action: 'registerTabSwitcherExtensionPage',
    tabId: 42,
    url: 'chrome-extension://lumno-test/src/options/options.html',
    title: ''
  }, 'the page should register its own tab so the background can address it');
  page.close();

  const web = createTabSwitcherPage({ bridge: true, connect: () => assert.fail('web pages should not open the port') });
  web.close();
}

async function testPortRequestsDriveTheSwitcher() {
  const { page, ports } = createExtensionPage();
  const port = ports[0];
  assert.deepStrictEqual(
    request(port, { action: 'getOpenTabSwitcherState' }),
    { action: 'tabSwitcherExtensionPageResponse', requestId: 1, tabId: 42, ok: true, reason: '', advanced: null, committed: null, open: false, suppressed: false }
  );
  const opened = request(port, { action: 'openTabSwitcherFromCommand', context: { tabs: switcherTabs(3) } });
  assert.strictEqual(opened.ok, true, 'opening through the port should report success');
  assert.strictEqual(page.cards().length, 3);
  assert.strictEqual(request(port, { action: 'getOpenTabSwitcherState' }).open, true);

  const advanced = request(port, { action: 'advanceOpenTabSwitcherFromCommand', offset: 1 });
  assert.strictEqual(advanced.advanced, true);
  assert.strictEqual(advanced.suppressed, false);
  assert.strictEqual(page.selectedIndex(), 1);

  const thumbnail = 'data:image/png;base64,Zm9v';
  assert.strictEqual(request(port, { action: 'updateTabSwitcherThumbnail', tabId: 3, url: 'https://site3.example.test/', thumbnail }).ok, true);

  const host = page.host();
  host.style.setProperty('visibility', 'visible');
  request(port, { action: 'setTabSwitcherCaptureVisibility', hidden: true });
  assert.strictEqual(host.style.getPropertyValue('visibility'), 'hidden', 'a capture should hide the switcher');
  request(port, { action: 'setTabSwitcherCaptureVisibility', hidden: true });
  request(port, { action: 'setTabSwitcherCaptureVisibility', hidden: false });
  assert.strictEqual(host.style.getPropertyValue('visibility'), 'visible', 'the switcher should get its own visibility back');
  assert.strictEqual(host.style.getPropertyPriority('visibility'), '');

  const committed = request(port, { action: 'commitOpenTabSwitcherFromShortcutRelease' });
  assert.strictEqual(committed.committed, true);
  await page.settle();
  assert.deepStrictEqual(
    page.messages.filter((message) => message.action === 'switchToTab').map((message) => ({ ...message })),
    [{ action: 'switchToTab', tabId: 2, windowId: 1 }]
  );
  assert.strictEqual(request(port, { action: 'commitOpenTabSwitcherFromShortcutRelease' }).committed, false,
    'committing with no switcher open should report nothing committed');

  const failed = request(port, { action: 'openTabSwitcherFromCommand', context: { tabs: [] } });
  assert.deepStrictEqual([failed.ok, failed.reason], [false, 'empty'],
    'a failed open should reach the background so it can fall back');
  page.close();
}

function testRuntimeMessagesReachTheBridgeToo() {
  const { page } = createExtensionPage();
  page.open({ tabs: switcherTabs(2) });
  const responses = [];
  page.runtimeMessages.dispatch({ action: 'getOpenTabSwitcherState' }, {}, (response) => responses.push(response));
  assert.ok(responses.some((response) => response && response.open === true));
  page.close();
}

async function testBufferedReleaseIsReplayedForTheCurrentCommand() {
  const { page, ports } = createExtensionPage();
  const port = ports[0];
  const commandStartedAt = Date.now();
  page.press('q', { code: 'KeyQ', altKey: true });
  page.release('Alt', { code: 'AltLeft' });
  request(port, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt });
  const relays = () => page.messages.filter((message) => message.action === 'notifyTabSwitcherShortcutModifierReleased');
  assert.deepStrictEqual(relays().map((message) => ({ ...message })), [{ action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' }],
    'a release that beat the arm message should still commit the switcher');

  request(port, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt: Date.now() + 10000 });
  assert.strictEqual(relays().length, 1, 'a release from before the current command should not be replayed');
  page.release('Alt', { code: 'AltLeft', isTrusted: false });
  assert.strictEqual(relays().length, 1, 'an untrusted release should not be relayed');
  page.release('Alt', { code: 'AltRight' });
  assert.strictEqual(relays().length, 2, 'the next real release should be relayed');
  page.release('Alt', { code: 'AltRight' });
  assert.strictEqual(relays().length, 2, 'the bridge should disarm after relaying');
  page.close();
}

// A tab left armed by an earlier switcher relays a quick release before the
// next switcher opens; the release must stay buffered until it commits.
async function testEarlyReleaseInAnArmedPageWaitsForItsSwitcher() {
  let committed = false;
  const { page, ports } = createExtensionPage({
    respond: (message) => (message.action === 'notifyTabSwitcherShortcutModifierReleased'
      ? { ok: true, committed }
      : { ok: true })
  });
  const port = ports[0];
  const relays = () => page.messages.filter((message) => message.action === 'notifyTabSwitcherShortcutModifierReleased');
  request(port, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt: 0 });
  const commandStartedAt = Date.now();
  page.press('Alt', { code: 'AltLeft', altKey: true });
  page.release('Alt', { code: 'AltLeft' });
  await page.settle();
  assert.strictEqual(relays().length, 1, 'the armed page should relay the release right away');
  request(port, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt });
  assert.strictEqual(relays().length, 2, 'the release should be replayed once its switcher arms the page');

  committed = true;
  request(port, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt: 0 });
  page.press('Alt', { code: 'AltLeft', altKey: true });
  page.release('Alt', { code: 'AltLeft' });
  await page.settle();
  request(port, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt });
  assert.strictEqual(relays().length, 3, 'a release that committed should not be replayed again');
  page.close();
}

async function testReconnectsAfterTheWorkerGoesAway() {
  const { page, ports, connects } = createExtensionPage();
  ports[0].disconnect();
  await page.settle(1100);
  assert.strictEqual(connects.length, 2, 'the page should reconnect once the worker drops the port');
  assert.strictEqual(ports[1].sent[0].action, 'registerTabSwitcherExtensionPage');
  page.window.dispatchEvent(new page.window.Event('pagehide'));
  ports[1].disconnect();
  await page.settle(1100);
  assert.strictEqual(connects.length, 2, 'a page being left should not reconnect');
  page.close();
}

function testPagesConnectTheBridgeBeforeTheirPageScript() {
  [
    ['newtab.html', 'src/newtab/newtab.ts'],
    ['src/options/options.html', 'src/options/app/main.ts'],
    ['src/onboarding/onboarding.html', 'src/onboarding/onboarding.ts']
  ].forEach(([page, pageScript]) => {
    const scripts = getPageScripts(page);
    assert.ok(runsBefore(scripts, 'src/shared/tab-switcher/tab-switcher.ts', 'src/shared/tab-switcher/page-bridge.ts'), `${page} should load the switcher before the bridge`);
    assert.ok(runsBefore(scripts, 'src/shared/tab-switcher/page-bridge.ts', pageScript), `${page} should connect the bridge before its page script runs`);
  });
}

(async () => {
  testRegistersItsTabOverANamedPort();
  await testPortRequestsDriveTheSwitcher();
  testRuntimeMessagesReachTheBridgeToo();
  await testBufferedReleaseIsReplayedForTheCurrentCommand();
  await testEarlyReleaseInAnArmedPageWaitsForItsSwitcher();
  await testReconnectsAfterTheWorkerGoesAway();
  testPagesConnectTheBridgeBeforeTheirPageScript();
  console.log('tab switcher page bridge tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
