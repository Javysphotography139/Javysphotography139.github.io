#!/usr/bin/env node
/**
 * Optimize gallery images using Node + sharp.
 * - Large display: long edge 1600px (default) -> JPEG/WebP/AVIF
 * - Square thumbnails: 480x480px (default) -> JPEG/WebP/AVIF
 *
 * Usage:
 *   node scripts/optimize-images.mjs
 *   node scripts/optimize-images.mjs 2048 512   // override sizes
 *
 * Requires: sharp, fast-glob
 *   npm install
 *   npm run optimize
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fg from "fast-glob";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const IMG_DIR = path.join(ROOT, "images");
const OUT_LARGE = path.join(IMG_DIR, "optimized", "large");
const OUT_THUMBS = path.join(IMG_DIR, "optimized", "thumbs");

// Sizes (defaults can be overridden via argv)
const LONG_EDGE = Number(process.argv[2] || 1600);
const THUMB_SIZE = Number(process.argv[3] || 480);

// Quality settings
const JPG_Q_LARGE = 82;
const JPG_Q_THUMB = 80;
const WEBP_Q_LARGE = 82;
const WEBP_Q_THUMB = 75;
// AVIF quality: sharp uses 0-100 scale (higher = better)
const AVIF_Q_LARGE = 48;
const AVIF_Q_THUMB = 46;

// Small async pool to limit concurrency
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function baseNameNoExt(p) {
  return path.basename(p, path.extname(p));
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeLargeVariants(srcPath, base) {
  const jpgOut = path.join(OUT_LARGE, `${base}@${LONG_EDGE}.jpg`);
  const webpOut = path.join(OUT_LARGE, `${base}@${LONG_EDGE}.webp`);
  const avifOut = path.join(OUT_LARGE, `${base}@${LONG_EDGE}.avif`);

  if (!(await fileExists(jpgOut))) {
    const pipeline = sharp(srcPath, { failOn: "none" }).rotate();
    await pipeline
      .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPG_Q_LARGE, progressive: true, chromaSubsampling: "4:4:4" })
      .toFile(jpgOut);
    console.log(`  - large jpg: ${path.relative(ROOT, jpgOut)}`);
  } else {
    console.log(`  - large jpg exists, skipping`);
  }

  // Derivatives from the just-written JPEG (ensures consistent input)
  const inputForWeb = jpgOut;

  if (!(await fileExists(webpOut))) {
    await sharp(inputForWeb)
      .webp({ quality: WEBP_Q_LARGE })
      .toFile(webpOut);
    console.log(`  - large webp: ${path.relative(ROOT, webpOut)}`);
  } else {
    console.log(`  - large webp exists, skipping`);
  }

  if (!(await fileExists(avifOut))) {
    await sharp(inputForWeb)
      .avif({ quality: AVIF_Q_LARGE, effort: 5 })
      .toFile(avifOut);
    console.log(`  - large avif: ${path.relative(ROOT, avifOut)}`);
  } else {
    console.log(`  - large avif exists, skipping`);
  }
}

async function writeThumbVariants(srcPath, base) {
  const jpgOut = path.join(OUT_THUMBS, `${base}@${THUMB_SIZE}.jpg`);
  const webpOut = path.join(OUT_THUMBS, `${base}@${THUMB_SIZE}.webp`);
  const avifOut = path.join(OUT_THUMBS, `${base}@${THUMB_SIZE}.avif`);

  if (!(await fileExists(jpgOut))) {
    const pipeline = sharp(srcPath, { failOn: "none" }).rotate();
    await pipeline
      .resize({
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        fit: "cover",
        position: "attention",
        withoutEnlargement: true
      })
      .jpeg({ quality: JPG_Q_THUMB, progressive: true, chromaSubsampling: "4:4:4" })
      .toFile(jpgOut);
    console.log(`  - thumb jpg: ${path.relative(ROOT, jpgOut)}`);
  } else {
    console.log(`  - thumb jpg exists, skipping`);
  }

  const inputForWeb = jpgOut;

  if (!(await fileExists(webpOut))) {
    await sharp(inputForWeb)
      .webp({ quality: WEBP_Q_THUMB })
      .toFile(webpOut);
    console.log(`  - thumb webp: ${path.relative(ROOT, webpOut)}`);
  } else {
    console.log(`  - thumb webp exists, skipping`);
  }

  if (!(await fileExists(avifOut))) {
    await sharp(inputForWeb)
      .avif({ quality: AVIF_Q_THUMB, effort: 5 })
      .toFile(avifOut);
    console.log(`  - thumb avif: ${path.relative(ROOT, avifOut)}`);
  } else {
    console.log(`  - thumb avif exists, skipping`);
  }
}

async function processImage(srcPath) {
  const base = baseNameNoExt(srcPath);
  console.log(`• Processing: ${path.relative(ROOT, srcPath)}`);

  await writeLargeVariants(srcPath, base);
  await writeThumbVariants(srcPath, base);
}

async function main() {
  console.log(`Using LONG_EDGE=${LONG_EDGE}px, THUMB_SIZE=${THUMB_SIZE}px`);
  console.log(`Source: ${IMG_DIR}`);
  console.log(`Output: ${OUT_LARGE} and ${OUT_THUMBS}`);

  await ensureDir(OUT_LARGE);
  await ensureDir(OUT_THUMBS);

  const patterns = [
    path.join(IMG_DIR, "photo_*.jpg"),
    path.join(IMG_DIR, "photo_*.jpeg"),
    path.join(IMG_DIR, "photo_*.JPG"),
    path.join(IMG_DIR, "photo_*.JPEG"),
    path.join(IMG_DIR, "photo_*.png"),
    path.join(IMG_DIR, "photo_*.PNG"),
  ];

  const files = await fg(patterns, { onlyFiles: true, unique: true, dot: false });
  if (!files.length) {
    console.log("No source images found matching images/photo_*.(jpg|jpeg|png). Nothing to do.");
    return;
  }

  const start = Date.now();
  let count = 0;
  await asyncPool(4, files, async (f) => {
    try {
      await processImage(f);
      count++;
    } catch (err) {
      console.error(`! Failed processing ${f}:`, err?.message || err);
    }
  });
  const ms = Date.now() - start;

  console.log(`✔ Done. Processed ${count} image(s) in ${ms}ms.`);
  console.log(`  Large : ${path.relative(ROOT, OUT_LARGE)}/*@${LONG_EDGE}.(jpg|webp|avif)`);
  console.log(`  Thumbs: ${path.relative(ROOT, OUT_THUMBS)}/*@${THUMB_SIZE}.(jpg|webp|avif)`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
