// Element boxes for measurement code. JSDOM does no layout: every element
// measures 0×0 and nothing is under the pointer. A test gives the elements it
// cares about a box, and the code under test measures and hit-tests them as
// it would in a browser (getBoundingClientRect, the offset*, client* and
// scroll* sizes, elementFromPoint, the window's size).
//
//   const layout = createLayout();
//   layout.place(card, { left: 100, top: 100, width: 188, height: 51 });
//   layout.place(section, () => ({ ...box, height: grows ? 120 : 80 }));
//   layout.flow(grid, '.card', { left: 100, top: 100, width: 188, height: 51, gap: 12 });
//   layout.measure(scroller, { clientWidth: 1048, scrollHeight: 600 });
//   layout.viewport({ width: 375, height: 667 });
//
// Boxes are { left, top, width, height } in viewport pixels. A box given as a
// function is read at each measure, for elements whose size follows the page.
// Call createLayout() inside the test; everything is undone when it ends.
import { onTestFinished, vi } from 'vitest';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Boxes in a row: each `width` × `height`, `gap` apart, from `left`.
interface Row extends Box {
  gap?: number;
}

type BoxSource = Box | (() => Box);

// Sizes that are not part of the box: scroll and client sizes, and offset
// sizes that differ from it.
interface Measures {
  clientWidth?: number;
  clientHeight?: number;
  scrollWidth?: number;
  scrollHeight?: number;
  offsetWidth?: number;
  offsetHeight?: number;
}

interface Flow {
  container: Element;
  selector: string;
  row: Row;
}

interface Layout {
  place<T extends Element>(element: T, box: BoxSource): T;
  // Places `elements` in a row; returns their rects.
  row(elements: readonly Element[], row: Row): DOMRect[];
  // Boxes in a row for the `selector` matches inside `container`, in the order
  // they have when measured, so a reorder moves them as it would on screen.
  flow(container: Element, selector: string, row: Row): DOMRect[];
  measure<T extends Element>(element: T, measures: Measures): T;
  viewport(size: { width?: number; height?: number }): void;
  // The point at the middle of an element's box.
  center(element: Element): [number, number];
}

function toRect({ left, top, width, height }: Box): DOMRect {
  return new DOMRect(left, top, width, height);
}

function contains(box: Box, x: number, y: number): boolean {
  return x >= box.left && x < box.left + box.width && y >= box.top && y < box.top + box.height;
}

function depthOf(element: Element): number {
  let count = 0;
  for (let node: Element | null = element; node; node = node.parentElement) {
    count += 1;
  }
  return count;
}

// The browser's own measures, kept before any test replaces them, so a
// second layout in one test falls back to them rather than to the first.
const NATIVE_RECT = Element.prototype.getBoundingClientRect;
const NATIVE_GETTERS = new Map<string, (() => unknown) | undefined>([
  ...['offsetWidth', 'offsetHeight', 'offsetLeft', 'offsetTop']
    .map((name): [string, (() => unknown) | undefined] => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)?.get]),
  ...['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight']
    .map((name): [string, (() => unknown) | undefined] => [name, Object.getOwnPropertyDescriptor(Element.prototype, name)?.get])
]);

function createLayout(): Layout {
  const boxes = new Map<Element, BoxSource>();
  const measures = new Map<Element, Measures>();
  const flows: Flow[] = [];
  const flowed = (flow: Flow): Element[] => Array.from(flow.container.querySelectorAll(flow.selector));
  const flowBox = (element: Element): Box | null => {
    for (const flow of flows) {
      if (!flow.container.isConnected) continue;
      const index = flowed(flow).indexOf(element);
      if (index >= 0) {
        const { left, top, width, height, gap = 0 } = flow.row;
        return { left: left + index * (width + gap), top, width, height };
      }
    }
    return null;
  };
  const boxOf = (element: Element): Box | null => {
    const flowing = flowBox(element);
    if (flowing) return flowing;
    const placed = boxes.get(element);
    if (!placed) return null;
    return typeof placed === 'function' ? placed() : placed;
  };

  const measure = NATIVE_RECT;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect(this: Element) {
    const box = boxOf(this);
    return box ? toRect(box) : measure.call(this);
  });

  // The offset parent is the nearest ancestor with a box.
  const offsetParentOf = (element: Element): HTMLElement | null => {
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (boxOf(node)) return node;
    }
    return null;
  };
  const measured = (element: Element, value: number | undefined, fallback: (() => unknown) | undefined) => {
    if (value !== undefined) return value;
    return fallback ? Number(fallback.call(element)) : 0;
  };
  const spyOffset = (name: 'offsetWidth' | 'offsetHeight' | 'offsetLeft' | 'offsetTop',
    read: (element: HTMLElement, box: Box | null) => number | undefined) => {
    const fallback = NATIVE_GETTERS.get(name);
    vi.spyOn(HTMLElement.prototype, name, 'get').mockImplementation(function get(this: HTMLElement) {
      return measured(this, read(this, boxOf(this)), fallback);
    });
  };
  const spySize = (name: keyof Omit<Measures, 'offsetWidth' | 'offsetHeight'>) => {
    const fallback = NATIVE_GETTERS.get(name);
    vi.spyOn(Element.prototype, name, 'get').mockImplementation(function get(this: Element) {
      return measured(this, measures.get(this)?.[name] ?? boxOf(this)?.[name.endsWith('Width') ? 'width' : 'height'], fallback);
    });
  };
  const offsetFrom = (element: HTMLElement, box: Box | null, side: 'left' | 'top') => {
    if (!box) return undefined;
    const parent = offsetParentOf(element);
    const parentBox = parent ? boxOf(parent) : null;
    return box[side] - (parentBox ? parentBox[side] : 0);
  };
  spyOffset('offsetWidth', (element, box) => measures.get(element)?.offsetWidth ?? box?.width);
  spyOffset('offsetHeight', (element, box) => measures.get(element)?.offsetHeight ?? box?.height);
  spyOffset('offsetLeft', (element, box) => offsetFrom(element, box, 'left'));
  spyOffset('offsetTop', (element, box) => offsetFrom(element, box, 'top'));
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function offsetParent(this: HTMLElement) {
    return offsetParentOf(this);
  });
  spySize('clientWidth');
  spySize('clientHeight');
  spySize('scrollWidth');
  spySize('scrollHeight');

  // Elements under the point, topmost first: deeper elements and, at equal
  // depth, the ones placed last win, as later siblings paint on top.
  const at = (x: number, y: number): Element[] => {
    const candidates = Array.from(new Set([...boxes.keys(), ...flows.flatMap(flowed)]));
    return candidates
      .map((element, order) => ({ element, order, box: boxOf(element) }))
      .filter(({ element, box }) => element.isConnected && box && contains(box, x, y))
      .sort((a, b) => (depthOf(b.element) - depthOf(a.element)) || (b.order - a.order))
      .map(({ element }) => element);
  };
  const hadElementFromPoint = Object.hasOwn(document, 'elementFromPoint');
  const hadElementsFromPoint = Object.hasOwn(document, 'elementsFromPoint');
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: (x: number, y: number) => at(x, y)[0] || document.body
  });
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: (x: number, y: number) => [...at(x, y), document.body, document.documentElement]
  });
  onTestFinished(() => {
    if (!hadElementFromPoint) Reflect.deleteProperty(document, 'elementFromPoint');
    if (!hadElementsFromPoint) Reflect.deleteProperty(document, 'elementsFromPoint');
  });

  return {
    place(element, box) {
      boxes.set(element, typeof box === 'function' ? box : { ...box });
      return element;
    },
    row(elements, { left, top, width, height, gap = 0 }) {
      return elements.map((element, index) => {
        const box = { left: left + index * (width + gap), top, width, height };
        boxes.set(element, box);
        return toRect(box);
      });
    },
    flow(container, selector, row) {
      const flow = { container, selector, row: { ...row } };
      flows.push(flow);
      return flowed(flow).map((element) => element.getBoundingClientRect());
    },
    measure(element, values) {
      measures.set(element, { ...measures.get(element), ...values });
      return element;
    },
    viewport({ width, height }) {
      if (width !== undefined) vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
      if (height !== undefined) vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(height);
    },
    center(element) {
      const rect = element.getBoundingClientRect();
      return [rect.left + rect.width / 2, rect.top + rect.height / 2];
    }
  };
}

export { createLayout };
export type { Box, Layout, Measures, Row };
