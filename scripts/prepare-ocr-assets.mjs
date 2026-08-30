// scripts/prepare-ocr-assets.mjs
import { mkdir, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEST = join(ROOT, "public", "ocr", "v7");

const TESSERACT_ROOT = join(ROOT, "node_modules", "tesseract.js", "dist");
const TESSDATA_ROOT = join(ROOT, "node_modules", "@tesseract.js-data");

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function main() {
  console.log("Preparing OCR assets...");

  await ensureDir(join(DEST, "core"));
  await ensureDir(join(DEST, "lang"));
  await ensureDir(join(DEST, "cache"));

  // Copy worker
  const workerSrc = join(TESSERACT_ROOT, "worker.min.js");
  const workerDest = join(DEST, "worker.min.js");
  if (existsSync(workerSrc)) {
    await copyFile(workerSrc, workerDest);
    console.log("✓ worker.min.js");
  } else {
    console.warn("✗ worker.min.js not found");
  }

  // Copy core files
  const coreFiles = ["tesseract-core.wasm.js", "tesseract-core-simd.wasm.js"];
  for (const file of coreFiles) {
    const src = join(TESSERACT_ROOT, file);
    const dest = join(DEST, "core", file);
    if (existsSync(src)) {
      await copyFile(src, dest);
      console.log(`✓ core/${file}`);
    }
  }

  // Copy language data
  const langs = ["eng", "fra"];
  for (const lang of langs) {
    const src = join(TESSDATA_ROOT, lang, `${lang}.traineddata.gz`);
    const dest = join(DEST, "lang", `${lang}.traineddata.gz`);
    if (existsSync(src)) {
      await copyFile(src, dest);
      console.log(`✓ lang/${lang}.traineddata.gz`);
    } else {
      console.warn(`✗ lang/${lang}.traineddata.gz not found`);
    }
  }

  console.log("OCR assets prepared.");
}

main().catch((err) => {
  console.error("Failed to prepare OCR assets:", err);
  process.exit(1);
});