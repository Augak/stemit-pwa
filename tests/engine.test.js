import test from "node:test";
import assert from "node:assert/strict";
import {
  validateManifest,
  mixToMono,
  inspectLocalModel,
  separateWithLocalModel
} from "../engine.js";

const baseManifest = {
  name: "test-separator",
  version: 1,
  inputName: "audio",
  inputShape: [1, 1, 4],
  outputNames: ["vocals", "instrumental"],
  instrumentalOutputName: "instrumental",
  sampleRate: 44100
};

function mockEnvironment({
  manifest = baseManifest,
  inputNames = ["audio"],
  outputNames = ["vocals", "instrumental"],
  outputData,
  instrumentalData,
  modelStatus = 200
} = {}) {
  const calls = { released: 0, run: 0, tensors: [] };
  class Tensor {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
      calls.tensors.push(this);
    }
  }
  const session = {
    inputNames,
    outputNames,
    async run(feeds) {
      calls.run++;
      assert.ok(feeds.audio instanceof Tensor);
      return {
        vocals: { data: outputData ?? Float32Array.from([0.1, 0.2, 0.3, 0.4]) },
        instrumental: {
          data: instrumentalData ?? Float32Array.from([0.4, 0.3, 0.2, 0.1])
        }
      };
    },
    async release() {
      calls.released++;
    }
  };

  globalThis.window = {
    ort: {
      Tensor,
      InferenceSession: {
        async create() {
          return session;
        }
      }
    }
  };

  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "HEAD") {
      return {
        ok: modelStatus >= 200 && modelStatus < 300,
        status: modelStatus
      };
    }
    return {
      ok: true,
      async json() {
        return manifest;
      }
    };
  };
  return calls;
}

test("accepts a fixed batch-1 mono model contract", () => {
  const manifest = validateManifest(baseManifest);
  assert.deepEqual(manifest.inputShape, [1, 1, 4]);
  assert.deepEqual(manifest.outputNames, ["vocals", "instrumental"]);
});

test("rejects malformed shapes, duplicate outputs and undeclared instrumental output", () => {
  assert.throws(
    () => validateManifest({ ...baseManifest, inputShape: [1, -1, 4] }),
    /fixed positive 3D/
  );
  assert.throws(
    () => validateManifest({ ...baseManifest, inputShape: [1, 2, 2] }),
    /mono model inputs/
  );
  assert.throws(
    () => validateManifest({ ...baseManifest, outputNames: ["vocals", "vocals"] }),
    /duplicate/
  );
  assert.throws(
    () => validateManifest({ ...baseManifest, instrumentalOutputName: "other" }),
    /also appear/
  );
});

test("mixes interleaved stereo samples into complete mono frames", () => {
  const mono = mixToMono(Float32Array.from([1, -1, 0.5, 0.5]), 2);
  assert.deepEqual([...mono], [0, 0.5]);
});

test("rejects incomplete interleaved channel frames", () => {
  assert.throws(
    () => mixToMono(Float32Array.from([0.1, 0.2, 0.3]), 2),
    /complete channel frames/
  );
});

test("preflights ONNX tensor metadata and releases the session", async () => {
  const calls = mockEnvironment();
  const result = await inspectLocalModel();
  assert.equal(result.ok, true);
  assert.deepEqual(result.runtimeInputs, ["audio"]);
  assert.equal(calls.released, 1);
});

test("refuses an ONNX file whose input tensor does not match the manifest", async () => {
  const calls = mockEnvironment({ inputNames: ["waveform"] });
  await assert.rejects(inspectLocalModel(), /input tensor 'audio' was not found/);
  assert.equal(calls.released, 1);
});

test("runs a compatible local model and returns copied mono outputs", async () => {
  const calls = mockEnvironment();
  const result = await separateWithLocalModel({
    samples: Float32Array.from([0.1, 0.2, 0.3, 0.4]),
    sampleRate: 44100,
    channels: 1
  });
  assert.equal(result.channels, 1);
  for (const [actual, expected] of [
    [result.vocals, [0.1, 0.2, 0.3, 0.4]],
    [result.instrumental, [0.4, 0.3, 0.2, 0.1]]
  ]) {
    assert.equal(actual.length, expected.length);
    actual.forEach((value, index) => {
      assert.ok(Math.abs(value - expected[index]) < 1e-6);
    });
  }
  assert.equal(calls.run, 1);
  assert.equal(calls.released, 1);
});

test("rejects a sample-rate mismatch before model inference", async () => {
  const calls = mockEnvironment();
  await assert.rejects(
    separateWithLocalModel({
      samples: Float32Array.from([0.1, 0.2, 0.3, 0.4]),
      sampleRate: 48000,
      channels: 1
    }),
    /requires 44100 Hz/
  );
  assert.equal(calls.run, 0);
  assert.equal(calls.released, 0);
});

test("rejects wrong-length model output and still releases the session", async () => {
  const calls = mockEnvironment({
    outputData: Float32Array.from([0.1, 0.2])
  });
  await assert.rejects(
    separateWithLocalModel({
      samples: Float32Array.from([0.1, 0.2, 0.3, 0.4]),
      sampleRate: 44100,
      channels: 1
    }),
    /exactly 4 samples/
  );
  assert.equal(calls.released, 1);
});

test("rejects non-finite model output and still releases the session", async () => {
  const calls = mockEnvironment({
    outputData: Float32Array.from([0.1, NaN, 0.3, 0.4])
  });
  await assert.rejects(
    separateWithLocalModel({
      samples: Float32Array.from([0.1, 0.2, 0.3, 0.4]),
      sampleRate: 44100,
      channels: 1
    }),
    /non-finite/
  );
  assert.equal(calls.released, 1);
});

test("fails clearly when the local ONNX file is missing", async () => {
  const calls = mockEnvironment({ modelStatus: 404 });
  await assert.rejects(
    inspectLocalModel(),
    /Local model unavailable \(404\)/
  );
  assert.equal(calls.released, 0);
});
