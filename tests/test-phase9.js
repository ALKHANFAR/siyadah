const path = require("path");
const { executePipeline, executeBatch, healthCheck, STAGES } = require("../engine/pipeline");

let passed = 0, failed = 0, total = 0;
function test(name, fn) { total++; try { const r = fn(); if (r === true) { passed++; console.log("  ✅ " + name); } else { failed++; console.log("  ❌ " + name + ": " + r); } } catch (e) { failed++; console.log("  ❌ " + name + ": " + e.message); } }

console.log("═══════════════════════════════════════════════════════════");
console.log("  Phase 9: Full Pipeline (E2E)");
console.log("═══════════════════════════════════════════════════════════\n");

// ═══════ Group 1: Pipeline Success ═══════
console.log("📋 Group 1: Pipeline نجاح كامل");
console.log("─────────────────────────────────────");

const scenarios = [
  { text: "أبي أحجز موعد للمريض", expect_intent: "appointment_book" },
  { text: "أرسل فاتورة للعميل", expect_intent: "invoice_send" },
  { text: "عميل جديد يتواصل معنا", expect_intent: "lead_capture" },
  { text: "أبي تقرير يومي نهاية كل يوم", expect_intent: "report_daily" },
  { text: "أرسل واتساب للعميل", expect_intent: "notify_whatsapp" },
  { text: "أبي تقرير أسبوعي", expect_intent: "report_weekly" },
  { text: "عميل يشتكي من مشكلة", expect_intent: "support_ticket" },
  { text: "رد تلقائي على رسائل الواتساب", expect_intent: "support_auto_reply" },
  { text: "أرسل إيميل تأكيد الحجز", expect_intent: "notify_email" },
  { text: "العميل ما دفع الحساب المستحق", expect_intent: "payment_follow" },
];

for (const s of scenarios) {
  test(s.text + " → " + s.expect_intent, () => {
    const r = executePipeline(s.text);
    if (!r.success) return "failed at " + r.stage_reached + ": " + JSON.stringify(r.errors[0]);
    return r.stages.select?.intent === s.expect_intent ? true : "got: " + r.stages.select?.intent;
  });
}

// ═══════ Group 2: Pipeline بنية ═══════
console.log("\n📋 Group 2: بنية النتيجة");
console.log("─────────────────────────────────────");

test("success = true", () => executePipeline("أبي أحجز موعد").success === true ? true : "false");
test("stage_reached = ready", () => executePipeline("أبي أحجز موعد").stage_reached === "ready" ? true : "wrong");
test("flow موجود", () => executePipeline("أبي أحجز موعد").flow ? true : "null");
test("ap_format موجود", () => executePipeline("أبي أحجز موعد").ap_format ? true : "null");
test("execution_time_ms < 500", () => {
  const r = executePipeline("أبي أحجز موعد");
  return r.execution_time_ms < 500 ? true : r.execution_time_ms + "ms";
});
test("log موجود مع stages", () => {
  const r = executePipeline("أبي أحجز موعد");
  return r.log && r.log.length >= 4 ? true : "log: " + r.log?.length;
});
test("stages.understand موجود", () => executePipeline("أبي أحجز موعد").stages.understand ? true : "مفقود");
test("stages.select موجود", () => executePipeline("أبي أحجز موعد").stages.select ? true : "مفقود");
test("stages.validate موجود", () => executePipeline("أبي أحجز موعد").stages.validate ? true : "مفقود");
test("stages.format موجود", () => executePipeline("أبي أحجز موعد").stages.format ? true : "مفقود");

// ═══════ Group 3: AP Format ═══════
console.log("\n📋 Group 3: ActivePieces Format");
console.log("─────────────────────────────────────");

test("AP trigger type = PIECE_TRIGGER", () => {
  const r = executePipeline("أبي أحجز موعد");
  return r.ap_format?.trigger?.type === "PIECE_TRIGGER" ? true : r.ap_format?.trigger?.type;
});
test("AP trigger pieceName starts with @activepieces", () => {
  const r = executePipeline("أبي أحجز موعد");
  return r.ap_format?.trigger?.settings?.pieceName?.startsWith("@activepieces/") ? true : "wrong prefix";
});
test("AP actions >= 3", () => {
  const r = executePipeline("أبي أحجز موعد");
  return r.ap_format?.actions?.length >= 3 ? true : "actions: " + r.ap_format?.actions?.length;
});
test("AP actions have nextAction chain", () => {
  const r = executePipeline("أبي أحجز موعد");
  const acts = r.ap_format?.actions || [];
  if (acts.length < 2) return "need >= 2";
  return acts[0].nextAction && !acts[acts.length-1].nextAction ? true : "chain broken";
});

// ═══════ Group 4: حالات فشل ═══════
console.log("\n📋 Group 4: حالات فشل");
console.log("─────────────────────────────────────");

test("نص غامض → فشل في understand", () => {
  const r = executePipeline("الجو حلو اليوم");
  return r.success === false && r.stage_reached === "understand" ? true : "stage: " + r.stage_reached;
});
test("نص فارغ → فشل", () => {
  const r = executePipeline("");
  return r.success === false ? true : "succeeded!";
});
test("فشل → errors array فيه تفاصيل", () => {
  const r = executePipeline("الجو حلو");
  return r.errors.length >= 1 && r.errors[0].code ? true : "no errors";
});

// ═══════ Group 5: Batch ═══════
console.log("\n📋 Group 5: Batch Pipeline");
console.log("─────────────────────────────────────");

test("executeBatch: 5 requests → 5 results", () => {
  const r = executeBatch(["أبي أحجز موعد", "أرسل فاتورة", "عميل جديد", "أبي تقرير", "أرسل واتساب"]);
  return r.length === 5 ? true : "got: " + r.length;
});
test("executeBatch: كلها success", () => {
  const r = executeBatch(["أبي أحجز موعد", "أرسل فاتورة", "عميل جديد يتواصل", "أبي تقرير يومي", "أرسل واتساب"]);
  const fails = r.filter(x => !x.success);
  return fails.length === 0 ? true : fails.map(x => x.input + "→" + x.stage_reached).join(", ");
});

// ═══════ Group 6: Health Check ═══════
console.log("\n📋 Group 6: Health Check");
console.log("─────────────────────────────────────");

test("healthCheck → healthy=true", () => healthCheck().healthy === true ? true : "unhealthy");
test("healthCheck → 5 tests", () => healthCheck().tests.length === 5 ? true : "wrong count");
test("healthCheck → all success", () => {
  const h = healthCheck();
  const fails = h.tests.filter(t => !t.success);
  return fails.length === 0 ? true : fails.map(t => t.text).join(", ");
});
test("healthCheck → each < 500ms", () => {
  const h = healthCheck();
  const slow = h.tests.filter(t => t.time_ms > 500);
  return slow.length === 0 ? true : slow.map(t => t.text + ": " + t.time_ms + "ms").join(", ");
});

// ═══════ Group 7: E2E سيناريوهات صناعية ═══════
console.log("\n📋 Group 7: سيناريوهات صناعية");
console.log("─────────────────────────────────────");

test("عيادة: حجز كشف + تأكيد واتساب", () => {
  const r = executePipeline("مريض يبي يحجز كشف أسنان", { industry: "clinic" });
  const pieces = r.flow?.steps?.map(s => s.piece_id) || [];
  return r.success && pieces.includes("google-calendar") && pieces.includes("whatsapp") ? true : "pieces: " + pieces;
});

test("متجر: عميل جديد → حفظ + إشعار", () => {
  const r = executePipeline("عميل جديد يتواصل من الموقع", { industry: "ecommerce" });
  const pieces = r.flow?.steps?.map(s => s.piece_id) || [];
  return r.success && pieces.includes("google-sheets") ? true : "pieces: " + pieces;
});

test("استشارات: تقرير أسبوعي", () => {
  const r = executePipeline("أبي تقرير أسبوعي نهاية كل أسبوع", { industry: "consulting" });
  return r.success && r.flow?.trigger?.piece_id === "schedule" ? true : "trigger: " + r.flow?.trigger?.piece_id;
});

// ═══════ RESULTS ═══════
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  النتيجة: " + passed + "/" + total + " نجحت");
if (failed > 0) console.log("  ❌ " + failed + " فشلت");
else console.log("  ✅ كل الاختبارات نجحت!");
console.log("═══════════════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
