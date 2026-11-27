import fs from "node:fs";

export function validateManifest(manifest, { modelExists = false } = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") errors.push("manifest must be an object");
  if (!manifest?.id) errors.push("id is required");
  if (!["candidate", "approved", "blocked"].includes(manifest?.status)) {
    errors.push("status must be candidate, approved, or blocked");
  }
  if (!manifest?.license || manifest.license.startsWith("replace-with-")) errors.push("verified license is required");
  if (!/^https?:\/\//.test(manifest?.sourceUrl || "")) errors.push("sourceUrl must be http(s)");
  if (!/^[0-9a-f]{64}$/i.test(manifest?.sha256 || "")) errors.push("sha256 must be a 64-character hex digest");
  if (!Number.isInteger(manifest?.sampleRate) || manifest.sampleRate <= 0) errors.push("sampleRate must be a positive integer");
  if (!Array.isArray(manifest?.inputShape) || manifest.inputShape.length !== 3) {
    errors.push("inputShape must be [1,1,N]");
  } else if (manifest.inputShape[0] !== 1 || manifest.inputShape[1] !== 1 || !Number.isInteger(manifest.inputShape[2]) || manifest.inputShape[2] <= 0) {
    errors.push("inputShape must be batch-1 mono with positive N");
  }
  if (!manifest?.inputName || manifest.inputName.startsWith("replace-with-")) errors.push("inputName is required");
  if (!Array.isArray(manifest?.outputNames) || manifest.outputNames.length < 1 || manifest.outputNames.some((n) => !n || n.startsWith("replace-with-"))) {
    errors.push("outputNames must contain at least one real output name");
  }
  if (manifest.instrumentalOutputName && !manifest.outputNames?.includes(manifest.instrumentalOutputName)) {
    errors.push("instrumentalOutputName must be listed in outputNames");
  }
  if (manifest.status === "approved" && !modelExists) {
    errors.push("approved manifest requires a bundled model file");
  }
  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && process.argv[1].endsWith("validate-manifest.mjs")) {
  const file = process.argv[2] || "models/manifest.json";
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  const result = validateManifest(manifest, { modelExists: process.argv.includes("--model-present") });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
