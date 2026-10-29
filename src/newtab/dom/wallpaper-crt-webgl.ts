// The CRT wallpaper effect drawn with WebGL: WebGL2 with a separate bloom
// pass when available, else a single WebGL1 pass.
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  preserveDrawingBuffer: true,
  premultipliedAlpha: false
};

const WEBGL1_VERTEX_SHADER = [
  'attribute vec2 aPosition;',
  'varying vec2 vUv;',
  'void main() {',
  '  vUv = aPosition * 0.5 + 0.5;',
  '  gl_Position = vec4(aPosition, 0.0, 1.0);',
  '}'
].join('\n');

const WEBGL1_FRAGMENT_SHADER = [
  'precision mediump float;',
  'uniform sampler2D uImage;',
  'uniform vec2 uResolution;',
  'uniform vec2 uSourceSize;',
  'uniform float uStrength;',
  'uniform float uBloom;',
  'uniform float uRgbOffset;',
  'uniform float uCurvature;',
  'varying vec2 vUv;',
  'vec2 coverUv(vec2 uv) {',
  '  float outputAspect = uResolution.x / max(uResolution.y, 1.0);',
  '  float sourceAspect = uSourceSize.x / max(uSourceSize.y, 1.0);',
  '  vec2 scale = sourceAspect > outputAspect',
  '    ? vec2(outputAspect / sourceAspect, 1.0)',
  '    : vec2(1.0, sourceAspect / outputAspect);',
  '  return (uv - 0.5) * scale + 0.5;',
  '}',
  'vec3 sampleRgb(vec2 uv, float shift) {',
  '  vec2 offset = vec2(',
  '    shift / max(uResolution.x, 1.0),',
  '    shift * 0.12 / max(uResolution.y, 1.0)',
  '  );',
  '  return vec3(',
  '    texture2D(uImage, coverUv(uv + offset)).r,',
  '    texture2D(uImage, coverUv(uv)).g,',
  '    texture2D(uImage, coverUv(uv - offset)).b',
  '  );',
  '}',
  'float luma(vec3 color) { return dot(color, vec3(0.2126, 0.7152, 0.0722)); }',
  'void main() {',
  '  vec2 centered = vUv * 2.0 - 1.0;',
  '  float curve = uCurvature * 0.16;',
  '  vec2 warped = centered * (1.0 + curve * dot(centered, centered));',
  '  vec2 uv = warped * 0.5 + 0.5;',
  '  float border = 1.0 - smoothstep(0.985, 1.03, max(abs(warped.x), abs(warped.y)));',
  '  float shift = mix(0.0, 4.2, uRgbOffset) * 1.25;',
  '  vec3 color = sampleRgb(uv, shift);',
  '  vec2 texel = 1.0 / max(uResolution, vec2(1.0));',
  '  float radius = mix(2.0, 10.0, uBloom);',
  '  float farRadius = radius * 2.15;',
  '  vec3 glow = vec3(0.0);',
  '  if (uBloom > 0.0001) {',
  '    glow += texture2D(uImage, coverUv(uv)).rgb * 0.18;',
  '    glow += texture2D(uImage, coverUv(uv + vec2(radius, 0.0) * texel)).rgb * 0.12;',
  '    glow += texture2D(uImage, coverUv(uv - vec2(radius, 0.0) * texel)).rgb * 0.12;',
  '    glow += texture2D(uImage, coverUv(uv + vec2(0.0, radius) * texel)).rgb * 0.12;',
  '    glow += texture2D(uImage, coverUv(uv - vec2(0.0, radius) * texel)).rgb * 0.12;',
  '    glow += texture2D(uImage, coverUv(uv + vec2(radius) * texel)).rgb * 0.055;',
  '    glow += texture2D(uImage, coverUv(uv - vec2(radius) * texel)).rgb * 0.055;',
  '    glow += texture2D(uImage, coverUv(uv + vec2(radius, -radius) * texel)).rgb * 0.055;',
  '    glow += texture2D(uImage, coverUv(uv + vec2(-radius, radius) * texel)).rgb * 0.055;',
  '    glow += texture2D(uImage, coverUv(uv + vec2(farRadius, 0.0) * texel)).rgb * 0.03;',
  '    glow += texture2D(uImage, coverUv(uv - vec2(farRadius, 0.0) * texel)).rgb * 0.03;',
  '    glow += texture2D(uImage, coverUv(uv + vec2(0.0, farRadius) * texel)).rgb * 0.03;',
  '    glow += texture2D(uImage, coverUv(uv - vec2(0.0, farRadius) * texel)).rgb * 0.03;',
  '    glow *= smoothstep(0.28, 0.78, luma(glow));',
  '  }',
  '  float displayResponse = clamp(uStrength / 0.2, 0.0, 1.0);',
  '  float bloomGain = uBloom * 0.28;',
  '  color += glow * bloomGain * (0.65 + 0.75 * displayResponse);',
  '  float scanPeriod = 2.0;',
  '  float scanWave = step(1.0, mod(floor(gl_FragCoord.y), scanPeriod));',
  '  float scanDepth = mix(0.035, 0.21, displayResponse);',
  '  color *= 1.0 - scanDepth * scanWave;',
  '  float channel = mod(floor(gl_FragCoord.x), 3.0);',
  '  vec3 mask = channel < 1.0 ? vec3(1.35, 0.16, 0.16)',
  '    : (channel < 2.0 ? vec3(0.16, 1.35, 0.16) : vec3(0.16, 0.16, 1.35));',
  '  float maskAmount = mix(0.32, 0.68, displayResponse);',
  '  color *= mix(vec3(1.0), mask, maskAmount);',
  '  float vignette = 1.0 - smoothstep(0.28, 1.15, length(centered * vec2(0.86, 1.0)));',
  '  color *= mix(0.72, 1.0, vignette) * border;',
  '  color = (color - 0.5) * (1.02 + 0.16 * uStrength) + 0.5;',
  '  color *= 1.01 + 0.07 * uStrength;',
  '  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);',
  '}'
].join('\n');

const WEBGL2_VERTEX_SHADER = [
  '#version 300 es',
  'in vec2 aPosition;',
  'out vec2 vUv;',
  'void main() {',
  '  vUv = aPosition * 0.5 + 0.5;',
  '  gl_Position = vec4(aPosition, 0.0, 1.0);',
  '}'
].join('\n');

const WEBGL2_CRT_FRAGMENT_SHADER = [
  '#version 300 es',
  'precision highp float;',
  'uniform sampler2D uImage;',
  'uniform vec2 uResolution;',
  'uniform vec2 uSourceSize;',
  'uniform float uStrength;',
  'uniform float uRgbOffset;',
  'uniform float uCurvature;',
  'in vec2 vUv;',
  'out vec4 fragColor;',
  'vec2 coverUv(vec2 uv) {',
  '  float outputAspect = uResolution.x / max(uResolution.y, 1.0);',
  '  float sourceAspect = uSourceSize.x / max(uSourceSize.y, 1.0);',
  '  vec2 scale = sourceAspect > outputAspect',
  '    ? vec2(outputAspect / sourceAspect, 1.0)',
  '    : vec2(1.0, sourceAspect / outputAspect);',
  '  return (uv - 0.5) * scale + 0.5;',
  '}',
  'vec3 sampleRgb(vec2 uv, float shift) {',
  '  vec2 offset = vec2(',
  '    shift / max(uResolution.x, 1.0),',
  '    shift * 0.12 / max(uResolution.y, 1.0)',
  '  );',
  '  return vec3(',
  '    texture(uImage, coverUv(uv + offset)).r,',
  '    texture(uImage, coverUv(uv)).g,',
  '    texture(uImage, coverUv(uv - offset)).b',
  '  );',
  '}',
  'void main() {',
  '  vec2 centered = vUv * 2.0 - 1.0;',
  '  float curve = uCurvature * 0.16;',
  '  vec2 warped = centered * (1.0 + curve * dot(centered, centered));',
  '  vec2 uv = warped * 0.5 + 0.5;',
  '  float border = 1.0 - smoothstep(0.985, 1.03, max(abs(warped.x), abs(warped.y)));',
  '  float shift = mix(0.0, 4.2, uRgbOffset) * 1.25;',
  '  vec3 color = sampleRgb(uv, shift);',
  '  float displayResponse = clamp(uStrength / 0.2, 0.0, 1.0);',
  '  float scanPeriod = 2.0;',
  '  float scanWave = step(1.0, mod(floor(gl_FragCoord.y), scanPeriod));',
  '  float scanDepth = mix(0.035, 0.21, displayResponse);',
  '  color *= 1.0 - scanDepth * scanWave;',
  '  float channel = mod(floor(gl_FragCoord.x), 3.0);',
  '  vec3 mask = channel < 1.0 ? vec3(1.35, 0.16, 0.16)',
  '    : (channel < 2.0 ? vec3(0.16, 1.35, 0.16) : vec3(0.16, 0.16, 1.35));',
  '  float maskAmount = mix(0.32, 0.68, displayResponse);',
  '  color *= mix(vec3(1.0), mask, maskAmount);',
  '  float vignette = 1.0 - smoothstep(0.28, 1.15, length(centered * vec2(0.86, 1.0)));',
  '  color *= mix(0.72, 1.0, vignette) * border;',
  '  color = (color - 0.5) * (1.02 + 0.16 * uStrength) + 0.5;',
  '  color *= 1.01 + 0.07 * uStrength;',
  '  fragColor = vec4(max(color, vec3(0.0)), 1.0);',
  '}'
].join('\n');

const WEBGL2_BLOOM_FRAGMENT_SHADER = [
  '#version 300 es',
  'precision highp float;',
  'uniform sampler2D uImage;',
  'uniform vec2 uTexelSize;',
  'uniform vec2 uDirection;',
  'uniform float uRadius;',
  'uniform float uThreshold;',
  'in vec2 vUv;',
  'out vec4 fragColor;',
  'float luma(vec3 color) { return dot(color, vec3(0.2126, 0.7152, 0.0722)); }',
  'vec3 brightSample(vec2 uv) {',
  '  vec3 color = texture(uImage, uv).rgb;',
  '  float gate = uThreshold < 0.0 ? 1.0 : smoothstep(uThreshold, 0.86, luma(color));',
  '  return color * gate;',
  '}',
  'void main() {',
  '  vec2 stepUv = uDirection * uTexelSize * uRadius;',
  '  vec3 color = brightSample(vUv) * 0.2270270270;',
  '  color += brightSample(vUv + stepUv * 1.3846153846) * 0.3162162162;',
  '  color += brightSample(vUv - stepUv * 1.3846153846) * 0.3162162162;',
  '  color += brightSample(vUv + stepUv * 3.2307692308) * 0.0702702703;',
  '  color += brightSample(vUv - stepUv * 3.2307692308) * 0.0702702703;',
  '  fragColor = vec4(color, 1.0);',
  '}'
].join('\n');

const WEBGL2_COMPOSITE_FRAGMENT_SHADER = [
  '#version 300 es',
  'precision highp float;',
  'uniform sampler2D uCrt;',
  'uniform sampler2D uBloom;',
  'uniform float uBloomAmount;',
  'in vec2 vUv;',
  'out vec4 fragColor;',
  'void main() {',
  '  vec3 crt = texture(uCrt, vUv).rgb;',
  '  vec3 bloom = texture(uBloom, vUv).rgb;',
  '  fragColor = vec4(max(crt + bloom * uBloomAmount, vec3(0.0)), 1.0);',
  '}'
].join('\n');

// The context the renderer draws with. A WebGL2 context runs WebGL2 shaders
// but none of its own calls, so both kinds are handled the same way.
type GL = WebGLRenderingContext | WebGL2RenderingContext;

// A wallpaper the renderer can upload as a texture.
type CrtSourceImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

// One frame: the wallpaper, the output size, and the effect's settings.
interface CrtRenderParams {
  image: CrtSourceImage | null | undefined;
  width?: number;
  height?: number;
  // The wallpaper's own size, when the image element is scaled.
  sourceWidth?: number;
  sourceHeight?: number;
  // 0-100.
  strength?: number;
  // 0-20.
  bloom?: number;
  // 0-100.
  rgbOffset?: number;
  // 0-100.
  curvature?: number;
}

interface CrtRendererOptions {
  documentObj?: Document;
  // The canvas to draw on; a new one when missing.
  canvas?: HTMLCanvasElement;
  onContextLost?: () => void;
  // Gets whether the restored context still renders.
  onContextRestored?: (supported: boolean) => void;
}

type Backend = 'webgl1' | 'webgl2';

// A linked program with its vertex position attribute and uniforms.
interface ProgramInfo<U extends string> {
  program: WebGLProgram;
  position: number;
  uniform(name: U): WebGLUniformLocation | null;
}

// A texture to draw into, with its framebuffer.
interface RenderTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

// The GPU objects of one backend, drawing a frame of the given size.
interface Pipeline {
  sourceTexture: WebGLTexture;
  render(params: CrtRenderParams, image: CrtSourceImage, width: number, height: number): boolean;
  release(): void;
}

function normalizePercent(value: unknown, fallback: number): number {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? number : fallback)) / 100;
}

function normalizeRange(value: unknown, max: unknown, fallback: number): number {
  const number = Number(value);
  const limit = Math.max(1, Number(max) || 100);
  return Math.max(0, Math.min(limit, Number.isFinite(number) ? number : fallback)) / limit;
}

function compileShader(gl: GL, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: GL, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createTexture(gl: GL): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function createBuffer(gl: GL): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  if (!buffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  return buffer;
}

function createTarget(gl: GL): RenderTarget | null {
  const texture = createTexture(gl);
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) gl.deleteTexture(texture);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    return null;
  }
  return { texture, framebuffer };
}

function deleteTarget(gl: GL, target: RenderTarget | null): void {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

function getProgramInfo<U extends string>(gl: GL, program: WebGLProgram, names: readonly U[]): ProgramInfo<U> {
  const uniforms = new Map<U, WebGLUniformLocation | null>();
  names.forEach((name) => {
    uniforms.set(name, gl.getUniformLocation(program, name));
  });
  return {
    program,
    position: gl.getAttribLocation(program, 'aPosition'),
    uniform: (name) => uniforms.get(name) || null
  };
}

function bindProgram<U extends string>(gl: GL, buffer: WebGLBuffer, programInfo: ProgramInfo<U>): void {
  gl.useProgram(programInfo.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(programInfo.position);
  gl.vertexAttribPointer(programInfo.position, 2, gl.FLOAT, false, 0, 0);
}

function bindTextureUnit(gl: GL, texture: WebGLTexture, unit: number, location: WebGLUniformLocation | null): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(location, unit);
}

function getSourceSize(params: CrtRenderParams, image: CrtSourceImage): [number, number] {
  const naturalWidth = 'naturalWidth' in image ? image.naturalWidth : 0;
  const naturalHeight = 'naturalHeight' in image ? image.naturalHeight : 0;
  return [
    Math.max(1, Number(params.sourceWidth) || naturalWidth || image.width || 1),
    Math.max(1, Number(params.sourceHeight) || naturalHeight || image.height || 1)
  ];
}

// One pass: the effect and its bloom, sampled around each pixel.
function createWebGL1Pipeline(gl: GL): Pipeline | null {
  const program = createProgram(gl, WEBGL1_VERTEX_SHADER, WEBGL1_FRAGMENT_SHADER);
  const buffer = program ? createBuffer(gl) : null;
  const sourceTexture = buffer ? createTexture(gl) : null;
  if (!program || !buffer || !sourceTexture) {
    if (sourceTexture) gl.deleteTexture(sourceTexture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    return null;
  }
  const info = getProgramInfo(gl, program, [
    'uImage', 'uResolution', 'uSourceSize', 'uStrength',
    'uBloom', 'uRgbOffset', 'uCurvature'
  ]);
  return {
    sourceTexture,
    render(params, image, width, height) {
      const sourceSize = getSourceSize(params, image);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      bindProgram(gl, buffer, info);
      bindTextureUnit(gl, sourceTexture, 0, info.uniform('uImage'));
      gl.uniform2f(info.uniform('uResolution'), width, height);
      gl.uniform2f(info.uniform('uSourceSize'), sourceSize[0], sourceSize[1]);
      gl.uniform1f(info.uniform('uStrength'), normalizePercent(params.strength, 50));
      gl.uniform1f(info.uniform('uBloom'), normalizeRange(params.bloom, 20, 15));
      gl.uniform1f(info.uniform('uRgbOffset'), normalizePercent(params.rgbOffset, 35));
      gl.uniform1f(info.uniform('uCurvature'), normalizePercent(params.curvature, 18));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    },
    release() {
      gl.deleteTexture(sourceTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    }
  };
}

// The effect into a full-size target, a two-pass blur of its bright parts at
// quarter size, then both composited onto the canvas.
function createWebGL2Pipeline(gl: GL): Pipeline | null {
  const crtProgram = createProgram(gl, WEBGL2_VERTEX_SHADER, WEBGL2_CRT_FRAGMENT_SHADER);
  const bloomProgram = crtProgram
    ? createProgram(gl, WEBGL2_VERTEX_SHADER, WEBGL2_BLOOM_FRAGMENT_SHADER)
    : null;
  const compositeProgram = bloomProgram
    ? createProgram(gl, WEBGL2_VERTEX_SHADER, WEBGL2_COMPOSITE_FRAGMENT_SHADER)
    : null;
  const buffer = compositeProgram ? createBuffer(gl) : null;
  const sourceTexture = buffer ? createTexture(gl) : null;
  const crtTarget = sourceTexture ? createTarget(gl) : null;
  const bloomTargetA = crtTarget ? createTarget(gl) : null;
  const bloomTargetB = bloomTargetA ? createTarget(gl) : null;
  if (!crtProgram || !bloomProgram || !compositeProgram || !buffer || !sourceTexture ||
      !crtTarget || !bloomTargetA || !bloomTargetB) {
    [crtTarget, bloomTargetA, bloomTargetB].forEach((target) => deleteTarget(gl, target));
    if (sourceTexture) gl.deleteTexture(sourceTexture);
    if (buffer) gl.deleteBuffer(buffer);
    [crtProgram, bloomProgram, compositeProgram].forEach((program) => {
      if (program) gl.deleteProgram(program);
    });
    return null;
  }
  const crt = getProgramInfo(gl, crtProgram, [
    'uImage', 'uResolution', 'uSourceSize', 'uStrength',
    'uRgbOffset', 'uCurvature'
  ]);
  const bloom = getProgramInfo(gl, bloomProgram, [
    'uImage', 'uTexelSize', 'uDirection', 'uRadius', 'uThreshold'
  ]);
  const composite = getProgramInfo(gl, compositeProgram, ['uCrt', 'uBloom', 'uBloomAmount']);
  let targetWidth = 0;
  let targetHeight = 0;

  function allocateTarget(target: RenderTarget, width: number, height: number): boolean {
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      target.texture,
      0
    );
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  }

  const ensureTargets = (width: number, height: number): boolean => {
    if (targetWidth === width && targetHeight === height) return true;
    const bloomWidth = Math.max(1, Math.ceil(width / 4));
    const bloomHeight = Math.max(1, Math.ceil(height / 4));
    if (!allocateTarget(crtTarget, width, height) ||
        !allocateTarget(bloomTargetA, bloomWidth, bloomHeight) ||
        !allocateTarget(bloomTargetB, bloomWidth, bloomHeight)) {
      return false;
    }
    targetWidth = width;
    targetHeight = height;
    return true;
  };

  return {
    sourceTexture,
    render(params, image, width, height) {
      const sourceSize = getSourceSize(params, image);
      const bloomRatio = normalizeRange(params.bloom, 20, 15);
      const strengthRatio = normalizePercent(params.strength, 50);
      const bloomWidth = Math.max(1, Math.ceil(width / 4));
      const bloomHeight = Math.max(1, Math.ceil(height / 4));

      if (bloomRatio > 0.0001 && !ensureTargets(width, height)) return false;
      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        bloomRatio > 0.0001 ? crtTarget.framebuffer : null
      );
      gl.viewport(0, 0, width, height);
      bindProgram(gl, buffer, crt);
      bindTextureUnit(gl, sourceTexture, 0, crt.uniform('uImage'));
      gl.uniform2f(crt.uniform('uResolution'), width, height);
      gl.uniform2f(crt.uniform('uSourceSize'), sourceSize[0], sourceSize[1]);
      gl.uniform1f(crt.uniform('uStrength'), strengthRatio);
      gl.uniform1f(crt.uniform('uRgbOffset'), normalizePercent(params.rgbOffset, 35));
      gl.uniform1f(crt.uniform('uCurvature'), normalizePercent(params.curvature, 18));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (bloomRatio <= 0.0001) return true;

      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomTargetA.framebuffer);
      gl.viewport(0, 0, bloomWidth, bloomHeight);
      bindProgram(gl, buffer, bloom);
      bindTextureUnit(gl, crtTarget.texture, 0, bloom.uniform('uImage'));
      gl.uniform2f(bloom.uniform('uTexelSize'), 1 / width, 1 / height);
      gl.uniform2f(bloom.uniform('uDirection'), 1, 0);
      gl.uniform1f(bloom.uniform('uRadius'), 1.2 + (bloomRatio * 2.8));
      gl.uniform1f(bloom.uniform('uThreshold'), 0.28);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomTargetB.framebuffer);
      bindTextureUnit(gl, bloomTargetA.texture, 0, bloom.uniform('uImage'));
      gl.uniform2f(bloom.uniform('uTexelSize'), 1 / bloomWidth, 1 / bloomHeight);
      gl.uniform2f(bloom.uniform('uDirection'), 0, 1);
      gl.uniform1f(bloom.uniform('uRadius'), 0.8 + (bloomRatio * 1.8));
      gl.uniform1f(bloom.uniform('uThreshold'), -1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      bindProgram(gl, buffer, composite);
      bindTextureUnit(gl, crtTarget.texture, 0, composite.uniform('uCrt'));
      bindTextureUnit(gl, bloomTargetB.texture, 1, composite.uniform('uBloom'));
      gl.uniform1f(
        composite.uniform('uBloomAmount'),
        bloomRatio * 0.28 * (0.65 + (0.75 * Math.min(1, strengthRatio / 0.2)))
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    },
    release() {
      [crtTarget, bloomTargetA, bloomTargetB].forEach((target) => deleteTarget(gl, target));
      gl.deleteTexture(sourceTexture);
      gl.deleteBuffer(buffer);
      [crtProgram, bloomProgram, compositeProgram].forEach((program) => gl.deleteProgram(program));
    }
  };
}

function createRenderer(options?: CrtRendererOptions | null) {
  const settings: CrtRendererOptions = options || {};
  const documentObj = settings.documentObj || globalThis.document;
  const canvas: HTMLCanvasElement | null = settings.canvas || (documentObj && typeof documentObj.createElement === 'function'
    ? documentObj.createElement('canvas')
    : null);
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  // Narrowed here, for the functions below.
  const surface = canvas;

  let gl: GL | null = null;
  let backend: Backend | '' = '';
  let pipeline: Pipeline | null = null;
  let contextLost = false;
  let supported = false;
  let uploadedImage: CrtSourceImage | null = null;

  function releaseResources(): void {
    if (gl && pipeline) pipeline.release();
    pipeline = null;
    uploadedImage = null;
  }

  // A context of the preferred backend, or WebGL2 falling back to WebGL1.
  function initialize(preferredBackend?: Backend | ''): boolean {
    try {
      if (preferredBackend === 'webgl2') {
        backend = 'webgl2';
        const context = surface.getContext('webgl2', CONTEXT_ATTRIBUTES);
        gl = context;
        pipeline = context ? createWebGL2Pipeline(context) : null;
        return Boolean(pipeline);
      }
      if (preferredBackend === 'webgl1') {
        backend = 'webgl1';
        const context = surface.getContext('webgl', CONTEXT_ATTRIBUTES);
        gl = context;
        pipeline = context ? createWebGL1Pipeline(context) : null;
        return Boolean(pipeline);
      }
      const webgl2 = surface.getContext('webgl2', CONTEXT_ATTRIBUTES);
      if (webgl2) {
        backend = 'webgl2';
        gl = webgl2;
        pipeline = createWebGL2Pipeline(webgl2);
        return Boolean(pipeline);
      }
      const webgl1 = surface.getContext('webgl', CONTEXT_ATTRIBUTES);
      backend = 'webgl1';
      gl = webgl1;
      pipeline = webgl1 ? createWebGL1Pipeline(webgl1) : null;
      return Boolean(pipeline);
    } catch {
      releaseResources();
      return false;
    }
  }

  function uploadSource(context: GL, texture: WebGLTexture, image: CrtSourceImage): boolean {
    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, texture);
    if (uploadedImage === image) return true;
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, image);
    if (typeof context.getError === 'function' && context.getError() !== context.NO_ERROR) {
      uploadedImage = null;
      return false;
    }
    uploadedImage = image;
    return true;
  }

  function render(params: CrtRenderParams | null | undefined): boolean {
    const context = gl;
    const activePipeline = pipeline;
    if (!context || !activePipeline || !params || !params.image || contextLost) return false;
    const image = params.image;
    const width = Math.max(1, Math.round(Number(params.width) || 1));
    const height = Math.max(1, Math.round(Number(params.height) || 1));
    if (surface.width !== width) surface.width = width;
    if (surface.height !== height) surface.height = height;
    try {
      if (!uploadSource(context, activePipeline.sourceTexture, image)) return false;
      const rendered = activePipeline.render(params, image, width, height);
      if (!rendered || (typeof context.getError === 'function' && context.getError() !== context.NO_ERROR)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function destroy(): void {
    releaseResources();
    if (typeof surface.removeEventListener === 'function') {
      surface.removeEventListener('webglcontextlost', handleContextLost);
      surface.removeEventListener('webglcontextrestored', handleContextRestored);
    }
    gl = null;
    supported = false;
  }

  function handleContextLost(event: Event): void {
    contextLost = true;
    supported = false;
    uploadedImage = null;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof settings.onContextLost === 'function') settings.onContextLost();
  }

  function handleContextRestored(): void {
    const restoredBackend = backend;
    contextLost = false;
    releaseResources();
    supported = initialize(restoredBackend);
    if (typeof settings.onContextRestored === 'function') settings.onContextRestored(supported);
  }

  if (typeof surface.addEventListener === 'function') {
    surface.addEventListener('webglcontextlost', handleContextLost);
    surface.addEventListener('webglcontextrestored', handleContextRestored);
  }
  supported = initialize();
  return {
    canvas: surface,
    destroy,
    isSupported: () => supported && Boolean(gl) && !contextLost,
    render
  };
}

type CrtRenderer = NonNullable<ReturnType<typeof createRenderer>>;

export { createRenderer };
export type { CrtRenderer, CrtRendererOptions, CrtRenderParams, CrtSourceImage };
