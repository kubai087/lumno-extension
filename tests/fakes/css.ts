// Stylesheets as the browser reads them. A check reads the declarations a
// rule ends up with through the document's CSS object model instead of
// matching the stylesheet's text: comments, whitespace and declaration order
// stop mattering, and a later declaration in the same rule wins as it does in
// a browser. Values read as written (see markDeclarations), so a declaration
// JSDOM cannot parse still counts, valid in Chrome or not. Token references
// (var(--lumno-*)) read as their light-theme values.
import { readFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

const TOKENS_PATH = 'src/shared/tokens.css';
let lightTokens: Map<string, string> | null = null;

// Light-theme token values from the :root block of src/shared/tokens.css.
export function readLightTokens(): Map<string, string> {
  if (lightTokens) {
    return lightTokens;
  }
  const rootBlock = readRepoFile(TOKENS_PATH).match(/:root\s*\{([\s\S]*?)\n\}/);
  const tokens = new Map<string, string>();
  for (const match of rootBlock ? rootBlock[1].matchAll(/(--lumno-[\w-]+)\s*:\s*([^;]+);/g) : []) {
    tokens.set(match[1], match[2].replace(/\s+/g, ' ').trim());
  }
  lightTokens = tokens;
  return tokens;
}

// Checks assert effective values (for example "160ms"), so token references
// resolve to their light value before matching. Fallbacks resolve the same way.
export function resolveLumnoTokens(css: string): string {
  const tokens = readLightTokens();
  return css.replace(/var\((--lumno-[\w-]+)(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (match, name: string, fallback?: string) => {
    const token = tokens.get(name);
    if (token !== undefined) {
      return token;
    }
    return fallback !== undefined ? fallback.trim() : match;
  });
}

// Page stylesheets split into parts the page links in order. A check written
// against the whole stylesheet reads the parts joined, in that order.
export const SPLIT_STYLESHEETS: Readonly<Record<string, readonly string[]>> = {
  'src/newtab/newtab.css': [
    'page', 'shortcuts', 'top-content', 'dock-and-entry', 'sections', 'bookmarks-topbar',
    'bookmark-cascade', 'recent-cards', 'notices-and-suggestions', 'corner-controls',
    'wallpaper-ink', 'appearance-panel', 'appearance-options', 'suggestions', 'page-overrides'
  ].map((name) => `src/newtab/styles/${name}.css`),
  'src/onboarding/onboarding.css': [
    'shell', 'page-copy', 'interactions', 'dark-theme', 'responsive', 'visual-stage',
    'newtab-preview', 'newtab-preview-sections', 'site-search-demo', 'feature-cards',
    'browser-window', 'overlay-demo', 'cursor-layer'
  ].map((name) => `src/onboarding/styles/${name}.css`)
};

// A stylesheet's source as written, joining a split stylesheet's parts.
export function readStylesheetSource(relativePath: string): string {
  return (SPLIT_STYLESHEETS[relativePath] || [relativePath]).map(readRepoFile).join('\n');
}

export function readStylesheet(relativePath: string): string {
  return resolveLumnoTokens(readStylesheetSource(relativePath));
}

const PAGE_STYLESHEETS: Readonly<Record<string, string>> = {
  'newtab.html': 'src/newtab/newtab.css',
  'src/options/options.html': 'src/options/options.css',
  'src/onboarding/onboarding.html': 'src/onboarding/onboarding.css'
};

// A page's HTML with its own stylesheet inlined where it is linked, so a
// check sees the markup and the page's styles in document order.
export function readPageSource(relativePath: string): string {
  const normalized = relative(REPO_ROOT, resolve(REPO_ROOT, relativePath)).split('\\').join('/');
  const html = readRepoFile(normalized);
  const stylesheet = PAGE_STYLESHEETS[normalized];
  if (!stylesheet) {
    return html;
  }
  const pageDir = normalized === 'newtab.html' ? 'src/newtab' : posix.dirname(normalized);
  // A split stylesheet is linked part by part; each part is inlined at its link.
  return (SPLIT_STYLESHEETS[stylesheet] || [stylesheet]).reduce((source, file) => {
    const href = posix.relative(pageDir, file);
    const css = resolveLumnoTokens(readRepoFile(file)).replace(/\n$/, '');
    return source.replace(
      new RegExp(`^([ \\t]*)<link rel="stylesheet" href="${href.replace(/[.]/g, '\\.')}" />$`, 'm'),
      (_match, indent: string) => [
        `${indent}<style>`,
        ...css.split('\n').map((line) => (line ? `${indent}  ${line}` : line)),
        `${indent}</style>`
      ].join('\n')
    );
  }, html);
}

// A selector list split at its top-level commas (not those inside :is()).
function splitSelectors(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map(normalizeSelector).filter(Boolean);
}

function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim();
}

// JSDOM's CSS object model drops declarations its parser does not know
// (`-webkit-user-drag`, `top: env(...)`, `content: attr(...)`, a gradient
// stop in light-dark()) and re-serializes the rest (`0` reads `0px`, a hex
// colour `rgb(...)`, a custom property loses the space after its commas).
// Checks read a declaration as the stylesheet writes it, so after each
// declaration the parsed text gets a marker custom property (JSDOM keeps any
// custom property) whose value indexes the declaration's own text;
// declaredStyle() reads them back.
const MARKER = '--lumno-declared-';

function markDeclarations(cssText: string, values: string[]): string {
  let output = '';
  let statement = '';
  let braces = 0;
  let parens = 0;
  const end = () => {
    const declaration = braces > 0 && /^\s*(-?-?[A-Za-z_][\w-]*)\s*:([\s\S]*)$/.exec(statement);
    output += statement;
    if (declaration) {
      const important = /\s*!\s*important\s*$/i.test(declaration[2]);
      values.push(declaration[2].replace(/\s*!\s*important\s*$/i, '').trim());
      output += `;${MARKER}${declaration[1]}: ${values.length - 1}${important ? ' !important' : ''}`;
    }
    statement = '';
  };
  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index];
    if (char === '/' && cssText[index + 1] === '*') {
      const close = cssText.indexOf('*/', index + 2);
      index = close < 0 ? cssText.length : close + 1;
    } else if (char === '"' || char === "'") {
      let close = index + 1;
      while (close < cssText.length && cssText[close] !== char) close += cssText[close] === '\\' ? 2 : 1;
      statement += cssText.slice(index, close + 1);
      index = close;
    } else if (char === '(' || char === ')') {
      parens += char === '(' ? 1 : -1;
      statement += char;
    } else if (parens === 0 && (char === ';' || char === '}')) {
      end();
      output += char;
      if (char === '}') braces -= 1;
    } else if (parens === 0 && char === '{') {
      output += statement + char;
      statement = '';
      braces += 1;
    } else {
      statement += char;
    }
  }
  end();
  return output;
}

interface Declaration {
  value: string;
  priority: string;
}

// A rule's declarations, each with its value as written.
export interface DeclaredStyle {
  readonly names: readonly string[];
  getPropertyValue(name: string): string;
  getPropertyPriority(name: string): string;
  readonly cssText: string;
}

// What JSDOM parsed (with the longhands it expands shorthands into),
// overridden by the marked declarations.
function declaredStyle(style: CSSStyleDeclaration, values: readonly string[]): DeclaredStyle {
  const declarations = new Map<string, Declaration>();
  const names = Array.from({ length: style.length }, (_, index) => style[index]);
  names.filter((name) => !name.startsWith(MARKER)).forEach((name) => {
    declarations.set(name, { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) });
  });
  names.filter((name) => name.startsWith(MARKER)).forEach((name) => {
    declarations.set(name.slice(MARKER.length), {
      value: values[Number(style.getPropertyValue(name).trim())],
      priority: style.getPropertyPriority(name)
    });
  });
  const declared = Array.from(declarations.keys());
  return {
    names: declared,
    getPropertyValue: (name) => declarations.get(name)?.value ?? '',
    getPropertyPriority: (name) => declarations.get(name)?.priority ?? '',
    get cssText() {
      return Array.from(declarations, ([name, { value, priority }]) => `${name}: ${value}${priority ? ' !important' : ''};`).join(' ');
    }
  };
}

interface CssEntry {
  selectors: string[];
  style: DeclaredStyle;
  // The @media and @supports conditions the rule is nested in.
  conditions: string[];
}

function isRuleList(value: unknown): value is CSSRuleList {
  return typeof value === 'object' && value !== null && 'length' in value && typeof value.length === 'number';
}

function isStyleDeclaration(value: unknown): value is CSSStyleDeclaration {
  return typeof value === 'object' && value !== null && 'getPropertyValue' in value;
}

function childRules(rule: CSSRule): CSSRuleList | null {
  return 'cssRules' in rule && isRuleList(rule.cssRules) ? rule.cssRules : null;
}

function conditionOf(rule: CSSRule): string {
  if ('media' in rule && rule.media instanceof Object && 'mediaText' in rule.media && typeof rule.media.mediaText === 'string') {
    return rule.media.mediaText;
  }
  return 'conditionText' in rule ? String(rule.conditionText || '') : '';
}

function styleOf(rule: CSSRule): CSSStyleDeclaration | null {
  return 'style' in rule && isStyleDeclaration(rule.style) ? rule.style : null;
}

function flatten(rules: CSSRuleList, conditions: string[], values: readonly string[]): CssEntry[] {
  return Array.from(rules).flatMap((rule) => {
    const selectorText = 'selectorText' in rule ? String(rule.selectorText || '') : '';
    const children = childRules(rule);
    if (children && !selectorText) {
      return flatten(children, conditions.concat(conditionOf(rule)), values);
    }
    const style = styleOf(rule);
    return style ? [{ selectors: splitSelectors(selectorText), style: declaredStyle(style, values), conditions }] : [];
  });
}

// One selector's declarations, merged.
export interface CssRule {
  has(name: string): boolean;
  // The declared value, without !important (see priority()).
  get(name: string): string | null;
  priority(name: string): string | null;
  names(): string[];
}

// Which rules count: undefined for top-level rules only, a condition string
// or RegExp for rules inside an @media / @supports block, or '*' for all.
export type CssCondition = string | RegExp | undefined;

export interface ParsedCss {
  readonly entries: readonly CssEntry[];
  rule(selector: string, condition?: CssCondition): CssRule | null;
  keyframes(name: string): Record<string, DeclaredStyle> | null;
  selectors(): string[];
  conditionsFor(selector: string): string[];
}

function findKeyframes(rules: CSSRuleList, name: string): CSSRuleList | null {
  for (const rule of Array.from(rules)) {
    const children = childRules(rule);
    const ruleName = 'name' in rule ? rule.name : undefined;
    if (children && ruleName === name) return children;
    if (children && !ruleName) {
      const nested = findKeyframes(children, name);
      if (nested) return nested;
    }
  }
  return null;
}

export function parseCss(cssText: string): ParsedCss {
  // Parsed in the test's document and taken out again at once, so the page
  // under test never sees it. @import rules stay rules and are never fetched.
  const style = document.createElement('style');
  const values: string[] = [];
  style.textContent = markDeclarations(cssText, values);
  document.head.appendChild(style);
  const sheet = style.sheet;
  style.remove();
  if (!sheet) {
    throw new Error('The stylesheet did not parse.');
  }
  const entries = flatten(sheet.cssRules, [], values);
  const matching = (selector: string, condition: CssCondition) => {
    const wanted = normalizeSelector(selector);
    return entries.filter((entry) => {
      if (!entry.selectors.includes(wanted)) return false;
      if (condition === undefined) return entry.conditions.length === 0;
      if (condition === '*') return true;
      return entry.conditions.some((text) => (condition instanceof RegExp ? condition.test(text) : text === condition));
    });
  };
  return {
    entries,
    // The declarations for `selector`, merged in source order as the cascade
    // would for rules of equal specificity.
    rule(selector, condition) {
      const found = matching(selector, condition);
      if (!found.length) return null;
      const merged = new Map<string, string>();
      const priorities = new Map<string, string>();
      found.forEach((entry) => {
        entry.style.names.forEach((name) => {
          merged.set(name, entry.style.getPropertyValue(name)
            .replace(/\s+/g, ' ')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .trim());
          priorities.set(name, entry.style.getPropertyPriority(name));
        });
      });
      return {
        has: (name) => merged.has(name),
        get: (name) => merged.get(name) ?? null,
        priority: (name) => priorities.get(name) ?? null,
        names: () => Array.from(merged.keys())
      };
    },
    // An @keyframes rule's frames as { '0%': declarations, ... }
    // (from/to read as 0%/100%), or null.
    keyframes(name) {
      const frames = findKeyframes(sheet.cssRules, name);
      if (!frames) return null;
      return Object.fromEntries(Array.from(frames).flatMap((frame) => {
        const frameStyle = styleOf(frame);
        const keyText = 'keyText' in frame ? String(frame.keyText) : '';
        return frameStyle
          ? [[keyText.replace(/^from$/, '0%').replace(/^to$/, '100%'), declaredStyle(frameStyle, values)]]
          : [];
      }));
    },
    // Every selector the stylesheet declares, top level or nested.
    selectors: () => entries.flatMap((entry) => entry.selectors),
    // The conditions of the @media / @supports blocks declaring `selector`.
    conditionsFor(selector) {
      const wanted = normalizeSelector(selector);
      return entries.filter((entry) => entry.selectors.includes(wanted)).flatMap((entry) => entry.conditions);
    }
  };
}

// A page's styles as the page loads them: its <style> blocks and its own
// stylesheets, inlined at their links by readPageSource.
export function parsePageCss(relativePath: string): ParsedCss {
  const doc = new DOMParser().parseFromString(readPageSource(relativePath), 'text/html');
  return parseCss(Array.from(doc.querySelectorAll('style'), (style) => style.textContent || '').join('\n'));
}

// A stylesheet of the repository, parsed with its tokens resolved.
export function parseStylesheet(relativePath: string): ParsedCss {
  return parseCss(readStylesheet(relativePath));
}
