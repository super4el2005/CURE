import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const directory = resolve(import.meta.dirname, "../public/icons");
const svg = await readFile(resolve(directory, "icon.svg"));

await Promise.all(
  [192, 512, 180].map((size) =>
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile(resolve(directory, size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`)),
  ),
);

await sharp(Buffer.from(svg.toString().replace('rx="112"', 'rx="0"')))
  .png()
  .toFile(resolve(directory, "icon-maskable-512.png"));
