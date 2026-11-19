# Stemit local-model evaluation gate

This checklist is required before a vocal-separation model is enabled in the Stemit UI.

## Required evidence

- Model source URL and exact revision.
- Redistribution and local-browser-use license confirmation.
- SHA-256 hash of the exact model file.
- Real ONNX input/output names and tensor shapes.
- Expected sample rate and channel layout.
- Approximate memory footprint during inference.
- Representative audio evaluation notes.
- Android test results on a lower-end device.

## Pass/fail gate

A candidate may be marked `approved` only when all of the following are true:

1. The license allows the intended distribution.
2. The graph metadata matches `docs/ENGINE_CONTRACT.md`.
3. The model passes the manifest and runtime preflight.
4. Inference returns finite audio with the expected length.
5. A 30–60 second test track completes without browser tab termination.
6. The output is listened to and documented for speech leakage, artifacts and timing.
7. The model is tested on a physical Android device before UI enablement.

## Current status

No model is approved or bundled in this repository. The current app therefore continues to expose stereo centre/side extraction only.

Do not change the model status to `approved` by editing metadata alone; attach the evidence above in the pull request that introduces the model.
