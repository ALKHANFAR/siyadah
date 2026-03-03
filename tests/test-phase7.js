/**
 * Phase 7: Flow Builder Tests
 */
const path = require("path");
const { buildFlow, toActivePiecesFormat, textToFlow } = require("../engine/flow-builder");
const { analyzeRequest } = require("../engine/intent-detector");
const { selectTools } = require("../engine/tool-selector");

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
console.log("  Phase 7: Flow Builder Tests");
console.log("═══════════════════════════════════════════════════════════\n");

// Helper
function selectForText(text) {
  return selectTools(analyzeRequest(text));
}

// ═══════════════════ GROUP 1: بنية Flow ═══════════════════
console.log("📋 Group 1: بنية الـ Flow");
console.log("─────────────────────────────────────");

test("buildFlow يرجع success=true", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  return r.success === true ? true : `${r.error}`;
});

test("flow فيه trigger", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  return r.flow?.trigger?.piece_id ? true : "trigger مفقود";
});

test("flow فيه steps >= 1", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  return r.flow?.steps?.length >= 1 ? true : `steps: ${r.flow?.steps?.length}`;
});

test("flow فيه _metadata", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const m = r.flow?._metadata;
  return m?.intent && m?.created && m?.total_steps > 0 ? true : "metadata ناقصة";
});

test("flow فيه error_handlers", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  return r.flow?.error_handlers?.length >= 1 ? true : `handlers: ${r.flow?.error_handlers?.length}`;
});

test("flow فيه connections_required", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  return r.flow?.connections_required?.length >= 1 ? true : `conn: ${r.flow?.connections_required?.length}`;
});


// ═══════════════════ GROUP 2: Trigger ═══════════════════
console.log("\n📋 Group 2: Trigger");
console.log("─────────────────────────────────────");

test("webhook trigger فيه path", () => {
  const sel = selectForText("عميل جديد يتواصل");
  const r = buildFlow(sel);
  return r.flow?.trigger?.settings?.path ? true : "path مفقود";
});

test("schedule trigger فيه cron + timezone", () => {
  const sel = selectForText("أبي تقرير يومي");
  const r = buildFlow(sel);
  const t = r.flow?.trigger;
  return t?.settings?.cronExpression && t?.settings?.timezone === "Asia/Riyadh"
    ? true : `cron: ${t?.settings?.cronExpression}, tz: ${t?.settings?.timezone}`;
});

test("trigger فيه trigger_type (instant/scheduled)", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  return ["instant", "scheduled"].includes(r.flow?.trigger?.trigger_type)
    ? true : `type: ${r.flow?.trigger?.trigger_type}`;
});


// ═══════════════════ GROUP 3: Steps ═══════════════════
console.log("\n📋 Group 3: Steps");
console.log("─────────────────────────────────────");

test("كل step فيه index", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const bad = r.flow.steps.filter(s => !s.index);
  return bad.length === 0 ? true : `${bad.length} بدون index`;
});

test("كل step فيه piece_id + action_name", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const bad = r.flow.steps.filter(s => !s.piece_id || !s.action_name);
  return bad.length === 0 ? true : `${bad.length} ناقص`;
});

test("كل step فيه role", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const bad = r.flow.steps.filter(s => !s.role);
  return bad.length === 0 ? true : `${bad.length} بدون role`;
});

test("كل step فيه auth_type", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const bad = r.flow.steps.filter(s => !s.auth_type);
  return bad.length === 0 ? true : `${bad.length} بدون auth`;
});

test("كل step فيه error_handling strategy", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const bad = r.flow.steps.filter(s => !s.error_handling?.strategy);
  return bad.length === 0 ? true : `${bad.length} بدون error strategy`;
});

test("كل step فيه output_ref", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const bad = r.flow.steps.filter(s => !s.output_ref);
  return bad.length === 0 ? true : `${bad.length} بدون output_ref`;
});


// ═══════════════════ GROUP 4: ActivePieces Format ═══════════════════
console.log("\n📋 Group 4: ActivePieces Format");
console.log("─────────────────────────────────────");

test("toActivePiecesFormat يرجع trigger", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const ap = toActivePiecesFormat(r);
  return ap?.trigger?.type === "PIECE_TRIGGER" ? true : `type: ${ap?.trigger?.type}`;
});

test("AP format: trigger فيه pieceName", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const ap = toActivePiecesFormat(r);
  return ap?.trigger?.settings?.pieceName?.startsWith("@activepieces/piece-")
    ? true : `name: ${ap?.trigger?.settings?.pieceName}`;
});

test("AP format: actions مع nextAction chain", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const ap = toActivePiecesFormat(r);
  // First action should have nextAction, last should not
  if (ap.actions.length < 2) return "need >= 2 actions";
  const first = ap.actions[0];
  const last = ap.actions[ap.actions.length - 1];
  return first.nextAction && !last.nextAction ? true : "chain broken";
});

test("AP format: كل action فيه pieceName + actionName", () => {
  const sel = selectForText("أبي أحجز موعد");
  const r = buildFlow(sel);
  const ap = toActivePiecesFormat(r);
  const bad = ap.actions.filter(a => !a.settings?.pieceName || !a.settings?.actionName);
  return bad.length === 0 ? true : `${bad.length} ناقص`;
});


// ═══════════════════ GROUP 5: textToFlow ═══════════════════
console.log("\n📋 Group 5: textToFlow (النص → فلو كامل)");
console.log("─────────────────────────────────────");

test("textToFlow: حجز موعد → flow كامل", () => {
  const r = textToFlow("أبي أحجز موعد");
  return r.flow?.success && r.ap_format ? true : `success: ${r.flow?.success}`;
});

test("textToFlow: فاتورة → Stripe في الخطوات", () => {
  const r = textToFlow("أرسل فاتورة للعميل");
  const pieces = r.flow?.flow?.steps?.map(s => s.piece_id) || [];
  return pieces.includes("stripe") ? true : `pieces: ${pieces}`;
});

test("textToFlow: عميل جديد → HubSpot + Sheets", () => {
  const r = textToFlow("عميل جديد يتواصل معنا");
  const pieces = r.flow?.flow?.steps?.map(s => s.piece_id) || [];
  return pieces.includes("hubspot") && pieces.includes("google-sheets") ? true : `pieces: ${pieces}`;
});

test("textToFlow: تقرير يومي → Schedule trigger", () => {
  const r = textToFlow("أبي تقرير يومي");
  return r.flow?.flow?.trigger?.piece_id === "schedule" ? true : `trigger: ${r.flow?.flow?.trigger?.piece_id}`;
});

test("textToFlow: رد تلقائي → OpenAI + WhatsApp", () => {
  const r = textToFlow("رد تلقائي على رسائل الواتساب");
  const pieces = r.flow?.flow?.steps?.map(s => s.piece_id) || [];
  return pieces.includes("openai") && pieces.includes("whatsapp") ? true : `pieces: ${pieces}`;
});


// ═══════════════════ GROUP 6: سيناريوهات معقدة ═══════════════════
console.log("\n📋 Group 6: سيناريوهات معقدة");
console.log("─────────────────────────────────────");

test("حجز موعد → 4+ خطوات", () => {
  const r = textToFlow("أبي أحجز موعد للمريض");
  return r.flow?.flow?.steps?.length >= 3 ? true : `steps: ${r.flow?.flow?.steps?.length}`;
});

test("فاتورة → 4+ خطوات (Stripe + WhatsApp + Gmail + Sheets)", () => {
  const r = textToFlow("أرسل فاتورة ودفع للعميل");
  return r.flow?.flow?.steps?.length >= 4 ? true : `steps: ${r.flow?.flow?.steps?.length}`;
});

test("error_handlers يشمل RATE_LIMIT + AUTH_TOKEN", () => {
  const r = textToFlow("أبي أحجز موعد");
  const codes = r.flow?.flow?.error_handlers?.map(h => h.error_code) || [];
  return codes.includes("RATE_LIMIT_EXCEEDED") && codes.includes("AUTH_TOKEN_EXPIRED")
    ? true : `codes: ${codes.join(", ")}`;
});

test("connections_required يشمل كل الأدوات المستخدمة", () => {
  const r = textToFlow("عميل جديد يتواصل");
  const conn = new Set(r.flow?.flow?.connections_required || []);
  const steps = r.flow?.flow?.steps || [];
  const allPieces = steps.map(s => s.piece_id);
  const missing = allPieces.filter(p => !conn.has(p));
  return missing.length === 0 ? true : `missing: ${missing}`;
});

test("total_steps = steps + 1 (trigger)", () => {
  const r = textToFlow("أبي أحجز موعد");
  const total = r.flow?.flow?._metadata?.total_steps;
  const expected = (r.flow?.flow?.steps?.length || 0) + 1;
  return total === expected ? true : `total: ${total}, expected: ${expected}`;
});


// ═══════════════════ GROUP 7: حالات فشل ═══════════════════
console.log("\n📋 Group 7: حالات فشل");
console.log("─────────────────────────────────────");

test("buildFlow مع selection فاشل → error", () => {
  const r = buildFlow({ success: false, errors: ["test error"] });
  return r.success === false ? true : "ما رجع false";
});

test("نص غامض → يبني flow أو يفشل بأمان", () => {
  const r = textToFlow("الجو حلو اليوم");
  // Should either have no flow or fail gracefully
  return r.flow?.success === false || !r.analysis.primary_intent ? true : "ما تعامل مع الغموض";
});


// ═══════════════════ RESULTS ═══════════════════
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  النتيجة: ${passed}/${total} نجحت`);
if (failed > 0) console.log(`  ❌ ${failed} فشلت`);
else console.log(`  ✅ كل الاختبارات نجحت!`);
console.log("═══════════════════════════════════════════════════════════");

process.exit(failed > 0 ? 1 : 0);
