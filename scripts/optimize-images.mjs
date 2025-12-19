#!/usr/bin/env node
/**
 * Optimize gallery images using Node + sharp.
 * - Large display: long edge 1600px (default) -> JPEG/WebP/AVIF
 * - Square thumbnails: 480x480px (default) -> JPEG/WebP/AVIF
 *
 * Usage:
 *   npm run optimize
 *   node scripts/optimize-images.mjs           // defaults (1600, 480)
 *   node scripts/optimize-images.mjs 2048 512  // override sizes
 *
 * Behavior:
 *   1) Iterate ALL raster images directly under /images (excluding /images/optimized and non-raster like SVG)
 *   2) Create optimized assets if needed (missing or stale vs source mtime)
 *   3) Clean up /images/optimized entries that no longer have a corresponding source
 *   4) Regenerate gallery DOM and inject into index.html between markers
 *
 * Requires: sharp, fast-glob
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
const GALLERY_HTML = path.join(ROOT, "gallery-items.html");
const INDEX_HTML = path.join(ROOT, "index.html");
const GALLERY_MARK_START = "<!-- GALLERY:START -->";
const GALLERY_MARK_END = "<!-- GALLERY:END -->";

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

// What we consider "raster" sources to optimize
const RASTER_EXTS = new Set([".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG", ".heic", ".HEIC"]);

// Minimum long-edge dimension to include an image in the gallery (helps exclude tiny icons/logos)
const MIN_GALLERY_LONG_EDGE = 600;

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

async function statMtimeMs(p) {
  try {
    const st = await fs.stat(p);
    return st.mtimeMs || 0;
  } catch {
    return 0;
  }
}

async function needsRebuild(srcPath, outPath) {
  if (!(await fileExists(outPath))) return true;
  const [s, o] = await Promise.all([statMtimeMs(srcPath), statMtimeMs(outPath)]);
  return o < s;
}

async function writeLargeVariants(srcPath, base) {
  const jpgOut = path.join(OUT_LARGE, `${base}@${LONG_EDGE}.jpg`);
  const webpOut = path.join(OUT_LARGE, `${base}@${LONG_EDGE}.webp`);
  const avifOut = path.join(OUT_LARGE, `${base}@${LONG_EDGE}.avif`);

  let rebuiltJpg = false;
  if (await needsRebuild(srcPath, jpgOut)) {
    const pipeline = sharp(srcPath, { failOn: "none" }).rotate();
    await pipeline
      .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPG_Q_LARGE, progressive: true, chromaSubsampling: "4:4:4" })
      .toFile(jpgOut);
    console.log(`  - large jpg: ${path.relative(ROOT, jpgOut)}`);
    rebuiltJpg = true;
  } else {
    // console.log(`  - large jpg up-to-date`);
  }

  const inputForWeb = jpgOut;

  if (rebuiltJpg || await needsRebuild(jpgOut, webpOut)) {
    await sharp(inputForWeb)
      .webp({ quality: WEBP_Q_LARGE })
      .toFile(webpOut);
    console.log(`  - large webp: ${path.relative(ROOT, webpOut)}`);
  } else {
    // console.log(`  - large webp up-to-date`);
  }

  if (rebuiltJpg || await needsRebuild(jpgOut, avifOut)) {
    await sharp(inputForWeb)
      .avif({ quality: AVIF_Q_LARGE, effort: 5 })
      .toFile(avifOut);
    console.log(`  - large avif: ${path.relative(ROOT, avifOut)}`);
  } else {
    // console.log(`  - large avif up-to-date`);
  }
}

async function writeThumbVariants(srcPath, base) {
  const jpgOut = path.join(OUT_THUMBS, `${base}@${THUMB_SIZE}.jpg`);
  const webpOut = path.join(OUT_THUMBS, `${base}@${THUMB_SIZE}.webp`);
  const avifOut = path.join(OUT_THUMBS, `${base}@${THUMB_SIZE}.avif`);

  let rebuiltJpg = false;
  if (await needsRebuild(srcPath, jpgOut)) {
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
    rebuiltJpg = true;
  } else {
    // console.log(`  - thumb jpg up-to-date`);
  }

  const inputForWeb = jpgOut;

  if (rebuiltJpg || await needsRebuild(jpgOut, webpOut)) {
    await sharp(inputForWeb)
      .webp({ quality: WEBP_Q_THUMB })
      .toFile(webpOut);
    console.log(`  - thumb webp: ${path.relative(ROOT, webpOut)}`);
  } else {
    // console.log(`  - thumb webp up-to-date`);
  }

  if (rebuiltJpg || await needsRebuild(jpgOut, avifOut)) {
    await sharp(inputForWeb)
      .avif({ quality: AVIF_Q_THUMB, effort: 5 })
      .toFile(avifOut);
    console.log(`  - thumb avif: ${path.relative(ROOT, avifOut)}`);
  } else {
    // console.log(`  - thumb avif up-to-date`);
  }
}

async function getImageLongEdge(srcPath) {
  try {
    const meta = await sharp(srcPath, { failOn: "none" }).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    return Math.max(w, h);
  } catch {
    return 0;
  }
}

async function processImage(srcPath, base) {
  console.log(`• Processing: ${path.relative(ROOT, srcPath)}`);

  await writeLargeVariants(srcPath, base);
  await writeThumbVariants(srcPath, base);
}

function humanizeAlt(base) {
  let alt = base.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!alt) alt = "photo";
  // Capitalize first letter
  alt = alt.charAt(0).toUpperCase() + alt.slice(1);
  return alt;
}

function generateGalleryItemsHTML(bases, { thumbSize, longEdge }) {
  const lines = [];
  lines.push(`<!-- Generated by optimize-images.mjs on ${new Date().toISOString()} -->`);
  for (const base of bases) {
    const alt = humanizeAlt(base);
    // Note: we always point <img src> to the JPG and offer avif/webp via <source>
    lines.push(
`<figure class="gallery-item">
  <picture>
    <source type="image/avif" srcset="images/optimized/thumbs/${base}@${thumbSize}.avif">
    <source type="image/webp" srcset="images/optimized/thumbs/${base}@${thumbSize}.webp">
    <img class="gallery-item__image" src="images/optimized/thumbs/${base}@${thumbSize}.jpg" alt="${alt}" loading="lazy" decoding="async" data-full="images/optimized/large/${base}@${longEdge}.jpg">
  </picture>
</figure>`);
  }
  lines.push("");
  return lines.join("\n");
}

async function updateIndexHtmlWithGallery(fragment) {
  try {
    let html = await fs.readFile(INDEX_HTML, "utf8");
    const block = `${GALLERY_MARK_START}\n${fragment}${GALLERY_MARK_END}`;

    if (html.includes(GALLERY_MARK_START) && html.includes(GALLERY_MARK_END)) {
      const re = new RegExp(`${GALLERY_MARK_START}[\\s\\S]*?${GALLERY_MARK_END}`);
      html = html.replace(re, block);
      await fs.writeFile(INDEX_HTML, html, "utf8");
      console.log(`  Index: ${path.relative(ROOT, INDEX_HTML)} (updated via markers)`);
      return;
    }

    const galleryDivRe = /(<div\s+class="gallery"\s*>)([\s\S]*?)(<\/div>)/;
    if (galleryDivRe.test(html)) {
      html = html.replace(galleryDivRe, `$1\n${block}\n$3`);
      await fs.writeFile(INDEX_HTML, html, "utf8");
      console.log(`  Index: ${path.relative(ROOT, INDEX_HTML)} (updated .gallery and added markers)`);
      return;
    }

    console.warn("! Could not find .gallery container in index.html; skipped updating index.html");
  } catch (e) {
    console.error("! Failed to update index.html:", e?.message || e);
  }
}

function parseOptimizedBase(filename) {
  // Accept: anything like "<base>@<size>.<ext>"
  const name = path.basename(filename, path.extname(filename));
  const m = name.match(/^(.*)@(\d+)$/);
  if (!m) return null;
  return { base: m[1], size: Number(m[2]) };
}

async function cleanupOrphans(validBases, { longEdge, thumbSize }) {
  const patterns = [
    path.join(OUT_LARGE, `*@[0-9]*.{jpg,jpeg,webp,avif}`),
    path.join(OUT_THUMBS, `*@[0-9]*.{jpg,jpeg,webp,avif}`),
  ];
  const files = await fg(patterns, { onlyFiles: true, unique: true, dot: false });

  let removed = 0;
  for (const f of files) {
    const parsed = parseOptimizedBase(path.basename(f));
    if (!parsed) continue;
    // Only consider current configured sizes for cleanup
    const expectedSize = f.startsWith(OUT_LARGE) ? longEdge : (f.startsWith(OUT_THUMBS) ? thumbSize : null);
    if (expectedSize == null || parsed.size !== expectedSize) continue;

    if (!validBases.has(parsed.base)) {
      try {
        await fs.unlink(f);
        removed++;
        // console.log(`  - removed orphan: ${path.relative(ROOT, f)}`);
      } catch (e) {
        console.warn(`! Failed to remove orphan ${path.relative(ROOT, f)}: ${e?.message || e}`);
      }
    }
  }
  if (removed) {
    console.log(`  Cleanup: removed ${removed} orphan optimized file(s)`);
  }
}

async function scanSources() {
  // Only files directly under images/ (not subfolders). Exclude images/optimized/**
  const files = await fg([path.join(IMG_DIR, "*")], {
    onlyFiles: true,
    unique: true,
    dot: false,
    ignore: [path.join(IMG_DIR, "optimized/**")],
  });
  // Keep raster images only
  const raster = files.filter(f => RASTER_EXTS.has(path.extname(f)));
  return raster;
}

function sortBasesNatural(bases) {
  // Natural order (case-insensitive, numeric aware)
  return Array.from(new Set(bases)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

async function main() {
  console.log(`Using LONG_EDGE=${LONG_EDGE}px, THUMB_SIZE=${THUMB_SIZE}px`);
  console.log(`Source: ${IMG_DIR}`);
  console.log(`Output: ${OUT_LARGE} and ${OUT_THUMBS}`);

  await ensureDir(OUT_LARGE);
  await ensureDir(OUT_THUMBS);

  const files = await scanSources();
  if (!files.length) {
    console.log("No source images found under images/. Nothing to do.");
    return;
  }

  const start = Date.now();
  let count = 0;
  const processedBases = [];

  // Prepare items with base names and sort deterministically by natural order of base
  const items = files.map((f) => ({ path: f, base: baseNameNoExt(f) }))
    .sort((a, b) => a.base.localeCompare(b.base, undefined, { numeric: true, sensitivity: "base" }));

  await asyncPool(4, items, async (it) => {
    try {
      // Skip extremely small images from gallery/optimization to avoid logos/icons,
      // but still allow optimization for all if you want by removing this check.
      const longEdge = await getImageLongEdge(it.path);
      const eligibleForGallery = longEdge >= MIN_GALLERY_LONG_EDGE;

      await processImage(it.path, it.base);
      processedBases.push(it.base);
      count++;
    } catch (err) {
      console.error(`! Failed processing ${it.path}:`, err?.message || err);
    }
  });
  const ms = Date.now() - start;

  try {
    const basesSorted = sortBasesNatural(processedBases);
    const html = generateGalleryItemsHTML(basesSorted, { thumbSize: THUMB_SIZE, longEdge: LONG_EDGE });
    await fs.writeFile(GALLERY_HTML, html, "utf8");
    console.log(`  Gallery: ${path.relative(ROOT, GALLERY_HTML)} (updated)`);
    await updateIndexHtmlWithGallery(html);
  } catch (e) {
    console.error("! Failed to write gallery HTML:", e?.message || e);
  }

  // Cleanup orphans: anything in optimized for the current configured sizes that no longer has a source
  await cleanupOrphans(new Set(processedBases), { longEdge: LONG_EDGE, thumbSize: THUMB_SIZE });

  console.log(`✔ Done. Processed ${count} image(s) in ${ms}ms.`);
  console.log(`  Large : ${path.relative(ROOT, OUT_LARGE)}/*@${LONG_EDGE}.(jpg|webp|avif)`);
  console.log(`  Thumbs: ${path.relative(ROOT, OUT_THUMBS)}/*@${THUMB_SIZE}.(jpg|webp|avif)`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
