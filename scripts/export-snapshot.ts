/**
 * Systemy — سكربت تصدير لقطة البيانات
 * يقرأ كل جداول SQLite عبر Prisma (يعمل على الخادم بـ bun فقط) ويولّد
 * ملف src/lib/snapshot-data.ts يحتوي SNAPSHOT المدمجة في حزمة العميل.
 *
 * تشغيل: bun scripts/export-snapshot.ts
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const db = new PrismaClient();

async function main(): Promise<void> {
  const [
    accounts,
    categories,
    transactions,
    habits,
    habitLogs,
    moods,
    tasks,
    notes,
    goals,
    systems,
    recurrings,
    assets,
    debts,
  ] = await Promise.all([
    db.account.findMany({ orderBy: { order: "asc" } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.transaction.findMany({ orderBy: { date: "asc" } }),
    db.habit.findMany({ orderBy: { createdAt: "asc" } }),
    db.habitLog.findMany({ orderBy: { date: "asc" } }),
    db.mood.findMany({ orderBy: { date: "asc" } }),
    db.task.findMany({ orderBy: { date: "asc" } }),
    db.note.findMany({ orderBy: { date: "asc" } }),
    db.goal.findMany({ orderBy: { targetDate: "asc" } }),
    db.systemModel.findMany({ orderBy: { createdAt: "asc" } }),
    db.recurring.findMany({ orderBy: { nextDate: "asc" } }),
    db.asset.findMany({ orderBy: { value: "desc" } }),
    db.debt.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  /* تعيين صريح للحقول (مطابقة أسماء prisma/schema.prisma) مع تواريخ ISO */
  const snapshot = {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: a.balance,
      color: a.color,
      icon: a.icon,
      order: a.order,
      createdAt: a.createdAt.toISOString(),
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      kind: c.kind,
      budget: c.budget,
      keywords: c.keywords,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      merchant: t.merchant,
      accountId: t.accountId,
      categoryId: t.categoryId,
      date: t.date.toISOString(),
      source: t.source,
      tags: t.tags,
      person: t.person,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    })),
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      target: h.target,
      unit: h.unit,
      frequency: h.frequency,
      streak: h.streak,
      bestStreak: h.bestStreak,
      saveAmount: h.saveAmount,
      systemKey: h.systemKey,
      createdAt: h.createdAt.toISOString(),
    })),
    habitLogs: habitLogs.map((l) => ({
      id: l.id,
      habitId: l.habitId,
      date: l.date.toISOString(),
      count: l.count,
      createdAt: l.createdAt.toISOString(),
    })),
    moods: moods.map((m) => ({
      id: m.id,
      score: m.score,
      factors: m.factors,
      note: m.note,
      date: m.date.toISOString(),
      createdAt: m.createdAt.toISOString(),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      done: t.done,
      date: t.date.toISOString(),
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
    })),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      type: n.type,
      mood: n.mood,
      tags: n.tags,
      pinned: n.pinned,
      secret: n.secret,
      date: n.date.toISOString(),
      createdAt: n.createdAt.toISOString(),
    })),
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      targetDate: g.targetDate.toISOString(),
      emoji: g.emoji,
      color: g.color,
      monthly: g.monthly,
      createdAt: g.createdAt.toISOString(),
    })),
    systems: systems.map((s) => ({
      id: s.id,
      key: s.key,
      name: s.name,
      icon: s.icon,
      color: s.color,
      description: s.description,
      trackCount: s.trackCount,
      config: s.config,
      createdAt: s.createdAt.toISOString(),
    })),
    recurrings: recurrings.map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      type: r.type,
      frequency: r.frequency,
      nextDate: r.nextDate.toISOString(),
      icon: r.icon,
      categoryId: r.categoryId,
      createdAt: r.createdAt.toISOString(),
    })),
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      value: a.value,
      currency: a.currency,
      unit: a.unit,
      icon: a.icon,
      createdAt: a.createdAt.toISOString(),
    })),
    debts: debts.map((d) => ({
      id: d.id,
      name: d.name,
      amount: d.amount,
      paid: d.paid,
      direction: d.direction,
      dueDate: d.dueDate ? d.dueDate.toISOString() : null,
      person: d.person,
      createdAt: d.createdAt.toISOString(),
    })),
  };

  const content = `/**
 * Systemy — لقطة بيانات مولّدة آلياً بواسطة scripts/export-snapshot.ts
 * لا تعدّل هذا الملف يدوياً — أعد تشغيل السكربت لتجديده.
 * تاريخ التوليد: ${new Date().toISOString()}
 */
import type { SnapshotData } from "@/lib/local-db";

export const SNAPSHOT: SnapshotData = ${JSON.stringify(snapshot, null, 2)};
`;

  const outPath = new URL("../src/lib/snapshot-data.ts", import.meta.url);
  writeFileSync(outPath, content, "utf8");

  const bytes = Buffer.byteLength(content, "utf8");
  console.log("SNAPSHOT →", outPath);
  console.log(
    `الحجم: ${(bytes / 1024).toFixed(1)} KB | ` +
      `accounts ${snapshot.accounts.length} · categories ${snapshot.categories.length} · ` +
      `transactions ${snapshot.transactions.length} · habits ${snapshot.habits.length} · ` +
      `habitLogs ${snapshot.habitLogs.length} · moods ${snapshot.moods.length} · ` +
      `tasks ${snapshot.tasks.length} · notes ${snapshot.notes.length} · goals ${snapshot.goals.length} · ` +
      `systems ${snapshot.systems.length} · recurrings ${snapshot.recurrings.length} · ` +
      `assets ${snapshot.assets.length} · debts ${snapshot.debts.length}`
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error("فشل تصدير اللقطة:", err);
    await db.$disconnect();
    process.exit(1);
  });
