# けしゴム / Eraser

写真の中のいらない物を、なぞって消す。Brush over things in your photos to erase them.

**For your own photos** (or photos you have the right to edit). Please don't use it to remove other people's watermarks or credits.

- Paint over an object, tap 消す / Erase, and it's filled in by AI inpainting that runs on your device.
- AI: LaMa (big-lama, ONNX export by Carve: `Carve/LaMa-ONNX` `lama_fp32.onnx`, ~200 MB, 512×512) via onnxruntime-web (WASM). Downloaded once from Hugging Face, kept in the browser cache, then works offline. Your photos never leave the device.
- Undo/redo, hold-to-compare with the original, save as JPG or share.
- Japanese by default, 日本語/English toggle. Free, no ads, no login, no analytics.

Model licence: LaMa (advimman/lama) and the Carve ONNX export are Apache-2.0.
App code: MIT.
