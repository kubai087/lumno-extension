// The network a shortcut icon is acquired over: the browser's favicon
// endpoint answers with `browserImage`, the icon services with `proxyImage`
// (or per page with `pageImages`), and either can fail or hang
// (`proxyMode`). The probe for the browser's placeholder globe answers with
// `placeholderImage`. Every request is recorded in `calls`.
import { Blob } from 'node:buffer';
import { getPageUrlFromFaviconProxyUrl } from '../../src/domain/favicon/canonical';

interface FaviconNetworkCall {
  url: string;
  options: RequestInit;
}

interface FaviconNetworkOptions {
  browserImage?: Uint8Array | null;
  proxyImage?: Uint8Array | null;
  placeholderImage?: Uint8Array;
  proxyMode?: 'ok' | 'error' | 'timeout';
  pageImages?: Record<string, { browser: Uint8Array; proxy: Uint8Array }>;
  // Answers by URL only (Firefox's data: icons); nothing else answers.
  images?: Record<string, Uint8Array>;
}

// A PNG header for a square image `width` pixels wide, told apart by `marker`.
function png(width: number, marker = 1): Uint8Array {
  const bytes = new Uint8Array(25);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width);
  view.setUint32(20, width);
  bytes[24] = marker;
  return bytes;
}

function dataUrl(image: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(image).toString('base64')}`;
}

// The marker of a PNG data: URL that png() made.
function markerOf(url: string): number {
  return Buffer.from(url.split(',')[1] || '', 'base64')[24];
}

function respond(url: string, image: Uint8Array | null | undefined) {
  return {
    ok: Boolean(image),
    url,
    headers: { get: () => '' },
    blob: async () => new Blob(image ? [image] : [], { type: 'image/png' })
  };
}

function createFaviconNetwork(options: FaviconNetworkOptions = {}) {
  const state = {
    browserImage: options.browserImage === undefined ? png(32, 2) : options.browserImage,
    proxyImage: options.proxyImage === undefined ? png(128, 3) : options.proxyImage,
    proxyMode: options.proxyMode || 'ok',
    pageImages: options.pageImages || {},
    calls: new Array<FaviconNetworkCall>()
  };
  const placeholderImage = options.placeholderImage || png(16, 0);

  function fetchImage(input: unknown, init?: RequestInit) {
    const url = String(input);
    const requestOptions = init || {};
    // The extension's own files (its locale messages) are not icons.
    if (url.includes('/_locales/') || url.endsWith('.json')) {
      return Promise.reject(new Error('offline'));
    }
    state.calls.push({ url, options: requestOptions });
    if (options.images) {
      return Promise.resolve(respond(url, options.images[url]));
    }
    const isBrowser = new URL(url).protocol === 'chrome-extension:';
    if (!isBrowser && state.proxyMode === 'timeout') {
      return new Promise<never>((_resolve, reject) => {
        const signal = requestOptions.signal;
        if (signal) signal.addEventListener('abort', () => reject(new Error('proxy timeout')), { once: true });
      });
    }
    if (!isBrowser && state.proxyMode === 'error') {
      return Promise.reject(new Error('proxy unavailable'));
    }
    const page = getPageUrlFromFaviconProxyUrl(url);
    const perPage = state.pageImages[page];
    const image = page.includes('lumno.invalid')
      ? placeholderImage
      : perPage ? perPage[isBrowser ? 'browser' : 'proxy'] : isBrowser ? state.browserImage : state.proxyImage;
    return Promise.resolve(respond(url, image));
  }

  return { state, fetch: fetchImage };
}

type FaviconNetwork = ReturnType<typeof createFaviconNetwork>;

export { createFaviconNetwork, dataUrl, markerOf, png };
export type { FaviconNetwork, FaviconNetworkOptions };
