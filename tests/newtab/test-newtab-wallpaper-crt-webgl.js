const assert = require('assert');
const vm = require('vm');
const { moduleScript } = require('../helpers/module-script');

function loadModule() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(moduleScript('src/newtab/dom/wallpaper-crt-webgl.ts', 'LumnoNewtabCrtWebGL'), sandbox, { filename: 'src/newtab/dom/wallpaper-crt-webgl.ts' });
  return sandbox.LumnoNewtabCrtWebGL;
}

function createFakeGl() {
  const calls = [];
  const uniforms = {};
  const gl = {
    ARRAY_BUFFER: 1,
    CLAMP_TO_EDGE: 2,
    COMPILE_STATUS: 3,
    FLOAT: 4,
    FRAMEBUFFER: 20,
    FRAMEBUFFER_COMPLETE: 21,
    COLOR_ATTACHMENT0: 22,
    FRAGMENT_SHADER: 5,
    LINEAR: 6,
    LINK_STATUS: 7,
    NO_ERROR: 0,
    RGBA: 8,
    STATIC_DRAW: 9,
    TEXTURE0: 10,
    TEXTURE_2D: 11,
    TEXTURE_MAG_FILTER: 12,
    TEXTURE_MIN_FILTER: 13,
    TEXTURE_WRAP_S: 14,
    TEXTURE_WRAP_T: 15,
    TRIANGLES: 16,
    UNPACK_FLIP_Y_WEBGL: 17,
    UNSIGNED_BYTE: 18,
    VERTEX_SHADER: 19,
    activeTexture() {},
    attachShader() {},
    bindBuffer() {},
    bindFramebuffer(_target, framebuffer) { calls.push(['bindFramebuffer', framebuffer]); },
    bindTexture(_target, texture) { calls.push(['bindTexture', texture]); },
    bufferData() {},
    compileShader() {},
    createBuffer: () => ({}),
    createFramebuffer: () => ({ kind: 'framebuffer' }),
    createProgram: () => ({}),
    createShader: (type) => ({ type }),
    createTexture: () => ({ kind: 'texture' }),
    deleteBuffer() {},
    deleteFramebuffer(framebuffer) { calls.push(['deleteFramebuffer', framebuffer]); },
    deleteProgram() {},
    deleteShader() {},
    deleteTexture() {},
    drawArrays(mode, first, count) { calls.push(['drawArrays', mode, first, count]); },
    enableVertexAttribArray() {},
    framebufferTexture2D() {},
    getAttribLocation: () => 0,
    getExtension: () => null,
    getProgramParameter: () => true,
    checkFramebufferStatus: () => 21,
    getError: () => 0,
    getShaderParameter: () => true,
    getUniformLocation: (_program, name) => name,
    linkProgram() {},
    pixelStorei() {},
    shaderSource(_shader, shaderSource) { calls.push(['shaderSource', shaderSource]); },
    texImage2D(...args) { calls.push(['texImage2D', args[args.length - 1], args]); },
    texParameteri() {},
    uniform1f(name, value) { uniforms[name] = value; },
    uniform1i(name, value) { uniforms[name] = value; },
    uniform2f(name, x, y) { uniforms[name] = [x, y]; },
    useProgram() {},
    vertexAttribPointer() {},
    viewport(_x, _y, width, height) { calls.push(['viewport', width, height]); }
  };
  return { calls, gl, uniforms };
}

const moduleApi = loadModule();
assert.ok(moduleApi && typeof moduleApi.createRenderer === 'function');

const unsupported = moduleApi.createRenderer({
  canvas: { getContext: () => null, addEventListener() {} }
});
assert.strictEqual(unsupported.isSupported(), false);
assert.strictEqual(unsupported.render({ image: {} }), false);

const fake = createFakeGl();
const canvasListeners = {};
let contextLostCount = 0;
let contextRestoredCount = 0;
const canvas = {
  width: 0,
  height: 0,
  addEventListener(name, handler) { canvasListeners[name] = handler; },
  removeEventListener(name, handler) {
    if (canvasListeners[name] === handler) delete canvasListeners[name];
  },
  getContext(type, attributes) {
    assert.strictEqual(type, 'webgl2');
    assert.strictEqual(attributes.preserveDrawingBuffer, true);
    return fake.gl;
  }
};
const renderer = moduleApi.createRenderer({
  canvas,
  onContextLost: () => { contextLostCount += 1; },
  onContextRestored: () => { contextRestoredCount += 1; }
});
assert.strictEqual(renderer.isSupported(), true);
const image = { naturalWidth: 1920, naturalHeight: 1080 };
assert.strictEqual(renderer.render({
  image,
  width: 1280,
  height: 720,
  strength: 15,
  bloom: 12,
  rgbOffset: 65,
  curvature: 20
}), true);
assert.deepStrictEqual(fake.uniforms.uResolution, [1280, 720]);
assert.deepStrictEqual(fake.uniforms.uSourceSize, [1920, 1080]);
assert.strictEqual(fake.uniforms.uPreset, undefined);
assert.strictEqual(fake.uniforms.uStrength, 0.15);
assert.strictEqual(fake.uniforms.uBloom, 1, 'composite should bind the bloom target on texture unit one');
assert.ok(
  Math.abs(fake.uniforms.uBloomAmount - 0.2037) < 0.000001,
  'WebGL2 composite should map the physical bloom value through the fixed RGB gain'
);
assert.strictEqual(fake.uniforms.uRgbOffset, 0.65);
assert.strictEqual(fake.uniforms.uCurvature, 0.2);
assert.strictEqual(fake.uniforms.uGrain, undefined);
assert.strictEqual(fake.uniforms.uScanlineSpacing, undefined);
assert.strictEqual(
  fake.calls.filter((call) => call[0] === 'drawArrays' && call[3] === 6).length,
  4,
  'WebGL2 should render CRT, horizontal bloom, vertical bloom, then composite'
);
assert.ok(fake.calls.some((call) => call[0] === 'texImage2D' && call[1] === image));
assert.deepStrictEqual(
  fake.calls
    .filter((call) => call[0] === 'texImage2D' && call[1] === null)
    .map((call) => [call[2][3], call[2][4]]),
  [[1280, 720], [320, 180], [320, 180]],
  'WebGL2 should allocate one full-resolution CRT target and two quarter-resolution bloom targets'
);
assert.ok(fake.calls.filter((call) => call[0] === 'shaderSource').some((call) => call[1].includes('uRgbOffset')));
assert.ok(fake.calls.filter((call) => call[0] === 'shaderSource').some((call) =>
  call[1].includes('float scanPeriod = 2.0;') &&
  call[1].includes('mod(floor(gl_FragCoord.y), scanPeriod)') &&
  call[1].includes('vec3(1.35, 0.16, 0.16)')
), 'WebGL2 CRT stage should use fixed scanlines and a stronger RGB grille');
assert.ok(fake.calls.filter((call) => call[0] === 'shaderSource').some((call) =>
  call[1].includes('uDirection') && call[1].includes('uThreshold')
), 'WebGL2 bloom stage should perform directional bright-pass blur');
assert.ok(fake.calls.filter((call) => call[0] === 'shaderSource').some((call) =>
  call[1].includes('uCrt') && call[1].includes('uBloom') && call[1].includes('uBloomAmount')
), 'WebGL2 composite stage should combine CRT and bloom targets');
assert.ok(fake.calls.filter((call) => call[0] === 'shaderSource').some((call) => call[1].includes('uCurvature')));
const uploadCount = fake.calls.filter((call) => call[0] === 'texImage2D').length;
assert.strictEqual(renderer.render({
  image,
  width: 1280,
  height: 720,
  bloom: 20
}), true);
assert.strictEqual(
  fake.calls.filter((call) => call[0] === 'texImage2D').length,
  uploadCount,
  'uniform-only changes should reuse the uploaded wallpaper texture'
);
const allocationCount = fake.calls.filter((call) =>
  call[0] === 'texImage2D' && call[1] === null
).length;
assert.strictEqual(renderer.render({ image, width: 1000, height: 500, bloom: 20 }), true);
assert.strictEqual(
  fake.calls.filter((call) => call[0] === 'texImage2D' && call[1] === null).length,
  allocationCount + 3,
  'resizing should reallocate exactly the CRT target and two bloom targets'
);
const zeroBloomDrawCount = fake.calls.filter((call) => call[0] === 'drawArrays').length;
const zeroBloomAllocationCount = fake.calls.filter((call) =>
  call[0] === 'texImage2D' && call[1] === null
).length;
assert.strictEqual(renderer.render({ image, width: 1000, height: 500, bloom: 0 }), true);
assert.strictEqual(
  fake.calls.filter((call) => call[0] === 'drawArrays').length,
  zeroBloomDrawCount + 1,
  'zero bloom should render only the CRT pass'
);
assert.strictEqual(
  fake.calls.filter((call) => call[0] === 'texImage2D' && call[1] === null).length,
  zeroBloomAllocationCount,
  'zero bloom should not allocate or resize bloom targets'
);
let prevented = false;
canvasListeners.webglcontextlost({ preventDefault: () => { prevented = true; } });
assert.strictEqual(prevented, true);
assert.strictEqual(contextLostCount, 1);
assert.strictEqual(renderer.isSupported(), false);
assert.strictEqual(renderer.render({ image, width: 1280, height: 720 }), false);
canvasListeners.webglcontextrestored();
assert.strictEqual(contextRestoredCount, 1);
assert.strictEqual(renderer.isSupported(), true);
assert.strictEqual(renderer.render({ image, width: 1280, height: 720 }), true);
assert.ok(
  fake.calls.filter((call) => call[0] === 'texImage2D').length > uploadCount,
  'a restored WebGL context should upload the wallpaper texture again'
);

renderer.destroy();
assert.strictEqual(renderer.isSupported(), false);
assert.strictEqual(canvasListeners.webglcontextlost, undefined);
assert.strictEqual(canvasListeners.webglcontextrestored, undefined);
assert.ok(
  fake.calls.filter((call) => call[0] === 'deleteFramebuffer').length >= 6,
  'context restoration and destroy should release every WebGL2 framebuffer generation'
);

const fallbackFake = createFakeGl();
const requestedContexts = [];
const fallbackRenderer = moduleApi.createRenderer({
  canvas: {
    addEventListener() {},
    removeEventListener() {},
    getContext(type) {
      requestedContexts.push(type);
      return type === 'webgl' ? fallbackFake.gl : null;
    }
  }
});
assert.deepStrictEqual(requestedContexts, ['webgl2', 'webgl']);
assert.strictEqual(fallbackRenderer.isSupported(), true);
assert.strictEqual(fallbackRenderer.render({ image, width: 640, height: 360, bloom: 10 }), true);
assert.strictEqual(
  fallbackFake.calls.filter((call) => call[0] === 'drawArrays').length,
  1,
  'WebGL1 fallback should retain the single-pass renderer'
);
fallbackRenderer.destroy();

const failedWebgl2 = createFakeGl();
failedWebgl2.gl.getShaderParameter = () => false;
const failedContextRequests = [];
const failedRenderer = moduleApi.createRenderer({
  canvas: {
    addEventListener() {},
    getContext(type) {
      failedContextRequests.push(type);
      return failedWebgl2.gl;
    }
  }
});
assert.deepStrictEqual(
  failedContextRequests,
  ['webgl2'],
  'an acquired WebGL2 context should not be replaced with WebGL1 on the same canvas'
);
assert.strictEqual(failedRenderer.isSupported(), false);

console.log('new tab wallpaper CRT WebGL tests passed');
