// Generates the PWA icons from a simple SVG. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f766e"/>
  <rect x="136" y="136" width="108" height="108" rx="22" fill="#f0fdfa"/>
  <rect x="268" y="136" width="108" height="108" rx="22" fill="#99f6e4"/>
  <rect x="136" y="268" width="108" height="108" rx="22" fill="#99f6e4"/>
  <rect x="268" y="268" width="108" height="108" rx="22" fill="#f0fdfa"/>
</svg>`;

await mkdir("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/icons/icon-${size}.png`);
}
await sharp(Buffer.from(svg(180))).png().toFile("src/app/apple-icon.png");
console.log("icons written");
