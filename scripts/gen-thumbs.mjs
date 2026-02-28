// Script to generate WebP thumbnails from frame PNGs using sharp-cli
// Run: node scripts/gen-thumbs.mjs
// Outputs to: public/frames/thumbs/

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const framesDir = join(__dirname, "../public/frames");
const thumbsDir = join(__dirname, "../public/frames/thumbs");

if (!existsSync(thumbsDir)) {
  mkdirSync(thumbsDir, { recursive: true });
}

const pngs = readdirSync(framesDir).filter(
  (f) => f.endsWith(".png") && !f.includes("overlay"),
);

console.log(`Generating WebP thumbnails for ${pngs.length} frames...`);

for (const file of pngs) {
  const inputPath = join(framesDir, file);
  const outputName = `${basename(file, extname(file))}.webp`;
  const outputPath = join(thumbsDir, outputName);

  if (existsSync(outputPath)) {
    console.log(`  ✓ ${outputName} (already exists)`);
    continue;
  }

  try {
    // sharp-cli uses subcommand syntax: sharp-cli [options] resize [w] [h]
    execSync(
      `npx sharp-cli --input "${inputPath}" --output "${outputPath}" --format webp resize 300`,
      { stdio: "pipe" },
    );
    console.log(`  ✓ ${outputName}`);
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message.split("\n")[0]}`);
  }
}

console.log(
  "\nDone. Update frames.ts thumbSrc fields to use /frames/thumbs/<name>.webp",
);
