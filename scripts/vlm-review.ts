/** مراجعة بصرية VLM للقطات التحقق النهائية */
import ZAI, { VisionMessage } from "z-ai-web-dev-sdk";
import fs from "fs";

async function review(zai: Awaited<ReturnType<typeof ZAI.create>>, path: string, label: string) {
  const b64 = fs.readFileSync(path).toString("base64");
  const messages: VisionMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `راجع هذه اللقطة (${label}) لتطبيق Systemy العربي RTL: هل يظهر كل شيء سليماً بلا قصّ أو تداخل أو نص مكسور؟ إن كانت هناك بطاقة تحميل تطبيق: هل تظهر بوضوح وجمال؟ أجب بإيجاز شديد بنقاط: (1) العناصر الظاهرة (2) أي مشاكل بصرية إن وجدت.`,
        },
        { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
      ],
    },
  ];
  const res = await zai.chat.completions.createVision({
    model: "glm-4.6v",
    messages,
    thinking: { type: "disabled" },
  });
  console.log(`\n═══ ${label} ═══`);
  console.log(res.choices?.[0]?.message?.content ?? "(لا رد)");
}

async function main() {
  const zai = await ZAI.create();
  const shots: Array<[string, string]> = [
    ["/home/z/my-project/apk/final-desktop.png", "سطح المكتب — صفحة الهبوط مع بطاقة تحميل APK"],
    ["/home/z/my-project/apk/final-mobile.png", "الجوال — التطبيق + رابط تحميل في التذييل"],
    ["/home/z/my-project/apk/test-file-1.png", "نسخة APK (file://) — شاشة اليوم"],
  ];
  for (const [p, l] of shots) {
    if (fs.existsSync(p)) await review(zai, p, l);
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
