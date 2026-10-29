// A folder icon's motion and color on the page: its lid and back morph
// between the closed and hover shapes, its gradient follows, and a saved
// color tints its parts.
import { isSvgElement } from '../../shared/dom-guards';
import { DEFAULT_FOLDER_COLOR, hexToRgb, rgbToHex } from '../bookmarks/bookmark-folder-icon';
import type { Rgb } from '../bookmarks/bookmark-folder-icon';


interface Point {
  x: number;
  y: number;
}

// Two shapes written with the same commands, morphed number by number.
interface NumberMorphTemplate {
  type: 'number';
  segments: string[];
  fromNumbers: number[];
  toNumbers: number[];
}

// Two shapes sampled into the same number of points.
interface PointMorphTemplate {
  type: 'point';
  fromPoints: Point[];
  toPoints: Point[];
  closed: boolean;
}

type MorphTemplate = NumberMorphTemplate | PointMorphTemplate;

// The shapes a point morph runs between and the points it last drew.
interface PointMorph {
  ends: Map<string, Point[]>;
  closed: boolean;
  points: Point[];
  d: string;
}

interface FolderMorphPart {
  partName: string;
  pathEl: SVGElement;
  baseD: string;
  hoverD: string;
  fillBase: string;
  fillHover: string;
  opacityBase: number;
  opacityHover: number;
  // Paths that take this part's shape as it morphs.
  linkedFollowers: Element[];
  animationFrameId: number;
  pointMorph?: PointMorph | null;
}

type MorphState = 'base' | 'hover';

interface GradientStop {
  offset: number;
  color: string;
  // The stop's color before the folder was recolored.
  baseColor?: string;
}

interface GradientConfig {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
}

interface UpperGradientMorph {
  mainGradientEl: Element;
  overlayGradientEl: Element;
  baseMain: GradientConfig;
  hoverMain: GradientConfig;
  baseOverlay: GradientConfig;
  hoverOverlay: GradientConfig;
  state: MorphState;
  rafId: number;
}

// What a folder icon keeps between its morphs and recolors.
interface FolderIconState {
  color?: string;
  upperGradientMorph?: UpperGradientMorph;
  morphParts?: FolderMorphPart[];
  morphSvg?: SVGSVGElement | null;
  morphState?: MorphState;
  upperFilterRestoreTimerId?: number;
}

const folderIconStates = new WeakMap<Element, FolderIconState>();
// The filter an upper shape had before a morph turned it off.
const originalUpperFilters = new WeakMap<Element, string | null>();

function getFolderIconState(folderIcon: Element): FolderIconState {
  let state = folderIconStates.get(folderIcon);
  if (!state) {
    state = {};
    folderIconStates.set(folderIcon, state);
  }
  return state;
}

const FOLDER_PATH_MORPH_DURATION_MS = 460;
const FOLDER_PATH_MORPH_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT = 140;
const FOLDER_PATH_MORPH_BEZIER = {
  x1: 0.22,
  y1: 1,
  x2: 0.36,
  y2: 1
};

function cubicBezierSampleCurveX(t: number, x1: number, x2: number): number {
  const inv = 1 - t;
  return 3 * inv * inv * t * x1 + 3 * inv * t * t * x2 + t * t * t;
}

function cubicBezierSampleCurveY(t: number, y1: number, y2: number): number {
  const inv = 1 - t;
  return 3 * inv * inv * t * y1 + 3 * inv * t * t * y2 + t * t * t;
}

function cubicBezierSampleCurveDerivativeX(t: number, x1: number, x2: number): number {
  const inv = 1 - t;
  return 3 * inv * inv * x1 + 6 * inv * t * (x2 - x1) + 3 * t * t * (1 - x2);
}

function cubicBezierEase(progress: number, bezier: typeof FOLDER_PATH_MORPH_BEZIER): number {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 0 || clamped === 1) {
    return clamped;
  }
  let t = clamped;
  for (let i = 0; i < 8; i += 1) {
    const x = cubicBezierSampleCurveX(t, bezier.x1, bezier.x2) - clamped;
    const dx = cubicBezierSampleCurveDerivativeX(t, bezier.x1, bezier.x2);
    if (Math.abs(x) < 1e-6 || Math.abs(dx) < 1e-6) {
      break;
    }
    t -= x / dx;
  }
  t = Math.max(0, Math.min(1, t));
  return cubicBezierSampleCurveY(t, bezier.y1, bezier.y2);
}

function buildPathMorphTemplate(fromD: string, toD: string): NumberMorphTemplate | null {
  const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
  const fromNumbers = (String(fromD || '').match(numberPattern) || []).map((value) => Number(value));
  const toNumbers = (String(toD || '').match(numberPattern) || []).map((value) => Number(value));
  if (!fromNumbers.length || fromNumbers.length !== toNumbers.length) {
    return null;
  }
  const fromMask = String(fromD).replace(numberPattern, '#');
  const toMask = String(toD).replace(numberPattern, '#');
  if (fromMask !== toMask) {
    return null;
  }
  const segments = String(fromD).split(numberPattern);
  return { type: 'number', segments, fromNumbers, toNumbers };
}

function composeNumberPathD(segments: string[], numbers: number[]): string {
  let output = '';
  for (let i = 0; i < numbers.length; i += 1) {
    output += `${segments[i]}${Number(numbers[i].toFixed(6))}`;
  }
  output += segments[numbers.length] || '';
  return output;
}

function isClosedPathData(d: string): boolean {
  return /[zZ]\s*$/.test(String(d || '').trim());
}

function samplePathPoints(
  svgEl: Element,
  d: string,
  sampleCount: number
): { points: Point[]; closed: boolean } | null {
  if (!svgEl || !d) {
    return null;
  }
  const count = Math.max(8, sampleCount | 0);
  const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tempPath.setAttribute('d', d);
  tempPath.setAttribute('fill', 'none');
  tempPath.setAttribute('stroke', 'none');
  tempPath.style.opacity = '0';
  tempPath.style.pointerEvents = 'none';
  svgEl.appendChild(tempPath);
  try {
    const total = tempPath.getTotalLength();
    if (!Number.isFinite(total) || total <= 0) {
      return null;
    }
    const closed = isClosedPathData(d);
    const points: Point[] = [];
    const divisor = closed ? count : Math.max(1, count - 1);
    for (let i = 0; i < count; i += 1) {
      const ratio = i / divisor;
      const len = Math.max(0, Math.min(total, total * ratio));
      const point = tempPath.getPointAtLength(len);
      points.push({ x: point.x, y: point.y });
    }
    return { points, closed };
  } catch (error) {
    return null;
  } finally {
    svgEl.removeChild(tempPath);
  }
}

function buildPointMorphTemplate(pathEl: Element, fromD: string, toD: string): PointMorphTemplate | null {
  if (!pathEl) {
    return null;
  }
  const svgEl = pathEl.closest('svg');
  if (!svgEl) {
    return null;
  }
  const sampleCount = FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT;
  const fromData = samplePathPoints(svgEl, fromD, sampleCount);
  const toData = samplePathPoints(svgEl, toD, sampleCount);
  if (!fromData || !toData || fromData.points.length !== toData.points.length) {
    return null;
  }
  const closed = fromData.closed && toData.closed;
  const fromPoints = fromData.points;
  let toPoints = toData.points;
  if (closed && fromPoints.length > 4) {
    const alignClosedPoints = (sourcePoints: Point[], targetPoints: Point[]): Point[] => {
      const rotatePoints = (points: Point[], shift: number): Point[] => {
        const len = points.length;
        const normalizedShift = ((shift % len) + len) % len;
        if (!normalizedShift) {
          return points.slice();
        }
        return points.slice(normalizedShift).concat(points.slice(0, normalizedShift));
      };
      const reversePoints = (points: Point[]): Point[] => points.slice().reverse();
      const calcScore = (aPoints: Point[], bPoints: Point[]): number => {
        let total = 0;
        for (let i = 0; i < aPoints.length; i += 1) {
          const dx = aPoints[i].x - bPoints[i].x;
          const dy = aPoints[i].y - bPoints[i].y;
          total += dx * dx + dy * dy;
        }
        return total;
      };
      let best = targetPoints.slice();
      let bestScore = Number.POSITIVE_INFINITY;
      const directions = [targetPoints, reversePoints(targetPoints)];
      for (let dirIndex = 0; dirIndex < directions.length; dirIndex += 1) {
        const dirPoints = directions[dirIndex];
        for (let shift = 0; shift < dirPoints.length; shift += 1) {
          const candidate = rotatePoints(dirPoints, shift);
          const score = calcScore(sourcePoints, candidate);
          if (score < bestScore) {
            bestScore = score;
            best = candidate;
          }
        }
      }
      return best;
    };
    toPoints = alignClosedPoints(fromPoints, toPoints);
  }
  return {
    type: 'point',
    fromPoints,
    toPoints,
    closed
  };
}

// Sampling a shape with getPointAtLength takes tens of milliseconds for the
// folder's parts, and ran inside the pointer event, so every hover stalled a
// frame before the lid moved. Every folder icon draws the same shapes, so
// each pair is sampled and aligned once per page, and a pair already
// sampled the other way round is reused swapped.
const pointMorphTemplateCache = new Map<string, PointMorphTemplate>();

function getPointMorphTemplate(pathEl: Element, fromD: string, toD: string): PointMorphTemplate | null {
  const key = `${fromD}\n${toD}`;
  const cached = pointMorphTemplateCache.get(key);
  if (cached) {
    return cached;
  }
  const reverse = pointMorphTemplateCache.get(`${toD}\n${fromD}`);
  const template: PointMorphTemplate | null = reverse
    ? { type: 'point', fromPoints: reverse.toPoints, toPoints: reverse.fromPoints, closed: reverse.closed }
    : buildPointMorphTemplate(pathEl, fromD, toD);
  // A path that could not be measured yet (not rendered) is sampled again next time.
  if (template) pointMorphTemplateCache.set(key, template);
  return template;
}

// Samples one part's shapes per idle slot, so the first hover finds them ready.
function warmFolderPathMorph(parts: FolderMorphPart[]): void {
  if (typeof requestIdleCallback !== 'function') {
    return;
  }
  const pending = parts.filter((part) => part.partName !== 'upper-overlay' &&
    !buildPathMorphTemplate(part.baseD, part.hoverD) &&
    !pointMorphTemplateCache.has(`${part.baseD}\n${part.hoverD}`));
  const next = () => {
    const part = pending.shift();
    if (!part) {
      return;
    }
    if (part.pathEl.isConnected) {
      getPointMorphTemplate(part.pathEl, part.baseD, part.hoverD);
    }
    requestIdleCallback(next, { timeout: 2000 });
  };
  if (pending.length) {
    requestIdleCallback(next, { timeout: 2000 });
  }
}

function composePointPathD(points: Point[], closed: boolean): string {
  if (!Array.isArray(points) || !points.length) {
    return '';
  }
  let d = `M ${Number(points[0].x.toFixed(6))} ${Number(points[0].y.toFixed(6))}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${Number(points[i].x.toFixed(6))} ${Number(points[i].y.toFixed(6))}`;
  }
  if (closed) {
    d += ' Z';
  }
  return d;
}

function cancelFolderPathMorph(part: FolderMorphPart | null | undefined): void {
  if (!part) {
    return;
  }
  if (part.animationFrameId) {
    cancelAnimationFrame(part.animationFrameId);
    part.animationFrameId = 0;
  }
}



function tintFolderColor(source: string, color: string): string {
  if (color.toUpperCase() === '#5393FF') return source;
  const sourceRgb = hexToRgb(source);
  const selected = hexToRgb(color);
  if (!sourceRgb || !selected) return source;
  const reference: Rgb = { r: 83, g: 147, b: 255 };
  const tinted: Rgb = { r: 0, g: 0, b: 0 };
  const channels: (keyof Rgb)[] = ['r', 'g', 'b'];
  // Preserve the original highlights and shaded edges relative to the outline.
  channels.forEach((channel) => {
    const amount = channel === 'b'
      ? (sourceRgb.r - reference.r) / (255 - reference.r)
      : (sourceRgb[channel] - reference[channel]) / (255 - reference[channel]);
    tinted[channel] = amount >= 0
      ? selected[channel] + (255 - selected[channel]) * amount
      : selected[channel] * (1 + amount);
  });
  return rgbToHex(tinted);
}

function applyFolderColor(folderIcon: Element | null | undefined, value: unknown): void {
  const svg = folderIcon && folderIcon.querySelector('svg');
  if (!folderIcon || !svg) return;
  const selected = hexToRgb(value);
  const color = selected ? rgbToHex(selected).toUpperCase() : DEFAULT_FOLDER_COLOR;
  const iconState = getFolderIconState(folderIcon);
  if (iconState.color === color && svg.getAttribute('data-folder-color') === color) return;
  iconState.color = color;
  svg.setAttribute('data-folder-color', color);
  svg.querySelectorAll('[data-folder-part$="-outline"], [data-folder-part-hover$="-outline"]').forEach((path) => {
    path.setAttribute('stroke', color);
  });
  svg.querySelectorAll('linearGradient:not([data-folder-gradient-morph]) stop').forEach((stop) => {
    const source = stop.getAttribute('data-folder-base-color') || stop.getAttribute('stop-color');
    if (!source) return;
    stop.setAttribute('data-folder-base-color', source);
    stop.setAttribute('stop-color', tintFolderColor(source, color));
  });
  svg.querySelectorAll('feColorMatrix').forEach((matrix) => {
    const original = matrix.getAttribute('data-folder-base-shadow') || matrix.getAttribute('values');
    if (!original || !original.includes('0.541176')) return;
    matrix.setAttribute('data-folder-base-shadow', original);
    if (color === DEFAULT_FOLDER_COLOR) { matrix.setAttribute('values', original); return; }
    const shadow = hexToRgb(tintFolderColor('#8AB6FF', color));
    if (!shadow) return;
    matrix.setAttribute('values', `0 0 0 0 ${shadow.r / 255} 0 0 0 0 ${shadow.g / 255} 0 0 0 0 ${shadow.b / 255} 0 0 0 0.21 0`);
  });
  initFolderUpperGradientMorph(folderIcon);
  const morph = iconState.upperGradientMorph;
  if (morph) {
    if (morph.rafId) { cancelAnimationFrame(morph.rafId); morph.rafId = 0; }
    [morph.baseMain, morph.hoverMain, morph.baseOverlay, morph.hoverOverlay].forEach((config) => {
      config.stops.forEach((stop) => {
        const baseColor = stop.baseColor || stop.color;
        stop.baseColor = baseColor;
        stop.color = tintFolderColor(baseColor, color);
      });
    });
    const isOpen = iconState.morphState === 'hover';
    morph.state = isOpen ? 'hover' : 'base';
    applyGradientMorphConfig(morph.mainGradientEl, isOpen ? morph.hoverMain : morph.baseMain);
    applyGradientMorphConfig(morph.overlayGradientEl, isOpen ? morph.hoverOverlay : morph.baseOverlay);
  }
}

function lerpNumber(fromValue: number, toValue: number, t: number): number {
  return fromValue + (toValue - fromValue) * t;
}

function applyGradientMorphConfig(gradientEl: Element | null, config: GradientConfig | null): void {
  if (!gradientEl || !config) {
    return;
  }
  gradientEl.setAttribute('x1', String(config.x1));
  gradientEl.setAttribute('y1', String(config.y1));
  gradientEl.setAttribute('x2', String(config.x2));
  gradientEl.setAttribute('y2', String(config.y2));
  const stops = gradientEl.querySelectorAll('stop');
  config.stops.forEach((stopConfig, index) => {
    const stopEl = stops[index];
    if (!stopEl) {
      return;
    }
    stopEl.setAttribute('offset', String(stopConfig.offset));
    stopEl.setAttribute('stop-color', stopConfig.color);
  });
}

function interpolateGradientConfig(fromConfig: GradientConfig, toConfig: GradientConfig, t: number): GradientConfig {
  const progress = Math.max(0, Math.min(1, t));
  const next: GradientConfig = {
    x1: Number(lerpNumber(fromConfig.x1, toConfig.x1, progress).toFixed(6)),
    y1: Number(lerpNumber(fromConfig.y1, toConfig.y1, progress).toFixed(6)),
    x2: Number(lerpNumber(fromConfig.x2, toConfig.x2, progress).toFixed(6)),
    y2: Number(lerpNumber(fromConfig.y2, toConfig.y2, progress).toFixed(6)),
    stops: []
  };
  for (let i = 0; i < fromConfig.stops.length; i += 1) {
    const fromStop = fromConfig.stops[i];
    const toStop = toConfig.stops[i];
    if (!fromStop || !toStop) {
      continue;
    }
    const fromRgb = hexToRgb(fromStop.color);
    const toRgb = hexToRgb(toStop.color);
    const color = (fromRgb && toRgb)
      ? rgbToHex({
        r: lerpNumber(fromRgb.r, toRgb.r, progress),
        g: lerpNumber(fromRgb.g, toRgb.g, progress),
        b: lerpNumber(fromRgb.b, toRgb.b, progress)
      })
      : (progress < 0.5 ? fromStop.color : toStop.color);
    next.stops.push({
      offset: Number(lerpNumber(fromStop.offset, toStop.offset, progress).toFixed(6)),
      color
    });
  }
  return next;
}

function initFolderUpperGradientMorph(folderIcon: Element | null): void {
  if (!folderIcon || getFolderIconState(folderIcon).upperGradientMorph) {
    return;
  }
  const svg = folderIcon.querySelector('svg');
  if (!svg) {
    return;
  }
  const mainGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-main"]');
  const overlayGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-overlay"]');
  if (!mainGradientEl || !overlayGradientEl) {
    return;
  }
  const baseMain: GradientConfig = {
    x1: 15.5, y1: 2, x2: 15.5, y2: 23,
    stops: [
      { offset: 0, color: '#CCDFFF' },
      { offset: 0.884515, color: '#B2CEFF' },
      { offset: 0.884615, color: '#89B5FF' },
      { offset: 1, color: '#97BEFF' }
    ]
  };
  const hoverMain: GradientConfig = {
    x1: 16.3736, y1: 2, x2: 16.3736, y2: 23,
    stops: [
      { offset: 0, color: '#93BBFF' },
      { offset: 0.884515, color: '#81B0FF' },
      { offset: 0.884615, color: '#4389FF' },
      { offset: 1, color: '#97BEFF' }
    ]
  };
  const baseOverlay: GradientConfig = {
    x1: 15.5, y1: 2, x2: 15.5, y2: 23,
    stops: [
      { offset: 0, color: '#CCDFFF' },
      { offset: 0.884515, color: '#B2CEFF' },
      { offset: 0.884615, color: '#89B5FF' },
      { offset: 1, color: '#97BEFF' }
    ]
  };
  const hoverOverlay: GradientConfig = {
    x1: 17.3736, y1: 11.3333, x2: 17.3736, y2: 23,
    stops: [
      { offset: 0, color: '#CCDFFF' },
      { offset: 0.827284, color: '#B2CEFF' },
      { offset: 0.85339, color: '#89B5FF' },
      { offset: 1, color: '#97BEFF' }
    ]
  };
  getFolderIconState(folderIcon).upperGradientMorph = {
    mainGradientEl,
    overlayGradientEl,
    baseMain,
    hoverMain,
    baseOverlay,
    hoverOverlay,
    state: 'base',
    rafId: 0
  };
  applyGradientMorphConfig(mainGradientEl, baseMain);
  applyGradientMorphConfig(overlayGradientEl, baseOverlay);
}

function playFolderUpperGradientMorph(folderIcon: Element, toHover: boolean): void {
  initFolderUpperGradientMorph(folderIcon);
  const morphState = getFolderIconState(folderIcon).upperGradientMorph;
  if (!morphState) {
    return;
  }
  const targetState = toHover ? 'hover' : 'base';
  if (morphState.state === targetState) {
    return;
  }
  morphState.state = targetState;
  if (morphState.rafId) {
    cancelAnimationFrame(morphState.rafId);
    morphState.rafId = 0;
  }
  const fromMain = toHover ? morphState.baseMain : morphState.hoverMain;
  const toMain = toHover ? morphState.hoverMain : morphState.baseMain;
  const fromOverlay = toHover ? morphState.baseOverlay : morphState.hoverOverlay;
  const toOverlay = toHover ? morphState.hoverOverlay : morphState.baseOverlay;
  const startTime = performance.now();
  const tick = (now: number): void => {
    const rawProgress = Math.max(0, Math.min(1, (now - startTime) / FOLDER_PATH_MORPH_DURATION_MS));
    const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
    applyGradientMorphConfig(morphState.mainGradientEl, interpolateGradientConfig(fromMain, toMain, eased));
    applyGradientMorphConfig(morphState.overlayGradientEl, interpolateGradientConfig(fromOverlay, toOverlay, eased));
    if (rawProgress < 1) {
      morphState.rafId = requestAnimationFrame(tick);
      return;
    }
    morphState.rafId = 0;
    applyGradientMorphConfig(morphState.mainGradientEl, toMain);
    applyGradientMorphConfig(morphState.overlayGradientEl, toOverlay);
  };
  morphState.rafId = requestAnimationFrame(tick);
}

function setFolderUpperFilterSuspended(folderIcon: Element, suspended: boolean): void {
  const svg = folderIcon.querySelector('svg');
  if (!svg) {
    return;
  }
  const upperFilterGroup = svg.querySelector('g[data-folder-layer="upper"] .x-nt-folder-shape--base > g[filter]');
  if (!upperFilterGroup) {
    return;
  }
  if (suspended) {
    if (!originalUpperFilters.has(upperFilterGroup)) {
      originalUpperFilters.set(upperFilterGroup, upperFilterGroup.getAttribute('filter'));
    }
    upperFilterGroup.setAttribute('filter', 'none');
    return;
  }
  const original = originalUpperFilters.get(upperFilterGroup);
  if (typeof original === 'string' && original) {
    upperFilterGroup.setAttribute('filter', original);
  } else {
    upperFilterGroup.removeAttribute('filter');
  }
}

function animatePathDWithCurve(part: FolderMorphPart, fromD: string, toD: string): boolean {
  let template: MorphTemplate | null = buildPathMorphTemplate(fromD, toD);
  // Turned back mid-morph: carry on from the points on screen towards the
  // other shape of the same pair, with no new sampling.
  const previous = part.pointMorph;
  const previousEnd = previous && previous.d === fromD ? previous.ends.get(toD) : undefined;
  let ends: Map<string, Point[]> | null = null;
  if (!template && previous && previousEnd) {
    ends = previous.ends;
    template = { type: 'point', fromPoints: previous.points, toPoints: previousEnd, closed: previous.closed };
  }
  if (!template) {
    template = getPointMorphTemplate(part.pathEl, fromD, toD);
    if (template && template.type === 'point') {
      ends = new Map([[fromD, template.fromPoints], [toD, template.toPoints]]);
    }
  }
  if (!template) {
    part.pointMorph = null;
    part.pathEl.setAttribute('d', toD);
    return false;
  }
  // Narrowed here, for the frames below.
  const morph = template;
  part.pointMorph = ends && morph.type === 'point'
    ? { ends, closed: morph.closed, points: morph.fromPoints, d: fromD }
    : null;
  cancelFolderPathMorph(part);
  const startTime = performance.now();
  const syncFollowers = (dValue: string): void => {
    part.linkedFollowers.forEach((el) => {
      el.setAttribute('d', dValue);
    });
  };
  const tick = (now: number): void => {
    const elapsed = now - startTime;
    const rawProgress = Math.max(0, Math.min(1, elapsed / FOLDER_PATH_MORPH_DURATION_MS));
    const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
    if (morph.type === 'number') {
      const values = morph.fromNumbers.map((fromValue, index) => {
        const toValue = morph.toNumbers[index];
        return fromValue + (toValue - fromValue) * eased;
      });
      const nextD = composeNumberPathD(morph.segments, values);
      part.pathEl.setAttribute('d', nextD);
      syncFollowers(nextD);
    } else {
      const points = morph.fromPoints.map((fromPoint, index) => {
        const toPoint = morph.toPoints[index];
        return {
          x: fromPoint.x + (toPoint.x - fromPoint.x) * eased,
          y: fromPoint.y + (toPoint.y - fromPoint.y) * eased
        };
      });
      const nextD = composePointPathD(points, morph.closed);
      part.pathEl.setAttribute('d', nextD);
      syncFollowers(nextD);
      if (part.pointMorph) {
        part.pointMorph.points = points;
        part.pointMorph.d = nextD;
      }
    }
    if (rawProgress < 1) {
      part.animationFrameId = requestAnimationFrame(tick);
      return;
    }
    part.pathEl.setAttribute('d', toD);
    syncFollowers(toD);
    if (part.pointMorph && morph.type === 'point') {
      part.pointMorph.points = morph.toPoints;
      part.pointMorph.d = toD;
    }
    part.animationFrameId = 0;
  };
  part.animationFrameId = requestAnimationFrame(tick);
  return true;
}

function initFolderPathMorph(folderIcon: Element | null | undefined): void {
  if (!folderIcon) return;
  const iconState = getFolderIconState(folderIcon);
  const svg = folderIcon.querySelector('svg');
  if (iconState.morphParts && iconState.morphSvg === svg) return;
  if (iconState.morphParts) {
    iconState.morphParts.forEach(cancelFolderPathMorph);
    const previous = iconState.upperGradientMorph;
    if (previous && previous.rafId) cancelAnimationFrame(previous.rafId);
    delete iconState.upperGradientMorph;
  }
  iconState.morphSvg = svg;
  if (!svg) {
    iconState.morphParts = [];
    return;
  }
  const hoverPathMap = new Map<string, string>();
  svg.querySelectorAll('[data-folder-part-hover]').forEach((pathEl) => {
    const partName = pathEl.getAttribute('data-folder-part-hover');
    const partD = pathEl.getAttribute('d');
    if (!partName || !partD) {
      return;
    }
    hoverPathMap.set(partName, partD);
  });
  const parts: FolderMorphPart[] = [];
  svg.querySelectorAll('[data-folder-part]').forEach((pathEl) => {
    const partName = pathEl.getAttribute('data-folder-part');
    const baseD = pathEl.getAttribute('d');
    const hoverD = partName ? hoverPathMap.get(partName) : undefined;
    if (!isSvgElement(pathEl) || !partName || !baseD || !hoverD) {
      return;
    }
    parts.push({
      partName,
      pathEl,
      baseD,
      hoverD,
      fillBase: pathEl.getAttribute('data-folder-fill-base') || '',
      fillHover: pathEl.getAttribute('data-folder-fill-hover') || '',
      opacityBase: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-base') || ''),
      opacityHover: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-hover') || ''),
      linkedFollowers: [],
      animationFrameId: 0
    });
  });
  const partMap = new Map<string, FolderMorphPart>();
  parts.forEach((part) => {
    partMap.set(part.partName, part);
  });
  const upperBodyPart = partMap.get('upper-body');
  const upperOverlayPart = partMap.get('upper-overlay');
  if (upperBodyPart && upperOverlayPart) {
    upperBodyPart.linkedFollowers.push(upperOverlayPart.pathEl);
  }
  parts.forEach((part) => {
    if (part.fillBase) {
      part.pathEl.setAttribute('fill', part.fillBase);
    }
    if (Number.isFinite(part.opacityBase)) {
      part.pathEl.style.opacity = String(part.opacityBase);
    }
  });
  iconState.morphParts = parts;
  iconState.morphState = 'base';
  warmFolderPathMorph(parts);
}

function setFolderPathMorphState(folderIcon: Element | null | undefined, toHover: boolean): void {
  if (!folderIcon) {
    return;
  }
  const iconState = getFolderIconState(folderIcon);
  if (!iconState.morphParts) {
    initFolderPathMorph(folderIcon);
  }
  const parts = iconState.morphParts || [];
  if (!parts.length) {
    return;
  }
  const targetState: MorphState = toHover ? 'hover' : 'base';
  if (iconState.upperFilterRestoreTimerId) {
    clearTimeout(iconState.upperFilterRestoreTimerId);
    iconState.upperFilterRestoreTimerId = 0;
  }
  setFolderUpperFilterSuspended(folderIcon, false);
  initFolderUpperGradientMorph(folderIcon);
  const gradientMorph = iconState.upperGradientMorph;
  if (gradientMorph) {
    if (gradientMorph.rafId) {
      cancelAnimationFrame(gradientMorph.rafId);
      gradientMorph.rafId = 0;
    }
    gradientMorph.state = targetState;
    applyGradientMorphConfig(
      gradientMorph.mainGradientEl,
      toHover ? gradientMorph.hoverMain : gradientMorph.baseMain
    );
    applyGradientMorphConfig(
      gradientMorph.overlayGradientEl,
      toHover ? gradientMorph.hoverOverlay : gradientMorph.baseOverlay
    );
  }
  const targetPaths = new Map(parts.map((part) => [
    part.partName,
    toHover ? part.hoverD : part.baseD
  ]));
  iconState.morphState = targetState;
  parts.forEach((part) => {
    cancelFolderPathMorph(part);
    const targetFill = toHover ? part.fillHover : part.fillBase;
    if (targetFill) {
      part.pathEl.setAttribute('fill', targetFill);
    }
    part.pathEl.style.removeProperty('transition');
    if (Number.isFinite(part.opacityBase) && Number.isFinite(part.opacityHover)) {
      part.pathEl.style.opacity = String(toHover ? part.opacityHover : part.opacityBase);
    }
    const targetD = part.partName === 'upper-overlay'
      ? (targetPaths.get('upper-body') || targetPaths.get(part.partName))
      : targetPaths.get(part.partName);
    if (!targetD) {
      return;
    }
    part.pathEl.setAttribute('d', targetD);
    part.linkedFollowers.forEach((follower) => {
      follower.setAttribute('d', targetD);
    });
  });
}

function playFolderPathMorph(
  folderIcon: Element | null | undefined,
  toHover: boolean,
  morphOptions?: { instant?: boolean }
): void {
  if (!folderIcon) {
    return;
  }
  if (morphOptions && morphOptions.instant === true) {
    setFolderPathMorphState(folderIcon, toHover);
    return;
  }
  const iconState = getFolderIconState(folderIcon);
  if (!iconState.morphParts) {
    initFolderPathMorph(folderIcon);
  }
  const parts = iconState.morphParts || [];
  if (!parts.length) {
    return;
  }
  const targetState: MorphState = toHover ? 'hover' : 'base';
  if (iconState.morphState === targetState) {
    return;
  }
  setFolderUpperFilterSuspended(folderIcon, true);
  playFolderUpperGradientMorph(folderIcon, toHover);
  if (iconState.upperFilterRestoreTimerId) {
    clearTimeout(iconState.upperFilterRestoreTimerId);
    iconState.upperFilterRestoreTimerId = 0;
  }
  iconState.upperFilterRestoreTimerId = window.setTimeout(() => {
    iconState.upperFilterRestoreTimerId = 0;
    setFolderUpperFilterSuspended(folderIcon, false);
  }, FOLDER_PATH_MORPH_DURATION_MS + 48);
  iconState.morphState = targetState;
  parts.forEach((part) => {
    const currentD = part.pathEl.getAttribute('d') || '';
    const fromD = currentD || (toHover ? part.baseD : part.hoverD);
    const toD = toHover ? part.hoverD : part.baseD;
    if (!fromD || !toD) {
      return;
    }
    const targetFill = toHover ? part.fillHover : part.fillBase;
    if (targetFill) {
      part.pathEl.setAttribute('fill', targetFill);
    }
    if (Number.isFinite(part.opacityBase) && Number.isFinite(part.opacityHover)) {
      part.pathEl.style.transition = `opacity ${FOLDER_PATH_MORPH_DURATION_MS}ms ${FOLDER_PATH_MORPH_EASING}`;
      part.pathEl.style.opacity = String(toHover ? part.opacityHover : part.opacityBase);
    }
    if (part.partName === 'upper-overlay') {
      const upperBodyPart = parts.find((item) => item.partName === 'upper-body');
      if (upperBodyPart) {
        part.pathEl.setAttribute('d', upperBodyPart.pathEl.getAttribute('d') || toD);
        return;
      }
    }
    const animated = animatePathDWithCurve(part, fromD, toD);
    if (!animated) {
      part.pathEl.setAttribute('d', toD);
      part.animationFrameId = 0;
    }
  });
}

// Where an icon's morph is, and the parts it morphs.
function getFolderMorphState(folderIcon: Element): MorphState | undefined {
  const iconState = folderIconStates.get(folderIcon);
  return iconState ? iconState.morphState : undefined;
}

function getFolderMorphParts(folderIcon: Element): readonly FolderMorphPart[] {
  const iconState = folderIconStates.get(folderIcon);
  return iconState && iconState.morphParts ? iconState.morphParts : [];
}

// The folder whose color an icon shows; '' when it shows none.
function getFolderIconColorId(icon: Element): string {
  const svg = icon.querySelector('svg[data-folder-color-id]');
  return svg ? svg.getAttribute('data-folder-color-id') || '' : '';
}

// Every folder icon drawn on the page.
function getFolderIcons(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('svg[data-folder-color-id]'))
    .map((svg) => svg.parentElement)
    .filter((icon): icon is HTMLElement => icon !== null);
}

export {
  FOLDER_PATH_MORPH_DURATION_MS,
  getFolderIconColorId,
  getFolderIcons,
  applyFolderColor,
  initFolderPathMorph,
  playFolderPathMorph,
  setFolderPathMorphState,
  getFolderMorphState,
  getFolderMorphParts
};
