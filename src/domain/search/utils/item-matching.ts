// Where a query term appears in a page: its title, the labels of its host
// that name the site, and its path. Whether a page matches, how it scores
// and how many query terms it covers all read this one set of rules, so a
// page is listed only for evidence its score counts.
import type { SearchQueryContext, SearchRankingOptions } from '../types';
import { normalizeHost } from './direct-navigation';
import { getSearchTitleUnitMatch } from './text-matching';
import type { TitleMatchOptions } from './text-matching';
import {
  SEARCH_HAN_PATTERN,
  allowsSearchMidWordMatch,
  findSearchLiteral,
  hasSearchLiteral,
  normalizeSearchText,
  splitSearchTitleTokens
} from './text-normalize';

// A page's text, read once for every term of a query.
interface SearchItemFields {
  title: string;
  titleLower: string;
  titleTokens: string[];
  // The host without "www.".
  hostname: string;
  // The labels that name the site (hostNameLabels), joined by dots.
  hostCore: string;
  hostLabels: string[];
  // The labels and the words of hyphenated ones.
  hostWords: string[];
  port: string;
  // The decoded path, with a "#/" route after it.
  pathLower: string;
  pathTokens: string[];
  // Host, port, path, query and fragment, as an address is typed.
  address: string;
}

interface SearchItemText {
  url?: string;
  title?: string;
}

// Second-level labels registries sell names under: bbc.co.uk, amazon.co.jp,
// gwbn.net.cn.
const SEARCH_HOST_SECOND_LEVEL_LABELS: ReadonlySet<string> = new Set([
  'ac', 'biz', 'co', 'com', 'edu', 'gen', 'go', 'gob', 'gov', 'info', 'ltd', 'mil', 'ne', 'net', 'nic', 'nom', 'or', 'org', 'plc', 'sch'
]);

// Labels in front of a host that name no site.
const SEARCH_HOST_PREFIX_LABEL_PATTERN = /^(www\d*|m|wap)$/;

// The labels of a host a query can name it by: not "www." or "m.", and not
// its top-level domain or a registry's second level, so "co" does not find
// every .com site nor "ai" claude.ai. An IP address keeps its numbers.
function getSearchHostNameLabels(hostname: unknown): string[] {
  const host = normalizeHost(hostname);
  if (!host) {
    return [];
  }
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    return host.split(/[.:[\]]+/).filter(Boolean);
  }
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) {
    return labels;
  }
  let end = labels.length - 1;
  if (end >= 2 && labels[end].length === 2 && SEARCH_HOST_SECOND_LEVEL_LABELS.has(labels[end - 1])) {
    end -= 1;
  }
  let start = 0;
  while (start < end - 1 && SEARCH_HOST_PREFIX_LABEL_PATTERN.test(labels[start])) {
    start += 1;
  }
  return labels.slice(start, end);
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

// An extension page's host is its random ID, which names nothing a reader
// would type: "a" would find every chrome-extension:// page.
const SEARCH_ID_HOST_PROTOCOL_PATTERN = /^[a-z-]*-extension:$/;

type UrlParts = Pick<SearchItemFields, 'hostname' | 'port' | 'pathLower' | 'address'> & { namesSite: boolean };

function readUrlParts(url: string): UrlParts {
  try {
    const parsed = new URL(url);
    const hostname = normalizeHost(parsed.hostname);
    // A single-page app's route ("#/inbox") is part of its path.
    const route = /^#!?\//.test(parsed.hash) ? parsed.hash.replace(/^#!?/, '') : '';
    const pathLower = normalizeSearchText(decodePath(parsed.pathname + route));
    const address = normalizeSearchText(decodePath(
      `${hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}${parsed.search}${parsed.hash}`
    ));
    return { hostname, port: parsed.port, pathLower, address, namesSite: !SEARCH_ID_HOST_PROTOCOL_PATTERN.test(parsed.protocol) };
  } catch (e) {
    return { hostname: '', port: '', pathLower: '', address: '', namesSite: false };
  }
}

function buildSearchItemFields(item: SearchItemText): SearchItemFields {
  const title = item.title ? String(item.title) : '';
  const { hostname, port, pathLower, address, namesSite } = readUrlParts(String(item.url || ''));
  const hostLabels = namesSite ? getSearchHostNameLabels(hostname) : [];
  const hostWords = hostLabels.slice();
  hostLabels.forEach((label) => {
    label.split('-').filter(Boolean).forEach((word) => {
      if (!hostWords.includes(word)) {
        hostWords.push(word);
      }
    });
  });
  return {
    title,
    titleLower: normalizeSearchText(title),
    titleTokens: splitSearchTitleTokens(title),
    hostname,
    hostCore: hostLabels.join('.'),
    hostLabels,
    hostWords,
    port,
    pathLower,
    pathTokens: pathLower.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean),
    address
  };
}

// The same page objects come back from the cached history and bookmark
// lists on every keystroke, so their fields are read once.
const searchItemFieldsCache = new WeakMap<object, SearchItemFields & { url: string }>();

function readSearchItemFields(item: SearchItemText): SearchItemFields {
  const url = String(item.url || '');
  const cached = searchItemFieldsCache.get(item);
  if (cached && cached.url === url && cached.title === String(item.title || '')) {
    return cached;
  }
  const fields = { ...buildSearchItemFields(item), url };
  searchItemFieldsCache.set(item, fields);
  return fields;
}

// What a term found only inside a word scores in the title, host or path.
const SEARCH_MID_WORD_SCORE = 8;

// A query of punctuation alone ("-", "?", "/") names no page.
const SEARCH_NAMING_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;

// How a query word appears in the title: a whole token, a token's start,
// as typed where a word starts (or inside one, for a long enough term), or
// spelled by the title's units: pinyin, initials, words across spaces.
function scoreSearchTitleTerm(fields: SearchItemFields, term: string, options?: TitleMatchOptions | null): number {
  if (!term || !fields.titleLower) {
    return 0;
  }
  if (fields.titleTokens.includes(term)) {
    return 24;
  }
  if (fields.titleTokens.some((token) => token.startsWith(term))) {
    return 14;
  }
  const literal = findSearchLiteral(fields.titleLower, term);
  if (literal === 'word') {
    return 14;
  }
  if (literal === 'inside' && allowsSearchMidWordMatch(term)) {
    return SEARCH_MID_WORD_SCORE;
  }
  const unitMatch = getSearchTitleUnitMatch(fields.title, term, options);
  if (!unitMatch) {
    return 0;
  }
  if (unitMatch.pieces > 1) {
    return 6;
  }
  return unitMatch.exact ? 24 : (unitMatch.anchored ? 16 : 10);
}

// A term with a dot, slash or colon is an address as typed ("github.com/k",
// "localhost:3000"): it matches from the start of the host or of one of its
// labels or path segments.
function scoreSearchAddressTerm(fields: SearchItemFields, term: string): number {
  if (!/[./:]/.test(term) || !fields.address) {
    return 0;
  }
  const typed = term.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '');
  if (!typed) {
    return 0;
  }
  if (fields.address.startsWith(typed)) {
    return 42;
  }
  let position = fields.address.indexOf(typed);
  while (position > 0) {
    if (/[./]/.test(fields.address.charAt(position - 1)) || /^[./]/.test(typed)) {
      return 16;
    }
    position = fields.address.indexOf(typed, position + 1);
  }
  return 0;
}

// How a query word names the host: a whole label, a label's or a hyphenated
// word's start, inside a label for a long enough term, its port, or an
// address typed out.
function scoreSearchHostTerm(fields: SearchItemFields, term: string): number {
  if (!term) {
    return 0;
  }
  // A number names a label whole, or starts the host: "163" finds
  // music.163.com and "19" 192.168.1.1, but "16" neither, and "168" not
  // every 192.168.x.x.
  if (/^\d+$/.test(term)) {
    const isIpAddress = fields.hostLabels.every((label) => /^\d+$/.test(label));
    if (!isIpAddress && fields.hostLabels.includes(term)) {
      return 28;
    }
    if (fields.hostLabels.length > 0 && fields.hostLabels[0].startsWith(term)) {
      return 16;
    }
    return fields.port && term === fields.port ? 28 : 0;
  }
  if (fields.hostLabels.includes(term)) {
    return 28;
  }
  if (fields.hostWords.some((word) => word.startsWith(term))) {
    return 16;
  }
  if (allowsSearchMidWordMatch(term) && fields.hostLabels.some((label) => label.includes(term))) {
    return SEARCH_MID_WORD_SCORE;
  }
  if (fields.port && term === fields.port) {
    return 28;
  }
  return scoreSearchAddressTerm(fields, term);
}

// A path names a page by terms of three characters or more, numbers or Han
// text: "en", "u" and "p" are in too many paths to tell pages apart.
function canSearchPathHoldTerm(term: string): boolean {
  return Array.from(term).length >= 3 || /^\d+$/.test(term) || SEARCH_HAN_PATTERN.test(term);
}

// How a query word appears in the path: a whole segment word, a word's
// start, as typed where a word starts, or inside a word for a long term.
function scoreSearchPathTerm(fields: SearchItemFields, term: string): number {
  if (!term || !fields.pathLower || !canSearchPathHoldTerm(term)) {
    return 0;
  }
  if (fields.pathTokens.includes(term)) {
    return 32;
  }
  // A number in a path is an ID, matched only whole: "1234" is not
  // meeting 123456789.
  if (/^\d+$/.test(term)) {
    return 0;
  }
  if (fields.pathTokens.some((token) => token.startsWith(term))) {
    return 18;
  }
  const literal = findSearchLiteral(fields.pathLower, term);
  if (literal === 'word') {
    return 10;
  }
  return literal === 'inside' && allowsSearchMidWordMatch(term) ? SEARCH_MID_WORD_SCORE : 0;
}

// A Han query spelled the way a site's address writes it: 知乎 is
// zhihu.com, 京东 is jd.com. The background fills queryHostSpellings with
// the query's pinyin and initials; only a whole label counts.
function matchesSearchHostSpelling(
  hostLabels: readonly string[],
  context: Pick<SearchQueryContext, 'queryHostSpellings'> | null | undefined
): boolean {
  const spellings = context && Array.isArray(context.queryHostSpellings) ? context.queryHostSpellings : [];
  return spellings.length > 0 && hostLabels.some((label) => spellings.includes(label));
}

// Whether the page shows the term anywhere matching counts. The title's
// units are walked last, since most queries match text as typed.
function matchesSearchTerm(fields: SearchItemFields, term: string, options?: TitleMatchOptions | null): boolean {
  if (!term) {
    return false;
  }
  if (fields.titleLower === term || fields.titleLower.startsWith(term)) {
    return true;
  }
  if (fields.titleTokens.some((token) => token.startsWith(term)) || hasSearchLiteral(fields.titleLower, term)) {
    return true;
  }
  if (scoreSearchHostTerm(fields, term) > 0 || scoreSearchPathTerm(fields, term) > 0) {
    return true;
  }
  return scoreSearchTitleTerm(fields, term, options) > 0;
}

// The terms a match needs: the query's words, or the whole query when it
// has one.
function getSearchCoreTerms(context: Partial<Pick<SearchQueryContext, 'coreQueryTerms' | 'queryTerms'>>): readonly string[] {
  if (Array.isArray(context.coreQueryTerms) && context.coreQueryTerms.length > 0) {
    return context.coreQueryTerms;
  }
  return Array.isArray(context.queryTerms) ? context.queryTerms : [];
}

// A page matches when it shows the whole query, or every word of it, each
// anywhere matching counts.
function matchesSearchItem(
  item: SearchItemText,
  context: Pick<SearchQueryContext, 'queryLower'> & Partial<Pick<SearchQueryContext, 'coreQueryTerms' | 'queryTerms' | 'queryHostSpellings'>>,
  options?: TitleMatchOptions | null
): boolean {
  if (!SEARCH_NAMING_CHARACTER_PATTERN.test(context.queryLower)) {
    return false;
  }
  const fields = readSearchItemFields(item);
  if (matchesSearchTerm(fields, context.queryLower, options) || matchesSearchHostSpelling(fields.hostLabels, context)) {
    return true;
  }
  const coreTerms = getSearchCoreTerms(context);
  return coreTerms.length > 0 && coreTerms.every((term) => matchesSearchTerm(fields, term, options));
}

// Whether the page shows a term where a word starts ('word'), only inside
// words ('inside'), or not at all.
function readSearchTermEvidence(fields: SearchItemFields, term: string, options?: TitleMatchOptions | null): 'word' | 'inside' | '' {
  const scores = [scoreSearchTitleTerm(fields, term, options), scoreSearchHostTerm(fields, term), scoreSearchPathTerm(fields, term)];
  if (scores.every((score) => score === 0)) {
    return '';
  }
  return scores.every((score) => score === 0 || score === SEARCH_MID_WORD_SCORE) ? 'inside' : 'word';
}

// Whether the page shows the query, or one of its words, only inside words:
// "over" in "Discover", "sign" in "Designers". Such a page still matches,
// but does not stand for a site the query names.
function isSearchItemMatchedInsideWords(fields: SearchItemFields, context: SearchQueryContext, options?: TitleMatchOptions | null): boolean {
  if (readSearchTermEvidence(fields, context.queryLower, options) === 'word' ||
      matchesSearchHostSpelling(fields.hostLabels, context)) {
    return false;
  }
  return getSearchCoreTerms(context).some((term) => readSearchTermEvidence(fields, term, options) !== 'word');
}

// The text part of a page's relevance: the whole query in the title, in
// the host and in the path, and each of its words.
function scoreSearchTitleText(fields: SearchItemFields, context: SearchQueryContext, options: SearchRankingOptions): number {
  const phrase = context.queryLower;
  let score = 0;
  if (fields.titleLower === phrase) score += 140;
  if (fields.titleLower.startsWith(phrase)) score += 70;
  const asToken = fields.titleTokens.includes(phrase);
  if (asToken) score += 45;
  const asTyped = hasSearchLiteral(fields.titleLower, phrase);
  if (asTyped) score += 24;
  // Pinyin, initials and words spelled across spaces, where the title does
  // not already show the query as typed.
  if (context.unitQuery && !asToken && !asTyped) {
    const unitMatch = getSearchTitleUnitMatch(fields.title, context.unitQuery, options);
    if (unitMatch) score += unitMatch.score;
  }
  context.queryTerms.forEach((word) => {
    score += scoreSearchTitleTerm(fields, word, options);
  });
  return score;
}

function scoreSearchHostText(fields: SearchItemFields, context: SearchQueryContext): number {
  const phrase = context.queryLower;
  let score = 0;
  if (fields.hostCore) {
    if (fields.hostCore.startsWith(phrase)) score += 20;
    if (hasSearchLiteral(fields.hostCore, phrase)) score += 14;
    if (fields.hostLabels.includes(phrase)) {
      score += 42;
    } else if (matchesSearchHostSpelling(fields.hostLabels, context)) {
      score += 28;
    }
  }
  context.queryTerms.forEach((word) => {
    score += scoreSearchHostTerm(fields, word);
  });
  return score;
}

function scoreSearchPathText(fields: SearchItemFields, context: SearchQueryContext): number {
  return context.queryTerms.reduce((score, word) => score + scoreSearchPathTerm(fields, word), 0);
}

// A page on this computer or the local network matches by its title.
function scoreSearchLocalNetworkTitle(fields: SearchItemFields, context: SearchQueryContext, options: SearchRankingOptions): number {
  if (!fields.hostname || typeof options.isLocalNetworkHost !== 'function' || !options.isLocalNetworkHost(fields.hostname)) {
    return 0;
  }
  const phrase = context.queryLower;
  if (fields.titleLower === phrase) return 60;
  if (fields.titleLower.startsWith(phrase)) return 42;
  if (hasSearchLiteral(fields.titleLower, phrase)) return 24;
  return scoreSearchPathTerm(fields, phrase) > 0 || scoreSearchHostTerm(fields, phrase) > 0 ? 20 : 0;
}

function scoreSearchItemText(fields: SearchItemFields, context: SearchQueryContext, options: SearchRankingOptions): number {
  if (!SEARCH_NAMING_CHARACTER_PATTERN.test(context.queryLower)) {
    return 0;
  }
  return scoreSearchTitleText(fields, context, options) +
    scoreSearchHostText(fields, context) +
    scoreSearchPathText(fields, context) +
    scoreSearchLocalNetworkTitle(fields, context, options);
}

export {
  getSearchCoreTerms,
  getSearchHostNameLabels,
  isSearchItemMatchedInsideWords,
  matchesSearchHostSpelling,
  matchesSearchItem,
  matchesSearchTerm,
  readSearchItemFields,
  scoreSearchHostTerm,
  scoreSearchItemText,
  scoreSearchPathTerm,
  scoreSearchTitleTerm
};
export type { SearchItemFields, SearchItemText };
