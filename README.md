# Word Meaning on Hover

A Chrome extension that shows dictionary definitions when you hold **Alt** (Option on Mac) and hover over any English word on a webpage.

## Install

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this folder: `meaning_of_word`
5. The extension should appear as **Word Meaning on Hover**

## How to use

1. Browse any normal website (e.g. Wikipedia, news sites, blogs)
2. Hold **Alt** (Option on Mac) and hover over an English word
3. Wait about 1 second — a tooltip appears with:
   - The word
   - Phonetic pronunciation (if available)
   - Part of speech
   - Up to 2 short definitions
4. Release **Alt** or move away from the word to dismiss the tooltip

## How it works

- A content script runs on every page and detects the word under your cursor using `document.caretRangeFromPoint` — only while **Alt** is held
- Definitions are fetched from the [Free Dictionary API](https://dictionaryapi.dev/) (no API key required)
- Lookups are cached in memory for 30 seconds to avoid duplicate requests

## Known limitations

- Does **not** work on `chrome://` pages, the Chrome Web Store, or other restricted Chrome internal pages
- Requires holding **Alt** and hovering for ~1 second before a lookup starts (debounce)
- Non-English words may return "No definition found"
- Very fast mouse movement across many words may feel sluggish due to debouncing
- Definitions come from an online API — an internet connection is required
- Word detection is heuristic; punctuation and unusual formatting can occasionally miss or misidentify words

## Project structure

```
meaning_of_word/
├── manifest.json
├── content/
│   ├── content.js
│   └── content.css
├── background/
│   └── service-worker.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Optional future improvements

- Toggle on/off via extension icon click (persist with `chrome.storage.sync`)
- Offline cache of recent lookups in `chrome.storage.local`
- Settings popup to adjust debounce delay or disable on specific sites

## License

MIT
