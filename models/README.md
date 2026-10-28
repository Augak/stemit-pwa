# Offline model assets

Stemit keeps model weights separate from the UI because model licensing and size
must be verified before shipping them to users.

To enable the AI path:

1. Add a license-compatible ONNX separation model as:
   models/stemit-vocal-separator.onnx
2. Update models/manifest.json with the model's input/output tensor names.
3. Bundle a local copy of ONNX Runtime Web as:
   vendor/ort.min.js
4. Test on an Android device with limited storage/RAM before publishing.

Until those files are present, Stemit deliberately stays in the transparent
centre/side extraction mode and labels it as such.
