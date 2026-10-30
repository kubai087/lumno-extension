// JSDOM draws no canvas and loads no image. installCanvasFake gives every
// canvas a 2D context that records what is drawn and reads back the pixels a
// test chooses; installImageFake replaces Image with one whose loads and
// decodes a test settles. Both are undone when the test finishes.
import { onTestFinished } from 'vitest';

interface PathPoint {
  x: number;
  y: number;
  radius?: number;
}

interface FakeGradient {
  colorStops: Array<[number, string]>;
  addColorStop(offset: number, color: string): void;
}

interface CanvasOperation {
  op: 'drawImage' | 'fill' | 'fillRect' | 'putImageData';
  source?: unknown;
  // drawImage's numbers after the source.
  args?: number[];
  points?: PathPoint[];
  fillStyle?: unknown;
  alpha?: number;
  composite?: string;
  filter?: string;
  data?: number[];
}

interface CanvasRecord {
  operations: CanvasOperation[];
  // The options each getContext call passed.
  contextOptions: unknown[];
  dataUrlCalls: number;
}

interface CanvasFakeOptions {
  // What getImageData reads, given the source drawn into the canvas last.
  readPixels?(width: number, height: number, drawn: unknown): Uint8ClampedArray;
  // What toDataURL answers.
  toDataUrl?(canvas: HTMLCanvasElement, type: string | undefined, quality: number | undefined): string;
}

interface CanvasFake {
  // Each canvas whose context was asked for, in that order.
  canvases: HTMLCanvasElement[];
  record(canvas: HTMLCanvasElement): CanvasRecord;
}

function isGradient(value: unknown): value is FakeGradient {
  return typeof value === 'object' && value !== null && 'colorStops' in value;
}

// What each replaced property was before any fake, so installing a fake twice
// in one test still restores the page's own.
const originals = new Map<object, Map<string, PropertyDescriptor | undefined>>();

// Replaces a property for the rest of the test.
function replaceProperty(target: object, name: string, value: unknown): void {
  let saved = originals.get(target);
  if (!saved) {
    saved = new Map();
    originals.set(target, saved);
  }
  if (!saved.has(name)) {
    const original = Object.getOwnPropertyDescriptor(target, name);
    saved.set(name, original);
    onTestFinished(() => {
      saved.delete(name);
      if (original) {
        Object.defineProperty(target, name, original);
      } else {
        Reflect.deleteProperty(target, name);
      }
    });
  }
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
}

function createContext(record: CanvasRecord, canvas: HTMLCanvasElement, options: CanvasFakeOptions) {
  const saved: object[] = [];
  let path: PathPoint[] = [];
  let drawn: unknown = null;
  const context = {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    filter: 'none',
    shadowBlur: 0,
    shadowColor: 'transparent',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    setTransform() {},
    save() {
      saved.push({
        globalAlpha: context.globalAlpha,
        globalCompositeOperation: context.globalCompositeOperation,
        fillStyle: context.fillStyle,
        filter: context.filter,
        shadowBlur: context.shadowBlur,
        shadowColor: context.shadowColor
      });
    },
    restore() {
      Object.assign(context, saved.pop() || {});
    },
    clearRect() {},
    beginPath() {
      path = [];
    },
    moveTo(x: number, y: number) {
      path.push({ x, y });
    },
    lineTo(x: number, y: number) {
      path.push({ x, y });
    },
    arc(x: number, y: number, radius: number) {
      path.push({ x, y, radius });
    },
    closePath() {},
    fill() {
      record.operations.push({ op: 'fill', points: path.slice(), fillStyle: context.fillStyle });
    },
    createImageData(width: number, height: number) {
      return { width, height, data: new Uint8ClampedArray(width * height * 4) };
    },
    getImageData(_x: number, _y: number, width: number, height: number) {
      const data = options.readPixels ? options.readPixels(width, height, drawn) : new Uint8ClampedArray(width * height * 4);
      return { width, height, data };
    },
    putImageData(imageData: { data: Uint8ClampedArray }) {
      record.operations.push({ op: 'putImageData', data: Array.from(imageData.data) });
    },
    createPattern(source: unknown) {
      return { source };
    },
    createRadialGradient(): FakeGradient {
      const gradient: FakeGradient = {
        colorStops: [],
        addColorStop(offset, color) {
          gradient.colorStops.push([offset, color]);
        }
      };
      return gradient;
    },
    drawImage(source: unknown, ...args: number[]) {
      drawn = source;
      record.operations.push({
        op: 'drawImage',
        source,
        args,
        alpha: context.globalAlpha,
        composite: context.globalCompositeOperation,
        filter: context.filter
      });
    },
    fillRect() {
      record.operations.push({
        op: 'fillRect',
        fillStyle: context.fillStyle,
        alpha: context.globalAlpha,
        composite: context.globalCompositeOperation
      });
    }
  };
  return context;
}

function installCanvasFake(options: CanvasFakeOptions = {}): CanvasFake {
  const records = new WeakMap<HTMLCanvasElement, CanvasRecord>();
  const contexts = new WeakMap<HTMLCanvasElement, ReturnType<typeof createContext>>();
  const canvases: HTMLCanvasElement[] = [];
  const recordOf = (canvas: HTMLCanvasElement): CanvasRecord => {
    let record = records.get(canvas);
    if (!record) {
      record = { operations: [], contextOptions: [], dataUrlCalls: 0 };
      records.set(canvas, record);
    }
    return record;
  };
  replaceProperty(HTMLCanvasElement.prototype, 'getContext', function getContext(this: HTMLCanvasElement, type: string, contextOptions?: unknown) {
    if (type !== '2d') {
      return null;
    }
    const record = recordOf(this);
    record.contextOptions.push(contextOptions);
    let context = contexts.get(this);
    if (!context) {
      context = createContext(record, this, options);
      contexts.set(this, context);
      canvases.push(this);
    }
    return context;
  });
  replaceProperty(HTMLCanvasElement.prototype, 'toDataURL', function toDataURL(this: HTMLCanvasElement, type?: string, quality?: number) {
    recordOf(this).dataUrlCalls += 1;
    return options.toDataUrl ? options.toDataUrl(this, type, quality) : 'data:image/png;base64,AA==';
  });
  return { canvases, record: recordOf };
}

// Fills every pixel with one color.
function solidPixels(rgba: readonly number[]) {
  return (width: number, height: number): Uint8ClampedArray => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < data.length; index += 4) {
      data.set(rgba.slice(0, 4), index);
    }
    return data;
  };
}

type ImageOutcome = 'load' | 'error' | 'pending';

interface ImageFakeOptions {
  // The image's natural size once it loads.
  size?(src: string): { width: number; height: number };
  // What setting src leads to, after the current task; 'load' by default.
  outcome?(src: string): ImageOutcome;
  // Hold decode() until the test calls finishDecode().
  deferDecode?: boolean;
}

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  currentSrc = '';
  decoding = '';
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  settled = false;
  private source = '';
  private decoded: Promise<void>;
  private resolveDecode: () => void = () => {};
  private readonly options: ImageFakeOptions;
  private readonly started: (image: FakeImage) => void;

  constructor(options: ImageFakeOptions, started: (image: FakeImage) => void) {
    this.options = options;
    this.started = started;
    this.decoded = options.deferDecode
      ? new Promise((resolve) => { this.resolveDecode = resolve; })
      : Promise.resolve();
  }

  get src(): string {
    return this.source;
  }

  set src(value: string) {
    this.source = String(value);
    this.currentSrc = this.source;
    this.started(this);
    const outcome = this.options.outcome ? this.options.outcome(this.source) : 'load';
    if (outcome !== 'pending') {
      setTimeout(() => (outcome === 'load' ? this.load() : this.fail()), 0);
    }
  }

  decode(): Promise<void> {
    return this.decoded;
  }

  finishDecode(): void {
    this.resolveDecode();
  }

  load(): void {
    if (this.settled) return;
    this.settled = true;
    const size = this.options.size ? this.options.size(this.source) : { width: 10, height: 10 };
    this.naturalWidth = size.width;
    this.naturalHeight = size.height;
    this.width = size.width;
    this.height = size.height;
    if (this.onload) this.onload();
  }

  fail(): void {
    if (this.settled) return;
    this.settled = true;
    if (this.onerror) this.onerror();
  }
}

interface ImageFake {
  // Every image whose src was set, in that order.
  images: FakeImage[];
  sources(): string[];
  // The unsettled image loading src.
  pending(src: string): FakeImage;
}

function installImageFake(options: ImageFakeOptions = {}): ImageFake {
  const images: FakeImage[] = [];
  class Image extends FakeImage {
    constructor() {
      super(options, (image) => images.push(image));
    }
  }
  replaceProperty(globalThis, 'Image', Image);
  return {
    images,
    sources: () => images.map((image) => image.src),
    pending(src) {
      const image = images.find((candidate) => candidate.src === src && !candidate.settled);
      if (!image) {
        throw new Error(`Expected an image loading ${src}.`);
      }
      return image;
    }
  };
}

// The src of a drawn image, or ''.
function sourceUrl(source: unknown): string {
  return typeof source === 'object' && source !== null && 'src' in source && typeof source.src === 'string' ? source.src : '';
}

export { FakeImage, installCanvasFake, installImageFake, isGradient, solidPixels, sourceUrl };
export type { CanvasFake, CanvasOperation, CanvasRecord, ImageFake, ImageFakeOptions };
