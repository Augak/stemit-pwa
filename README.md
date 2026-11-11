# Stemit Studio PWA

Stemit Studio is a mobile-first, installable browser audio workspace. It processes selected audio locally in the browser; no account or upload is required.

## Current working features

- Installable PWA with offline app-shell caching
- Local audio import and drag/drop
- Stereo centre/side extraction into two independent mono layers
- Mixer controls per layer: volume, pan, mute and solo
- Mix preview and WAV export
- Individual WAV export for each extracted layer
- Clear disclosure of what is and is not implemented

## Separation model status

**The currently enabled mode is stereo centre/side extraction.** It is useful for exploring stereo mixes but it is not AI source separation and cannot reliably isolate vocals, drums, bass, guitar or piano.

Four-stem and six-stem modes are displayed as planned capabilities but remain disabled until a compatible, license-reviewed model and browser inference pipeline are integrated and tested on real Android devices. Do not represent these modes as available yet.

The ONNX adapter now includes manifest validation, runtime tensor-name preflight, fixed-shape and sample-rate checks, output validation, and explicit session cleanup. It remains an integration seam: it is not connected to the studio UI, and no real ONNX model or bundled ONNX Runtime Web package is included.

The current adapter supports only fixed-shape, batch-1 mono waveform models. It does not yet implement resampling, chunking, overlap reconstruction, spectrogram preprocessing, dynamic shapes, or long-track memory management. See [the engine contract](docs/ENGINE_CONTRACT.md) before evaluating a model.

## Run locally

Serve this folder from localhost or deploy it to GitHub Pages, Netlify or another static host. Opening the page directly as a file may prevent PWA features.

## Engine tests

Node.js 20 or newer is required. Install no dependencies; run:

    npm test

The tests use a mocked ONNX Runtime session to validate the adapter contract and resource lifecycle. They do not claim real model quality or performance.

## Privacy

Audio is decoded and processed in the browser. The app does not upload the selected track to a server.
