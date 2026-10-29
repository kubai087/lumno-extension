const fs = require('fs');
const path = require('path');

const DEFAULT_ROOTS = ['src'];
const INCLUDED_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.html', '.css']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git']);
const STYLE_DEBT_ALLOWLIST = [
  {
    file: 'src/overlay/lifecycle.ts',
    reason: 'overlay viewport and zoom synchronization',
    setPropertyImportant: true
  },
  {
    file: 'src/newtab/dom/favicon-view.ts',
    reason: 'favicon fallback display and optical alignment until class-rendered fallback is verified',
    important: true,
    setPropertyImportant: true
  },
  {
    file: 'src/overlay/favicon-view.ts',
    reason: 'favicon fallback display and optical alignment until class-rendered fallback is verified',
    setPropertyImportant: true
  }
];

function walk(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    return INCLUDED_EXTENSIONS.has(path.extname(root)) ? [root] : [];
  }
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    if (IGNORED_DIRS.has(entry.name)) {
      return;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      return;
    }
    // Component tests sit next to their components; their copy is fixture text.
    if (entry.isFile() && INCLUDED_EXTENSIONS.has(path.extname(entry.name)) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  });
  return files;
}

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function countSetPropertyImportant(source) {
  return countMatches(
    source,
    /\.style\.setProperty\s*\([\s\S]*?['"]important['"][\s\S]*?\)/g
  );
}

function normalizePath(value) {
  return path.normalize(value);
}

function countMetric(source, metric) {
  if (metric === 'important') {
    return countMatches(source, /!important/g);
  }
  if (metric === 'setPropertyImportant') {
    return countSetPropertyImportant(source);
  }
  return 0;
}

function countAllowlistedMetric(file, source, metric) {
  return STYLE_DEBT_ALLOWLIST
    .filter((rule) => normalizePath(rule.file) === file && rule[metric])
    .reduce((total, rule) => {
      if (rule[metric] === true) {
        return total + countMetric(source, metric);
      }
      return total + countMatches(source, rule[metric]);
    }, 0);
}

function auditFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const important = countMatches(source, /!important/g);
  const setPropertyImportant = countSetPropertyImportant(source);
  const allowlistedImportant = countAllowlistedMetric(file, source, 'important');
  const allowlistedSetPropertyImportant = countAllowlistedMetric(file, source, 'setPropertyImportant');
  return {
    file,
    lines: source.split(/\r?\n/).length,
    important,
    setPropertyImportant,
    allowlistedImportant,
    allowlistedSetPropertyImportant,
    cssText: countMatches(source, /\.style\.cssText/g),
    styleWrites: countMatches(source, /\.style\./g),
    createElement: countMatches(source, /createElement\s*\(/g)
  };
}

function printTable(rows) {
  rows.forEach((row) => {
    console.log(
      `${row.file} lines=${row.lines}` +
      ` important=${row.important}` +
      ` setPropertyImportant=${row.setPropertyImportant}` +
      ` cssText=${row.cssText}` +
      ` styleWrites=${row.styleWrites}` +
      ` createElement=${row.createElement}`
    );
  });
}

function printTotals(rows) {
  const totals = rows.reduce((next, row) => ({
    files: next.files + 1,
    lines: next.lines + row.lines,
    important: next.important + row.important,
    setPropertyImportant: next.setPropertyImportant + row.setPropertyImportant,
    allowlistedImportant: next.allowlistedImportant + row.allowlistedImportant,
    allowlistedSetPropertyImportant: next.allowlistedSetPropertyImportant + row.allowlistedSetPropertyImportant,
    cssText: next.cssText + row.cssText,
    styleWrites: next.styleWrites + row.styleWrites,
    createElement: next.createElement + row.createElement
  }), {
    files: 0,
    lines: 0,
    important: 0,
    setPropertyImportant: 0,
    allowlistedImportant: 0,
    allowlistedSetPropertyImportant: 0,
    cssText: 0,
    styleWrites: 0,
    createElement: 0
  });
  console.log(
    `TOTAL files=${totals.files}` +
    ` lines=${totals.lines}` +
    ` important=${totals.important}` +
    ` setPropertyImportant=${totals.setPropertyImportant}` +
    ` cssText=${totals.cssText}` +
    ` styleWrites=${totals.styleWrites}` +
    ` createElement=${totals.createElement}`
  );
  console.log(
    `TOTAL_ALLOWLIST important=${totals.allowlistedImportant}` +
    ` setPropertyImportant=${totals.allowlistedSetPropertyImportant}`
  );
  console.log(
    `TOTAL_REMAINING important=${totals.important - totals.allowlistedImportant}` +
    ` setPropertyImportant=${totals.setPropertyImportant - totals.allowlistedSetPropertyImportant}`
  );
}

function printAllowlist(rows) {
  const rowMap = new Map(rows.map((row) => [row.file, row]));
  const activeRules = STYLE_DEBT_ALLOWLIST
    .map((rule) => {
      const file = normalizePath(rule.file);
      const row = rowMap.get(file);
      if (!row) {
        return null;
      }
      return {
        file,
        reason: rule.reason,
        important: rule.important ? row.allowlistedImportant : 0,
        setPropertyImportant: rule.setPropertyImportant ? row.allowlistedSetPropertyImportant : 0
      };
    })
    .filter(Boolean)
    .filter((rule) => rule.important > 0 || rule.setPropertyImportant > 0);
  if (activeRules.length === 0) {
    return;
  }
  console.log('Allowlisted style debt:');
  activeRules.forEach((rule) => {
    console.log(
      `${rule.file}` +
      ` important=${rule.important}` +
      ` setPropertyImportant=${rule.setPropertyImportant}` +
      ` reason=${JSON.stringify(rule.reason)}`
    );
  });
}

const roots = process.argv.slice(2);
const scanRoots = roots.length > 0 ? roots : DEFAULT_ROOTS;
const rows = scanRoots
  .flatMap(walk)
  .map((file) => path.normalize(file))
  .filter((file, index, list) => list.indexOf(file) === index)
  .sort()
  .map(auditFile);

printTable(rows);
printAllowlist(rows);
printTotals(rows);
