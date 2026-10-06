// Turns the original product photos in product-photos/ into small, sharp WebP files for the website:
//   product-photos/hario-mug.jpg  →  public/products/hario-mug-400.webp and hario-mug-800.webp
// Runs automatically before every build (npm run build) and on GitHub Actions. Originals are never changed.
import {readdirSync, mkdirSync, statSync, existsSync} from 'node:fs';
import {join, extname, basename} from 'node:path';
import sharp from 'sharp';

const SRC = 'product-photos';
const OUT = 'public/products';
const WIDTHS = [400, 800];
const PHOTO = /\.(jpe?g|png|webp|avif|tiff?)$/i;

if (!existsSync(SRC)) process.exit(0);
mkdirSync(OUT, {recursive: true});
let made = 0;
for (const file of readdirSync(SRC).filter(f => PHOTO.test(f))) {
  const name = basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const input = join(SRC, file), changed = statSync(input).mtimeMs;
  for (const width of WIDTHS) {
    const output = join(OUT, `${name}-${width}.webp`);
    if (existsSync(output) && statSync(output).mtimeMs >= changed) continue;
    await sharp(input).rotate().resize({width, height: width, fit: 'inside', withoutEnlargement: true}).webp({quality: 78}).toFile(output);
    made++;
  }
}
if (made) console.log(`Optimised ${made} product image file(s) into ${OUT}/`);
