// A page's one React root, and the views it draws: into the root's own
// container, or into other places on the page through portals. A view's
// owner shows it in a container and removes it again; every view lives in
// the same tree under one scheduler.
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Fragment, type ReactNode } from 'react';
import { createStore } from '../state/store';
import type { Store } from '../state/store';
import { useStore } from './use-store';

interface PortalView {
  container: Element | DocumentFragment;
  key: string;
  node: ReactNode;
}

interface PortalViewsState {
  views: readonly PortalView[];
}

function PortalOutlet({ store, rootContainer }: { store: Store<PortalViewsState>; rootContainer: Element | DocumentFragment }) {
  const { views } = useStore(store);
  return (
    <>
      {views.map((view) => (view.container === rootContainer
        ? <Fragment key={view.key}>{view.node}</Fragment>
        : createPortal(view.node, view.container, view.key)))}
    </>
  );
}

class PortalHost {
  private readonly store: Store<PortalViewsState> = createStore<PortalViewsState>({ views: [] });
  private readonly root: Root;
  private readonly keys = new WeakMap<Element | DocumentFragment, string>();
  private nextKey = 0;

  // `rootContainer` holds the root; a view shown in it is drawn there
  // directly.
  constructor(rootContainer: Element | DocumentFragment) {
    this.root = createRoot(rootContainer);
    flushSync(() => this.root.render(<PortalOutlet rootContainer={rootContainer} store={this.store} />));
  }

  // Draws `node` into `container`, replacing what was drawn there, and
  // commits before it returns.
  show(container: Element | DocumentFragment, node: ReactNode): void {
    const views = this.withView(container, node);
    flushSync(() => this.store.setState({ views }));
  }

  // Draws `node` into `container` when React next commits.
  update(container: Element | DocumentFragment, node: ReactNode): void {
    this.store.setState({ views: this.withView(container, node) });
  }

  // Removes the view drawn into `container`.
  remove(container: Element | DocumentFragment): void {
    const views = this.store.getSnapshot().views;
    if (views.some((view) => view.container === container)) {
      flushSync(() => this.store.setState({ views: views.filter((view) => view.container !== container) }));
    }
  }

  destroy(): void {
    flushSync(() => this.root.unmount());
  }

  private withView(container: Element | DocumentFragment, node: ReactNode): readonly PortalView[] {
    const key = this.keyFor(container);
    const views = this.store.getSnapshot().views;
    const index = views.findIndex((view) => view.container === container);
    return index === -1
      ? [...views, { container, key, node }]
      : views.map((view, viewIndex) => (viewIndex === index ? { container, key, node } : view));
  }

  private keyFor(container: Element | DocumentFragment): string {
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
