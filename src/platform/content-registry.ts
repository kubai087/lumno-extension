// What the extension's scripts in a page's isolated world share with each
// other and with the worker's injected functions. Scripts the worker injects
// are ES modules, which the browser loads once per world, so they keep their
// state in module scope; this registry holds only what has to be seen from
// outside a module: which classic content scripts already run (a script can
// be injected into a page that already loaded it from the manifest) and
// whether the search overlay is open (which the worker reads without loading
// the overlay), and the keys typed while it opens. It lives on the isolated world's global object, which the
// page never sees; this module is the only code that touches it. A reloaded
// or updated extension runs in a new isolated world, so each extension
// context starts with an empty registry and fresh module instances.

const REGISTRY_KEY = '__lumnoContent';

function isRegistry(value: unknown): value is LumnoContentRegistry {
  return Boolean(value) && typeof value === 'object' && value !== null &&
    'claimed' in value && Boolean(value.claimed) && typeof value.claimed === 'object';
}

function getRegistry(): LumnoContentRegistry {
  const existing = globalThis.__lumnoContent;
  if (existing) {
    return existing;
  }
  const created: LumnoContentRegistry = { claimed: {} };
  globalThis.__lumnoContent = created;
  return created;
}

// The registry of a given window: the isolated world's own global in the
// extension, another window in tests.
function getRegistryOf(scope: object): LumnoContentRegistry {
  if (scope === globalThis) {
    return getRegistry();
  }
  const existing: unknown = Reflect.get(scope, REGISTRY_KEY);
  if (isRegistry(existing)) {
    return existing;
  }
  const created: LumnoContentRegistry = { claimed: {} };
  Reflect.set(scope, REGISTRY_KEY, created);
  return created;
}

// Claims a classic content script's single run in this world: true for the
// first caller, false when the script already runs here.
function claimContentScript(name: string): boolean {
  const registry = getRegistry();
  if (registry.claimed[name]) {
    return false;
  }
  registry.claimed[name] = true;
  return true;
}

// Whether the page clip picker has the page in its Picture-in-Picture window,
// which the automatic picture-in-picture scripts leave alone meanwhile.
function setDocumentPipActiveState(active: boolean): void {
  getRegistry().documentPipActive = active;
}

function isDocumentPipActiveState(): boolean {
  return getRegistry().documentPipActive === true;
}

// The overlay's font faces the shortcut observer registered at document
// start, for the overlay to keep when it first opens; read as untrusted.
function setEarlyOverlayFontFaces(scope: object, faces: unknown): void {
  getRegistryOf(scope).earlyOverlayFontFaces = faces;
}

function readEarlyOverlayFontFaces(scope: object): unknown {
  return getRegistryOf(scope).earlyOverlayFontFaces;
}

// The keys held while the overlay was opening: the shortcut observer
// registers its holder, the overlay takes the text when its input has focus.
function setOverlayTypeAhead(holder: { take(): string }): void {
  getRegistry().overlayTypeAhead = holder;
}

function takeOverlayTypeAhead(): string {
  const holder = getRegistry().overlayTypeAhead;
  if (!holder || typeof holder.take !== 'function') {
    return '';
  }
  const text: unknown = holder.take();
  return typeof text === 'string' ? text : '';
}

function setOverlayOpenState(open: boolean): void {
  getRegistry().overlayOpen = open;
}

function isOverlayOpenState(): boolean {
  return getRegistry().overlayOpen === true;
}

export {
  claimContentScript,
  isDocumentPipActiveState,
  isOverlayOpenState,
  readEarlyOverlayFontFaces,
  setDocumentPipActiveState,
  setEarlyOverlayFontFaces,
  setOverlayOpenState,
  setOverlayTypeAhead,
  takeOverlayTypeAhead
};
