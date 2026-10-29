// Draws the mode tag and the Tab hint: the React view
// (react/search/mode-tag.tsx) shows the models set here in its stores. Each
// change commits before it returns, so the tag can be measured and animated
// at once.
import type { ModeTagHandlers, ModeTagStore, TabHintStore } from '../../../react/search/mode-tag';
import { EMPTY_MODE_TAG } from '../mode-tag-model';
import type { ModeTagModel, TabHintModel } from '../mode-tag-model';

interface ModeTagStores {
  modeTagStore: ModeTagStore;
  tabHintStore: TabHintStore;
}

class ModeTagDrawing {
  private tagModel: ModeTagModel = EMPTY_MODE_TAG;
  private hintModel: TabHintModel = { visible: false, label: '', title: '' };
  private readonly stores: ModeTagStores;
  private readonly handlers: ModeTagHandlers;

  constructor(stores: ModeTagStores, handlers: ModeTagHandlers) {
    this.stores = stores;
    this.handlers = handlers;
  }

  get model(): ModeTagModel {
    return this.tagModel;
  }

  get tabHint(): TabHintModel {
    return this.hintModel;
  }

  update(patch: Partial<ModeTagModel>): void {
    this.tagModel = { ...this.tagModel, ...patch };
    this.stores.modeTagStore.setState({ model: this.tagModel, handlers: this.handlers });
  }

  updateTabHint(patch: Partial<TabHintModel>): void {
    this.hintModel = { ...this.hintModel, ...patch };
    this.stores.tabHintStore.setState(this.hintModel);
  }
}

export type { ModeTagStores };
export { ModeTagDrawing };
