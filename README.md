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

## Offline engine progress

This update adds `engine.js`, a model manifest, and a documented local-assets contract for a real ONNX/WebAssembly separation path. The adapter validates a local model, loads it through ONNX Runtime Web, and keeps model inference separate from the UI.

The model weights and runtime are intentionally not bundled yet: a license-compatible model and local `vendor/ort.min.js` build still need to be selected, added, and tested on the target 4 GB Android device. Until then, the app continues to use the clearly labelled stereo centre/side fallback.

### Next engineering steps

1. Select a license-compatible vocal-separation model with a compatible tensor contract.
2. Add the model to `models/stemit-vocal-separator.onnx` and update `models/manifest.json`.
3. Bundle ONNX Runtime Web locally in `vendor/ort.min.js`.
4. Wire the adapter into `app.js`, then benchmark memory, speed and output quality on Android.
