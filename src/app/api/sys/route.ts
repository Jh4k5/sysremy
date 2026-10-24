import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

const SYS_TIMEOUT_MS = 30000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/**
 * POST /api/sys — المساعد الذكي.
 * البيانات محلية على جهاز المستخدم؛ العميل يرسل ملخص سياقه نصياً،
 * والخادم يعيد رداً واحداً فقط — لا يُخزَّن شيء.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const messages = isRecord(body) && Array.isArray(body.messages) ? (body.messages as ChatMsg[]) : [];
  const context = isRecord(body) && typeof body.context === "string" ? body.context : "";
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (!lastUser.trim()) {
    return NextResponse.json({ error: "اكتب رسالة أولاً" }, { status: 400 });
  }

  const systemPrompt = [
    "أنت «Sys» — مساعد ذكي داخل تطبيق Systemy، نظام تشغيل شخصي عربي (مال، عادات، مهام، تقويم، يوميات).",
    "أجب بالعربية الفصحى المبسطة، بأسلوب دافئ ومختصر (سطران إلى خمسة أسطر).",
    "استخدم الأرقام من «سياق بيانات المستخدم» أدناه فقط — لا تخترع أرقاماً. إن لم تجد الرقم، قل ذلك بلطف.",
    "اقترح إجراءات عملية صغيرة (خطوة واحدة). لا تستخدم جداول منسقة، نص عادي فقط.",
    "",
    "سياق بيانات المستخدم:",
    context || "(لا توجد بيانات بعد — المستخدم في بداية رحلته)",
  ].join("\n");

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      model: process.env.ZAI_MODEL ?? "glm-4.5-flash",
      messages: [
        { role: "system" as const, content: systemPrompt },
        ...messages.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
      temperature: 0.6,
      max_tokens: 600,
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    if (reply) return NextResponse.json({ reply });
    return NextResponse.json({ error: "رد فارغ من النموذج" }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "تعذر الاتصال بالنموذج" }, { status: 502 });
  }
}
