'use strict';

// Parses CSS with the browser's CSS object model (JSDOM's), so a check reads
// the declarations a rule really ends up with instead of matching the
// stylesheet's text: comments, whitespace and declaration order stop
// mattering, and a later declaration in the same rule wins as it does in a
// browser. Values read as written (see markDeclarations), so a declaration
// JSDOM cannot parse still counts, valid in Chrome or not.

const { JSDOM, VirtualConsole } = require('jsdom');

// A selector list split at its top-level commas (not those inside :is()).
function selectorsOf(rule) {
  const text = String(rule.selectorText || '');
  const parts = [];
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
  return parts.map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function normalizeSelector(selector) {
  return String(selector).replace(/\s+/g, ' ').trim();
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

function markDeclarations(cssText, values) {
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

// A rule's declarations with each one's value as written: what JSDOM parsed
// (with the longhands it expands shorthands into), overridden by the marked
// declarations. Reads like a CSSStyleDeclaration.
function declaredStyle(style, values) {
  const declarations = new Map();
  for (let index = 0; index < style.length; index += 1) {
    const name = style[index];
    if (!name.startsWith(MARKER)) {
      declarations.set(name, { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) });
    }
  }
  for (let index = 0; index < style.length; index += 1) {
    const name = style[index];
    if (name.startsWith(MARKER)) {
      declarations.set(name.slice(MARKER.length), {
        value: values[Number(style.getPropertyValue(name).trim())],
        priority: style.getPropertyPriority(name)
      });
    }
  }
  const names = Array.from(declarations.keys());
  return Object.assign(names.slice(), {
    getPropertyValue(name) {
      return declarations.has(name) ? declarations.get(name).value : '';
    },
    getPropertyPriority(name) {
      return declarations.has(name) ? declarations.get(name).priority : '';
    },
    get cssText() {
      return names.map((name) => {
        const { value, priority } = declarations.get(name);
        return `${name}: ${value}${priority ? ' !important' : ''};`;
      }).join(' ');
    }
  });
}

function conditionOf(rule) {
  if (rule.media && typeof rule.media.mediaText === 'string') return rule.media.mediaText;
  return String(rule.conditionText || '');
}

// The rules of a parsed stylesheet, flattened. Each entry is
// { selectors, style, conditions } where conditions lists the @media and
// @supports conditions the rule is nested in.
function flatten(cssRules, conditions, values) {
  return Array.from(cssRules).flatMap((rule) => {
    if (rule.cssRules && !rule.selectorText) {
      return flatten(rule.cssRules, conditions.concat(conditionOf(rule)), values);
    }
    if (!rule.style) return [];
    return [{ selectors: selectorsOf(rule), style: declaredStyle(rule.style, values), conditions }];
  });
}

function parseCss(cssText) {
  // @import rules are kept as rules but never fetched; the console stays quiet
  // about the URLs it cannot resolve.
  const dom = new JSDOM('<!doctype html><html><head></head></html>', { virtualConsole: new VirtualConsole() });
  const style = dom.window.document.createElement('style');
  const values = [];
  style.textContent = markDeclarations(String(cssText || ''), values);
  dom.window.document.head.appendChild(style);
  const entries = flatten(style.sheet.cssRules, [], values);
  const matching = (selector, condition) => {
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
    // would for rules of equal specificity. Without `condition` only top-level
    // rules count; pass a condition string or RegExp for rules inside an
    // @media / @supports block, or '*' for all.
    rule(selector, condition) {
      const found = matching(selector, condition);
      if (!found.length) return null;
      const merged = {};
      const priorities = {};
      found.forEach((entry) => {
        for (let index = 0; index < entry.style.length; index += 1) {
          const name = entry.style[index];
          merged[name] = entry.style.getPropertyValue(name)
            .replace(/\s+/g, ' ')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .trim();
          priorities[name] = entry.style.getPropertyPriority(name);
        }
      });
      return {
        has(name) {
          return Object.hasOwn(merged, name);
        },
        // The declared value, without !important (see priority()).
        get(name) {
          return Object.hasOwn(merged, name) ? merged[name] : null;
        },
        priority(name) {
          return Object.hasOwn(priorities, name) ? priorities[name] : null;
        },
        names() {
          return Object.keys(merged);
        }
      };
    },
    // An @keyframes rule's frames as { '0%': declarations, ... }
    // (from/to read as 0%/100%), or null.
    keyframes(name) {
      const find = (rules) => {
        for (const rule of Array.from(rules)) {
          if (rule.name === name && rule.cssRules) return rule;
          if (rule.cssRules && !rule.name) {
            const nested = find(rule.cssRules);
            if (nested) return nested;
          }
        }
        return null;
      };
      const found = find(style.sheet.cssRules);
      if (!found) return null;
      return Object.fromEntries(Array.from(found.cssRules).map((frame) => [
        String(frame.keyText).replace(/^from$/, '0%').replace(/^to$/, '100%'),
        declaredStyle(frame.style, values)
      ]));
    },
    // Every selector the stylesheet declares, top level or nested.
    selectors() {
      return entries.flatMap((entry) => entry.selectors);
    },
    // The conditions of the @media / @supports blocks declaring `selector`.
    conditionsFor(selector) {
      const wanted = normalizeSelector(selector);
      return entries.filter((entry) => entry.selectors.includes(wanted)).flatMap((entry) => entry.conditions);
    }
  };
}

// A page's styles as the page loads them: its <style> blocks and its own
// stylesheets, inlined at their links by readPageSource.
function parsePageCss(relativePath) {
  const { readPageSource } = require('./page-source');
  const dom = new JSDOM(readPageSource(relativePath), { virtualConsole: new VirtualConsole() });
  return parseCss(Array.from(dom.window.document.querySelectorAll('style')).map((style) => style.textContent).join('\n'));
}

module.exports = { parseCss, parsePageCss };
