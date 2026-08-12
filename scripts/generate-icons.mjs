// Generate PWA icons + favicon from the design-token lantern.
// Run: node scripts/generate-icons.mjs
//
// Produces:
//   public/icon.svg               — vector master (used by favicon meta)
//   public/icon-180.png           — apple-touch-icon (iOS home screen)
//   public/icon-192.png           — Android manifest
//   public/icon-512.png           — Android manifest / splash
//   public/icon-maskable-512.png  — maskable variant (safe-zone body)
//   public/favicon.ico            — browser tab
//
// The lantern shape uses the audit's tokens directly:
//   body   #F6C45A (lantern)
//   frame  #241E1A (ink)
//   halo   rgba(246, 196, 90, 0.18)
//   bg     #FBF6EE (paper) — for regular icons
//   bg     #0C7A55 (green) — for the maskable circle bed
//
// Placeholder-quality until real production art lands — matches the
// design tokens so it's on-brand rather than random.

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public");

// Basic lantern silhouette centred inside a 512×512 viewBox. Simple
// shapes — cap + body + tassel — coloured with the token palette.
// Kept single-path where possible so tiny sizes stay legible.
function lanternSvg({
  size = 512,
  bg = "#FBF6EE",
  maskable = false,
  showRoundedBg = true,
} = {}) {
  // Maskable icons need the body inside the "safe zone" — a circle
  // with 80% diameter of the canvas centred on it. We paint the whole
  // canvas the brand green and shrink the lantern to fit.
  const bodyScale = maskable ? 0.6 : 0.82;
  const bodyPaint = "#F6C45A";
  const frame = "#241E1A";
  const halo = "rgba(246, 196, 90, 0.22)";
  const cx = 256;
  const cy = 256;

  // Lantern anatomy — proportional to a 512-canvas base.
  const bodyW = 190 * bodyScale;
  const bodyH = 250 * bodyScale;
  const capW = 130 * bodyScale;
  const capH = 34 * bodyScale;
  const handleW = 90 * bodyScale;
  const handleH = 60 * bodyScale;

  const bodyX = cx - bodyW / 2;
  const bodyY = cy - bodyH / 2 + 20 * bodyScale;
  const bodyR = 24 * bodyScale;

  const capX = cx - capW / 2;
  const capY = bodyY - capH + 4;

  const handleX = cx - handleW / 2;
  const handleY = capY - handleH;

  const bgFill = maskable
    ? "#0C7A55"
    : showRoundedBg
      ? bg
      : "none";

  const cornerR = maskable ? 0 : 96;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" rx="${cornerR}" ry="${cornerR}" fill="${bgFill}"/>
  <!-- soft halo -->
  <circle cx="${cx}" cy="${cy + 10}" r="${bodyW * 1.15}" fill="${halo}"/>
  <!-- handle -->
  <path
    d="M ${handleX} ${handleY + handleH}
       q 0 -${handleH} ${handleW / 2} -${handleH}
       q ${handleW / 2} 0 ${handleW / 2} ${handleH}"
    stroke="${frame}" stroke-width="${10 * bodyScale}"
    fill="none" stroke-linecap="round"/>
  <!-- cap -->
  <rect x="${capX}" y="${capY}" width="${capW}" height="${capH}"
        rx="${8 * bodyScale}" fill="${frame}"/>
  <!-- body glass -->
  <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}"
        rx="${bodyR}" fill="${bodyPaint}"/>
  <!-- body frame -->
  <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}"
        rx="${bodyR}" fill="none" stroke="${frame}" stroke-width="${8 * bodyScale}"/>
  <!-- vertical frame divider (single, subtle) -->
  <line x1="${cx}" y1="${bodyY + 12 * bodyScale}" x2="${cx}"
        y2="${bodyY + bodyH - 12 * bodyScale}"
        stroke="${frame}" stroke-width="${5 * bodyScale}" opacity="0.55"/>
  <!-- base foot -->
  <rect x="${cx - (capW - 10) / 2}" y="${bodyY + bodyH - 2}"
        width="${capW - 10}" height="${18 * bodyScale}"
        rx="${6 * bodyScale}" fill="${frame}"/>
</svg>`;
}

async function writeSvg(name, svg) {
  await fs.writeFile(path.join(OUT, name), svg);
  console.log(`  · wrote ${name}`);
}

async function writePng(name, size, opts = {}) {
  const svg = lanternSvg({ size, ...opts });
  const buf = Buffer.from(svg);
  await sharp(buf).resize(size, size).png().toFile(path.join(OUT, name));
  console.log(`  · wrote ${name} (${size}×${size})`);
}

async function writeIco() {
  // Small favicon: generate 48px PNG then rename to .ico —
  // Chrome + Firefox + Safari all accept PNG-inside-.ico for favicons.
  const svg = lanternSvg({ size: 48, showRoundedBg: true });
  const buf = Buffer.from(svg);
  const png = await sharp(buf).resize(48, 48).png().toBuffer();
  await fs.writeFile(path.join(OUT, "favicon.ico"), png);
  console.log("  · wrote favicon.ico (48×48 PNG-in-ICO)");
}

console.log("Generating Noi lantern icons →");
await writeSvg("icon.svg", lanternSvg({ showRoundedBg: false }));
await writePng("icon-180.png", 180);
await writePng("icon-192.png", 192);
await writePng("icon-512.png", 512);
await writePng("icon-maskable-512.png", 512, { maskable: true });
await writeIco();
console.log("Done.");
