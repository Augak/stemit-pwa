/**
 * Stemit offline separation engine adapter.
 *
 * The adapter intentionally fails closed when the local model contract is
 * incomplete instead of presenting an unverified result as AI separation.
 */

export const ENGINE_STATUS = {
  unavailable: "unavailable",
  ready: "ready",
  running: "running",
  complete: "complete",
  error: "error"
};

export async function loadLocalOnnxRuntime() {
  if (!window.ort) {
    throw new Error("ONNX Runtime Web is not bundled. Add vendor/ort.min.js before enabling AI mode.");
  }
  return window.ort;
}

export async function validateLocalModel(modelUrl = "./models/stemit-vocal-separator.onnx") {
  const response = await fetch(modelUrl, { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error("Local model unavailable (" + response.status + ").");
  return { modelUrl, ok: true };
}

export async function separateWithLocalModel({
  samples,
  sampleRate,
  channels,
  modelUrl = "./models/stemit-vocal-separator.onnx",
  manifestUrl = "./models/manifest.json",
  onProgress = () => {}
}) {
  const ort = await loadLocalOnnxRuntime();
  const manifest = await fetch(manifestUrl).then(r => {
    if (!r.ok) throw new Error("Model manifest not found.");
    return r.json();
  });

  validateManifest(manifest);
  await validateLocalModel(modelUrl);

  const mono = channels > 1 ? mixToMono(samples, channels) : samples;
  const expectedLength = manifest.inputShape?.[manifest.inputShape.length - 1];
  if (Number.isInteger(expectedLength) && expectedLength !== mono.length) {
    throw new Error(
      "This model expects " + expectedLength + " samples, but the selected file has " + mono.length +
      ". The UI fallback will be used until chunking is implemented."
    );
  }

  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  });

  const input = new ort.Tensor("float32", mono, manifest.inputShape || [1, 1, mono.length]);
  onProgress(25, "Running offline AI model…");
  const results = await session.run({ [manifest.inputName]: input });
  const output = results[manifest.outputNames[0]];
  if (!output?.data) throw new Error("Model returned no audio output.");

  const vocals = flattenAudioOutput(output.data);
  if (!vocals.length) throw new Error("Model returned an empty vocal track.");
  if (vocals.length !== mono.length && !manifest.allowVariableOutputLength) {
    throw new Error("Model output length does not match the input length.");
  }

  onProgress(90, "Preparing separated audio…");
  return {
    sampleRate,
    channels: 1,
    vocals,
    instrumental: manifest.instrumentalOutputName && results[manifest.instrumentalOutputName]
      ? flattenAudioOutput(results[manifest.instrumentalOutputName].data)
      : null
  };
}

function validateManifest(manifest) {
  if (!manifest.inputName || !manifest.outputNames?.length) {
    throw new Error("Model manifest is missing inputName/outputNames.");
  }
  if (!Array.isArray(manifest.inputShape) || manifest.inputShape.length !== 3) {
    throw new Error("Model manifest must define a 3D inputShape such as [1, 1, 131072].");
  }
}

function flattenAudioOutput(data) {
  return Float32Array.from(data, Number);
}

function mixToMono(samples, channels) {
  const frames = Math.floor(samples.length / channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[i * channels + c];
    mono[i] = sum / channels;
  }
  return mono;
}
