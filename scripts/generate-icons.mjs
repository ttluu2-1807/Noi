// Generate PWA icons + favicon from the Noi lantern.
// Run: npm run icons
//
// Source: the lantern SVG from the design HTML (page 76×76). Every
// path + colour lifted verbatim so we stay in sync with the design.
//
// Produces:
//   public/icon.svg               — vector master
//   public/icon-180.png           — apple-touch-icon (iOS home screen)
//   public/icon-192.png           — Android manifest
//   public/icon-512.png           — Android manifest / splash
//   public/icon-maskable-512.png  — maskable variant (safe-zone body)
//   public/favicon.ico            — browser tab
//
// The maskable variant paints the whole canvas green and floats the
// lantern in the middle 60% so Android's adaptive-icon crop never
// clips the body — the design's 76×76 lantern renders inside a 46×46
// window, so we shrink to 60% of canvas to be safe on any crop shape.

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public");

// The design's lantern paths, unmodified. Green rect + paper handle +
// gold body + green wick + paper base.
const LANTERN_PATHS = `
  <path d="M29 22h18" stroke="#FBF6EE" stroke-width="4" stroke-linecap="round"/>
  <path d="M27 28.5c0-2 1.6-3.5 3.6-3.5h14.8c2 0 3.6 1.5 3.6 3.5v14c0 5.6-4.8 9.5-11 9.5s-11-3.9-11-9.5Z" fill="#F6C45A"/>
  <path d="M35 36.5 L42.5 31.5" stroke="#0C7A55" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M38 55.5v4" stroke="#FBF6EE" stroke-width="4" stroke-linecap="round"/>
`;

/**
 * Build an SVG string at any pixel size. The design's paths live in a
 * 76×76 coord space with a 20-unit corner radius on the rect. We emit
 * a viewBox matching that so the paths render 1:1 regardless of size.
 *
 * For the standard icon, corner radius scales with size. For maskable,
 * we paint the whole square (no radius) and scale the lantern down so
 * the body stays inside the safe zone even under aggressive crops.
 */
function lanternSvg({ maskable = false } = {}) {
  const cornerR = maskable ? 0 : 20;
  // Maskable: shrink the lantern so it sits in the middle 60% of canvas.
  // Standard: keep the design's exact scale (lantern fills ~60% already).
  const scale = maskable ? 0.75 : 1;
  const tx = maskable ? (76 * (1 - scale)) / 2 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76" width="76" height="76">
  <rect width="76" height="76" rx="${cornerR}" fill="#0C7A55"/>
  <g transform="translate(${tx.toFixed(2)} ${tx.toFixed(2)}) scale(${scale})">
    ${LANTERN_PATHS.trim()}
  </g>
</svg>`;
}

async function writeSvg(name, svg) {
  await fs.writeFile(path.join(OUT, name), svg);
  console.log(`  · wrote ${name}`);
}

async function writePng(name, size, opts = {}) {
  const svg = lanternSvg(opts);
  const buf = Buffer.from(svg);
  await sharp(buf, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, name));
  console.log(`  · wrote ${name} (${size}×${size})`);
}

async function writeIco() {
  const svg = lanternSvg();
  const png = await sharp(Buffer.from(svg), { density: 300 })
    .resize(48, 48)
    .png()
    .toBuffer();
  await fs.writeFile(path.join(OUT, "favicon.ico"), png);
  console.log("  · wrote favicon.ico (48×48 PNG-in-ICO)");
}

console.log("Generating Noi lantern icons →");
await writeSvg("icon.svg", lanternSvg());
await writePng("icon-180.png", 180);
await writePng("icon-192.png", 192);
await writePng("icon-512.png", 512);
await writePng("icon-maskable-512.png", 512, { maskable: true });
await writeIco();
console.log("Done.");
