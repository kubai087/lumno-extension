// The order of the mode menu's sources and groups, as the panel edits it:
// a dragged tile or group is stored on top of the latest stored order, so a
// concurrent change from Settings is not lost, and Ctrl/Cmd+Z steps back
// through this page's own moves. Moves, undos and redos run one after
// another, so each reads what the previous one stored.
import {
  applyGroupMove,
  applyScopeMenuMove,
  createHistory
} from '../../domain/search/search-source-order';
import type { ScopeMenuMove, SearchSourceOrder } from '../../domain/search/search-source-order';
import { searchSourceOrder } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';

// A group block moved from its title in the menu.
interface GroupMove {
  delta: number;
  group: string;
  groups: string[];
}

class SearchModeMenuOrder {
  private readonly settings: Pick<SettingsStore, 'getStored' | 'include' | 'set'>;
  private readonly history = createHistory();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(settings: Pick<SettingsStore, 'getStored' | 'include' | 'set'>) {
    this.settings = settings;
  }

  // The stored order; null when it cannot be read.
  readonly load = (): Promise<unknown> => (
    this.settings.include(searchSourceOrder)
      .then(() => this.settings.getStored(searchSourceOrder))
      .catch(() => null)
  );

  readonly reorder = (payload: ScopeMenuMove | null | undefined): Promise<unknown> => (
    this.enqueue(() => this.load().then((value) => this.record(value, applyScopeMenuMove(value, payload))))
  );

  readonly moveGroup = (payload: GroupMove | null | undefined): Promise<unknown> => {
    if (!payload) {
      return Promise.resolve();
    }
    return this.enqueue(() => this.load().then((value) => (
      this.record(value, applyGroupMove(value, payload.groups, payload.group, payload.delta))
    )));
  };

  // Returns whether there was a step to take, so the menu only claims
  // Ctrl/Cmd+Z when it does something.
  readonly step = (direction: 'undo' | 'redo'): boolean => {
    if (!(direction === 'redo' ? this.history.canRedo() : this.history.canUndo())) {
      return false;
    }
    void this.enqueue(() => this.load().then((value) => {
      const target = direction === 'redo' ? this.history.redo(value) : this.history.undo(value);
      return target ? this.write(target) : null;
    }));
    return true;
  };

  private record(before: unknown, after: SearchSourceOrder): Promise<void> {
    this.history.record(before, after);
    return this.write(after);
  }

  private write(order: SearchSourceOrder): Promise<void> {
    return this.settings.set(searchSourceOrder, order).catch(() => {});
  }

  private enqueue(task: () => Promise<unknown>): Promise<unknown> {
    this.queue = this.queue.then(task).catch(() => {});
    return this.queue;
  }
}

export { SearchModeMenuOrder };
export type { GroupMove };
