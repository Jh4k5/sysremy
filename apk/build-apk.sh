#!/bin/bash
# بناء Systemy APK — أدوات Android الرسمية (aapt2 + d8 + zipalign + apksigner)
# الاستخدام: bash /home/z/my-project/apk/build-apk.sh [مسار-مجلد-أصول-الويب]
#
# PR-1 (الأسرار): بيانات التوقيع لا تُخزن في المستودع إطلاقاً.
#   تُقرأ من متغيرات البيئة: SYSTEMY_KS_PATH / SYSTEMY_KS_ALIAS / SYSTEMY_KS_PASS / SYSTEMY_KEY_PASS
#   مع fallback لملف env خارج المستودع (chmod 600). المخزن القديم apk/systemy.keystore
#   اعتُبر مكشوفاً (كلمة المرور كانت مطبوعة في هذا السكربت بتاريخه) واستُبدل بمخزن جديد
#   خارج شجرة المصدر. النسخ المنشورة سابقاً بهذا المفتاح: لا شيء قابل للتثبيت (كانت غير موقعة).
set -euo pipefail

SDK=/home/z/android-sdk
BT=$SDK/build-tools/34.0.0
PLATFORM=$SDK/platforms/android-34
APKDIR="$(cd "$(dirname "$0")" && pwd)"
WEB="${1:-$APKDIR/web-assets}"
OUT=$APKDIR/dist
APK_NAME="Systemy-v5.0.apk"

# ─── بيانات التوقيع (سرية — خارج المستودع) ───
ENV_FILE="${SYSTEMY_SECRETS_ENV:-/home/z/.systemy-secrets/env}"
if [ -z "${SYSTEMY_KS_PATH:-}" ] && [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
KS="${SYSTEMY_KS_PATH:-}"
KS_ALIAS="${SYSTEMY_KS_ALIAS:-systemy}"
KS_PASS="${SYSTEMY_KS_PASS:-}"
KEY_PASS="${SYSTEMY_KEY_PASS:-}"
if [ -z "$KS" ] || [ -z "$KS_PASS" ] || [ ! -f "$KS" ]; then
  echo "❌ بيانات التوقيع غير متوفرة — عرّف SYSTEMY_KS_PATH/SYSTEMY_KS_PASS أو جهّز $ENV_FILE"
  exit 1
fi

if [ ! -d "$BT" ]; then echo "❌ build-tools غير مثبتة"; exit 1; fi
if [ ! -f "$WEB/index.html" ]; then echo "❌ $WEB/index.html غير موجود (شغّل scripts/build-web-export.sh أولاً)"; exit 1; fi

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/dex"

echo "▸ 1/8 ترجمة الموارد (aapt2 compile)..."
"$BT/aapt2" compile --dir "$APKDIR/res" -o "$OUT/res.zip"

echo "▸ 2/8 ربط الموارد + Manifest + الأصول (aapt2 link)..."
"$BT/aapt2" link \
  -o "$OUT/app-unsigned.apk" \
  -I "$PLATFORM/android.jar" \
  --manifest "$APKDIR/AndroidManifest.xml" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 9 --version-name "5.0" \
  -A "$WEB" \
  --auto-add-overlay \
  "$OUT/res.zip"

echo "▸ 3/8 ترجمة Java (ECJ — يعمل على JRE)..."
ECJ_JAVA=$(find "$APKDIR/java" -name "*.java")
java -jar "$SDK/ecj.jar" -source 8 -target 8 -nowarn -proc:none \
  -bootclasspath "$PLATFORM/android.jar" \
  -d "$OUT/classes" \
  $ECJ_JAVA

echo "▸ 4/8 تحويل إلى dex (d8)..."
find "$OUT/classes" -name "*.class" > "$OUT/classlist.txt"
# shellcheck disable=SC2046
"$BT/d8" --release --lib "$PLATFORM/android.jar" \
  --output "$OUT/dex" \
  $(cat "$OUT/classlist.txt")

echo "▸ 5/8 حزن classes.dex داخل APK..."
cd "$OUT/dex"
zip -qj "$OUT/app-unsigned.apk" classes.dex

echo "▸ 6/8 محاذاة (zipalign)..."
"$BT/zipalign" -f 4 "$OUT/app-unsigned.apk" "$OUT/app-aligned.apk"

echo "▸ 7/8 التوقيع (apksigner v1+v2)..."
"$BT/apksigner" sign \
  --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KEY_PASS" \
  --ks-key-alias "$KS_ALIAS" \
  --out "$OUT/$APK_NAME" \
  "$OUT/app-aligned.apk"

echo "▸ 8/8 النشر — النسخة الموقعة فقط إلى public/downloads..."
PUBLISH=/home/z/my-project/public/downloads
mkdir -p "$PUBLISH"
find "$PUBLISH" -maxdepth 1 -name "Systemy-v*.apk" -delete
cp "$OUT/$APK_NAME" "$PUBLISH/$APK_NAME"

echo ""
echo "════ التحقق ════"
"$BT/apksigner" verify --print-certs "$OUT/$APK_NAME" | head -4
echo "── badging ──"
"$BT/aapt2" dump badging "$OUT/$APK_NAME" | head -4
echo "── المحتويات ──"
unzip -l "$OUT/$APK_NAME" | grep -c "assets/" | xargs echo "ملفات الأصول:"
echo ""
echo "✅ APK موقّع وجاهز: $OUT/$APK_NAME ($(du -h "$OUT/$APK_NAME" | cut -f1))"
echo "✅ منشور للتحميل: $PUBLISH/$APK_NAME"
# تنظيف الوسائط غير الموقعة — لا تُنسخ أبداً
rm -f "$OUT/app-unsigned.apk" "$OUT/app-aligned.apk"
