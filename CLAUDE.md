# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GastosDiarios is a personal expense tracker. It is a **client-only web app with no build step**: the data logic is in ES modules, and the UI is driven by **Alpine.js** with **Tailwind CSS** styling and **Lucide** icons, all loaded from CDNs. There is no backend and no test suite. All data lives in the browser's `localStorage`. Because of the CDNs, the app **requires an internet connection** to render (only the data is offline).

## Commands

```bash
npm start        # Serve on http://localhost:3000 via `npx serve`
```

There is no build, lint, or test tooling. A local server is required (not just opening `index.html`) because `src/app.js` is an ES module, which browsers block over the `file://` protocol.

## Architecture

The UI is a single Alpine component; the data logic stays in framework-agnostic ES modules.

- **`index.html`** — the whole view. Loads Tailwind (Play CDN, configured inline with `darkMode: 'class'` and an `accent` color mapped to `rgb(var(--accent) / <alpha-value>)`), Lucide, and Alpine. Markup is Tailwind utility classes + Alpine directives (`x-data="app"`, `x-for`, `x-text`, `@click`, …). Reusable class combos live in the `<style type="text/tailwindcss">` `@layer components` block (`.card`, `.field`, `.btn-ghost`, …).
- **`src/app.js`** — registers the Alpine `app` component on the `alpine:init` event. Holds all reactive state (`state`, `viewYear`/`viewMonth`, `form`, `accent`, `mode`, `settingsOpen`, `toast`), exposes derived data as **getters** (`monthExpenses`, `total`, `pct`, `breakdown`, `alert`, …) and actions (`addExpense`, `removeExpense`, `setBudget`, `changeMonth`, `doExport`, `doImport`). Delegates all data work to `storage.js`.
- **`src/storage.js`** — persistence and pure data helpers. Owns the `state` shape (`{ budget, expenses }`), `localStorage` load/save (key `gastosdiarios-v1`, wrapped in try/catch — `saveState` returns a boolean), JSON export/import, `sanitizeExpense` (validates untrusted imported data), and the pure functions (`filterByMonth`, `sumExpenses`, `groupByCategory`, `createExpense`).
- **`src/categories.js`** — the editable list of categories (id, label, Lucide `icon`, `emoji`, `color`). `getCategory()` falls back to the last category (`otros`) for unknown ids.
- **`theme.config.js`** — user-facing customization: brand name/tagline, logo (Lucide `logoIcon` or a `logoImage` URL/photo), `locale`/`currency`, `defaultBudget`, accent color + presets, default theme mode.

### Reactivity & conventions

- Alpine tracks state automatically — mutate `this.state`, call `saveState(this.state)`, and the getters/DOM update on their own. There is no manual `render()`.
- **Icons**: Lucide replaces `<i data-lucide="…">` placeholders with SVGs via `lucide.createIcons()`. Alpine re-creates those placeholders inside `x-for`, so any action that changes a list calls `this.$nextTick(refreshIcons)` to re-render icons. Add that call to new actions that mutate rendered lists.
- **Theming**: the accent color is a CSS variable (`--accent`, space-separated RGB set by `applyAccent`); light/dark is the `.dark` class on `<html>` toggled by `applyMode`. Both are `$watch`ed and persisted (`gd-mode` in `localStorage`).
- **XSS**: Alpine's `x-text` auto-escapes, so user input needs no manual escaping (unlike the old `innerHTML` approach). Do not switch list rendering back to `innerHTML`/`x-html` with user data.
- An `expense` is `{ id, amount, category, description, date, createdAt }`. `id` uses `crypto.randomUUID()`; `date` is a `YYYY-MM-DD` string; amounts are rounded to 2 decimals.
- Dates are parsed as `new Date(date + 'T12:00:00')` to avoid timezone/off-by-one-day issues — reuse this idiom.
- Currency/locale come from `theme.config.js` via `Intl.NumberFormat`. UI strings are in Spanish.
- `viewYear`/`viewMonth` track the displayed month independently of today; expenses are one flat array filtered by `filterByMonth()` at read time.
