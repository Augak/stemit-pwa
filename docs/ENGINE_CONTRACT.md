# Offline ONNX engine contract

The current Stemit interface still uses stereo mid/side extraction. The ONNX adapter is a separate integration seam and is not enabled in the user flow. This document describes the checks required before a real model can be used.

## Supported contract in this adapter

- One fixed-shape, batch-1 mono waveform input: `[1, 1, N]`.
- `inputName` must match an input exposed by ONNX Runtime Web.
- `outputNames[0]` is the vocal estimate.
- `instrumentalOutputName` is optional, but if provided it must also appear in `outputNames` and in the ONNX session output metadata.
- Optional `sampleRate` must match the decoded audio exactly.
- Each returned waveform must contain exactly `N` finite samples.
- The model session is released after inspection or inference.

## Deliberate limitations

This adapter does not yet implement resampling, chunking, overlap-add reconstruction, spectrogram/STFT preprocessing, stereo model inputs, dynamic shapes, quantization, WebGPU execution, or long-track memory management. A model requiring any of those operations must not be declared compatible by editing the manifest alone.

## Model integration checklist

1. Confirm the model license permits redistribution and local browser use.
2. Record the source URL, revision/commit, license, model hash and attribution.
3. Inspect the ONNX graph real input/output names, ranks, dimensions and expected sample rate.
4. Add the exact compatible runtime build locally under `vendor/`.
5. Add the model under `models/` only after storage and redistribution rights are confirmed.
6. Update `models/manifest.json` from actual graph metadata, not an assumed tensor contract.
7. Run `npm test`, then test inference on representative audio and physical Android devices before enabling AI mode in the interface.

## Local validation

Node.js 20 or newer is required for the built-in test runner. No network dependency is needed for `npm test`.
