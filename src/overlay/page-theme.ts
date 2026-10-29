import { OVERLAY_HOST_ID, OVERLAY_PANEL_ID } from '../domain/injected-commands';

type PageTheme = 'dark' | 'light';

// An [r, g, b] triple, each 0 to 255.
type Rgb = number[];

interface ParsedColor {
  rgb: Rgb;
  alpha: number;
}

// One hint at the page's theme, and how much it counts.
interface ThemeSignal {
  theme: PageTheme;
  confidence: number;
  weight: number;
}

// Where the viewport is sampled, as fractions of its size.
interface SamplePoint {
  x: number;
  y: number;
  weight: number;
}

interface VisualThemeSignal {
  // Null when the samples are too mixed to call.
  theme: PageTheme | null;
  suggestedTheme: PageTheme;
  confidence: number;
  score: number;
  sampleCount: number;
}

interface PageThemeOptions {
  document?: Document | null;
  window?: Window | null;
  points?: readonly SamplePoint[];
  // Reads the theme-color meta as an [r, g, b] triple.
  parseThemeColorRgb?: (color: string) => Rgb | null;
}

interface ThemeModeOptions {
  // 'dark', 'light', or anything else for the system setting.
  mode?: string;
  pageThemeAdaptationEnabled?: boolean;
  systemTheme?: string;
}

const DEFAULT_CANVAS_RGB: readonly number[] = [255, 255, 255];
const MAX_BACKGROUND_ANCESTORS = 10;
const VIEWPORT_SAMPLE_POINTS: readonly SamplePoint[] = Object.freeze([
  { x: 0.28, y: 0.19, weight: 1.2 },
  { x: 0.39, y: 0.19, weight: 1.7 },
  { x: 0.5, y: 0.19, weight: 2.35 },
  { x: 0.61, y: 0.19, weight: 1.7 },
  { x: 0.72, y: 0.19, weight: 1.2 },
  { x: 0.28, y: 0.29, weight: 1.05 },
  { x: 0.39, y: 0.29, weight: 1.45 },
  { x: 0.5, y: 0.29, weight: 1.9 },
  { x: 0.61, y: 0.29, weight: 1.45 },
  { x: 0.72, y: 0.29, weight: 1.05 },
  { x: 0.28, y: 0.39, weight: 0.95 },
  { x: 0.39, y: 0.39, weight: 1.25 },
  { x: 0.5, y: 0.39, weight: 1.55 },
  { x: 0.61, y: 0.39, weight: 1.25 },
  { x: 0.72, y: 0.39, weight: 0.95 },
  { x: 0.28, y: 0.5, weight: 0.7 },
  { x: 0.39, y: 0.5, weight: 0.9 },
  { x: 0.5, y: 0.5, weight: 1.05 },
  { x: 0.61, y: 0.5, weight: 0.9 },
  { x: 0.72, y: 0.5, weight: 0.7 },
  { x: 0.5, y: 0.08, weight: 0.65 },
  { x: 0.18, y: 0.2, weight: 0.55 },
  { x: 0.82, y: 0.2, weight: 0.55 },
  { x: 0.18, y: 0.5, weight: 0.45 },
  { x: 0.82, y: 0.5, weight: 0.45 },
  { x: 0.32, y: 0.64, weight: 0.45 },
  { x: 0.5, y: 0.64, weight: 0.55 },
  { x: 0.68, y: 0.64, weight: 0.45 },
  { x: 0.5, y: 0.78, weight: 0.35 }
]);

function clampNumber(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, number));
}

function parseColorChannel(value: string): number {
  const text = String(value || '').trim();
  if (!text) {
    return NaN;
  }
  if (text.endsWith('%')) {
    return clampNumber((Number(text.slice(0, -1)) / 100) * 255, 0, 255);
  }
  return clampNumber(Number(text), 0, 255);
}

function parseAlphaChannel(value: string): number {
  const text = String(value || '').trim();
  if (!text) {
    return 1;
  }
  if (text.endsWith('%')) {
    return clampNumber(Number(text.slice(0, -1)) / 100, 0, 1);
  }
  return clampNumber(Number(text), 0, 1);
}

function parseHexColor(hex: string): ParsedColor | null {
  if (hex.length === 3 || hex.length === 4) {
    const red = parseInt(hex[0] + hex[0], 16);
    const green = parseInt(hex[1] + hex[1], 16);
    const blue = parseInt(hex[2] + hex[2], 16);
    const alpha = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    if ([red, green, blue, alpha].every((value) => Number.isFinite(value))) {
      return { rgb: [red, green, blue], alpha };
    }
    return null;
  }
  if (hex.length === 6 || hex.length === 8) {
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    if ([red, green, blue, alpha].every((value) => Number.isFinite(value))) {
      return { rgb: [red, green, blue], alpha };
    }
  }
  return null;
}

function parseFunctionalColor(trimmed: string): ParsedColor | null {
  const match = trimmed.match(/^rgba?\((.*)\)$/);
  if (!match) {
    return null;
  }
  const body = match[1].trim();
  let parts: string[] = [];
  let alpha = 1;
  if (body.includes(',')) {
    parts = body.split(',').map((part) => part.trim());
    if (parts.length < 3) {
      return null;
    }
    alpha = parts.length > 3 ? parseAlphaChannel(parts[3]) : 1;
  } else {
    const alphaSplit = body.split('/');
    parts = alphaSplit[0].trim().split(/\s+/).filter(Boolean);
    alpha = alphaSplit.length > 1 ? parseAlphaChannel(alphaSplit[1]) : 1;
  }
  if (parts.length < 3) {
    return null;
  }
  const rgb = [
    parseColorChannel(parts[0]),
    parseColorChannel(parts[1]),
    parseColorChannel(parts[2])
  ];
  if (!rgb.every((value) => Number.isFinite(value))) {
    return null;
  }
  return { rgb, alpha };
}

function parseCssColor(color: unknown): ParsedColor | null {
  if (!color || typeof color !== 'string') {
    return null;
  }
  const trimmed = color.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (trimmed === 'transparent') {
    return { rgb: [0, 0, 0], alpha: 0 };
  }
  if (trimmed.startsWith('#')) {
    return parseHexColor(trimmed.slice(1));
  }
  return parseFunctionalColor(trimmed);
}

function mixRgb(foreground: readonly number[], background: readonly number[], alpha: number): Rgb {
  const amount = clampNumber(alpha, 0, 1);
  return [
    Math.round((foreground[0] * amount) + (background[0] * (1 - amount))),
    Math.round((foreground[1] * amount) + (background[1] * (1 - amount))),
    Math.round((foreground[2] * amount) + (background[2] * (1 - amount)))
  ];
}

function getRelativeLuminance(rgb: readonly number[] | null): number {
  if (!rgb || rgb.length !== 3) {
    return 0;
  }
  const [red, green, blue] = rgb.map((value) => {
    const channel = clampNumber(value, 0, 255) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function getPerceptualTone(rgb: readonly number[] | null): number {
  if (!rgb || rgb.length !== 3) {
    return 0.5;
  }
  return (
    (clampNumber(rgb[0], 0, 255) * 0.299) +
    (clampNumber(rgb[1], 0, 255) * 0.587) +
    (clampNumber(rgb[2], 0, 255) * 0.114)
  ) / 255;
}

function getCssColorThemeSignal(color: unknown, weight: number): ThemeSignal | null {
  const parsed = parseCssColor(color);
  if (!parsed || parsed.alpha <= 0.08) {
    return null;
  }
  const rgb = parsed.alpha < 1
    ? mixRgb(parsed.rgb, DEFAULT_CANVAS_RGB, parsed.alpha)
    : parsed.rgb;
  const luminance = getRelativeLuminance(rgb);
  const normalizedWeight = Number.isFinite(Number(weight))
    ? Math.max(0, Number(weight))
    : 1;
  if (luminance < 0.42) {
    return {
      theme: 'dark',
      confidence: clampNumber((0.42 - luminance) / 0.42, 0, 1),
      weight: normalizedWeight
    };
  }
  if (luminance > 0.58) {
    return {
      theme: 'light',
      confidence: clampNumber((luminance - 0.58) / 0.42, 0, 1),
      weight: normalizedWeight
    };
  }
  return null;
}

// The theme the signals agree on, or null when they are too weak or split.
function resolvePageThemeSignals(signals: ReadonlyArray<ThemeSignal | null>): PageTheme | null {
  let totalScore = 0;
  let totalWeight = 0;
  (Array.isArray(signals) ? signals : []).forEach((signal) => {
    if (!signal || (signal.theme !== 'dark' && signal.theme !== 'light')) {
      return;
    }
    const confidence = clampNumber(signal.confidence, 0, 1);
    const weight = Number.isFinite(Number(signal.weight))
      ? Math.max(0, Number(signal.weight))
      : 1;
    if (confidence <= 0 || weight <= 0) {
      return;
    }
    const contributionWeight = confidence * weight;
    totalScore += (signal.theme === 'dark' ? -1 : 1) * contributionWeight;
    totalWeight += contributionWeight;
  });
  if (totalWeight <= 0.2) {
    return null;
  }
  const confidence = totalScore / totalWeight;
  if (confidence <= -0.22) {
    return 'dark';
  }
  if (confidence >= 0.22) {
    return 'light';
  }
  return null;
}

function getComputedStyleFor(win: Window | null, element: Element | null): CSSStyleDeclaration | null {
  if (!win || typeof win.getComputedStyle !== 'function' || !element) {
    return null;
  }
  try {
    return win.getComputedStyle(element);
  } catch (_error) {
    return null;
  }
}

function isElementRenderable(style: CSSStyleDeclaration | null): boolean {
  if (!style) {
    return true;
  }
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false;
  }
  const opacity = Number(style.opacity);
  return !Number.isFinite(opacity) || opacity > 0.03;
}

function getElementId(element: Element | null): string {
  if (!element) {
    return '';
  }
  if (typeof element.id === 'string') {
    return element.id;
  }
  return typeof element.getAttribute === 'function' ? String(element.getAttribute('id') || '') : '';
}

function hasTruthyAttribute(element: Element, name: string): boolean {
  if (!element || typeof element.hasAttribute !== 'function') {
    return false;
  }
  return element.hasAttribute(name);
}

function isLumnoOverlayElement(element: Element): boolean {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < MAX_BACKGROUND_ANCESTORS) {
    const id = getElementId(current);
    if (id === OVERLAY_PANEL_ID || id === OVERLAY_HOST_ID) {
      return true;
    }
    if (hasTruthyAttribute(current, 'data-lumno-overlay-host') ||
        hasTruthyAttribute(current, 'data-lumno-overlay-panel')) {
      return true;
    }
    current = current.parentElement;
    depth += 1;
  }
  return false;
}

function getViewportSize(doc: Document, win: Window): { width: number; height: number } {
  const visualViewport = win && win.visualViewport ? win.visualViewport : null;
  const width = Number(visualViewport && visualViewport.width) ||
    Number(win && win.innerWidth) ||
    Number(doc && doc.documentElement && doc.documentElement.clientWidth) ||
    0;
  const height = Number(visualViewport && visualViewport.height) ||
    Number(win && win.innerHeight) ||
    Number(doc && doc.documentElement && doc.documentElement.clientHeight) ||
    0;
  return {
    width: Math.max(0, width),
    height: Math.max(0, height)
  };
}

function getElementAtPoint(doc: Document, x: number, y: number): Element | null {
  if (!doc || typeof doc.elementFromPoint !== 'function') {
    return null;
  }
  try {
    return doc.elementFromPoint(x, y);
  } catch (_error) {
    return null;
  }
}

// The background behind an element: its own and its ancestors' colors
// laid over the white canvas.
function getCompositedBackgroundRgb(element: Element, doc: Document, win: Window): { rgb: Rgb; hasExplicitBackground: boolean } {
  const stack: Element[] = [];
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < MAX_BACKGROUND_ANCESTORS) {
    stack.push(current);
    if (current === doc.documentElement) {
      break;
    }
    current = current.parentElement;
    depth += 1;
  }
  if (doc && doc.body && !stack.includes(doc.body)) {
    stack.push(doc.body);
  }
  if (doc && doc.documentElement && !stack.includes(doc.documentElement)) {
    stack.push(doc.documentElement);
  }

  let rgb = DEFAULT_CANVAS_RGB.slice();
  let hasExplicitBackground = false;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const style = getComputedStyleFor(win, stack[i]);
    const parsed = parseCssColor(style && style.backgroundColor);
    if (!parsed || parsed.alpha <= 0.01) {
      continue;
    }
    hasExplicitBackground = true;
    rgb = mixRgb(parsed.rgb, rgb, parsed.alpha);
  }
  return {
    rgb,
    hasExplicitBackground
  };
}

function getElementTextRgb(element: Element, win: Window): Rgb | null {
  const style = getComputedStyleFor(win, element);
  const parsed = parseCssColor(style && style.color);
  if (!parsed || parsed.alpha < 0.2) {
    return null;
  }
  return parsed.rgb;
}

function scoreThemeSample(element: Element | null, weight: number, doc: Document, win: Window): { score: number; weight: number } | null {
  if (!element || isLumnoOverlayElement(element)) {
    return null;
  }
  const style = getComputedStyleFor(win, element);
  if (!isElementRenderable(style)) {
    return null;
  }
  const background = getCompositedBackgroundRgb(element, doc, win);
  const backgroundRgb = background.rgb;
  const backgroundTone = getPerceptualTone(backgroundRgb);
  const textRgb = getElementTextRgb(element, win);
  const textTone = textRgb ? getPerceptualTone(textRgb) : null;
  let vote = 0;

  if (!background.hasExplicitBackground && textTone !== null) {
    if (textTone >= 0.72) {
      vote -= 1.1;
    } else if (textTone <= 0.28) {
      vote += 1.1;
    }
  } else if (backgroundTone <= 0.38) {
    vote -= 1;
  } else if (backgroundTone >= 0.62) {
    vote += 1;
  } else {
    vote += (backgroundTone - 0.5) * 0.7;
  }

  if (textRgb && textTone !== null) {
    const backgroundLuminance = getRelativeLuminance(backgroundRgb);
    const textLuminance = getRelativeLuminance(textRgb);
    const contrast = (Math.max(backgroundLuminance, textLuminance) + 0.05) /
      (Math.min(backgroundLuminance, textLuminance) + 0.05);
    if (contrast >= 2.2) {
      if (backgroundTone <= 0.5 && textTone >= 0.64) {
        vote -= 0.55;
      } else if (backgroundTone >= 0.5 && textTone <= 0.36) {
        vote += 0.55;
      }
    }
  }

  return {
    score: vote * weight,
    weight
  };
}

// The theme of what the viewport shows, from colors sampled across it.
function detectPageVisualThemeSignal(options?: PageThemeOptions | null): VisualThemeSignal | null {
  const settings: PageThemeOptions = options && typeof options === 'object' ? options : {};
  const doc = settings.document || (typeof document !== 'undefined' ? document : null);
  const win = settings.window || (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : null);
  if (!doc || !win) {
    return null;
  }
  const viewport = getViewportSize(doc, win);
  if (viewport.width <= 0 || viewport.height <= 0) {
    return null;
  }
  const points = Array.isArray(settings.points) && settings.points.length > 0
    ? settings.points
    : VIEWPORT_SAMPLE_POINTS;
  let totalScore = 0;
  let totalWeight = 0;
  let sampleCount = 0;
  points.forEach((point) => {
    const x = clampNumber(point.x, 0, 1) * Math.max(1, viewport.width - 1);
    const y = clampNumber(point.y, 0, 1) * Math.max(1, viewport.height - 1);
    const element = getElementAtPoint(doc, x, y);
    const weight = Number.isFinite(Number(point.weight)) ? Math.max(0, Number(point.weight)) : 1;
    const sample = scoreThemeSample(element, weight, doc, win);
    if (!sample) {
      return;
    }
    totalScore += sample.score;
    totalWeight += sample.weight;
    sampleCount += 1;
  });

  if (totalWeight < 1) {
    return null;
  }
  const confidence = totalScore / totalWeight;
  const absoluteConfidence = Math.min(1, Math.abs(confidence));
  return {
    theme: confidence <= -0.48 ? 'dark' : (confidence >= 0.48 ? 'light' : null),
    suggestedTheme: confidence < 0 ? 'dark' : 'light',
    confidence: absoluteConfidence,
    score: confidence,
    sampleCount
  };
}

function detectPageVisualTheme(options?: PageThemeOptions | null): PageTheme | null {
  const signal = detectPageVisualThemeSignal(options);
  return signal && signal.theme ? signal.theme : null;
}

function pushThemeCandidate(candidates: Element[], element: Element | null): void {
  if (!element || candidates.includes(element)) {
    return;
  }
  candidates.push(element);
}

function getFirstElementByTagName(doc: Document, tagName: string): Element | null {
  if (typeof doc.getElementsByTagName !== 'function') {
    return null;
  }
  const elements = doc.getElementsByTagName(tagName);
  return elements && elements.length > 0 ? elements[0] : null;
}

// Elements whose class or theme attributes usually carry a site's explicit
// light/dark choice: the root, the body, common app roots and the first
// few body children.
function getPageThemeCandidateElements(doc: Document): Element[] {
  const docEl = doc.documentElement;
  const body = doc.body;
  const candidates: Element[] = [];
  pushThemeCandidate(candidates, docEl);
  pushThemeCandidate(candidates, body);
  ['app', 'root', '__next', '__nuxt'].forEach((id) => {
    if (typeof doc.getElementById === 'function') {
      pushThemeCandidate(candidates, doc.getElementById(id));
    }
  });
  pushThemeCandidate(candidates, getFirstElementByTagName(doc, 'ytd-app'));
  pushThemeCandidate(candidates, getFirstElementByTagName(doc, 'ytm-app'));
  if (body && body.children && body.children.length) {
    const candidateLimit = Math.min(body.children.length, 8);
    for (let i = 0; i < candidateLimit; i += 1) {
      pushThemeCandidate(candidates, body.children[i]);
    }
  }
  return candidates;
}

function classifyThemeToken(value: string | null): PageTheme | null {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) {
    return null;
  }
  if (
    normalized.includes('dark') ||
    normalized.includes('night') ||
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'on'
  ) {
    return 'dark';
  }
  if (
    normalized.includes('light') ||
    normalized.includes('day') ||
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'off'
  ) {
    return 'light';
  }
  return null;
}

// Classifies one class token; business names such as "light-rays" or
// "dark-veil" are not theme switches.
function getThemeClassTokenTheme(token: string): PageTheme | null {
  const normalized = String(token || '').toLowerCase().trim();
  if (!normalized) {
    return null;
  }
  if (normalized === 'dark' || normalized === 'darkmode' || normalized === 'night') {
    return 'dark';
  }
  if (normalized === 'light' || normalized === 'lightmode' || normalized === 'day') {
    return 'light';
  }
  if (/^(theme|mode|scheme|color-scheme|appearance|is|has)-(dark|night)$/.test(normalized) ||
      /^(dark|night)-(theme|mode|scheme|color-scheme|appearance)$/.test(normalized)) {
    return 'dark';
  }
  if (/^(theme|mode|scheme|color-scheme|appearance|is|has)-(light|day)$/.test(normalized) ||
      /^(light|day)-(theme|mode|scheme|color-scheme|appearance)$/.test(normalized)) {
    return 'light';
  }
  return null;
}

function getElementClassTheme(element: Element | null): PageTheme | null {
  if (!element) {
    return null;
  }
  const className = typeof element.className === 'string'
    ? element.className
    : (typeof element.getAttribute === 'function' ? element.getAttribute('class') : '');
  const classText = String(className || '').toLowerCase();
  if (!classText) {
    return null;
  }
  const tokenList = classText.split(/\s+/);
  for (let i = 0; i < tokenList.length; i += 1) {
    const theme = getThemeClassTokenTheme(tokenList[i]);
    if (theme) {
      return theme;
    }
  }
  return null;
}

function getElementAttributeTheme(element: Element | null): PageTheme | null {
  if (!element || typeof element.hasAttribute !== 'function') {
    return null;
  }
  if (element.hasAttribute('dark') ||
      element.hasAttribute('data-dark') ||
      element.hasAttribute('dark-mode')) {
    return 'dark';
  }
  if (element.hasAttribute('light')) {
    return 'light';
  }
  const attrNames = [
    'data-theme',
    'data-color-scheme',
    'data-color-mode',
    'data-mode',
    'data-appearance',
    'color-scheme',
    'theme',
    'data-bs-theme'
  ];
  for (let i = 0; i < attrNames.length; i += 1) {
    const value = typeof element.getAttribute === 'function'
      ? element.getAttribute(attrNames[i])
      : '';
    const theme = classifyThemeToken(value);
    if (theme) {
      return theme;
    }
  }
  return getElementClassTheme(element);
}

function getHeadMetaContent(doc: Document, name: string): string {
  const head = doc.head;
  if (!head || typeof head.querySelector !== 'function') {
    return '';
  }
  const meta = head.querySelector(`meta[name="${name}"]`);
  return meta ? String(meta.getAttribute('content') || '') : '';
}

function getThemeSignalWeight(weight: unknown): number {
  return Number.isFinite(Number(weight)) ? Math.max(0, Number(weight)) : 1;
}

function getThemeSignalFromLuminance(luminance: number, weight: number): ThemeSignal | null {
  if (luminance < 0.42) {
    return {
      theme: 'dark',
      confidence: clampNumber((0.42 - luminance) / 0.42, 0, 1),
      weight: getThemeSignalWeight(weight)
    };
  }
  if (luminance > 0.58) {
    return {
      theme: 'light',
      confidence: clampNumber((luminance - 0.58) / 0.42, 0, 1),
      weight: getThemeSignalWeight(weight)
    };
  }
  return null;
}

function getThemeSignalFromTheme(theme: string | null | undefined, weight: number, confidence: number): ThemeSignal | null {
  if (theme !== 'dark' && theme !== 'light') {
    return null;
  }
  return {
    theme,
    confidence: clampNumber(
      Number.isFinite(Number(confidence)) ? Number(confidence) : 0.7,
      0,
      1
    ),
    weight: getThemeSignalWeight(weight)
  };
}

function getThemeSignalFromSchemeValue(value: string, weight: number): ThemeSignal | null {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) {
    return null;
  }
  const hasDark = normalized.includes('dark');
  const hasLight = normalized.includes('light');
  if (hasDark && !hasLight) {
    return getThemeSignalFromTheme('dark', weight, 0.62);
  }
  if (hasLight && !hasDark) {
    return getThemeSignalFromTheme('light', weight, 0.62);
  }
  return null;
}

function normalizeThemeSignal(
  signal: { theme: PageTheme | null; confidence: number; weight?: number } | null,
  defaultWeight: number
): ThemeSignal | null {
  if (!signal || (signal.theme !== 'dark' && signal.theme !== 'light')) {
    return null;
  }
  return {
    theme: signal.theme,
    confidence: clampNumber(signal.confidence, 0, 1),
    weight: Number.isFinite(Number(signal.weight))
      ? Math.max(0, Number(signal.weight))
      : getThemeSignalWeight(defaultWeight)
  };
}

// The host page's theme, fused from weighted signals: explicit class and
// attribute hints, color-scheme meta and computed values, the theme-color
// meta, root/body backgrounds and a visual sample of the viewport. No
// single hint short-circuits the others. `parseThemeColorRgb` reads the
// theme-color meta as an [r, g, b] triple (the favicon-theme parser).
function detectPageTheme(options?: PageThemeOptions | null): PageTheme | null {
  const settings: PageThemeOptions = options && typeof options === 'object' ? options : {};
  const doc = settings.document || (typeof document !== 'undefined' ? document : null);
  const win = settings.window || (doc && doc.defaultView) || null;
  if (!doc || !win) {
    return null;
  }
  const docEl = doc.documentElement;
  if (!docEl) {
    return null;
  }
  const body = doc.body;
  const candidateTheme = getPageThemeCandidateElements(doc)
    .map(getElementAttributeTheme)
    .find(Boolean);
  const colorSchemeMeta = getHeadMetaContent(doc, 'color-scheme').toLowerCase();
  const schemeValue = (win.getComputedStyle(docEl).colorScheme || '').toLowerCase();
  const themeColor = getHeadMetaContent(doc, 'theme-color').trim();
  const themeColorRgb = typeof settings.parseThemeColorRgb === 'function'
    ? settings.parseThemeColorRgb(themeColor)
    : null;
  const docStyleForSignals = win.getComputedStyle(docEl);
  const bodyStyleForSignals = body ? win.getComputedStyle(body) : null;
  const visualSignal = detectPageVisualThemeSignal({ document: doc, window: win });
  const fusedTheme = resolvePageThemeSignals([
    getThemeSignalFromTheme(candidateTheme, 0.48, 0.74),
    getThemeSignalFromSchemeValue(colorSchemeMeta, 0.4),
    getThemeSignalFromSchemeValue(schemeValue, 0.26),
    themeColorRgb && themeColorRgb.length === 3
      ? getThemeSignalFromLuminance(getRelativeLuminance(themeColorRgb), 0.72)
      : null,
    getCssColorThemeSignal(docStyleForSignals.backgroundColor, 0.78),
    getCssColorThemeSignal(bodyStyleForSignals && bodyStyleForSignals.backgroundColor, 0.58),
    normalizeThemeSignal(visualSignal, 1.05)
  ]);
  if (fusedTheme) {
    return fusedTheme;
  }
  const bodyStyle = body ? win.getComputedStyle(body) : null;
  const docStyle = win.getComputedStyle(docEl);
  const bgColor = (bodyStyle && bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'transparent')
    ? bodyStyle.backgroundColor
    : docStyle.backgroundColor;
  const backgroundSignal = getCssColorThemeSignal(bgColor, 1);
  return backgroundSignal ? backgroundSignal.theme : null;
}

const PAGE_THEME_ATTRIBUTE_FILTER = Object.freeze([
  'class',
  'style',
  'data-theme',
  'data-color-scheme',
  'data-color-mode',
  'data-mode',
  'data-appearance',
  'theme',
  'color-scheme',
  'dark',
  'light',
  'data-bs-theme'
]);

// What a page theme observer reports with each change.
interface PageThemeChange {
  // A page mutation led to it, not just the observer starting.
  pageChanged: boolean;
}

// Watches the host page for theme switches (root/body theme attributes and
// head meta changes) and calls `onChange` at most once per frame. The call
// made after `start` alone passes `{ pageChanged: false }`; one that follows
// a page mutation passes `{ pageChanged: true }`.
function createPageThemeObserver(win: Window & typeof globalThis, onChange: (change: PageThemeChange) => void) {
  const doc = win && win.document;
  let observer: MutationObserver | null = null;
  let frame: number | null = null;
  let pageChanged = false;

  function scheduleChange(): void {
    if (frame !== null) {
      return;
    }
    frame = win.requestAnimationFrame(() => {
      frame = null;
      const changed = pageChanged;
      pageChanged = false;
      if (typeof onChange === 'function') {
        onChange({ pageChanged: changed });
      }
    });
  }

  function handleMutations(): void {
    pageChanged = true;
    scheduleChange();
  }

  function start(): void {
    if (observer || !doc || typeof win.MutationObserver !== 'function') {
      return;
    }
    const pageObserver = new win.MutationObserver(handleMutations);
    observer = pageObserver;
    [doc.documentElement, doc.body].forEach((element) => {
      if (element) {
        pageObserver.observe(element, {
          attributes: true,
          attributeFilter: PAGE_THEME_ATTRIBUTE_FILTER.slice()
        });
      }
    });
    if (doc.head) {
      pageObserver.observe(doc.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['name', 'content', 'media']
      });
    }
    scheduleChange();
  }

  function stop(): void {
    if (frame !== null) {
      win.cancelAnimationFrame(frame);
      frame = null;
    }
    pageChanged = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  return Object.freeze({
    start,
    stop,
    get active() { return observer !== null; }
  });
}

// The panel's theme: the chosen mode, or in system mode the page's theme
// when adapting to it, else the system's.
function resolveOverlayTheme(options?: (ThemeModeOptions & { pageTheme?: string | null }) | null): PageTheme {
  const settings: ThemeModeOptions & { pageTheme?: string | null } = options && typeof options === 'object' ? options : {};
  const mode = settings.mode === 'dark' || settings.mode === 'light'
    ? settings.mode
    : 'system';
  if (mode !== 'system') {
    return mode;
  }
  const pageTheme = settings.pageTheme === 'dark' || settings.pageTheme === 'light'
    ? settings.pageTheme
    : null;
  if (settings.pageThemeAdaptationEnabled !== false && pageTheme) {
    return pageTheme;
  }
  return settings.systemTheme === 'dark' ? 'dark' : 'light';
}

function shouldStrengthenDarkOverlayBackground(options?: { resolvedTheme?: string; pageTheme?: string | null } | null): boolean {
  const settings: { resolvedTheme?: string; pageTheme?: string | null } = options && typeof options === 'object' ? options : {};
  return settings.resolvedTheme === 'dark' && settings.pageTheme === 'light';
}

function shouldObservePageTheme(options?: ThemeModeOptions | null): boolean {
  const settings: ThemeModeOptions = options && typeof options === 'object' ? options : {};
  const mode = settings.mode === 'dark' || settings.mode === 'light'
    ? settings.mode
    : 'system';
  if (mode === 'dark') {
    return true;
  }
  if (mode !== 'system') {
    return false;
  }
  return settings.pageThemeAdaptationEnabled === true || settings.systemTheme === 'dark';
}

// Starts or stops watching the page, as the mode needs; true when watching.
function syncPageThemeObservation(options?: (ThemeModeOptions & { start?: () => void; stop?: () => void }) | null): boolean {
  const settings: ThemeModeOptions & { start?: () => void; stop?: () => void } = options && typeof options === 'object' ? options : {};
  const shouldObserve = shouldObservePageTheme(settings);
  const callback = shouldObserve ? settings.start : settings.stop;
  if (typeof callback === 'function') {
    callback();
  }
  return shouldObserve;
}

export {
  parseCssColor,
  getRelativeLuminance,
  getPerceptualTone,
  getCssColorThemeSignal,
  resolvePageThemeSignals,
  detectPageVisualThemeSignal,
  detectPageVisualTheme,
  detectPageTheme,
  getThemeClassTokenTheme,
  createPageThemeObserver,
  resolveOverlayTheme,
  shouldStrengthenDarkOverlayBackground,
  shouldObservePageTheme,
  syncPageThemeObservation
};
export type { PageTheme, PageThemeChange, PageThemeOptions, ParsedColor, ThemeModeOptions, ThemeSignal, VisualThemeSignal };
