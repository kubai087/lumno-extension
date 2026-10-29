// The bottom dock's density hysteresis: denser at once, roomier only when it
// is not held and would not flip back.
const assert = require('assert');
const path = require('path');

const { nextDockDensity } = require(path.join(__dirname, '..', '..', 'src', 'newtab', 'dom', 'layout.ts'));

function probe(stable) {
  const calls = [];
  const fn = (candidate) => {
    calls.push(candidate);
    return typeof stable === 'function' ? stable(candidate) : stable;
  };
  fn.calls = calls;
  return fn;
}

// The first layout and a page leaving the mobile flow take what they measure.
assert.strictEqual(nextDockDensity('', 'compact', {}), 'compact');
assert.strictEqual(nextDockDensity(null, 'default', {}), 'default');
assert.strictEqual(nextDockDensity('mobile', 'default', { isPromotionStable: probe(false) }), 'default');

// A mobile-width page always flows.
assert.strictEqual(nextDockDensity('compact', 'default', { mobileFlow: true }), 'mobile');

// Getting denser happens at once, even while promotions are held, and
// without probing anything.
{
  const isPromotionStable = probe(true);
  assert.strictEqual(nextDockDensity('default', 'compact', { holdPromotion: true, isPromotionStable }), 'compact');
  assert.strictEqual(nextDockDensity('compact', 'tiny', { isPromotionStable }), 'tiny');
  assert.strictEqual(nextDockDensity('compact', 'compact', { isPromotionStable }), 'compact');
  assert.deepStrictEqual(isPromotionStable.calls, []);
}

// A live resize or a preference change holds the dock where it is.
{
  const isPromotionStable = probe(true);
  assert.strictEqual(nextDockDensity('compact', 'default', { holdPromotion: true, isPromotionStable }), 'compact');
  assert.strictEqual(nextDockDensity('tiny', 'default', { holdPromotion: true, isPromotionStable }), 'tiny');
  assert.deepStrictEqual(isPromotionStable.calls, []);
}

// A wrapped shortcut row: compact leaves room for default, but default
// pushes the shortcuts down and measures compact again. It stays compact.
{
  const measureAt = { compact: 'default', default: 'compact' };
  const isPromotionStable = probe((candidate) => measureAt[candidate] === candidate);
  let density = nextDockDensity('', 'compact', { isPromotionStable });
  for (let frame = 0; frame < 4; frame += 1) {
    density = nextDockDensity(density, measureAt[density], { isPromotionStable });
    assert.strictEqual(density, 'compact', 'the dock must not alternate compact and default');
  }
  assert.ok(isPromotionStable.calls.every((candidate) => candidate === 'default'));
}

// Once the viewport grows enough that default still measures default, the
// dock becomes roomier.
assert.strictEqual(nextDockDensity('compact', 'default', { isPromotionStable: probe(true) }), 'default');
assert.strictEqual(nextDockDensity('tiny', 'compact', { isPromotionStable: probe(true) }), 'compact');
assert.strictEqual(nextDockDensity('tiny', 'default', { isPromotionStable: probe(false) }), 'tiny');

console.log('newtab dock density tests passed');
