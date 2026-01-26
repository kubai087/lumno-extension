# Lumno

A lightweight new-tab search and quick navigation overlay for Chromium browsers.

## Core Features

- Global command to open a floating search overlay from any page.
- Smart suggestions from history, bookmarks, top sites, and Google suggestions.
- Keyword shortcuts for internal pages (e.g., `settings`, `extensions`).
- URL recognition and direct navigation with Tab autocomplete.
- Site search shortcuts (e.g., type `gh ` then press Tab for GitHub search).
- New tab page with the same unified search experience.

## Local Installation (No Store Required)

1. Clone or download this repository.
2. Open `chrome://extensions` (or your Chromium browser equivalent).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repo folder.
5. Optional: set a custom shortcut at `chrome://extensions/shortcuts`.

## Usage

- Press the command shortcut (default `Ctrl+T` / `Command+T`) to open the overlay.
- Type to search history, bookmarks, and top sites.
- Enter a site key + space and press Tab to switch to site search.
- Use Tab to accept autocomplete, Enter to navigate.

## Development Notes

- No build step required.
- Source files are plain JavaScript.

Author: Kubai087
