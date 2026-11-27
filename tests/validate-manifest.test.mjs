import assert from "node:assert/strict";
import test from "node:test";
import { validateManifest } from "../docs/validate-manifest.mjs";

const base = {
  id: "demo-model",
  status: "candidate",
  license: "MIT",
  sourceUrl: "https://example.com/model.onnx",
  sha256: "a".repeat(64),
  inputName: "input",
  inputShape: [1, 1, 131072],
  outputNames: ["vocals"],
  instrumentalOutputName: null,
  sampleRate: 44100
};

test("accepts a contract-shaped candidate manifest", () => {
  assert.equal(validateManifest(base).ok, true);
});

test("accepts HTTP and HTTPS source URLs and rejects other schemes", () => {
  for (const sourceUrl of ["http://example.com/model.onnx", "https://example.com/model.onnx"]) {
    assert.equal(validateManifest({ ...base, sourceUrl }).ok, true);
  }
  for (const sourceUrl of ["ftp://example.com/model.onnx", "example.com/model.onnx", ""]) {
    const result = validateManifest({ ...base, sourceUrl });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /sourceUrl/);
  }
});

test("rejects placeholder metadata", () => {
  const result = validateManifest({ ...base, sha256: "replace-with-64-character-sha256" });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /sha256/);
});

test("rejects approved manifest without bundled model", () => {
  const result = validateManifest({ ...base, status: "approved" });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /bundled model/);
});

test("accepts approved manifest when model is present", () => {
  const result = validateManifest({ ...base, status: "approved" }, { modelExists: true });
  assert.equal(result.ok, true);
});
