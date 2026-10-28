/**
 * Stemit offline separation engine adapter.
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

  if (!manifest.inputName || !manifest.outputNames?.length) {
    throw new Error("Model manifest is missing inputName/outputNames.");
  }

  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  });

  const mono = channels > 1 ? mixToMono(samples, channels) : samples;
  const input = new ort.Tensor("float32", mono, [1, 1, mono.length]);
  onProgress(25, "Running offline AI model…");
  const results = await session.run({ [manifest.inputName]: input });
  const output = results[manifest.outputNames[0]];
  if (!output?.data) throw new Error("Model returned no audio output.");
  onProgress(90, "Preparing separated audio…");

  const vocals = Float32Array.from(output.data);
  return {
    sampleRate,
    channels: 1,
    vocals,
    instrumental: manifest.instrumentalOutputName && results[manifest.instrumentalOutputName]
      ? Float32Array.from(results[manifest.instrumentalOutputName].data)
      : null
  };
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
