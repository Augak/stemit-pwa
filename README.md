# Stemit PWA

Stemit is a mobile-first, browser-based audio layer exploration tool.

## Current status

This daily update makes the existing `stemit-pwa` project GitHub-ready with:

- PWA manifest and install metadata
- accessible labels and keyboard-friendly controls
- local file handling with no login
- local WAV export
- README and deployment notes
- clear disclosure of the current engine limitation

### Important engine note

The current browser build uses **stereo centre/side extraction**. It is **not yet the full AI vocal-separation engine**. This is intentionally disclosed in the interface so the project does not present a prototype as a finished AI separator.

## Run locally

Open `index.html` with a local static server, for example:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy

This is a static PWA. It can be deployed to GitHub Pages, Netlify, Vercel, or any static host.

## GitHub upload

Upload the complete folder contents to the existing `stemit-pwa` repository. Do not create a duplicate repository.

## Next engineering milestone

Replace the centre/side extraction step in `app.js` with the real offline model pipeline (for example an ONNX/WebAssembly or Android native inference path) and then verify performance on low-resource Android hardware.
