# Stemit Studio — Product Reverse-Engineering Blueprint

Status: research and implementation plan. This document describes the public behaviour we intend to reproduce independently; it is not a claim that every feature is implemented.

## Reference scope

Primary reference: https://www.splitmysong.com/

Secondary reference for processing modes and privacy choices: https://splitmysong.app/

Only publicly observable product behaviour, published documentation, and openly licensed technical components are in scope. Stemit must use original code, interface, naming, assets, and implementation. Do not copy proprietary source, private APIs, protected assets, or bypass access controls.

## Public feature map

| Area | Observed reference behaviour | Stemit implementation target |
|---|---|---|
| Input | Common audio formats; the .com describes 0.1–200 MB and up to 20 minutes | Validate type, size and duration; explain device limits; start with MP3/WAV/M4A/FLAC where browser decoder supports them |
| Separation | Four-stem and six-stem AI models | Four-stem and six-stem modes backed by verified inference, never simulated |
| Six outputs | Vocals, drums, bass, guitar, piano, other | Same useful stem categories; preserve model output order and metadata |
| Processing | AI separation can take minutes | Progress stages, cancellation, recoverable errors, memory checks, retry |
| Mixer | Per-stem volume/mute/pan, plus tempo, pitch, click, count-in, looper and master | Mobile-first mixer with independent controls, waveform timeline, master bus, loop markers, metronome/count-in; pitch and time-stretch as later verified DSP features |
| Export | Individual stems and finished mix; FLAC described for high-quality mix export | Individual WAV first, aligned stem bundle/ZIP next, then MP3/FLAC after encoder/licensing review |
| Privacy | .com describes automatic deletion after about 24 hours; .app distinguishes private local processing from cloud processing | Local processing by default where feasible; cloud only after explicit consent with clear provider, retention and deletion disclosure |
| Device guidance | .com recommends desktop for best mixer performance on long/lossless files | Android-friendly limits, low-memory mode, background-tab warnings, resumable downloads and optional cloud route |

Reference notes:
- SplitMySong.com publicly describes six-stem and four-stem models, volume, pan, tempo, pitch, click, count-in, looper and master controls. It describes 200 MB / 20 minute input limits and automatic deletion after approximately 24 hours.
- SplitMySong.app publicly describes browser-private and cloud processing choices, HTDemucs six-stem outputs, and its use of demucs-rs / HTDemucs.
- These are observations of public product pages, not guarantees that Stemit should copy their limits or internal implementation.

## Functional architecture

### 1. Application shell
- Keep the existing installable PWA and app-shell offline cache.
- Split the code into focused modules: file intake, audio decode/resample, separation adapter, project store, mixer graph, waveform renderer, export pipeline and UI.
- Do not load a large model until the user selects a model and confirms the estimated download and device requirements.

### 2. Separation engine
- Define a stable adapter contract: model metadata, required sample rate, channel count, chunk size, input/output stem labels, runtime requirements, progress, cancellation and disposal.
- Candidate: HTDemucs 6-stem ONNX. The candidate model requires careful audio preprocessing and chunked inference; the model file alone is not an engine.
- Verify model provenance, license, model hash, output ordering, sample rate, chunk overlap strategy and quality on known test audio before enabling the mode.
- Prefer WebGPU only when supported and stable; retain a WASM path where practical. Detect capability rather than assuming all Android browsers can run it.
- Local inference is the privacy-first option. The current target Android device class may not have enough practical memory or speed for full-song neural inference.
- Cloud processing must be an opt-in adapter, not a silent upload. No audio leaves the device without consent. Do not expose server credentials in frontend code.

### 3. Mixer and project model
- Each stem is an aligned audio buffer with stable ID, label, sample rate, duration and source offset.
- Mixer state: gain, pan, mute, solo, optional EQ, output routing.
- Transport: play/pause, seek, elapsed/total time, loop A/B, playback rate and master output.
- Tempo and pitch changes must use a suitable time-stretch/pitch-shift implementation; do not alter sample playback rate and claim independent tempo/pitch control.
- A project should reopen with its source reference, stem metadata, mixer state and markers. Browser storage quotas and eviction must be handled honestly.

### 4. Export
- First guarantee sample-aligned WAV stem downloads and a WAV mix.
- Bundle aligned stems into ZIP after testing on mobile.
- Add MP3 and FLAC only after selecting and testing reliable encoders. Preserve source sample rate where supported and report any conversion.
- Export must respect mute/solo/gain/pan/master state and avoid clipping.

## Delivery phases and acceptance criteria

### Phase A — foundation and correctness
- Fix the current New Track action: it must not remove the source file. Replace it with a meaningful add/import track workflow or remove the misleading control.
- Separate UI code from audio logic.
- Add robust file validation, decode errors, mono/stereo handling and object-URL cleanup.
- Test WAV generation, channel layout, clipping prevention and mixer playback.

### Phase B — six-stem model integration
- Add runtime capability detection and explicit model download consent.
- Integrate one licensed six-stem model with real inference.
- Test with several legally usable sample tracks and compare stems by listening and objective checks.
- Only then enable the six-stem mode in the interface.

### Phase C — mixer parity
- Waveforms and timeline seek.
- Track gain, pan, mute, solo and master.
- Loop A/B, metronome and count-in.
- Correct pitch shift and time stretch with independent controls.

### Phase D — exports and projects
- Individual WAV, aligned ZIP and full mix.
- Persistent local project metadata and clear storage management.
- Optional cloud processing only after a real backend, privacy policy, deletion policy and consent flow exist.

### Phase E — differentiated Stemit tools
- Audio-to-MIDI and sheet music (MusicXML/PDF) as a separate transcription workflow.
- Instrument tuner, pitch/note display and practice tools.
- Composition/arrangement workspace.

## Test matrix

- Android Chrome on Android 10-class hardware: import, decode, playback, mixer, exports, memory pressure and installability.
- Desktop Chrome/Firefox: full functional and model tests.
- Network loss during model download and processing.
- Unsupported formats, mono files, long files, low storage and interrupted tabs.
- Verify that local mode makes no audio network requests.
- Verify cloud mode is impossible until consent is explicit and the destination/retention terms are shown.

## Current repository truth

The current PWA has local audio import, basic stereo centre/side extraction, simple mixer controls and WAV export. Centre/side extraction is not AI source separation. The four- and six-stem modes remain unavailable until real model inference is integrated and tested. This distinction must remain visible in the product.
