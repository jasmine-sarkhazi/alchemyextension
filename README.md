# Little Alchemy Read-Aloud

A Chrome extension that helps kids who are still learning to read play
[Little Alchemy](https://littlealchemy.com) and
[Little Alchemy 2](https://littlealchemy2.com).

## What it does

- 🔊 **Reads elements aloud** when you hover, drag, or create them.
- 🎤 **Voice-to-drop**: click the floating mic button (or hold `Space`) and say
  an element's name — the extension finds it in the library and drops it on
  the play area.
- ⚙️ **Settings popup** to tune speed, pitch, volume, language, and which
  events trigger speech.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and select this folder.
4. Open <https://littlealchemy2.com> (or v1) and start playing.

Add PNG icons at `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
before publishing — the manifest references them.

## How it works

- A content script attaches listeners for `mouseover`, `mousedown`,
  `dragstart`, and `touchstart` on element nodes in the library and play area,
  and speaks the element's name via `speechSynthesis`.
- A `MutationObserver` watches the workspace for newly added element nodes
  (the result of a successful combination) and speaks their names too.
- The mic button uses the browser's `SpeechRecognition` API. The recognized
  phrase is fuzzy-matched against on-screen element names, then a synthetic
  mousedown→mousemove→mouseup sequence drags the element into the play area.

## Privacy

No data leaves your computer. Speech synthesis and recognition both run via
the browser's built-in Web Speech API.
