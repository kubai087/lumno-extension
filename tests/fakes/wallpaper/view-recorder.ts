// Stands in for the React appearance panel (src/newtab/react/wallpaper-view.tsx,
// tested there) in tests of the wallpaper runtime: it keeps the state the
// runtime renders and the few elements the runtime measures or focuses. Tests
// read the panel from that state and act through its actions, as the panel's
// controls do. Mock the view with it:
//   vi.mock('../react/wallpaper-view', async () => ({
//     createWallpaperViewController: (await import('./view-recorder')).createRecordingWallpaperView
//   }));
import type {
  QuoteSettingsModel,
  SectionSettingsModel,
  WallpaperPanelModel,
  WallpaperPanelState,
  WallpaperPanelStateSlot,
  WallpaperViewController
} from '../../../src/newtab/react/wallpaper-view';
import type { Store } from '../../../src/shared/state/store';

interface RecordingPanel {
  controller: WallpaperViewController;
  model: WallpaperPanelModel;
  state: WallpaperPanelState;
  renders: number;
  // The refs focus() was asked for, in order.
  focused: string[];
  quoteSettings: QuoteSettingsModel | null;
  sectionSettings: SectionSettingsModel | null;
  // Whether one of the panel's select menus is open, and its menu.
  selectOpen: boolean;
  selectMenu: HTMLElement;
}

const REF_NAMES = [
  'appearanceOptions', 'builtInGrid', 'localGrid', 'bingPanel', 'curatedPanel', 'curatedItemsHost', 'modeRow',
  'effectInkToneControl', 'effectStrengthControl', 'effectSizeControl', 'effectSpacingControl',
  'effectTextureControl', 'effectCrtBloomControl', 'effectCrtRgbOffsetControl', 'effectCrtCurvatureControl',
  'urlTile', 'urlForm', 'quoteBody'
];

const panels = new WeakMap<Element, RecordingPanel>();

function createRecordingWallpaperView(config: {
  documentObj?: Document;
  model?: WallpaperPanelModel;
  state: Store<WallpaperPanelStateSlot>;
}): WallpaperViewController {
  const documentObj = config.documentObj || document;
  const refs: Record<string, HTMLElement> = {};
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, refName: string, parent: HTMLElement | null) => {
    const element = documentObj.createElement(tag);
    element.className = className;
    if (refName) {
      refs[refName] = element;
      element.setAttribute('data-wallpaper-ref', refName);
    }
    if (parent) parent.appendChild(element);
    return element;
  };
  const control = create('div', 'x-nt-wallpaper-control', '', null);
  const panel = create('div', 'x-nt-wallpaper-panel', 'panel', control);
  const button = create('button', 'x-nt-wallpaper-button', 'button', control);
  REF_NAMES.forEach((name) => create('div', '', name, panel));
  create('input', '', 'urlInput', refs.urlForm || null);
  const controller: WallpaperViewController = {
    control,
    panel,
    button,
    getRefs: () => refs,
    attachSettings(stores) {
      if (stores.quote) {
        const quote = stores.quote;
        recording.quoteSettings = quote.getSnapshot().model;
        quote.subscribe(() => {
          recording.quoteSettings = quote.getSnapshot().model;
        });
      }
      if (stores.section) {
        const section = stores.section;
        recording.sectionSettings = section.getSnapshot().model;
        section.subscribe(() => {
          recording.sectionSettings = section.getSnapshot().model;
        });
      }
    },
    focus(name) {
      recording.focused.push(name);
      const element = refs[name];
      if (element) element.focus();
    },
    closeOpenSelect() {
      const wasOpen = recording.selectOpen;
      recording.selectOpen = false;
      return wasOpen;
    },
    containsSelectMenuTarget: (target) => target === recording.selectMenu,
    destroy() {}
  };
  const recording: RecordingPanel = {
    controller,
    model: config.model || {},
    state: config.state.getSnapshot().state,
    renders: 0,
    focused: [],
    quoteSettings: null,
    sectionSettings: null,
    selectOpen: false,
    selectMenu: documentObj.createElement('div')
  };
  // The panel draws each state its owner sets.
  config.state.subscribe(() => {
    const { state } = config.state.getSnapshot();
    recording.state = state;
    recording.renders += 1;
    control.setAttribute('data-panel-open', state.open ? 'true' : 'false');
  });
  panels.set(control, recording);
  return controller;
}

// The recording panel mounted in `control`.
function getRecordingPanel(control: Element | null): RecordingPanel {
  const recording = control ? panels.get(control) : undefined;
  if (!recording) {
    throw new Error('The wallpaper panel has not been drawn.');
  }
  return recording;
}

export { createRecordingWallpaperView, getRecordingPanel };
export type { RecordingPanel };
