/**
 * يقدّم نص هجرة المزامنة (docs/ui-redesign/sync-migration.sql) كما هو من القرص —
 * مصدر واحد للحقيقة: زر «انسخ أوامر التهيئة» في بطاقة الحساب يجلبها من هنا.
 * لا أسرار في الملف إطلاقاً (مخطط + سياسات RLS فقط) — عمومي بتصميم.
 */
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sqlPath = path.join(
      process.cwd(),
      "docs",
      "ui-redesign",
      "sync-migration.sql"
    );
    const sql = await readFile(sqlPath, "utf8");
    return new Response(sql, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "تعذر قراءة ملف الهجرة من الخادم" },
      { status: 404 }
    );
  }
}
