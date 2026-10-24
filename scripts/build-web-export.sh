#!/bin/bash
# التصدير الثابت لواجهة Systemy (بدون خادم) في مجلد معزول
# لا يمس خادم التطوير ولا .next الخاص به إطلاقاً
set -euo pipefail

SRC=/home/z/my-project
EXPORT=/home/z/systemy-export
OUT=$SRC/apk/web-assets

echo "▸ نسخ المشروع إلى $EXPORT (معزول عن خادم التطوير)..."
rm -rf "$EXPORT"
mkdir -p "$EXPORT"
cd "$SRC"
# نسخ كل شيء عدا node_modules/.next/db_logs
tar -cf - --exclude=node_modules --exclude=.next --exclude=dev.log --exclude=server.log --exclude=apk/web-assets --exclude=public/downloads --exclude=upload --exclude=tool-results --exclude=agent-ctx --exclude=nithami-ref . | (cd "$EXPORT" && tar -xf -)

# نسخة hardlink لـ node_modules (نفس الجهاز — Turbopack لا يقبل symlinks خارج الجذر)
rm -rf "$EXPORT/node_modules"
cp -al "$SRC/node_modules" "$EXPORT/node_modules"

echo "▸ نقل src/app/api بعيداً (خارج src/app — غير متوافق مع output:export)..."
mv "$EXPORT/src/app/api" "$EXPORT/api-src-backup"

echo "▸ البناء الثابت (BUILD_EXPORT=1 NEXT_PUBLIC_STANDALONE=1)..."
cd "$EXPORT"
BUILD_EXPORT=1 NEXT_PUBLIC_STANDALONE=1 bunx next build 2>&1 | tail -25

if [ ! -f "$EXPORT/out/index.html" ]; then
  echo "❌ فشل التصدير: out/index.html غير موجود"
  exit 1
fi

echo "▸ نسخ النتيجة إلى $OUT..."
rm -rf "$OUT"
cp -r "$EXPORT/out" "$OUT"

echo "▸ فحص المسارات النسبية في index.html..."
head -c 2000 "$OUT/index.html" | grep -o 'href="[^"]*"' | head -8 || true

echo ""
echo "✅ تم التصدير: $(du -sh "$OUT" | cut -f1) — $(find "$OUT" -type f | wc -l) ملفاً"
