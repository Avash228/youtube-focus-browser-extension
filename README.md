# YouTube Focus

A local Manifest V3 extension for Chromium browsers (Brave, Chrome, Edge) that hides entertainment on YouTube and keeps only music and educational videos.

No external servers, API keys, analytics, dependencies, or build steps. Everything runs locally in your browser.

## What it does

- **Filters feeds by title and channel:** Keeps music (songs, concerts, covers, OSTs, ambient sounds, YouTube Mixes) and educational content (programming, languages, science, DIY/repairs, cooking, sports, crafts) using Russian and English rules.
- **Strict & relaxed modes:** Strict mode (default) hides anything it can't positively identify as music or educational. Relaxed mode only hides obvious entertainment like let's plays, reactions, vlogs, pranks, and shows.
- **Removes Shorts & end screens:** Hides Shorts shelves and navigation links (including music/educational Shorts), plus end-screen recommendation overlays.
- **Guards the video player:** If you open a non-matching video directly, it pauses playback and shows why it was blocked.
- **On-page controls:** Adds a `Focus · N hidden` button in the bottom-right corner to inspect hidden cards, temporarily unhide a video for the current tab, or whitelist a channel. Hovering over visible cards also gives a quick button to hide the channel.
- **Custom rules & backups:** Whitelist or blacklist channels (by `@handle`, URL, or name), add custom allow/block words, test any video title right inside the popup, and export/import your settings as JSON.

## Installation

1. Download or clone this repository.
2. Open `brave://extensions` or `chrome://extensions` in your browser.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `YouTube-Focus` folder (the one containing `manifest.json`).
5. Refresh any open YouTube tabs.

## Project layout

- `manifest.json` — Manifest V3 config (`storage` permission only, runs on `youtube.com`).
- `classifier.js` — Title/channel normalization and classification rules.
- `settings.js` — `chrome.storage.local` wrapper and channel URL/handle normalization.
- `content.js` / `content.css` — DOM card filtering, SPA navigation handling, player gate, and in-page drawer.
- `popup.html` / `popup.css` / `popup.js` — Extension popup UI, rule editor, title tester, and JSON backup.
- `tests/` — 151 unit and regression tests.

To run the test suite (requires Node.js 18+):

```bash
node --test YouTube-Focus/tests/classifier.test.cjs
```

## Privacy

The extension makes zero network requests, collects no telemetry, and stores no watch history. All settings and channel lists stay in `chrome.storage.local` in your browser profile.
