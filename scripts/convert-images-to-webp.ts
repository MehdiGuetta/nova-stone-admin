// One-off migration: converts every non-WebP image already stored in the
// Asset table to WebP in place. Asset ids never change, so Product.img /
// Project.img references (which point at /api/assets/:id) stay valid —
// nothing else needs to be touched.
//
// Run with: npx tsx scripts/convert-images-to-webp.ts
// (uses DATABASE_URL from .env — point it at whichever DB you want to convert)

import "dotenv/config";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const WEBP_QUALITY = 82;

async function main() {
  const assets = await prisma.asset.findMany({
    select: { id: true, mimeType: true, data: true },
  });
  console.log(`Found ${assets.length} assets.`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const asset of assets) {
    if (asset.mimeType === "image/webp") {
      skipped++;
      continue;
    }
    if (!asset.mimeType.startsWith("image/")) {
      skipped++;
      continue;
    }

    try {
      const webpBuffer = await sharp(asset.data).webp({ quality: WEBP_QUALITY }).toBuffer();
      await prisma.asset.update({
        where: { id: asset.id },
        data: { data: webpBuffer, mimeType: "image/webp" },
      });
      bytesBefore += asset.data.length;
      bytesAfter += webpBuffer.length;
      converted++;
      console.log(`✓ ${asset.id}  ${asset.data.length}b -> ${webpBuffer.length}b`);
    } catch (error) {
      console.error(`✗ ${asset.id} failed:`, error);
      failed++;
    }
  }

  const savedPct = bytesBefore > 0 ? (100 * (1 - bytesAfter / bytesBefore)).toFixed(1) : "0";
  console.log(
    `\nDone. Converted: ${converted}, skipped (already webp / non-image): ${skipped}, failed: ${failed}`
  );
  if (converted > 0) {
    console.log(`Size: ${bytesBefore}b -> ${bytesAfter}b (${savedPct}% smaller)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
