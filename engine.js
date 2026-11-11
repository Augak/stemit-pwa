/**
 * Stemit offline separation engine adapter.
 *
 * The adapter fails closed when the local model contract is incomplete. It
 * validates the manifest against the ONNX session metadata before inference
 * and always releases the session after use.
 */

export const ENGINE_STATUS = Object.freeze({
  unavailable: "unavailable",
  ready: "ready",
  running: "running",
  complete: "complete",
  error: "error"
});

export async function loadLocalOnnxRuntime() {
  const ort = globalThis.window?.ort || globalThis.ort;
  if (!ort?.InferenceSession || !ort?.Tensor) {
    throw new Error("ONNX Runtime Web is not bundled. Add vendor/ort.min.js before enabling AI mode.");
  }
  return ort;
}

export async function validateLocalModel(modelUrl = "./models/stemit-vocal-separator.onnx") {
  const response = await fetch(modelUrl, { method: "HEAD", cache: "no-store" });
  if (!response.ok) throw new Error("Local model unavailable (" + response.status + ").");
  return { modelUrl, ok: true };
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Model manifest must be a JSON object.");
  }
  if (typeof manifest.inputName !== "string" || !manifest.inputName.trim()) {
    throw new Error("Model manifest is missing inputName.");
  }
  if (!Array.isArray(manifest.outputNames) || manifest.outputNames.length === 0 ||
      manifest.outputNames.some(name => typeof name !== "string" || !name.trim())) {
    throw new Error("Model manifest must define at least one valid output name.");
  }
  if (new Set(manifest.outputNames).size !== manifest.outputNames.length) {
    throw new Error("Model manifest contains duplicate output names.");
  }
  if (!Array.isArray(manifest.inputShape) || manifest.inputShape.length !== 3 ||
      manifest.inputShape.some(dimension => !Number.isSafeInteger(dimension) || dimension <= 0)) {
    throw new Error("Model manifest must define a fixed positive 3D inputShape, for example [1, 1, 131072].");
  }
  if (manifest.inputShape[0] !== 1 || manifest.inputShape[1] !== 1) {
    throw new Error("This adapter currently supports batch-1, mono model inputs only.");
  }
  if (manifest.sampleRate !== undefined &&
      (!Number.isSafeInteger(manifest.sampleRate) || manifest.sampleRate <= 0)) {
    throw new Error("Model manifest sampleRate must be a positive integer.");
  }
  if (manifest.instrumentalOutputName !== undefined &&
      manifest.instrumentalOutputName !== null &&
      !manifest.outputNames.includes(manifest.instrumentalOutputName)) {
    throw new Error("instrumentalOutputName must also appear in outputNames.");
  }

  return Object.freeze({
    ...manifest,
    inputShape: [...manifest.inputShape],
    outputNames: [...manifest.outputNames]
  });
}

export function mixToMono(samples, channels) {
  if (!(samples instanceof Float32Array)) {
    throw new TypeError("Audio samples must be supplied as a Float32Array.");
  }
  if (!Number.isSafeInteger(channels) || channels < 1) {
    throw new Error("Audio channel count must be a positive integer.");
  }
  if (samples.length === 0 || samples.length % channels !== 0) {
    throw new Error("Audio sample data is empty or does not contain complete channel frames.");
  }

  const frames = samples.length / channels;
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      const value = samples[frame * channels + channel];
      if (!Number.isFinite(value)) throw new Error("Audio contains a non-finite sample value.");
      sum += value;
    }
    mono[frame] = sum / channels;
  }
  return mono;
}

function prepareModelInput({ samples, sampleRate, channels }, manifest) {
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0) {
    throw new Error("Audio sample rate must be a positive integer.");
  }
  if (manifest.sampleRate && sampleRate !== manifest.sampleRate) {
    throw new Error(
      "This model requires " + manifest.sampleRate + " Hz audio, but the selected audio is " +
      sampleRate + " Hz. Resampling is not implemented yet."
    );
  }

  const mono = mixToMono(samples, channels);
  const expectedLength = manifest.inputShape.reduce((total, dimension) => total * dimension, 1);
  if (expectedLength !== mono.length) {
    throw new Error(
      "This model expects " + expectedLength + " mono samples, but the selected audio contains " +
      mono.length + ". Chunking and overlap reconstruction are not implemented yet."
    );
  }
  return mono;
}

function validateSessionMetadata(session, manifest) {
  if (!Array.isArray(session.inputNames) || !Array.isArray(session.outputNames)) {
    throw new Error("ONNX session metadata is unavailable; refusing to run an unverified model.");
  }
  if (!session.inputNames.includes(manifest.inputName)) {
    throw new Error("Model input tensor '" + manifest.inputName + "' was not found in the ONNX file.");
  }
  const missingOutputs = manifest.outputNames.filter(name => !session.outputNames.includes(name));
  if (missingOutputs.length) {
    throw new Error("Model output tensor(s) not found: " + missingOutputs.join(", ") + ".");
  }
}

function flattenAudioOutput(data, name, expectedLength) {
  if (!data || typeof data.length !== "number" || data.length !== expectedLength) {
    throw new Error("Model output '" + name + "' must contain exactly " + expectedLength + " samples.");
  }
  const output = Float32Array.from(data, Number);
  for (let index = 0; index < output.length; index++) {
    if (!Number.isFinite(output[index])) {
      throw new Error("Model output '" + name + "' contains a non-finite sample value.");
    }
  }
  return output;
}

async function readManifest(manifestUrl) {
  const response = await fetch(manifestUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Model manifest not found (" + response.status + ").");
  return validateManifest(await response.json());
}

async function createValidatedSession(ort, modelUrl, manifest) {
  await validateLocalModel(modelUrl);
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all"
  });
  try {
    validateSessionMetadata(session, manifest);
    return session;
  } catch (error) {
    await session.release?.();
    throw error;
  }
}

/**
 * Inspect a bundled ONNX model without running inference. This is the model
 * integration preflight to run after a real, licensed model is added.
 */
export async function inspectLocalModel({
  modelUrl = "./models/stemit-vocal-separator.onnx",
  manifestUrl = "./models/manifest.json"
} = {}) {
  const ort = await loadLocalOnnxRuntime();
  const manifest = await readManifest(manifestUrl);
  const session = await createValidatedSession(ort, modelUrl, manifest);
  try {
    return {
      ok: true,
      modelUrl,
      inputName: manifest.inputName,
      inputShape: [...manifest.inputShape],
      outputNames: [...manifest.outputNames],
      sampleRate: manifest.sampleRate || null,
      runtimeInputs: [...session.inputNames],
      runtimeOutputs: [...session.outputNames]
    };
  } finally {
    await session.release?.();
  }
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
  const manifest = await readManifest(manifestUrl);
  const mono = prepareModelInput({ samples, sampleRate, channels }, manifest);
  const session = await createValidatedSession(ort, modelUrl, manifest);

  try {
    const input = new ort.Tensor("float32", mono, manifest.inputShape);
    onProgress(25, "Running offline AI model…");
    const results = await session.run({ [manifest.inputName]: input });
    const vocalName = manifest.outputNames[0];
    const vocals = flattenAudioOutput(results?.[vocalName]?.data, vocalName, mono.length);
    const instrumental = manifest.instrumentalOutputName
      ? flattenAudioOutput(
          results?.[manifest.instrumentalOutputName]?.data,
          manifest.instrumentalOutputName,
          mono.length
        )
      : null;

    onProgress(90, "Preparing separated audio…");
    return {
      sampleRate,
      channels: 1,
      vocals,
      instrumental
    };
  } finally {
    await session.release?.();
  }
}
