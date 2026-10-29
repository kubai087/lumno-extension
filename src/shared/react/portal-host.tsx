// A page's one React root, and the views it draws into places on the page
// through portals. A view's owner shows it in a container and removes it
// again; every view lives in the same tree under one scheduler.
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { createStore } from '../state/store';
import type { Store } from '../state/store';
import { useStore } from './use-store';

interface PortalView {
  container: Element;
  key: string;
  node: ReactNode;
}

interface PortalViewsState {
  views: readonly PortalView[];
}

function PortalOutlet({ store }: { store: Store<PortalViewsState> }) {
  const { views } = useStore(store);
  return <>{views.map((view) => createPortal(view.node, view.container, view.key))}</>;
}

class PortalHost {
  private readonly store: Store<PortalViewsState> = createStore<PortalViewsState>({ views: [] });
  private readonly root: Root;
  private readonly keys = new WeakMap<Element, string>();
  private nextKey = 0;

  // `rootContainer` holds the root itself; it draws nothing of its own.
  constructor(rootContainer: Element) {
    this.root = createRoot(rootContainer);
    flushSync(() => this.root.render(<PortalOutlet store={this.store} />));
  }

  // Draws `node` into `container`, replacing what was drawn there, and
  // commits before it returns.
  show(container: Element, node: ReactNode): void {
    const views = this.withView(container, node);
    flushSync(() => this.store.setState({ views }));
  }

  // Draws `node` into `container` when React next commits.
  update(container: Element, node: ReactNode): void {
    this.store.setState({ views: this.withView(container, node) });
  }

  // Removes the view drawn into `container`.
  remove(container: Element): void {
    const views = this.store.getSnapshot().views;
    if (views.some((view) => view.container === container)) {
      flushSync(() => this.store.setState({ views: views.filter((view) => view.container !== container) }));
    }
  }

  destroy(): void {
    flushSync(() => this.root.unmount());
  }

  private withView(container: Element, node: ReactNode): readonly PortalView[] {
    const key = this.keyFor(container);
    const views = this.store.getSnapshot().views;
    const index = views.findIndex((view) => view.container === container);
    return index === -1
      ? [...views, { container, key, node }]
      : views.map((view, viewIndex) => (viewIndex === index ? { container, key, node } : view));
  }

  private keyFor(container: Element): string {
    let key = this.keys.get(container);
    if (!key) {
      this.nextKey += 1;
      key = `portal-${this.nextKey}`;
      this.keys.set(container, key);
    }
    return key;
  }
}

export { PortalHost };
