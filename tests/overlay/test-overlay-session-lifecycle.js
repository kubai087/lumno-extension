const assert = require('assert');
const { JSDOM } = require('jsdom');

const LumnoOverlayLifecycle = require('../../src/overlay/dom/lifecycle.ts');

const lifecycle = LumnoOverlayLifecycle;

// Cleanup steps run newest first, once, and a failing step does not stop the rest.
{
  const registry = lifecycle.createSessionCleanupRegistry();
  const order = [];
  registry.add(() => order.push('first'));
  registry.add(() => {
    order.push('failing');
    throw new Error('teardown failed');
  });
  registry.add(() => order.push('last'));
  assert.strictEqual(registry.add(null), null);
  assert.strictEqual(registry.size, 3);
  registry.run();
  assert.deepStrictEqual(order, ['last', 'failing', 'first']);
  assert.strictEqual(registry.size, 0);
  registry.run();
  assert.deepStrictEqual(order, ['last', 'failing', 'first'], 'steps run only once');
}

// A later invocation reaches an earlier session through its mount host.
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const { document } = dom.window;
  const host = document.createElement('div');
  document.documentElement.appendChild(host);
  const destroyCalls = [];
  lifecycle.onSessionDestroyRequest(host, (options) => {
    destroyCalls.push(options);
    host.remove();
  });
  assert.strictEqual(lifecycle.requestSessionDestroy(host, { preserveLoadingIntent: true }), true,
    'a session that removes its host reports itself destroyed');
  assert.deepStrictEqual(destroyCalls, [{ preserveLoadingIntent: true, animateExit: false }]);

  document.documentElement.appendChild(host);
  assert.strictEqual(lifecycle.requestSessionDestroy(host), false,
    'a session answers one destroy request only');
  assert.strictEqual(destroyCalls.length, 1);
  dom.window.close();
}

// A hotkey toggle requests an animated close from the existing session.
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const host = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(host);
  const requests = [];
  lifecycle.onSessionDestroyRequest(host, (options) => requests.push(options));
  assert.strictEqual(lifecycle.requestSessionDestroy(host, { animateExit: true }), false,
    'the host remains mounted while its exit animation runs');
  assert.deepStrictEqual(requests, [{ preserveLoadingIntent: false, animateExit: true }]);
  // The session keeps listening while it animates out, so a press that
  // reopens the overlay can still finish it at once.
  lifecycle.requestSessionDestroy(host, { preserveLoadingIntent: true });
  assert.deepStrictEqual(requests[1], { preserveLoadingIntent: true, animateExit: false });
  lifecycle.requestSessionDestroy(host);
  assert.strictEqual(requests.length, 2, 'a plain request ends the session for good');
  dom.window.close();
}

// Unbinding (the session's own teardown) stops it answering later requests.
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const { document } = dom.window;
  const host = document.createElement('div');
  document.body.appendChild(host);
  let destroyed = 0;
  const unbind = lifecycle.onSessionDestroyRequest(host, () => {
    destroyed += 1;
  });
  unbind();
  assert.strictEqual(lifecycle.requestSessionDestroy(host, { preserveLoadingIntent: false }), false,
    'an overlay without a live session is still mounted, so the caller falls back');
  assert.strictEqual(destroyed, 0);
  dom.window.close();
}

// The request detail is a plain string so it survives isolated worlds.
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const { document } = dom.window;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const details = [];
  host.addEventListener('_x_extension_overlay_session_destroy_2026_unique_', (event) => {
    details.push(event.detail);
  });
  lifecycle.requestSessionDestroy(host, { preserveLoadingIntent: true });
  lifecycle.requestSessionDestroy(host, { animateExit: true });
  lifecycle.requestSessionDestroy(host);
  assert.deepStrictEqual(details, ['preserve-loading-intent', 'animate-exit', '']);
  dom.window.close();
}

assert.strictEqual(lifecycle.requestSessionDestroy(null), false);
assert.strictEqual(typeof lifecycle.onSessionDestroyRequest(null, () => {}), 'function');

console.log('overlay session lifecycle tests passed');
