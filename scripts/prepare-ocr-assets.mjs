import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicOcrRoot = join(root, "public", "ocr");
const publicOcr = join(publicOcrRoot, "v7");
const publicOpenCv = join(root, "public", "opencv");
const core = join(root, "node_modules", "tesseract.js-core");
const tesseract = join(root, "node_modules", "tesseract.js", "dist");
const fra = join(root, "node_modules", "@tesseract.js-data", "fra", "4.0.0", "fra.traineddata.gz");
const eng = join(root, "node_modules", "@tesseract.js-data", "eng", "4.0.0", "eng.traineddata.gz");

await rm(publicOcrRoot, { recursive: true, force: true });
await rm(publicOpenCv, { recursive: true, force: true });
await mkdir(join(publicOcr, "core"), { recursive: true });
await mkdir(publicOpenCv, { recursive: true });
await mkdir(join(publicOcr, "lang"), { recursive: true });

await cp(join(tesseract, "worker.min.js"), join(publicOcr, "worker.min.js"));
await cp(
  join(root, "node_modules", "@techstark", "opencv-js", "dist", "opencv.js"),
  join(publicOpenCv, "opencv.js"),
);

for (const file of [
  "tesseract-core.wasm.js",
  "tesseract-core.wasm",
  "tesseract-core-simd.wasm.js",
  "tesseract-core-simd.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm",
  "tesseract-core-relaxedsimd.wasm.js",
  "tesseract-core-relaxedsimd.wasm",
]) {
  await cp(join(core, file), join(publicOcr, "core", file));
}

await cp(fra, join(publicOcr, "lang", "fra.traineddata.gz"));
await cp(eng, join(publicOcr, "lang", "eng.traineddata.gz"));

console.log("OCR assets prepared in public/ocr");
