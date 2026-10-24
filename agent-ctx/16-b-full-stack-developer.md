# Task 16-b — full-stack-developer
تخصيص الإضافة السريعة + حقل الميزانية في الإعدادات (استهلاك budgetPacing من Task 15، بلا أي إعادة كتابة للمحرك).

## الملفات (فقط هذان)
- `src/components/systemy/quick-add/tx-forms.tsx` — upgrades:
  1. رقائق «الأكثر تسجيلاً» (أعلى 6 أوصاف تكراراً من آخر 120 معاملة من نفس النوع؛ التعادل بالأحدث) فوق حقل الوصف؛ اللمسة تعبّئ الوصف وتُطلق التخمين الذكي القائم. مخفية عند ≤1 أو التعديل.
  2. التاجر surfaced مباشرة بتسميات النوع (مصروف/دخل/تحويل عام) — «تفاصيل أكثر» = وسوم+ملاحظة فقط.
  3. «مع من؟ (اختياري)» لمصروف فقط → tx.person يُمرر للإضافتين (add/replace تقبلانه).
  4. «اربط بهدف — اجعله مساهمة ادخار» (دخل، جديد فقط، قابل للطي): بعد نجاح addTransaction → contributeGoal(goalId, value) بلا accountId (savedAmount فقط). يُصفّر عند editTxId/switchKind.
  5. معاينة ميزانية حية تحت المبلغ (status≠unset && مبلغ>0): مصروف اليوم/الأسبوع بنعناعي/مرجاني، دخل «يرفع متبقي الشهر» بنعناعي — سطر واحد text-[10.5px] داخل بطاقة المبلغ.
- `src/components/systemy/settings/settings-screen.tsx` — FinanceSection فقط:
  - حقل «ميزانية الصرف الشهرية» بنمط monthlyIncome حرفياً (تعديل + NumberPad + حفظ → updateSettings) + تلميح «منفصلة عن دخلك…».
  - سطر مشتق tabular: «≈ perDay يومياً · عبر daysLeft يوماً متبقياً هذا الشهر» (budgetPacing مع useLive فئات+معاملات أُضيفا داخل القسم).
  - زر «اعتمد مجموع المظاريف (envelopesSum)» عند >0 و≠ الحالي → updateSettings({monthlyBudget: envelopesSum}).
  - استيرادات مضافة فقط: budgetPacing + نوعا Category/Transaction.

## التحقق
- eslint على الملفين: exit 0.
- tsc --noEmit: صفر أخطاء تذكر الملفين.
- dev.log: ✓ Compiled + GET / 200 (curl بعد التعديلات) — بلا أخطاء.
- بلا agent-browser (تعليمات المُنسّق — تحقق بصري لاحق).

## ملاحظات للتكامل/المُنسّق
- معاينة الميزانية في التعديل تحسب المعاملة مرتين (اتباع الصيغة الحرفية المطلوبة) — الإضافة الجديدة دقيقة.
- DEFAULT_SETTINGS استوردت في tx-forms كfallback عند null الابتدائي لuseLive.
- عقد goal: contributeGoal بلا accountId لا ينشئ معاملة تحويل — آمن مع رصيد الحساب.
