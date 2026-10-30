// Element lookups for tests. Each fails the test, with the selector or name
// it looked for, when the element is missing or not of the expected kind.
import { isHtmlElement, isHtmlTag, isSvgElement } from '../../src/shared/dom-guards';

type TagName = keyof HTMLElementTagNameMap;

export function expectElement(value: unknown, name = 'value'): HTMLElement {
  if (!(value instanceof Node) || !isHtmlElement(value)) {
    throw new Error(`Expected ${name} to be an HTML element.`);
  }
  return value;
}

export function expectTag<K extends TagName>(value: unknown, tag: K, name = 'value'): HTMLElementTagNameMap[K] {
  if (!(value instanceof Node) || !isHtmlTag(value, tag)) {
    throw new Error(`Expected ${name} to be a <${tag}> element.`);
  }
  return value;
}

export function expectSvg(value: unknown, name = 'value'): SVGElement {
  if (!(value instanceof Node) || !isSvgElement(value)) {
    throw new Error(`Expected ${name} to be an SVG element.`);
  }
  return value;
}

export function getElement(root: ParentNode, selector: string): HTMLElement {
  return expectElement(root.querySelector(selector), selector);
}

export function getTag<K extends TagName>(root: ParentNode, selector: string, tag: K): HTMLElementTagNameMap[K] {
  return expectTag(root.querySelector(selector), tag, selector);
}

export function getElements(root: ParentNode, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll(selector), (element) => expectElement(element, selector));
}

export function getTags<K extends TagName>(root: ParentNode, selector: string, tag: K): Array<HTMLElementTagNameMap[K]> {
  return Array.from(root.querySelectorAll(selector), (element) => expectTag(element, tag, selector));
}

export function getSvgs(root: ParentNode, selector: string): SVGElement[] {
  return Array.from(root.querySelectorAll(selector), (element) => expectSvg(element, selector));
}

export function getElementById(id: string): HTMLElement {
  return expectElement(document.getElementById(id), `#${id}`);
}

// A value the test needs to be there, such as a controller a factory made.
export function required<T>(value: T | null | undefined, name = 'value'): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${name} to be present.`);
  }
  return value;
}
