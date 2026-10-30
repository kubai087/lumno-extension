# Contributing to Lumno

Thanks for helping improve Lumno. Bug reports, ideas, translations and code are
all welcome. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Issues

- Search the [existing issues](https://github.com/kubai087/lumno-extension/issues)
  first; a thumbs-up on an existing one counts too.
- Use the bug report or feature request form. You can write in English, Chinese
  or Japanese.
- Report security problems privately, as [SECURITY.md](SECURITY.md) describes,
  never in a public issue.
- For a large change or a new feature, open an issue to agree on the approach
  before you write the code, so the work is not wasted.

## Setting up

You need Node.js 22 (`nvm use` reads `.nvmrc`) and Chrome or another Chromium
browser.

```bash
npm ci
npm run build
```

Then open `chrome://extensions/`, turn on Developer mode, choose
**Load unpacked** and select `dist/chrome`, the development extension the
build writes. To try the Firefox build, see
the Development section of the [README](../README.md#development).

`dist/chrome/` is build output and never committed. It holds the pages,
styles, assets and locales copied as they are, and `build/`: every script the
extension runs, built by Vite from the entry modules
[`scripts/build/entries.js`](../scripts/build/entries.js) lists. Page scripts
are ES modules that share chunks (`build/chunks/`); preloads, content scripts
and the service worker are self-contained classic scripts.

While you work, `npm run watch` keeps `dist/chrome/` current as you edit.

After a rebuild, click Reload on the extensions page, then reload the pages you
are testing.

## Where things live

The [README](../README.md#project-structure) maps the folders. `src/` owns
browser APIs, storage, navigation and ranking; its `react/` folders own what
the pages show.

`src/` is layered, and ESLint holds the layers apart: `domain/` is pure logic
(no browser globals, no DOM work), `platform/` wraps browser and extension
APIs, `shared/` is UI and page runtime that several surfaces use, and the
surfaces (`background/`, `content/`, `overlay/`, `newtab/`, `options/`,
`onboarding/`, `popup/`) sit on top. A module imports from its own layer and
the ones below it, and a surface never imports another surface.

## Making a change

- Keep a pull request to one topic. Unrelated fixes are easier to review in
  pull requests of their own.
- Add or update tests for what the change does. Every test is TypeScript and
  runs in Vitest. Unit and component tests sit next to their module as
  `*.test.ts(x)`; tests of a whole page go in `tests/pages/<page>/`, checks of
  the repository and its build in `tests/repo/`, and browser flows in
  `tests/e2e/`. Tests use the fakes in `tests/fakes/` (an in-memory browser,
  the worker's APIs, element boxes, CSS) and test what a module does, never
  how its source is written.
- Put new or changed UI text in the four languages people maintain under
  `_locales/`: `en`, `zh_CN`, `zh_TW` and `ja`. Leave the other six, which are
  AI-translated, to the maintainers; `npm run check:locales` lists what they
  still wait for as a warning, and fails only on the four. `npm run audit:i18n`
  lists Chinese text written straight into the code instead of `_locales/`.
- Keep the extension local: no code loaded from a CDN, no `eval`, and no new
  network requests unless the user turns the feature on. A change that sends
  data anywhere new also needs the README's Privacy section and the privacy
  policy updated.
- New third-party code, icons or fonts must come under a license that allows
  redistribution. Add them to [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)
  and put their license texts next to them.
- What each surface loads has a size budget. A change that grows a route by
  more than a few KiB fails CI unless one of its commit messages carries a
  `Bundle-Growth: <why>` trailer; see
  [`tests/repo/bundle-budgets.test.ts`](../tests/repo/bundle-budgets.test.ts).

## Translations

Lumno's interface comes in 10 languages. English, Simplified Chinese,
Traditional Chinese and Japanese are written and reviewed by people; Korean,
German, French, Spanish, Brazilian Portuguese and Russian are AI-translated,
and the language picker says so.

- If you speak one of them, open Settings → General → Language →
  **Improve translation**. You can report one string on a prefilled
  [translation issue](https://github.com/kubai087/lumno-extension/issues/new?template=translation.yml),
  or download every string as a spreadsheet, fill in the Suggestion column and
  attach it to the issue. You do not need to set up the repository.
- Maintainers merge a returned spreadsheet with
  `node scripts/i18n/import-sheet.js <file.csv> <locale>`, which leaves out
  suggestions whose `{tokens}` or line breaks differ from English.
- Before a release, maintainers translate what the AI-translated languages are
  missing: `npm run i18n:export -- <work-dir>` writes the missing strings as
  chunks, and `npm run i18n:import -- <work-dir>` merges the translated chunks
  back. `npm run package:store` runs `npm run check:locales:strict`, so a
  package never ships with a missing string.

## Checks

Before you open a pull request, run:

```bash
npm run verify
```

It builds the extension and runs the tests, the static checks and ESLint, the
same as CI. While you work, run only part of it:

```bash
npx vitest run src/domain/search         # The tests under some paths
npx vitest run -t "scope panel"          # The tests whose name matches
npm run lint                             # ESLint
npm run test:e2e                         # Browser flows, after npm run build
```

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): subject

What was wrong or missing, and how this change fixes it, wrapped at
72 characters.
```

- **type**: `feat`, `fix`, `perf`, `refactor`, `style`, `test`, `docs`,
  `build`, `ci` or `chore`.
- **scope** (optional): the area the change touches, such as `newtab`,
  `overlay`, `options`, `popup`, `onboarding`, `background`, `search`,
  `settings`, `tests` or `repo`. Leave it out when a change spans many areas.
- **subject**: English, in the imperative, starting with a lowercase letter and
  without a trailing period. The whole first line stays within 72 characters.
- **body**: may be left out for a small, obvious change; otherwise say why the
  change is needed, not only what it does. Wrap it at 72 characters.
- **trailers** go at the end, such as `Bundle-Growth: <why>` for a change that
  is meant to grow a React bundle past its budget.

Keep each commit to one logical change, so it can be reviewed and reverted on
its own.

## Pull requests

Fill in the pull request template: what changed and why, how you tested it, and
before and after screenshots for UI changes. Check the change in Chrome, and in
Firefox too when it touches anything the README's browser compatibility table
lists.

## License

Lumno is licensed under the [GPL-3.0](../LICENSE). By sending a pull request, you
agree that your contribution is licensed under the same terms.
