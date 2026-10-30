import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Callbacks keep the parameters of the signature they implement, a catch block
// often only needs to know that something threw, and `{ key: _omit, ...rest }`
// is how the code drops a key from a copy.
const unusedVarsOptions = {
  args: 'none',
  caughtErrors: 'none',
  ignoreRestSiblings: true,
  destructuredArrayIgnorePattern: '^_'
};

const extensionGlobals = {
  ...globals.browser,
  ...globals.webextensions
};

// src/ layers, lowest first: domain (pure logic), platform (browser and
// extension API wrappers), shared (UI and page runtime used by several
// surfaces), then the surfaces themselves. A module may import its own layer
// and the ones below it; a surface may not import another surface.
const SURFACES = ['background', 'content', 'overlay', 'newtab', 'options', 'onboarding', 'popup'];

function importsFrom(directories) {
  return {
    regex: `(?:^|/)(?:${directories.join('|')})(?:/|$)`,
    message: 'This layer may not import from there; see the layers in eslint.config.mjs.'
  };
}

function restrictImports(directories) {
  return { 'no-restricted-imports': ['error', { patterns: [importsFrom(directories)] }] };
}

// What domain code may not reach for: browser and extension globals, directly
// or through globalThis, and DOM work on any object handed to it. Timers and
// network requests are I/O too; platform/ wraps them. crypto stays allowed:
// its random values work the same in every runtime.
const DOMAIN_GLOBALS = [
  'chrome', 'browser', 'document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'location',
  'self', 'HTMLElement', 'Element', 'Node', 'getComputedStyle', 'requestAnimationFrame',
  'cancelAnimationFrame', 'matchMedia', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'Image', 'FileReader', 'fetch', 'indexedDB', 'caches', 'importScripts', 'DOMParser', 'screen', 'history',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'AbortController', 'XMLHttpRequest',
  'WebSocket', 'Worker', 'BroadcastChannel'
];
const DOM_TYPES = [
  'Node', 'Element', 'HTMLElement', 'HTML\\w+Element', 'SVGElement', 'SVG\\w+Element', 'Document',
  'DocumentFragment', 'ShadowRoot', 'Window', 'EventTarget', 'Event', 'UIEvent', 'KeyboardEvent', 'MouseEvent',
  'PointerEvent', 'FocusEvent', 'InputEvent', 'CompositionEvent', 'WheelEvent', 'DragEvent', 'ClipboardEvent',
  'TouchEvent', 'CustomEvent', 'DOMRect', 'CSSStyleDeclaration'
];
const DOM_MEMBERS = [
  'createElement', 'createElementNS', 'createTextNode', 'createDocumentFragment', 'querySelector',
  'querySelectorAll', 'getElementById', 'getElementsByClassName', 'addEventListener', 'removeEventListener',
  'appendChild', 'insertBefore', 'removeChild', 'replaceChildren', 'classList', 'setAttribute',
  'removeAttribute', 'innerHTML', 'getBoundingClientRect', 'attachShadow', 'getRootNode', 'ownerDocument',
  'defaultView', 'scrollIntoView'
];

// An element type given to a query asserts it; the lookups in
// src/shared/dom-lookup.ts (and tests/fakes/dom.ts) check it instead.
const TYPE_ASSERTING_QUERY = {
  selector: 'CallExpression[callee.property.name=/^(?:querySelector|querySelectorAll|closest)$/][typeArguments]',
  message: 'Look the element up through a guarded lookup instead of asserting its type.'
};

// Markup never travels as a string: views render JSX, icons are <RemixIcon>,
// SVG is described as data (shared/ui/svg-tree.ts), and code outside React
// builds elements with createElement.
const HTML_STRING_SINKS = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML'], Property[key.name='dangerouslySetInnerHTML']",
    message: 'Render the content as JSX instead of injecting markup.'
  },
  {
    selector: "AssignmentExpression > MemberExpression.left[property.name=/^(?:innerHTML|outerHTML)$/]",
    message: 'Build the nodes with createElement (or svg-tree) instead of assigning markup.'
  },
  {
    selector: "CallExpression[callee.property.name=/^(?:insertAdjacentHTML|setHTMLUnsafe|createContextualFragment)$/], CallExpression[callee.object.name='document'][callee.property.name=/^(?:write|writeln)$/]",
    message: 'Build the nodes with createElement (or svg-tree) instead of parsing markup.'
  }
];

export default tseslint.config(
  {
    ignores: [
      'build/',
      'dist/',
      'coverage/',
      'node_modules/',
      'src/react/',
      'assets/vendor/',
      '.claude/',
      // Local work output and scratch data, ignored by git as well.
      'output/',
      '.tmp/',
      '.codex-artifacts/',
      '.worktrees/'
    ]
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Input sanitizers match control characters on purpose.
      'no-control-regex': 'off',
      // `let match = null;` and the like give a variable its type up front even
      // when every path assigns it before reading.
      'no-useless-assignment': 'off'
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      sourceType: 'module',
      globals: extensionGlobals
    }
  },
  {
    files: ['src/background/**/*.ts'],
    languageOptions: {
      globals: globals.serviceworker
    }
  },
  {
    // Node tooling. Tests also hand functions to the pages they drive, so
    // they see the browser's globals too.
    files: ['scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...extensionGlobals
      }
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node
    }
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', unusedVarsOptions],
      // Types are narrowed, never asserted.
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-syntax': ['error', TYPE_ASSERTING_QUERY, ...HTML_STRING_SINKS]
    }
  },
  {
    // Modules stay small enough to read whole: one reason to change, short
    // functions with few paths through them, and no import cycles.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/**/*.generated.ts'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/extensions': ['.ts', '.tsx'],
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: 'tsconfig.json' })]
    },
    rules: {
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 15],
      'import-x/no-cycle': 'warn'
    }
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['warn', { max: 800, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    // Tests run in Node and hand functions to the documents they drive.
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, ...extensionGlobals }
    }
  },
  {
    // A function run in a page's main world is serialized on its own by
    // executeScript, so its helpers live inside its body; each such module
    // holds one function (two short ones at most), so it still reads whole.
    files: ['src/**/*.main-world.ts'],
    rules: { 'max-lines-per-function': 'off' }
  },
  {
    // Globals are declared with var, the only form globalThis picks up.
    files: ['src/types/**/*.d.ts'],
    rules: { 'no-var': 'off' }
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      ...restrictImports(['platform', 'shared', 'react', ...SURFACES]),
      'no-restricted-globals': ['error', ...DOMAIN_GLOBALS],
      'no-restricted-syntax': ['error', ...HTML_STRING_SINKS, {
        selector: `MemberExpression[property.name=/^(?:${DOM_MEMBERS.join('|')})$/]`,
        message: 'Domain code does no DOM work; move this to shared/ or a surface.'
      }, {
        selector: `MemberExpression[object.name='globalThis'][property.name=/^(?:${DOMAIN_GLOBALS.join('|')})$/]`,
        message: 'Domain code reaches no browser API; take it as a parameter or move this to platform/.'
      }, {
        // Typed code that handles the DOM names its types.
        selector: `TSTypeReference[typeName.name=/^(?:${DOM_TYPES.join('|')})$/]`,
        message: 'Domain code does no DOM work; move this to shared/ or a surface.'
      }]
    }
  },
  {
    files: ['src/platform/**/*.ts'],
    rules: restrictImports(['shared', 'react', ...SURFACES])
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: restrictImports(SURFACES)
  },
  ...SURFACES.map((surface) => ({
    files: [`src/${surface}/**/*.ts`],
    rules: restrictImports(SURFACES.filter((other) => other !== surface))
  })),
  {
    files: ['src/**/react/**/*.{ts,tsx}', 'tests/**/*.tsx'],
    extends: [tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: extensionGlobals
    },
    rules: {
      // The classic hook rules. The plugin's other recommended rules check
      // code for the React Compiler, which Lumno does not use.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', unusedVarsOptions]
    }
  }
);
