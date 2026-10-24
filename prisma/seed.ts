/**
 * Systemy — Seed ببيانات تجريبية عربية واقعية (30 يوماً)
 * تشغيل: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// مولد عشوائي ثابت البذرة حتى تبقى البيانات متسقة
let seed = 20240701;
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function ri(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const now = new Date();
function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysAgo(n: number, h = 12, m = 0): Date {
  const d = dayStart(now);
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
}
function atTime(n: number, h: number, m = 0): Date {
  const d = dayStart(now);
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 مسح البيانات القديمة...");
  await db.habitLog.deleteMany();
  await db.transaction.deleteMany();
  await db.note.deleteMany();
  await db.mood.deleteMany();
  await db.task.deleteMany();
  await db.recurring.deleteMany();
  await db.asset.deleteMany();
  await db.debt.deleteMany();
  await db.goal.deleteMany();
  await db.category.deleteMany();
  await db.account.deleteMany();
  await db.systemModel.deleteMany();

  // ─── الأنظمة ────────────────────────────────────────────────
  console.log("⚙️ الأنظمة...");
  const systems = [
    { key: "money", name: "المال", icon: "wallet", color: "#F5B95C", description: "حسابات، ميزانية أظرف، Safe-to-Spend، أهداف ادخار، أصول وديون", trackCount: 12 },
    { key: "habits", name: "العادات", icon: "flame", color: "#5CE1E6", description: "حلقات تقدم، سلاسل متسامحة، خريطة حرارية، ربط عادة بمبلغ ادخار", trackCount: 6 },
    { key: "health", name: "الصحة واللياقة", icon: "heart-pulse", color: "#6EE7A8", description: "وزن، تمارين، ماء، نوم — متصل ببيانات الصحة", trackCount: 5 },
    { key: "goals", name: "الأهداف (OKR)", icon: "target", color: "#FFB4A2", description: "هدف كبير ← نتائج قابلة للقياس ← عادات ومعاملات تغذّيها", trackCount: 4 },
    { key: "learning", name: "التعلم", icon: "graduation-cap", color: "#C4B5FD", description: "ساعات دراسة، جلسات تركيز Pomodoro، مراجعة متباعدة", trackCount: 4 },
    { key: "projects", name: "المشاريع والمهام", icon: "kanban", color: "#F5D565", description: "لوحة Kanban، فواتير بسيطة، هامش ربح كل مشروع جانبي", trackCount: 3 },
    { key: "people", name: "الأشخاص", icon: "users", color: "#8EC5FF", description: "آخر تواصل، ديون وهدايا، مناسبات، معاملات مشتركة", trackCount: 3 },
    { key: "home", name: "المنزل والأسرة", icon: "home", color: "#F8B4D9", description: "قوائم تسوق مشتركة، فواتير دورية، صيانة وتنبيهات تجديد", trackCount: 3 },
  ];
  for (const s of systems) await db.systemModel.create({ data: s });

  // ─── الحسابات ───────────────────────────────────────────────
  console.log("🏦 الحسابات...");
  const accounts = {
    cash: await db.account.create({ data: { name: "نقد", type: "cash", balance: 640, color: "#F5B95C", icon: "banknote", order: 1 } }),
    bank: await db.account.create({ data: { name: "البنك الأهلي", type: "bank", balance: 12340, color: "#5CE1E6", icon: "landmark", order: 2 } }),
    wallet: await db.account.create({ data: { name: "محفظة stc pay", type: "wallet", balance: 480, color: "#C4B5FD", icon: "smartphone", order: 3 } }),
    credit: await db.account.create({ data: { name: "بطاقة ائتمان", type: "credit", balance: -1450, color: "#FFB4A2", icon: "credit-card", order: 4 } }),
    savings: await db.account.create({ data: { name: "حساب الادخار", type: "savings", balance: 8500, color: "#6EE7A8", icon: "piggy-bank", order: 5 } }),
  };

  // ─── الفئات والأظرف ──────────────────────────────────────────
  console.log("🏷️ الفئات...");
  const cats = {
    food: await db.category.create({ data: { name: "بقالة وطعام", icon: "shopping-basket", color: "#F5B95C", budget: 1400, keywords: "تميمي,سلة,هورا,بقالة,لؤلؤة,بندة" } }),
    coffee: await db.category.create({ data: { name: "قهوة", icon: "coffee", color: "#C08457", budget: 280, keywords: "قهوة,ستاربكس,درنك,بارنز,دنكن,لاتيه,كابتشينو" } }),
    dining: await db.category.create({ data: { name: "مطاعم", icon: "utensils", color: "#FFB4A2", budget: 420, keywords: "مطعم,بيتزا,برجر,شاورما,كباب,مشاوي,سوشي" } }),
    transport: await db.category.create({ data: { name: "مواصلات", icon: "car-front", color: "#5CE1E6", budget: 380, keywords: "أوبر,كريم,بنزين,وقود,محطة,مواصلات,موصل" } }),
    bills: await db.category.create({ data: { name: "فواتير واشتراكات", icon: "receipt", color: "#8EC5FF", budget: 620, keywords: "stc,كهرباء,مياه,نتفلكس,نتفليكس,سبوتيفاي,شاهد,اشتراك,فاتورة" } }),
    shopping: await db.category.create({ data: { name: "تسوق", icon: "shopping-bag", color: "#F8B4D9", budget: 480, keywords: "نون,جرير,زارا,ايكيا,أمازون,ه&m,مكياج,ملابس" } }),
    fun: await db.category.create({ data: { name: "ترفيه", icon: "gamepad-2", color: "#C4B5FD", budget: 250, keywords: "سينما,بلايستيشن,ألعاب,حديد,تذاكر" } }),
    health: await db.category.create({ data: { name: "صحة", icon: "heart-pulse", color: "#6EE7A8", budget: 200, keywords: "صيدلية,دكتور,نهدي,الداية,علاج,فييتامين" } }),
    learning: await db.category.create({ data: { name: "تعليم", icon: "graduation-cap", color: "#F5D565", budget: 240, keywords: "كورس,كتاب,دورة,أوديمي,تعلم" } }),
    family: await db.category.create({ data: { name: "حوالات للأهل", icon: "send", color: "#F5B95C", budget: 2000, keywords: "حوالة,للأهل,الوالد,الوالدة,اهل" } }),
    gifts: await db.category.create({ data: { name: "هدايا وصدقة", icon: "gift", color: "#FFD9A0", budget: 200, keywords: "هدية,صدقة,تبرع,خيرية" } }),
    salary: await db.category.create({ data: { name: "راتب", icon: "briefcase", color: "#6EE7A8", kind: "income", keywords: "راتب,مرتب" } }),
    freelance: await db.category.create({ data: { name: "عمل حر", icon: "laptop", color: "#5CE1E6", kind: "income", keywords: "عميل,مشروع,فريلانس,تصميم,برمجة" } }),
    sales: await db.category.create({ data: { name: "مبيعات", icon: "store", color: "#C4B5FD", kind: "income", keywords: "بيع,مبيعة,متجر" } }),
  };

  // ─── المعاملات (آخر 30 يوماً) ───────────────────────────────
  console.log("💳 المعاملات...");
  type Tx = { type: string; amount: number; description: string; merchant?: string; accountId: string; categoryId: string; date: Date; source?: string; tags?: string; person?: string };
  const txs: Tx[] = [];

  // الراتب (أول الشهر الحالي أو آخر راتب)
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 9, 5);
  txs.push({ type: "income", amount: 9500, description: "راتب الشهر", merchant: "شركة النخبة للتقنية", accountId: accounts.bank.id, categoryId: cats.salary.id, date: firstOfMonth, tags: "ثابت" });

  // دخل العمل الحر
  txs.push({ type: "income", amount: 2400, description: "دفعة مشروع تطبيق القهوة", merchant: "عميل أحمد", accountId: accounts.bank.id, categoryId: cats.freelance.id, date: daysAgo(9, 13), tags: "مشروع" });
  txs.push({ type: "income", amount: 1800, description: "تصميم هوية بصرية", merchant: "مقهى روز", accountId: accounts.wallet.id, categoryId: cats.freelance.id, date: daysAgo(22, 16), tags: "مشروع" });
  txs.push({ type: "income", amount: 3200, description: "دفعة ثانية مشروع القهوة", merchant: "عميل أحمد", accountId: accounts.bank.id, categoryId: cats.freelance.id, date: daysAgo(2, 11), tags: "مشروع" });

  // مبيعات صغيرة
  txs.push({ type: "income", amount: 450, description: "بيع قالب Notion", merchant: "متجر القوالب", accountId: accounts.wallet.id, categoryId: cats.sales.id, date: daysAgo(14, 19), tags: "جانبي" });

  // مصاريف يومية واقعية
  const coffeeShops = [
    { d: "قهوة لاتيه", m: "ستاربكس", a: [16, 24] },
    { d: "آيس دريب", m: "درنك", a: [18, 26] },
    { d: "إسبريسو مزدوج", m: "بارنز", a: [12, 16] },
  ];
  const groceries = [
    { d: "تسوق أسبوعي", m: "تميمي ماركت", a: [180, 380] },
    { d: "بقالة سريعة", m: "سلة", a: [45, 120] },
    { d: "خضار وفواكه", m: "سوق الخضار", a: [30, 80] },
  ];
  const restaurants = [
    { d: "عشاء برجر", m: "بيتزا هت", a: [55, 120] },
    { d: "غداء شاورما", m: "شاورما هاوس", a: [22, 38] },
    { d: "مشاوي جماعية", m: "مطعم النخيل", a: [90, 180] },
  ];
  const rides = [
    { d: "أوبر للعمل", m: "أوبر", a: [14, 32] },
    { d: "بنزين", m: "محطة الوقود", a: [80, 120] },
    { d: "كريم", m: "كريم", a: [12, 25] },
  ];

  for (let d = 29; d >= 0; d--) {
    const dow = daysAgo(d).getDay(); // 5 = الجمعة
    // قهوة: ~5 مرات أسبوعياً
    if (rand() < 0.72) {
      const c = pick(coffeeShops);
      txs.push({ type: "expense", amount: ri(c.a[0], c.a[1]), description: c.d, merchant: c.m, accountId: accounts.wallet.id, categoryId: cats.coffee.id, date: atTime(d, ri(8, 21), ri(0, 59)) });
    }
    // بقالة: أيام متفرقة
    if (rand() < 0.35) {
      const g = pick(groceries);
      txs.push({ type: "expense", amount: ri(g.a[0], g.a[1]), description: g.d, merchant: g.m, accountId: accounts.bank.id, categoryId: cats.food.id, date: atTime(d, ri(16, 20)) });
    }
    // مطاعم: ~3 مرات أسبوعياً
    if (rand() < 0.42) {
      const r = pick(restaurants);
      txs.push({ type: "expense", amount: ri(r.a[0], r.a[1]), description: r.d, merchant: r.m, accountId: accounts.credit.id, categoryId: cats.dining.id, date: atTime(d, ri(13, 22)) });
    }
    // مواصلات
    if (rand() < 0.4) {
      const t = pick(rides);
      txs.push({ type: "expense", amount: ri(t.a[0], t.a[1]), description: t.d, merchant: t.m, accountId: pick([accounts.wallet.id, accounts.bank.id]), categoryId: cats.transport.id, date: atTime(d, ri(7, 22)) });
    }
    // الجمعة: حوالة للأهل (معظم الجمع)
    if (dow === 5 && rand() < 0.85) {
      txs.push({ type: "expense", amount: 500, description: "حوالة أسبوعية للأهل", merchant: "الوالدة", accountId: accounts.bank.id, categoryId: cats.family.id, date: atTime(d, 11, 30), tags: "عائلة", person: "الوالدة" });
    }
    // تسوق متقطع
    if (rand() < 0.13) {
      const s = pick([
        { d: "طلب نون — إكسسوارات", m: "نون", a: [89, 260] },
        { d: "كتاب من جرير", m: "جرير", a: [45, 95] },
        { d: "تيشيرت", m: "زارا", a: [99, 199] },
      ]);
      txs.push({ type: "expense", amount: ri(s.a[0], s.a[1]), description: s.d, merchant: s.m, accountId: accounts.credit.id, categoryId: cats.shopping.id, date: atTime(d, ri(14, 21)) });
    }
    // ترفيه وصحة متقطعة
    if (rand() < 0.08) txs.push({ type: "expense", amount: ri(60, 180), description: "سينما مع الأصدقاء", merchant: "سينما موفي", accountId: accounts.credit.id, categoryId: cats.fun.id, date: atTime(d, 21) });
    if (rand() < 0.07) txs.push({ type: "expense", amount: ri(35, 140), description: "صيدلية — فيتامينات", merchant: "صيدلية النهدي", accountId: accounts.wallet.id, categoryId: cats.health.id, date: atTime(d, 18) });
  }

  // فواتير ثابتة هذا الشهر
  const electric = new Date(now.getFullYear(), now.getMonth(), Math.min(7, now.getDate()), 10, 0);
  txs.push({ type: "expense", amount: 245, description: "فاتورة الكهرباء", merchant: "الشركة السعودية للكهرباء", accountId: accounts.bank.id, categoryId: cats.bills.id, date: electric, tags: "ثابت" });
  const stcDate = new Date(now.getFullYear(), now.getMonth(), Math.min(3, now.getDate()), 10, 0);
  txs.push({ type: "expense", amount: 145, description: "فاتورة stc — الجوال والإنترنت", merchant: "STC", accountId: accounts.bank.id, categoryId: cats.bills.id, date: stcDate, tags: "ثابت" });
  const netflixDate = daysAgo(12, 8);
  txs.push({ type: "expense", amount: 56, description: "اشتراك نتفلكس", merchant: "Netflix", accountId: accounts.credit.id, categoryId: cats.bills.id, date: netflixDate, tags: "اشتراك" });
  txs.push({ type: "expense", amount: 21.99, description: "اشتراك سبوتيفاي", merchant: "Spotify", accountId: accounts.credit.id, categoryId: cats.bills.id, date: daysAgo(6, 8), tags: "اشتراك" });
  txs.push({ type: "expense", amount: 39, description: "اشتراك شاهد VIP", merchant: "شاهد", accountId: accounts.credit.id, categoryId: cats.bills.id, date: daysAgo(20, 8), tags: "اشتراك" });

  // هدية عيد ميلاد
  txs.push({ type: "expense", amount: 180, description: "هدية عيد ميلاد سارة", merchant: "متجر الهدايا", accountId: accounts.credit.id, categoryId: cats.gifts.id, date: daysAgo(16, 17), person: "سارة" });
  // صدقة
  txs.push({ type: "expense", amount: 100, description: "صدقة جمعة", merchant: "جمعية خيرية", accountId: accounts.wallet.id, categoryId: cats.gifts.id, date: daysAgo(5, 12) });
  // كورس تعليمي
  txs.push({ type: "expense", amount: 149, description: "دورة أساسيات التصوير", merchant: "أكاديمية إبداع", accountId: accounts.credit.id, categoryId: cats.learning.id, date: daysAgo(18, 20) });

  for (const t of txs) {
    await db.transaction.create({ data: { ...t, currency: "SAR", source: t.source ?? "manual" } });
  }
  console.log(`   ✔ ${txs.length} معاملة`);

  // ─── العادات وسجلاتها ────────────────────────────────────────
  console.log("🔁 العادات...");
  const habitsData = [
    { name: "قراءة 20 دقيقة", icon: "book-open", color: "#F5B95C", target: 1, unit: "جلسة", p: 0.78, saveAmount: null as number | null },
    { name: "تمرين رياضي", icon: "dumbbell", color: "#FF8E7A", target: 1, unit: "جلسة", p: 0.62, saveAmount: 10 },
    { name: "8 أكواب ماء", icon: "droplets", color: "#5CE1E6", target: 8, unit: "كوب", p: 0.8, saveAmount: null },
    { name: "النوم قبل 12", icon: "moon", color: "#C4B5FD", target: 1, unit: "ليلة", p: 0.55, saveAmount: null },
    { name: "ورد القرآن", icon: "book-heart", color: "#6EE7A8", target: 1, unit: "ورد", p: 0.86, saveAmount: null },
    { name: "تعلم الإنجليزية", icon: "languages", color: "#F5D565", target: 15, unit: "دقيقة", p: 0.7, saveAmount: null },
  ];
  for (const h of habitsData) {
    const logs: { date: Date; count: number }[] = [];
    for (let d = 29; d >= 0; d--) {
      if (rand() < h.p) {
        const count = h.target > 1 ? ri(Math.floor(h.target * 0.6), h.target) : 1;
        logs.push({ date: dayStart(daysAgo(d)), count });
      }
    }
    // streak حالي و أفضل streak
    let streak = 0;
    for (let d = 0; d < 30; d++) {
      const done = logs.some((l) => l.date.getTime() === dayStart(daysAgo(d)).getTime());
      if (done) streak++;
      else if (d > 0) break;
      else if (!done && d === 0) continue; // اليوم ربما لم يأتِ بعد
    }
    let best = 0, run = 0;
    for (let d = 29; d >= 0; d--) {
      const done = logs.some((l) => l.date.getTime() === dayStart(daysAgo(d)).getTime());
      if (done) { run++; best = Math.max(best, run); } else run = 0;
    }
    const habit = await db.habit.create({
      data: { name: h.name, icon: h.icon, color: h.color, target: h.target, unit: h.unit, streak, bestStreak: Math.max(best, streak), saveAmount: h.saveAmount },
    });
    for (const l of logs) await db.habitLog.create({ data: { habitId: habit.id, date: l.date, count: l.count } });
  }

  // ─── المزاج (30 يوماً) ───────────────────────────────────────
  console.log("😊 المزاج...");
  const factorsPool = ["نوم", "عمل", "علاقات", "مال", "صحة", "طقس"];
  const moodNotes = [
    "يوم هادئ ومنتج",
    "اجتماع طويل لكنه كان مفيداً",
    "أشعر بالامتنان اليوم",
    "ضغط شوي من موعد التسليم",
    "تمرين الصباح غير مزاجي تماماً",
    "سهرة مع الأصدقاء كانت رائعة",
  ];
  for (let d = 29; d >= 0; d--) {
    if (d === 0 && now.getHours() < 9) continue; // مزاج اليوم يُدخل لاحقاً
    const score = rand() < 0.08 ? ri(1, 2) : rand() < 0.7 ? ri(3, 4) : 5;
    const fs = [pick(factorsPool), ...(rand() < 0.5 ? [pick(factorsPool)] : [])];
    await db.mood.create({
      data: { score, factors: [...new Set(fs)].join(","), note: rand() < 0.35 ? pick(moodNotes) : null, date: dayStart(daysAgo(d)) },
    });
  }

  // ─── المهام (اليوم + غداً) ───────────────────────────────────
  console.log("✅ المهام...");
  const tasksData = [
    { title: "مراجعة تقرير العميل وإرساله", done: true, d: 0, priority: "high" },
    { title: "تمرين الظهر في النادي", done: true, d: 0 },
    { title: "الرد على بريد الجامعة", done: false, d: 0, priority: "high" },
    { title: "سداد فاتورة المياه قبل الخميس", done: false, d: 0 },
    { title: "قراءة 20 صفحة من كتاب العادات الذرية", done: false, d: 0 },
    { title: "ترتيب خطة الأسبوع القادم", done: false, d: 1 },
    { title: "موعد طبيب الأسنان 4:30م", done: false, d: 1, priority: "high" },
  ];
  for (const t of tasksData) await db.task.create({ data: { title: t.title, done: t.done, date: dayStart(daysAgo(-t.d)), priority: t.priority ?? "normal" } });

  // ─── الملاحظات واليوميات ─────────────────────────────────────
  console.log("📝 الملاحظات...");
  const notesData = [
    {
      title: "فكرة مشروع: سوق قوالب Systemy",
      content: "الناس تحب تخصيص أدواتها. لو فتحنا سوق Blueprints يبيع فيه المبدعون أنظمتهم — نظام طالب ثانوي، نظام متجر صغير، نظام مسافر — يصير التطبيق منصة لا مجرد أداة.\n\nالخطوة الأولى: 20 قالباً مجانياً عند الإطلاق لتحفيز التثبيت.",
      type: "note", tags: "أفكار,مشاريع", pinned: true, d: 4,
    },
    {
      title: "مراجعة أسبوعية — كيف قضيت أسبوعي؟",
      content: "الأسبوع كان أهدى من السابق. أنجزت 3 من 5 مهام رئيسية.\n\nما نجح: تمرين الصباح قبل العمل (3 أيام)، وقراءة 20 دقيقة صارت أسهل بعد ما ربطتها بالقهوة.\n\nما يحتاج تحسين: السهر بعد 12 — أثر على مزاج صباح الخميس.\n\nتجربة الأسبوع القادم: وضع الجوال خارج الغرفة بعد العشاء.",
      type: "journal", mood: "جيد", tags: "مراجعة", d: 2,
    },
    {
      title: "اجتماع مع عميل أحمد — مشروع تطبيق القهوة",
      content: "ناقشنا المرحلة الثانية: لوحة نقاط الولاء وتقارير المبيعات.\n\nالمطلوب مني: نموذج أولي قبل الأحد، وتقدير زمني للربط مع نظام الكاشير.\n\nالميزانية: 3200 ريال دفعة ثانية أُرسلت اليوم ✓\n\nالوسوم: مشروع، عميل أحمد",
      type: "note", tags: "عمل,مشاريع", d: 2,
    },
    {
      title: "يوميات صباحية",
      content: "صحيت قبل الفجر بنصف ساعة، صليت وقرأت ورد اليوم الأول من رمضان الماضي. القهوة كانت ألذ من المعتاد.\n\nأشعر أن الأسبوع سيكون جيداً. أهم ثلاثة أشياء اليوم: التقرير، التمرين، والرد على الجامعة.",
      type: "journal", mood: "ممتاز", tags: "صباح,امتنان", d: 0,
    },
    {
      title: "قائمة كتب 2025",
      content: "العادات الذرية — جيمس كلير (أقرؤه الآن)\nالأب الغني والأب الفقير\nفن اللامبالاة\nالتفكير السريع والبطيء\nعصر الذكاء الاصطناعي\n\nالهدف: كتاب كل شهر. أكملت حتى الآن: 4 كتب.",
      type: "note", tags: "كتب,أهداف", d: 11,
    },
    {
      title: "ملاحظة مالية: الذهب",
      content: "تابعت سعر الذهب اليوم — وصل 389 للغرام عيار 24.\n\nالاستراتيجية: شراء 5 غرامات كل 3 أشهر بدل مبلغ كبير مرة واحدة.\n\nحالياً عندي 31 غراماً. الهدف الوصول لـ 50 غراماً بنهاية العام كجزء من محفظة الطوارئ.",
      type: "note", tags: "مال,استثمار", d: 8,
    },
    {
      title: "يوميات — يوم متعب",
      content: "يوم طويل في العمل. اجتماعات متتالية بلا فسحة.\n\nصرت أعرف لماذا أتعب: الأيام اللي فيها أكثر من 4 اجتماعات ينزل مزاجي. الحل: حصر الاجتماعات في يومين بالأسبوع فقط.\n\nالحمدلله على أي حال، أنهيت الضغط الأسوأ.",
      type: "journal", mood: "متعب", tags: "عمل", d: 6,
    },
    {
      title: "قائمة البقالة",
      content: "قهوة مختصة (كيلو)\nحبوب فولاذية\nدقيق الكيتو\nبيض منظف\nأفوكادو\nحليب شوفان\n\n— للعشاء مع الأهل الجمعة: لحم، أرز بسمتي، بهارات الكبسة",
      type: "note", tags: "منزل,قائمة", d: 1,
    },
    {
      title: "يوميات صباحية",
      content: "أول يوم أجرب فيه جلسة تركيز 50 دقيقة قبل فتح البريد. فرق كبير! أنجزت التصميم اللي كنت أأجله أسبوعاً.\n\nسأخليها عادة رسمية.",
      type: "journal", mood: "جيد", tags: "إنتاجية,تركيز", d: 13,
    },
    {
      title: "تأملات في العادات",
      content: "أنا بعد 30 يوماً من التتبع: العادة اللي تصير أسهل هي المرتبطة بشيء موجود أصلاً (القهوة ← القراءة).\n\nوالعادة الأصعب هي اللي تحتاج قرار إرادي في وقت متأخر (النوم قبل 12).\n\nالخلاصة: صمم البيئة لا الإرادة.",
      type: "journal", mood: "جيد", tags: "عادات,تأمل", d: 17,
    },
    // ذكريات "في مثل هذا اليوم" — من سنة سابقة
    {
      title: "يوميات — ذكرى من العام الماضي",
      content: "اليوم وقّعت أول عقد عمل حر بحجم جاد. كنت خائفاً ومتحمساً في نفس الوقت.\n\nاتفقنا على 6000 ريال لموقع متجر كامل. أول مرة أشعر أن مهاراتي تساوي شيئاً في السوق.\n\nدرس اليوم: الثقة تُبنى بالأفعال الصغيرة المتكررة لا بالقرارات الكبيرة.",
      type: "journal", mood: "ممتن", tags: "امتنان,بدايات", pinned: false, d: 365,
    },
    {
      title: "بدء رحلة الادخار",
      content: "فتحت اليوم حساب الادخار وحوّلت أول 1000 ريال.\n\nالهدف: صندوق طوارئ يغطي 6 أشهر مصاريف.\n\nشعور غريب أن أضع المال بعيداً عن يدي — لكنه شعور صحي.",
      type: "journal", mood: "جيد", tags: "مال,ادخار", d: 371,
    },
  ];
  for (const n of notesData) {
    await db.note.create({
      data: { title: n.title, content: n.content, type: n.type, mood: n.mood ?? null, tags: n.tags ?? "", pinned: n.pinned ?? false, date: daysAgo(n.d, 21) },
    });
  }

  // ─── الأهداف ─────────────────────────────────────────────────
  console.log("🎯 الأهداف...");
  const goalsData = [
    { name: "MacBook Pro جديد", targetAmount: 8500, savedAmount: 6200, months: 3, emoji: "💻", color: "#F5B95C", monthly: 800 },
    { name: "صندوق الطوارئ", targetAmount: 30000, savedAmount: 18500, months: 9, emoji: "🛟", color: "#6EE7A8", monthly: 1300 },
    { name: "عمرة رمضان", targetAmount: 5000, savedAmount: 3400, months: 4, emoji: "🕋", color: "#C4B5FD", monthly: 400 },
    { name: "دورة التصوير الاحترافي", targetAmount: 2400, savedAmount: 2100, months: 1, emoji: "📷", color: "#FFB4A2", monthly: 300 },
  ];
  for (const g of goalsData) {
    const td = new Date(now);
    td.setMonth(td.getMonth() + g.months);
    await db.goal.create({ data: { name: g.name, targetAmount: g.targetAmount, savedAmount: g.savedAmount, targetDate: td, emoji: g.emoji, color: g.color, monthly: g.monthly } });
  }

  // ─── المتكررات والاشتراكات ───────────────────────────────────
  console.log("🔄 الاشتراكات...");
  const recurringData = [
    { name: "Netflix", amount: 56, inDays: 5, icon: "clapperboard" },
    { name: "Spotify", amount: 21.99, inDays: 12, icon: "music" },
    { name: "شاهد VIP", amount: 39, inDays: 2, icon: "tv" },
    { name: "فاتورة stc", amount: 145, inDays: 9, icon: "signal" },
    { name: "النادي الرياضي", amount: 249, inDays: 15, icon: "dumbbell" },
    { name: "iCloud 200GB", amount: 9.99, inDays: 20, icon: "cloud" },
  ];
  for (const r of recurringData) {
    const nd = dayStart(now);
    nd.setDate(nd.getDate() + r.inDays);
    await db.recurring.create({ data: { name: r.name, amount: r.amount, frequency: "monthly", nextDate: nd, icon: r.icon, categoryId: cats.bills.id } });
  }

  // ─── الأصول ──────────────────────────────────────────────────
  console.log("💎 الأصول...");
  const assetsData = [
    { name: "ذهب عيار 24", type: "gold", value: 12060, unit: "31 غرام", icon: "gem" },
    { name: "بيتكوين", type: "crypto", value: 11250, unit: "0.05 BTC", icon: "bitcoin" },
    { name: "سيارة كورولا 2021", type: "car", value: 52000, icon: "car-front" },
    { name: "محفظة أسهم (تاسي)", type: "stocks", value: 7800, icon: "trending-up" },
  ];
  for (const a of assetsData) await db.asset.create({ data: a });

  // ─── الديون ──────────────────────────────────────────────────
  console.log("🤝 الديون...");
  const dd = new Date(now); dd.setDate(dd.getDate() + 12);
  await db.debt.create({ data: { name: "قرض صغير — أحمد", amount: 800, paid: 300, direction: "receivable", person: "أحمد", dueDate: dd } });
  const dd2 = new Date(now); dd2.setDate(dd2.getDate() + 5);
  await db.debt.create({ data: { name: "تقسيط دورة التصوير", amount: 600, paid: 150, direction: "payable", person: "أكاديمية إبداع", dueDate: dd2 } });

  console.log("✅ تمت تهيئة بيانات Systemy بنجاح");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
