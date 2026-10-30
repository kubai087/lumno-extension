import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from './wallpaper-crt-webgl';
import { required } from '../../../tests/fakes/dom';

type Call = [string, ...unknown[]];

// A WebGL context that records the calls the renderer makes and the uniforms it sets.
function createFakeGl() {
  const calls: Call[] = [];
  const uniforms: Record<string, unknown> = {};
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
    bindFramebuffer: (_target: number, framebuffer: unknown) => calls.push(['bindFramebuffer', framebuffer]),
    bindTexture: (_target: number, texture: unknown) => calls.push(['bindTexture', texture]),
    bufferData() {},
    compileShader() {},
    createBuffer: () => ({}),
    createFramebuffer: () => ({ kind: 'framebuffer' }),
    createProgram: () => ({}),
    createShader: (type: number) => ({ type }),
    createTexture: () => ({ kind: 'texture' }),
    deleteBuffer() {},
    deleteFramebuffer: (framebuffer: unknown) => calls.push(['deleteFramebuffer', framebuffer]),
    deleteProgram() {},
    deleteShader() {},
    deleteTexture() {},
    drawArrays: (mode: number, first: number, count: number) => calls.push(['drawArrays', mode, first, count]),
    enableVertexAttribArray() {},
    framebufferTexture2D() {},
    getAttribLocation: () => 0,
    getExtension: () => null,
    getProgramParameter: () => true,
    checkFramebufferStatus: () => 21,
    getError: () => 0,
    getShaderParameter: () => true,
    getUniformLocation: (_program: unknown, name: string) => name,
    linkProgram() {},
    pixelStorei() {},
    shaderSource: (_shader: unknown, source: string) => calls.push(['shaderSource', source]),
    texImage2D: (...args: unknown[]) => calls.push(['texImage2D', args[args.length - 1], args]),
    texParameteri() {},
    uniform1f: (name: string, value: number) => { uniforms[name] = value; },
    uniform1i: (name: string, value: number) => { uniforms[name] = value; },
    uniform2f: (name: string, x: number, y: number) => { uniforms[name] = [x, y]; },
    useProgram() {},
    vertexAttribPointer() {},
    viewport: (_x: number, _y: number, width: number, height: number) => calls.push(['viewport', width, height])
  };
  const count = (predicate: (call: Call) => boolean) => calls.filter(predicate).length;
  const shaderSources = () => calls.filter((call) => call[0] === 'shaderSource').map((call) => String(call[1]));
  // The render targets allocated, by size: texImage2D calls without pixels.
  const allocations = () => calls.filter((call) => call[0] === 'texImage2D' && call[1] === null)
    .map((call) => (Array.isArray(call[2]) ? [call[2][3], call[2][4]] : []));
  return { allocations, calls, count, gl, shaderSources, uniforms };
}

// A canvas whose getContext answers `answer` for the context types asked for.
function canvasAnswering(answer: (type: string, attributes: unknown) => unknown): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getContext', { value: answer });
  return canvas;
}

function wallpaperImage(): HTMLImageElement {
  const image = document.createElement('img');
  Object.defineProperty(image, 'naturalWidth', { value: 1920 });
  Object.defineProperty(image, 'naturalHeight', { value: 1080 });
  return image;
}

describe('the CRT WebGL renderer', () => {
  it('is unsupported without WebGL', () => {
    const renderer = required(createRenderer({ canvas: canvasAnswering(() => null) }));
    expect(renderer.isSupported()).toBe(false);
    expect(renderer.render({ image: wallpaperImage() })).toBe(false);
  });

  function setup() {
    const fake = createFakeGl();
    const requested: Array<[string, unknown]> = [];
    const canvas = canvasAnswering((type, attributes) => {
      requested.push([type, attributes]);
      return fake.gl;
    });
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();
    const renderer = required(createRenderer({ canvas, onContextLost, onContextRestored }));
    return { canvas, fake, onContextLost, onContextRestored, renderer, requested };
  }

  const image = wallpaperImage();
  const frame = { image, width: 1280, height: 720, strength: 15, bloom: 12, rgbOffset: 65, curvature: 20 };

  it('draws on a WebGL2 context that keeps its buffer', () => {
    const { renderer, requested } = setup();
    expect(renderer.isSupported()).toBe(true);
    expect(requested).toHaveLength(1);
    expect(requested[0][0]).toBe('webgl2');
    expect(requested[0][1]).toMatchObject({ preserveDrawingBuffer: true });
  });

  it('renders CRT, two bloom passes and a composite with the frame\'s settings', () => {
    const { fake, renderer } = setup();
    expect(renderer.render(frame)).toBe(true);
    expect(fake.uniforms.uResolution).toEqual([1280, 720]);
    expect(fake.uniforms.uSourceSize).toEqual([1920, 1080]);
    expect(fake.uniforms.uPreset).toBeUndefined();
    expect(fake.uniforms.uStrength).toBe(0.15);
    // The composite binds the bloom target on texture unit one.
    expect(fake.uniforms.uBloom).toBe(1);
    // The physical bloom value maps through the fixed RGB gain.
    expect(Number(fake.uniforms.uBloomAmount)).toBeCloseTo(0.2037, 6);
    expect(fake.uniforms.uRgbOffset).toBe(0.65);
    expect(fake.uniforms.uCurvature).toBe(0.2);
    expect(fake.uniforms.uGrain).toBeUndefined();
    expect(fake.uniforms.uScanlineSpacing).toBeUndefined();
    expect(fake.count((call) => call[0] === 'drawArrays' && call[3] === 6)).toBe(4);
    expect(fake.calls.some((call) => call[0] === 'texImage2D' && call[1] === image)).toBe(true);
    // One full-resolution CRT target and two quarter-resolution bloom targets.
    expect(fake.allocations()).toEqual([[1280, 720], [320, 180], [320, 180]]);
  });

  it('compiles the CRT, bloom and composite stages', () => {
    const { fake, renderer } = setup();
    renderer.render(frame);
    const sources = fake.shaderSources();
    expect(sources.some((source) => source.includes('uRgbOffset'))).toBe(true);
    // Fixed scanlines and a stronger RGB grille.
    expect(sources.some((source) => source.includes('float scanPeriod = 2.0;') &&
      source.includes('mod(floor(gl_FragCoord.y), scanPeriod)') && source.includes('vec3(1.35, 0.16, 0.16)'))).toBe(true);
    // A directional bright-pass blur.
    expect(sources.some((source) => source.includes('uDirection') && source.includes('uThreshold'))).toBe(true);
    expect(sources.some((source) => source.includes('uCrt') && source.includes('uBloom') && source.includes('uBloomAmount'))).toBe(true);
    expect(sources.some((source) => source.includes('uCurvature'))).toBe(true);
  });

  it('reuses the uploaded wallpaper for a change of settings and reallocates its targets on a resize', () => {
    const { fake, renderer } = setup();
    renderer.render(frame);
    const uploads = fake.count((call) => call[0] === 'texImage2D');
    expect(renderer.render({ image, width: 1280, height: 720, bloom: 20 })).toBe(true);
    expect(fake.count((call) => call[0] === 'texImage2D')).toBe(uploads);

    const allocated = fake.allocations().length;
    expect(renderer.render({ image, width: 1000, height: 500, bloom: 20 })).toBe(true);
    expect(fake.allocations().length).toBe(allocated + 3);
  });

  it('renders only the CRT pass without bloom, allocating nothing for it', () => {
    const { fake, renderer } = setup();
    renderer.render({ image, width: 1000, height: 500, bloom: 20 });
    const draws = fake.count((call) => call[0] === 'drawArrays');
    const allocated = fake.allocations().length;
    expect(renderer.render({ image, width: 1000, height: 500, bloom: 0 })).toBe(true);
    expect(fake.count((call) => call[0] === 'drawArrays')).toBe(draws + 1);
    expect(fake.allocations().length).toBe(allocated);
  });

  it('stops on a lost context and uploads the wallpaper again once it is restored', () => {
    const { canvas, fake, onContextLost, onContextRestored, renderer } = setup();
    renderer.render(frame);
    const uploads = fake.count((call) => call[0] === 'texImage2D');
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(renderer.isSupported()).toBe(false);
    expect(renderer.render(frame)).toBe(false);

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(onContextRestored).toHaveBeenCalledTimes(1);
    expect(renderer.isSupported()).toBe(true);
    expect(renderer.render(frame)).toBe(true);
    expect(fake.count((call) => call[0] === 'texImage2D')).toBeGreaterThan(uploads);
  });

  it('releases every framebuffer generation and stops listening once destroyed', () => {
    const { canvas, fake, onContextLost, renderer } = setup();
    renderer.render(frame);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    renderer.render(frame);
    renderer.destroy();
    expect(renderer.isSupported()).toBe(false);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(fake.count((call) => call[0] === 'deleteFramebuffer')).toBeGreaterThanOrEqual(6);
  });

  it('falls back to a single-pass WebGL1 renderer', () => {
    const fallback = createFakeGl();
    const requested: string[] = [];
    const renderer = required(createRenderer({
      canvas: canvasAnswering((type) => {
        requested.push(type);
        return type === 'webgl' ? fallback.gl : null;
      })
    }));
    expect(requested).toEqual(['webgl2', 'webgl']);
    expect(renderer.isSupported()).toBe(true);
    expect(renderer.render({ image, width: 640, height: 360, bloom: 10 })).toBe(true);
    expect(fallback.count((call) => call[0] === 'drawArrays')).toBe(1);
    renderer.destroy();
  });

  it('never swaps an acquired WebGL2 context for WebGL1 on the same canvas', () => {
    const failing = createFakeGl();
    failing.gl.getShaderParameter = () => false;
    const requested: string[] = [];
    const renderer = required(createRenderer({
      canvas: canvasAnswering((type) => {
        requested.push(type);
        return failing.gl;
      })
    }));
    expect(requested).toEqual(['webgl2']);
    expect(renderer.isSupported()).toBe(false);
  });
});
