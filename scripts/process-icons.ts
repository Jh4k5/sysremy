/** معالجة أيقونة Systemy: أحجام Android mipmap + PWA + adaptive foreground */
import sharp from "sharp";
import fs from "fs";
import path from "path";

const RAW = "/home/z/my-project/apk-icon-raw.png";
const APK_RES = "/home/z/my-project/apk/res";
const PUBLIC_ICONS = "/home/z/my-project/public/icons";

fs.mkdirSync(PUBLIC_ICONS, { recursive: true });

const densities = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

async function main() {
  // 1) أيقونات Android التقليدية (المستخدمة لـ <26 أو عند غياب adaptive)
  for (const [dir, size] of Object.entries(densities)) {
    const outDir = path.join(APK_RES, dir);
    fs.mkdirSync(outDir, { recursive: true });
    await sharp(RAW).resize(size, size, { fit: "cover" }).png().toFile(path.join(outDir, "ic_launcher.png"));
    console.log(`✓ ${dir}/ic_launcher.png ${size}px`);
  }

  // 2) Adaptive foreground: الأيقونة 58% في المنتصف على canvas شفاف 432px (منطقة الأمان)
  fs.mkdirSync(path.join(APK_RES, "drawable-nodpi"), { recursive: true });
  await sharp({
    create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: await sharp(RAW).resize(251, 251, { fit: "cover" }).png().toBuffer(), top: 90, left: 90 }])
    .png()
    .toFile(path.join(APK_RES, "drawable-nodpi/ic_launcher_fg.png"));
  console.log("✓ drawable-nodpi/ic_launcher_fg.png 432px (58%)");

  // 3) أيقونات PWA
  await sharp(RAW).resize(512, 512, { fit: "cover" }).png().toFile(path.join(PUBLIC_ICONS, "icon-512.png"));
  await sharp(RAW).resize(192, 192, { fit: "cover" }).png().toFile(path.join(PUBLIC_ICONS, "icon-192.png"));
  await sharp(RAW).resize(512, 512, { fit: "cover" }).png().toFile(path.join(PUBLIC_ICONS, "icon-512-maskable.png"));
  console.log("✓ PWA icons: 512 / 192 / maskable");

  // نسخة صغيرة للمعاينة في صفحة التحميل
  await sharp(RAW).resize(96, 96, { fit: "cover" }).png().toFile(path.join(PUBLIC_ICONS, "icon-96.png"));
  console.log("✓ icon-96.png");
}

main().catch((e) => { console.error(e); process.exit(1); });
