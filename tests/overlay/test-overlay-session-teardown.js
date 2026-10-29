const assert = require('assert');
const {
  createOverlayPage,
  openAndSettle,
  waitFor
} = require('../helpers/overlay-runtime-harness');

// Runs the unmodified overlay injection bundle in JSDOM and checks that every
// way of closing an overlay - including a later invocation of the toggle
// helper and the stale-overlay replacement path - releases the page-level
// listeners the overlay registered.

function assertReleased(page, baselineDocumentListeners, message) {
  assert.deepStrictEqual(page.ledger.snapshot(), baselineDocumentListeners,
    `${message}: no window/document listeners should remain`);
  assert.strictEqual(page.sessionStorageListenerCount(), 0,
    `${message}: no chrome.storage.onChanged listeners should remain`);
  assert.strictEqual(page.mediaListeners.size, 0,
    `${message}: no color-scheme listeners should remain`);
  assert.strictEqual(page.window.__lumnoContent.overlayOpen, false,
    `${message}: the overlay should report itself closed`);
}

async function waitForClosed(page, message) {
  await waitFor(() => page.hostCount() === 0, message, page.errors);
}

const MOTION_KEY = '_x_extension_motion_effects_enabled_2026_unique_';

function findPanel(page) {
  return page.window.LumnoTestOverlayShellModule.findOverlayPanel(page.window.document);
}

async function testToggleCloseFromNewInvocation() {
  const page = await createOverlayPage({ settings: { [MOTION_KEY]: true } });
  try {
    const baseline = page.ledger.snapshot();
    await openAndSettle(page);
    await waitFor(() => findPanel(page).getAttribute('data-lumno-overlay-entry') === 'done',
      'the entry should finish before closing', page.errors);
    // A second hotkey press runs the toggle helper again; that invocation
    // has its own closure and must still release the first one's listeners.
    page.toggle();
    assert.strictEqual(findPanel(page).getAttribute('data-lumno-overlay-exit'), 'running',
      'the second press should start the exit animation');
    await waitForClosed(page, 'the second press should close the overlay after its exit animation');
    assert.strictEqual(page.hostCount(), 0, 'the second press should close the overlay');
    assertReleased(page, baseline, 'closing from a new invocation');
  } finally {
    page.window.close();
  }
}

async function openWithMotion() {
  const page = await createOverlayPage({ settings: { [MOTION_KEY]: true } });
  const baseline = page.ledger.snapshot();
  await openAndSettle(page);
  await waitFor(() => findPanel(page).getAttribute('data-lumno-overlay-entry') === 'done',
    'the entry should finish before closing', page.errors);
  return { page, baseline };
}

// Once the exit starts the overlay is closed for everyone but the animation:
// the worker reads it as closed, and keys, focus and clicks no longer reach it.
async function testExitReleasesInputAtOnce() {
  const { page } = await openWithMotion();
  try {
    await page.type('hello');
    page.press('Escape');
    const panel = findPanel(page);
    assert.strictEqual(panel.getAttribute('data-lumno-overlay-exit'), 'running');
    assert.strictEqual(page.window.__lumnoContent.overlayOpen, false,
      'the open flag should clear when the exit starts, not when it ends');
    assert.strictEqual(panel.inert, true, 'a closing overlay should not take focus or clicks');
    assert.notStrictEqual(page.root().activeElement, page.input(), 'the input should lose focus when the exit starts');
    const messagesBeforeEnter = page.messages.length;
    page.press('Enter');
    await page.settle(30);
    assert.deepStrictEqual(page.messages.slice(messagesBeforeEnter).map((message) => message.action)
      .filter((action) => action !== 'notifyOverlayClosed'), [],
      'Enter pressed during the exit should not run the search');
    await waitForClosed(page, 'the overlay should close after its exit');
  } finally {
    page.window.close();
  }
}

// Pressing the hotkey again during the exit reopens the overlay instead of
// being dropped, whichever way the close started.
async function testPressDuringExitReopens() {
  for (const startClose of ['hotkey', 'Escape']) {
    const { page, baseline } = await openWithMotion();
    try {
      const closingHost = page.host();
      if (startClose === 'hotkey') {
        page.toggle();
      } else {
        page.press('Escape');
      }
      assert.strictEqual(findPanel(page).getAttribute('data-lumno-overlay-exit'), 'running',
        `${startClose} should start the exit`);
      await openAndSettle(page);
      assert.strictEqual(page.hostCount(), 1, `a press during the ${startClose} exit should leave one overlay`);
      assert.notStrictEqual(page.host(), closingHost, `the ${startClose} exit should give way to a fresh overlay`);
      assert.strictEqual(findPanel(page).hasAttribute('data-lumno-overlay-exit'), false);
      assert.strictEqual(page.window.__lumnoContent.overlayOpen, true);
      await page.settle(300);
      assert.strictEqual(page.hostCount(), 1, `the dropped ${startClose} exit must not close the new overlay`);
      page.toggle({ ensureOpen: true });
      assert.strictEqual(page.hostCount(), 1, 'ensureOpen should keep the reopened overlay');
      page.toggle();
      await waitForClosed(page, `the reopened overlay should close after the ${startClose} case`);
      assertReleased(page, baseline, `reopening during the ${startClose} exit`);
    } finally {
      page.window.close();
    }
  }
}

// With Motion effects off (the harness default) the exit is skipped too.
async function testCloseWithoutMotionIsImmediate() {
  const page = await createOverlayPage();
  try {
    const baseline = page.ledger.snapshot();
    await openAndSettle(page);
    page.toggle();
    assert.strictEqual(page.hostCount(), 0, 'the hotkey should close at once without Motion effects');
    assertReleased(page, baseline, 'closing without motion');
    await openAndSettle(page);
    page.press('Escape');
    assert.strictEqual(page.hostCount(), 0, 'Escape should close at once without Motion effects');
    assertReleased(page, baseline, 'Escape without motion');
  } finally {
    page.window.close();
  }
}

async function testStaleReplacementThenClose() {
  const page = await createOverlayPage();
  try {
    const baseline = page.ledger.snapshot();
    const firstHost = await openAndSettle(page);
    const listenersWhileOpen = page.ledger.snapshot();
    const storageListenersWhileOpen = page.sessionStorageListenerCount();
    // A token from another context marks the mounted overlay as stale, so
    // the next invocation replaces it instead of toggling it closed.
    page.markOverlayFromOtherContext();
    const secondHost = await openAndSettle(page);
    assert.notStrictEqual(secondHost, firstHost, 'the stale overlay should be replaced');
    assert.strictEqual(firstHost.isConnected, false, 'the stale overlay host should be removed');
    assert.strictEqual(page.hostCount(), 1, 'exactly one overlay should stay mounted');
    assert.deepStrictEqual(page.ledger.snapshot(), listenersWhileOpen,
      'replacing a stale overlay should not stack a second set of page listeners');
    assert.strictEqual(page.sessionStorageListenerCount(), storageListenersWhileOpen,
      'replacing a stale overlay should not stack a second set of storage listeners');
    page.toggle();
    await waitForClosed(page, 'the replacement overlay should close');
    assert.strictEqual(page.hostCount(), 0, 'the replacement overlay should close');
    assertReleased(page, baseline, 'closing after a stale replacement');
  } finally {
    page.window.close();
  }
}

async function testEscapeCloseReleasesListeners() {
  const page = await createOverlayPage();
  try {
    const baseline = page.ledger.snapshot();
    await openAndSettle(page);
    page.toggle();
    await waitForClosed(page, 'the first cycle should close');
    await openAndSettle(page);
    page.toggle();
    await waitForClosed(page, 'the second cycle should close');
    assertReleased(page, baseline, 'repeated open/close cycles');
  } finally {
    page.window.close();
  }
}

async function testMountGuardRestoresHostUntilClose() {
  const page = await createOverlayPage();
  try {
    const host = await openAndSettle(page);
    // A host page that rewrites its DOM must not silently drop the open
    // overlay; only an intentional close may detach it.
    host.remove();
    await waitFor(() => host.isConnected, 'the open overlay host should be restored', page.errors);
    page.toggle();
    await waitForClosed(page, 'the restored overlay should close');
    assert.strictEqual(host.isConnected, false, 'a closed overlay must stay detached');
    assert.strictEqual(page.hostCount(), 0);
  } finally {
    page.window.close();
  }
}

(async () => {
  await testToggleCloseFromNewInvocation();
  await testCloseWithoutMotionIsImmediate();
  await testExitReleasesInputAtOnce();
  await testPressDuringExitReopens();
  await testMountGuardRestoresHostUntilClose();
  await testStaleReplacementThenClose();
  await testEscapeCloseReleasesListeners();
  console.log('overlay session teardown tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
