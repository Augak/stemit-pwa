# Stemit Audio Studio — PWA prototype

A lightweight, installable progressive web app for testing an audio layer-extraction workflow on phones and desktop browsers.

## Current functionality
- Select or drag in a browser-supported audio file.
- Extract a rough stereo **centre** layer (Vocal focus) or **side/difference** layer (Instrumental focus).
- Listen, seek, mute, and export the processed result as 16-bit stereo WAV.
- PWA manifest and service worker for installability and caching of the app shell.
- Audio decoding and processing happen locally in the browser; no audio upload or account is used.

## Important engine limitation
This is a testable UI and signal-processing prototype, **not AI source separation**. Centre/side extraction cannot reliably separate vocals from instruments and works poorly with mono tracks or mixes with off-centre vocals. The next serious engine step is to integrate a real model such as a browser-compatible ONNX/Transformers pipeline or a secure server-side separation API. Do not present this prototype as production-quality AI separation.

## Run locally
A service worker requires localhost or HTTPS. From this folder, run:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in a modern browser. For phone testing, deploy the folder to an HTTPS static host (Netlify/Vercel/GitHub Pages), then open the link on the phone and use the browser's **Install app** or **Add to Home screen** option.

## Notes
- Recommended input size: below 50 MB. A hard 100 MB guard is included; browser memory limits may be lower on older phones.
- WAV export is uncompressed and can be much larger than the input file.
- Google Fonts are optional decoration; the app's system fallback fonts still work offline.
