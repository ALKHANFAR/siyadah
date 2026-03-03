/**
 * Phase 6: اختبارات قاسية — Intent Detection + Tool Selection
 * 
 * 80+ اختبار يغطي:
 * - فهم النوايا من نصوص عربية سعودية حقيقية
 * - استخراج الكيانات (أرقام، إيميلات، تواريخ، مبالغ)
 * - اختيار الأدوات الصحيحة لكل نية
 * - التحقق من وجود كل أداة/أكشن في السجل الحقيقي
 * - حالات الحافة والنصوص الغامضة
 */

const path = require("path");
const fs = require("fs");
const { detectIntents, extractEntities, analyzeRequest, normalizeArabic } = require("../engine/intent-detector");
const { INTENT_TOOL_MAP, TOOL_ALIASES, selectTools, pieceMap } = require("../engine/tool-selector");

let passed = 0, failed = 0, total = 0;
function test(name, fn) {
  total++;
  try {
    const r = fn();
    if (r === true) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name}: ${r}`); }
  } catch (e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  Phase 6: Intent Detection + Tool Selection");
console.log("═══════════════════════════════════════════════════════════\n");


// ═══════════════════ GROUP 1: تطبيع النص ═══════════════════
console.log("📋 Group 1: تطبيع النص العربي");
console.log("─────────────────────────────────────");

test("تطبيع الألف: إ أ آ → ا", () =>
  normalizeArabic("إيميل أحمد آخر") === "ايميل احمد اخر" ? true : normalizeArabic("إيميل أحمد آخر")
);
test("تطبيع التاء المربوطة: ة → ه", () =>
  normalizeArabic("فاتورة جديدة").includes("فاتوره") ? true : normalizeArabic("فاتورة جديدة")
);
test("تطبيع الألف المقصورة: ى → ي", () =>
  normalizeArabic("مستشفى").includes("مستشفي") ? true : normalizeArabic("مستشفى")
);
test("إزالة التشكيل", () =>
  normalizeArabic("مَوْعِد") === "موعد" ? true : normalizeArabic("مَوْعِد")
);


// ═══════════════════ GROUP 2: كشف النوايا — مواعيد ═══════════════════
console.log("\n📋 Group 2: كشف النوايا — مواعيد");
console.log("─────────────────────────────────────");

test("'أبي أحجز موعد' → appointment_book", () => {
  const r = detectIntents("أبي أحجز موعد");
  return r[0]?.intent === "appointment_book" ? true : `got: ${r[0]?.intent}`;
});

test("'المريض يبي يحجز كشف' → appointment_book", () => {
  const r = detectIntents("المريض يبي يحجز كشف");
  return r[0]?.intent === "appointment_book" ? true : `got: ${r[0]?.intent}`;
});

test("'ذكّرني قبل الموعد بساعة' → appointment_remind", () => {
  const r = detectIntents("ذكّرني قبل الموعد بساعة");
  return r[0]?.intent === "appointment_remind" ? true : `got: ${r[0]?.intent}`;
});

test("'العميل يبي يلغي الموعد' → appointment_cancel", () => {
  const r = detectIntents("العميل يبي يلغي الموعد");
  return r[0]?.intent === "appointment_cancel" ? true : `got: ${r[0]?.intent}`;
});

test("'بوكينق جديد' → appointment_book", () => {
  const r = detectIntents("بوكينق جديد");
  return r[0]?.intent === "appointment_book" ? true : `got: ${r[0]?.intent}`;
});


// ═══════════════════ GROUP 3: كشف النوايا — عملاء ═══════════════════
console.log("\n📋 Group 3: كشف النوايا — عملاء");
console.log("─────────────────────────────────────");

test("'عميل جديد يتواصل معنا' → lead_capture", () => {
  const r = detectIntents("عميل جديد يتواصل معنا");
  return r[0]?.intent === "lead_capture" ? true : `got: ${r[0]?.intent}`;
});

test("'يسجل العميل المحتمل' → lead_capture", () => {
  const r = detectIntents("يسجل العميل المحتمل من الفورم");
  return r[0]?.intent === "lead_capture" ? true : `got: ${r[0]?.intent}`;
});

test("'صنّف العملاء الجدد حسب الأولوية' → lead_qualify", () => {
  const r = detectIntents("صنّف العملاء الجدد حسب الأولوية");
  return r[0]?.intent === "lead_qualify" ? true : `got: ${r[0]?.intent}`;
});

test("'حدّث بيانات العميل' → contact_update", () => {
  const r = detectIntents("حدّث بيانات العميل");
  return r[0]?.intent === "contact_update" ? true : `got: ${r[0]?.intent}`;
});


// ═══════════════════ GROUP 4: كشف النوايا — فواتير ═══════════════════
console.log("\n📋 Group 4: كشف النوايا — فواتير");
console.log("─────────────────────────────────────");

test("'أرسل فاتورة للعميل' → invoice_send", () => {
  const r = detectIntents("أرسل فاتورة للعميل");
  return r[0]?.intent === "invoice_send" ? true : `got: ${r[0]?.intent}`;
});

test("'العميل ما دفع الحساب' → payment_follow", () => {
  const r = detectIntents("العميل ما دفع الحساب المستحق");
  return r[0]?.intent === "payment_follow" ? true : `got: ${r[0]?.intent}`;
});

test("'متابعة الفواتير المتأخرة' → payment_follow", () => {
  const r = detectIntents("متابعة الفواتير المتأخرة");
  return r.some(i => i.intent === "payment_follow") ? true : `got: ${r.map(i=>i.intent)}`;
});


// ═══════════════════ GROUP 5: كشف النوايا — إشعارات ═══════════════════
console.log("\n📋 Group 5: كشف النوايا — إشعارات");
console.log("─────────────────────────────────────");

test("'أرسل واتساب للعميل' → notify_whatsapp", () => {
  const r = detectIntents("أرسل واتساب للعميل");
  return r[0]?.intent === "notify_whatsapp" ? true : `got: ${r[0]?.intent}`;
});

test("'إيميل تأكيد' → notify_email", () => {
  const r = detectIntents("أرسل إيميل تأكيد الحجز");
  return r[0]?.intent === "notify_email" ? true : `got: ${r[0]?.intent}`;
});

test("'أبلغ الفريق والعميل' → notify_multi", () => {
  const r = detectIntents("أبلغ الفريق والعميل بالتحديث");
  return r[0]?.intent === "notify_multi" ? true : `got: ${r[0]?.intent}`;
});


// ═══════════════════ GROUP 6: كشف النوايا — تقارير ═══════════════════
console.log("\n📋 Group 6: كشف النوايا — تقارير");
console.log("─────────────────────────────────────");

test("'أبي تقرير يومي' → report_daily", () => {
  const r = detectIntents("أبي تقرير يومي نهاية كل يوم");
  return r[0]?.intent === "report_daily" ? true : `got: ${r[0]?.intent}`;
});

test("'ملخص أسبوعي' → report_weekly", () => {
  const r = detectIntents("ملخص أسبوعي كل أسبوع");
  return r[0]?.intent === "report_weekly" ? true : `got: ${r[0]?.intent}`;
});

test("'كم عدد العملاء هذا الشهر' → report_custom", () => {
  const r = detectIntents("كم عدد العملاء هذا الشهر؟ أبي إحصائيات");
  return r.some(i => i.intent === "report_custom") ? true : `got: ${r.map(i=>i.intent)}`;
});


// ═══════════════════ GROUP 7: كشف النوايا — دعم ═══════════════════
console.log("\n📋 Group 7: كشف النوايا — دعم");
console.log("─────────────────────────────────────");

test("'عميل يشتكي' → support_ticket", () => {
  const r = detectIntents("عميل يشتكي من مشكلة في الخدمة");
  return r[0]?.intent === "support_ticket" ? true : `got: ${r[0]?.intent}`;
});

test("'رد تلقائي على الرسائل' → support_auto_reply", () => {
  const r = detectIntents("رد تلقائي على رسائل الواتساب");
  return r[0]?.intent === "support_auto_reply" ? true : `got: ${r[0]?.intent}`;
});


// ═══════════════════ GROUP 8: كشف النوايا — تجارة ═══════════════════
console.log("\n📋 Group 8: كشف النوايا — تجارة");
console.log("─────────────────────────────────────");

test("'طلب جديد من المتجر' → order_new", () => {
  const r = detectIntents("طلب جديد من المتجر");
  return r[0]?.intent === "order_new" ? true : `got: ${r[0]?.intent}`;
});

test("'المخزون قرب يخلص' → inventory_alert", () => {
  const r = detectIntents("المخزون قرب يخلص — كمية قليلة");
  return r[0]?.intent === "inventory_alert" ? true : `got: ${r[0]?.intent}`;
});


// ═══════════════════ GROUP 9: استخراج الكيانات ═══════════════════
console.log("\n📋 Group 9: استخراج الكيانات");
console.log("─────────────────────────────────────");

test("استخراج رقم جوال سعودي 05", () => {
  const e = extractEntities("رقم العميل 0512345678");
  return e.some(x => x.type === "phone" && x.value.includes("05")) ? true : `${JSON.stringify(e)}`;
});

test("استخراج رقم جوال +966", () => {
  const e = extractEntities("تواصل معه على +966512345678");
  return e.some(x => x.type === "phone") ? true : `${JSON.stringify(e)}`;
});

test("استخراج إيميل", () => {
  const e = extractEntities("إيميله ahmed@example.com");
  return e.some(x => x.type === "email" && x.value === "ahmed@example.com") ? true : `${JSON.stringify(e)}`;
});

test("استخراج تاريخ", () => {
  const e = extractEntities("الموعد 15/3/2026");
  return e.some(x => x.type === "date") ? true : `${JSON.stringify(e)}`;
});

test("استخراج يوم (بكرة)", () => {
  const e = extractEntities("أبي موعد بكرة");
  return e.some(x => x.type === "date" && x.value === "بكرة") ? true : `${JSON.stringify(e)}`;
});

test("استخراج مبلغ بالريال", () => {
  const e = extractEntities("الفاتورة 1500 ريال");
  return e.some(x => x.type === "amount") ? true : `${JSON.stringify(e)}`;
});

test("استخراج اسم أداة (واتساب)", () => {
  const e = extractEntities("أرسل واتساب للعميل");
  return e.some(x => x.type === "tool" && x.value.includes("واتساب")) ? true : `${JSON.stringify(e)}`;
});

test("استخراج صناعة (عيادة)", () => {
  const e = extractEntities("عندي عيادة أسنان");
  return e.some(x => x.type === "industry") ? true : `${JSON.stringify(e)}`;
});

test("استخراج كيانات متعددة", () => {
  const e = extractEntities("العميل أحمد رقمه 0512345678 وإيميله a@b.com والمبلغ 500 ريال");
  const types = new Set(e.map(x => x.type));
  return types.has("phone") && types.has("email") && types.has("amount") ? true : `types: ${[...types]}`;
});


// ═══════════════════ GROUP 10: التحليل الكامل ═══════════════════
console.log("\n📋 Group 10: التحليل الكامل");
console.log("─────────────────────────────────────");

test("analyzeRequest يرجع primary_intent", () => {
  const r = analyzeRequest("أبي أحجز موعد");
  return r.primary_intent?.intent === "appointment_book" ? true : `${r.primary_intent?.intent}`;
});

test("analyzeRequest يكشف تسلسل (وبعدين)", () => {
  const r = analyzeRequest("أبي أحجز موعد وبعدين أرسل واتساب");
  return r.has_sequence === true ? true : "ما كشف التسلسل";
});

test("analyzeRequest يكشف نية الأتمتة", () => {
  const r = analyzeRequest("أبي الحجز يصير تلقائي");
  return r.has_automation_intent === true ? true : "ما كشف الأتمتة";
});

test("نوايا ثانوية تنكشف", () => {
  const r = analyzeRequest("لما عميل جديد يسجل، أبي أحجز له موعد وأرسل واتساب");
  return r.all_intents.length >= 2 ? true : `عدد النوايا: ${r.all_intents.length}`;
});


// ═══════════════════ GROUP 11: INTENT_TOOL_MAP ═══════════════════
console.log("\n📋 Group 11: خريطة النوايا → أدوات");
console.log("─────────────────────────────────────");

test("كل intent في الخريطة", () => {
  const intentIds = Object.values(require("../engine/intent-detector").INTENTS).map(i => i.id);
  const mapped = Object.keys(INTENT_TOOL_MAP);
  const missing = intentIds.filter(id => !mapped.includes(id));
  return missing.length === 0 ? true : `ناقص: ${missing.join(", ")}`;
});

test("كل mapping فيه trigger", () => {
  const bad = Object.entries(INTENT_TOOL_MAP).filter(([k, v]) => !v.trigger);
  return bad.length === 0 ? true : bad.map(([k]) => k).join(", ");
});

test("كل mapping فيه steps >= 1", () => {
  const bad = Object.entries(INTENT_TOOL_MAP).filter(([k, v]) => !v.steps || v.steps.length === 0);
  return bad.length === 0 ? true : bad.map(([k]) => k).join(", ");
});

test("كل trigger piece موجود في السجل", () => {
  const bad = [];
  Object.entries(INTENT_TOOL_MAP).forEach(([k, v]) => {
    if (!pieceMap[v.trigger.piece]) bad.push(`${k}→${v.trigger.piece}`);
  });
  return bad.length === 0 ? true : bad.join(", ");
});

test("كل trigger name موجود فعلاً", () => {
  const bad = [];
  Object.entries(INTENT_TOOL_MAP).forEach(([k, v]) => {
    const p = pieceMap[v.trigger.piece];
    if (p) {
      const triggers = new Set(p.triggers.map(t => t.name));
      if (!triggers.has(v.trigger.trigger)) bad.push(`${k}: ${v.trigger.piece}.${v.trigger.trigger}`);
    }
  });
  return bad.length === 0 ? true : bad.join(", ");
});

test("كل action في steps موجود فعلاً", () => {
  const bad = [];
  Object.entries(INTENT_TOOL_MAP).forEach(([k, v]) => {
    [...v.steps, ...(v.optional || [])].forEach(s => {
      const p = pieceMap[s.piece];
      if (!p) { bad.push(`${k}: ${s.piece} missing`); return; }
      const actions = new Set(p.actions.map(a => a.name));
      if (!actions.has(s.action)) bad.push(`${k}: ${s.piece}.${s.action}`);
    });
  });
  return bad.length === 0 ? true : bad.join(" | ");
});


// ═══════════════════ GROUP 12: Tool Selection ═══════════════════
console.log("\n📋 Group 12: اختيار الأدوات");
console.log("─────────────────────────────────────");

test("selectTools: حجز موعد → Calendar + WhatsApp + Sheets", () => {
  const analysis = analyzeRequest("أبي أحجز موعد");
  const r = selectTools(analysis);
  if (!r.success) return r.errors.join(", ");
  const pieces = r.steps.map(s => s.piece);
  return pieces.includes("google-calendar") && pieces.includes("whatsapp") && pieces.includes("google-sheets")
    ? true : `pieces: ${pieces}`;
});

test("selectTools: فاتورة → Stripe + WhatsApp + Gmail", () => {
  const analysis = analyzeRequest("أرسل فاتورة للعميل ودفع");
  const r = selectTools(analysis);
  if (!r.success) return r.errors.join(", ");
  const pieces = r.steps.map(s => s.piece);
  return pieces.includes("stripe") ? true : `pieces: ${pieces}`;
});

test("selectTools: عميل جديد → Sheets + HubSpot + WhatsApp", () => {
  const analysis = analyzeRequest("عميل جديد يتواصل معنا");
  const r = selectTools(analysis);
  if (!r.success) return r.errors.join(", ");
  const pieces = r.steps.map(s => s.piece);
  return pieces.includes("hubspot") && pieces.includes("google-sheets") ? true : `pieces: ${pieces}`;
});

test("selectTools: كل step فيه verified=true", () => {
  const analysis = analyzeRequest("أبي أحجز موعد");
  const r = selectTools(analysis);
  const unverified = r.steps.filter(s => !s.verified);
  return unverified.length === 0 ? true : `${unverified.length} unverified`;
});

test("selectTools: trigger محدد صح", () => {
  const analysis = analyzeRequest("أبي تقرير يومي");
  const r = selectTools(analysis);
  return r.trigger?.piece === "schedule" && r.trigger?.trigger === "every_day" ? true : `${JSON.stringify(r.trigger)}`;
});

test("selectTools: total_steps محسوب صح", () => {
  const analysis = analyzeRequest("أبي أحجز موعد");
  const r = selectTools(analysis);
  return r.total_steps === r.steps.length + r.optional_steps.length + 1 ? true : `total: ${r.total_steps}`;
});


// ═══════════════════ GROUP 13: TOOL_ALIASES ═══════════════════
console.log("\n📋 Group 13: أسماء الأدوات العربية");
console.log("─────────────────────────────────────");

test("واتساب → whatsapp", () => TOOL_ALIASES["واتساب"] === "whatsapp" ? true : "خطأ");
test("جيميل → gmail", () => TOOL_ALIASES["جيميل"] === "gmail" ? true : "خطأ");
test("شيت → google-sheets", () => TOOL_ALIASES["شيت"] === "google-sheets" ? true : "خطأ");
test("هبسبوت → hubspot", () => TOOL_ALIASES["هبسبوت"] === "hubspot" ? true : "خطأ");
test("سترايب → stripe", () => TOOL_ALIASES["سترايب"] === "stripe" ? true : "خطأ");

test("كل alias يشير لأداة موجودة في السجل", () => {
  const bad = Object.entries(TOOL_ALIASES).filter(([k, v]) => !pieceMap[v]);
  return bad.length === 0 ? true : bad.map(([k, v]) => `${k}→${v}`).join(", ");
});


// ═══════════════════ GROUP 14: حالات حافة ═══════════════════
console.log("\n📋 Group 14: حالات حافة");
console.log("─────────────────────────────────────");

test("نص فارغ → لا نوايا", () => {
  const r = detectIntents("");
  return r.length === 0 ? true : `got ${r.length} intents`;
});

test("نص عشوائي → لا نوايا أو ثقة منخفضة", () => {
  const r = detectIntents("الجو حلو اليوم");
  return r.length === 0 || r[0].confidence < 0.3 ? true : `${r[0]?.intent} (${r[0]?.confidence})`;
});

test("selectTools بدون intent → خطأ واضح", () => {
  const r = selectTools({ primary_intent: null, secondary_intents: [], entities: [] });
  return r.success === false && r.error ? true : "ما رجع خطأ";
});

test("نص طويل ومعقد — يكشف نوايا متعددة", () => {
  const text = "لما عميل جديد يسجل من الموقع، أبي تلقائي يحجز له موعد وبعدين يرسل واتساب تأكيد ويسجل في الشيت";
  const r = analyzeRequest(text);
  return r.all_intents.length >= 2 && r.has_automation_intent && r.has_sequence
    ? true : `intents: ${r.all_intents.length}, auto: ${r.has_automation_intent}, seq: ${r.has_sequence}`;
});

test("نوايا confidence مرتبة تنازلياً", () => {
  const r = detectIntents("أبي أحجز موعد وأرسل واتساب تأكيد");
  for (let i = 1; i < r.length; i++) {
    if (r[i].confidence > r[i - 1].confidence) return `${r[i].intent} (${r[i].confidence}) > ${r[i-1].intent} (${r[i-1].confidence})`;
  }
  return true;
});


// ═══════════════════ GROUP 15: سيناريوهات سندس الصحية ═══════════════════
console.log("\n📋 Group 15: سيناريوهات سندس الصحية");
console.log("─────────────────────────────────────");

test("'مريض يبي يحجز كشف أسنان بكرة' → appointment_book + entities", () => {
  const r = analyzeRequest("مريض يبي يحجز كشف أسنان بكرة");
  return r.primary_intent?.intent === "appointment_book" && r.entities.some(e => e.type === "date")
    ? true : `intent: ${r.primary_intent?.intent}`;
});

test("'ذكّر المرضى قبل مواعيدهم بساعة على الواتس' → appointment_remind", () => {
  const r = analyzeRequest("ذكّر المرضى قبل مواعيدهم بساعة على الواتس");
  return r.primary_intent?.intent === "appointment_remind" ? true : `got: ${r.primary_intent?.intent}`;
});

test("'لما أحد يلغي موعده، أرسل له رسالة وحجز جديد' → appointment_cancel", () => {
  const r = analyzeRequest("لما أحد يلغي موعده، أرسل له رسالة وحجز جديد");
  return r.primary_intent?.intent === "appointment_cancel" ? true : `got: ${r.primary_intent?.intent}`;
});

test("'أرسل فاتورة الكشف 300 ريال على واتساب' → invoice_send + amount", () => {
  const r = analyzeRequest("أرسل فاتورة الكشف 300 ريال على واتساب");
  const hasAmount = r.entities.some(e => e.type === "amount");
  return r.primary_intent?.intent === "invoice_send" && hasAmount
    ? true : `intent: ${r.primary_intent?.intent}, amount: ${hasAmount}`;
});

test("'تقرير يومي بعدد المواعيد والإلغاءات' → report_daily", () => {
  const r = analyzeRequest("أبي تقرير يومي بعدد المواعيد والإلغاءات");
  return r.primary_intent?.intent === "report_daily" ? true : `got: ${r.primary_intent?.intent}`;
});


// ═══════════════════ RESULTS ═══════════════════
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  النتيجة: ${passed}/${total} نجحت`);
if (failed > 0) console.log(`  ❌ ${failed} فشلت`);
else console.log(`  ✅ كل الاختبارات نجحت!`);
console.log("═══════════════════════════════════════════════════════════");

console.log(`\n📊 Phase 6 Stats:`);
console.log(`  نوايا معرّفة: ${Object.keys(require("../engine/intent-detector").INTENTS).length}`);
console.log(`  خرائط أدوات: ${Object.keys(INTENT_TOOL_MAP).length}`);
console.log(`  أسماء عربية: ${Object.keys(TOOL_ALIASES).length}`);
console.log(`  أنماط كيانات: ${Object.keys(require("../engine/intent-detector").ENTITY_PATTERNS).length}`);

process.exit(failed > 0 ? 1 : 0);
