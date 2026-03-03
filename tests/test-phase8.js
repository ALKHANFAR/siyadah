const path = require("path");
const { validateFlow, validateStructure, validateRegistry, validateConnections, validateVariables, validateSafety, autoFix } = require("../engine/validator");
const { textToFlow } = require("../engine/flow-builder");

let passed = 0, failed = 0, total = 0;
function test(name, fn) { total++; try { const r = fn(); if (r === true) { passed++; console.log(`  ✅ ${name}`); } else { failed++; console.log(`  ❌ ${name}: ${r}`); } } catch (e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); } }

console.log("═══════════════════════════════════════════════════════════");
console.log("  Phase 8: Validator (5 Safety Gates)");
console.log("═══════════════════════════════════════════════════════════\n");

function getFlow(text) { return textToFlow(text).flow; }

console.log("📋 Gate 1: Structure");
console.log("─────────────────────────────────────");
test("flow صحيح → passes", () => { const r = validateStructure(getFlow("أبي أحجز موعد").flow); return r.passed === true ? true : r.errors.map(e=>e.code).join(", "); });
test("بدون trigger → يفشل", () => { const r = validateStructure({ steps: [{ piece_id: "x", action_name: "y", index: 1 }] }); return !r.passed && r.errors.some(e => e.code === "NO_TRIGGER") ? true : "ما كشف"; });
test("بدون steps → يفشل", () => { const r = validateStructure({ trigger: { piece_id: "webhook", trigger_name: "catch_webhook" }, steps: [] }); return !r.passed ? true : "ما فشل"; });
test("step بدون piece_id → يفشل", () => { const r = validateStructure({ trigger: { piece_id: "webhook", trigger_name: "catch_webhook" }, steps: [{ action_name: "x", index: 1 }] }); return r.errors.some(e => e.code === "STEP_NO_PIECE") ? true : "ما كشف"; });
test("indices مكررة → يفشل", () => { const r = validateStructure({ trigger: { piece_id: "w", trigger_name: "t" }, steps: [{ piece_id: "a", action_name: "b", index: 1 }, { piece_id: "c", action_name: "d", index: 1 }] }); return r.errors.some(e => e.code === "DUPLICATE_INDEX") ? true : "ما كشف"; });
test("null → يفشل", () => validateStructure(null).passed === false ? true : "ما فشل");

console.log("\n📋 Gate 2: Registry");
console.log("─────────────────────────────────────");
test("flow حقيقي → passes", () => { const r = validateRegistry(getFlow("أبي أحجز موعد").flow); return r.passed === true ? true : r.errors.map(e=>e.message).join("|"); });
test("trigger مزيف → يفشل", () => { const r = validateRegistry({ trigger: { piece_id: "fake-xyz", trigger_name: "test" }, steps: [] }); return r.errors.some(e => e.code === "TRIGGER_PIECE_NOT_FOUND") ? true : "ما كشف"; });
test("action مزيف → يفشل", () => { const r = validateRegistry({ trigger: { piece_id: "webhook", trigger_name: "catch_webhook" }, steps: [{ piece_id: "gmail", action_name: "fake_xyz", index: 1 }] }); return r.errors.some(e => e.code === "ACTION_NOT_FOUND") ? true : "ما كشف"; });
test("5 flows مختلفة → 0 errors", () => {
  const t = ["أبي أحجز موعد", "أرسل فاتورة", "عميل جديد", "أبي تقرير يومي", "أرسل واتساب"];
  const bad = t.filter(x => !validateRegistry(getFlow(x).flow).passed);
  return bad.length === 0 ? true : bad.join(", ");
});

console.log("\n📋 Gate 3: Connections");
console.log("─────────────────────────────────────");
test("flow صحيح → passes", () => { const r = validateConnections(getFlow("أبي أحجز موعد").flow); return r.passed === true ? true : r.errors.map(e=>e.code).join(", "); });
test("piece غير موجود → error", () => { const r = validateConnections({ trigger: { piece_id: "webhook" }, steps: [{ piece_id: "nonexistent-abc", index: 1 }], connections_required: [] }); return r.errors.some(e => e.code === "UNKNOWN_PIECE") ? true : "ما كشف"; });

console.log("\n📋 Gate 4: Variables");
console.log("─────────────────────────────────────");
test("flow صحيح → passes", () => { const r = validateVariables(getFlow("أبي أحجز موعد").flow); return r.passed === true ? true : r.errors.map(e=>e.code).join(", "); });
test("forward ref → يفشل", () => {
  const flow = { trigger: { piece_id: "webhook", trigger_name: "catch_webhook" }, steps: [
    { piece_id: "gmail", action_name: "send_email", index: 1, settings: { input: { to: "{{steps.step_3.email}}" } } },
    { piece_id: "slack", action_name: "send_channel_message", index: 2, settings: { input: {} } }
  ]};
  return validateVariables(flow).errors.some(e => e.code === "FORWARD_REF") ? true : "ما كشف";
});

console.log("\n📋 Gate 5: Safety");
console.log("─────────────────────────────────────");
test("flow صحيح → passes", () => { const r = validateSafety(getFlow("أبي أحجز موعد").flow); return r.passed === true ? true : r.errors.map(e=>e.code).join(", "); });
test("SQL injection → يفشل", () => { const r = validateSafety({ steps: [{ piece_id: "x", index: 1, settings: { input: { q: "DROP TABLE users" } } }] }); return r.errors.some(e => e.code === "SQL_INJECTION") ? true : "ما كشف"; });
test("XSS → يفشل", () => { const r = validateSafety({ steps: [{ piece_id: "x", index: 1, settings: { input: { m: "<script>alert(1)</script>" } } }] }); return r.errors.some(e => e.code === "XSS") ? true : "ما كشف"; });
test("eval → يفشل", () => { const r = validateSafety({ steps: [{ piece_id: "x", index: 1, settings: { input: { c: "eval('bad')" } } }] }); return r.errors.some(e => e.code === "CODE_INJECTION") ? true : "ما كشف"; });
test("rm -rf → يفشل", () => { const r = validateSafety({ steps: [{ piece_id: "x", index: 1, settings: { input: { c: "rm -rf /" } } }] }); return r.errors.some(e => e.code === "DANGEROUS_CMD") ? true : "ما كشف"; });

console.log("\n📋 Full Validation");
console.log("─────────────────────────────────────");
test("flow صحيح → valid=true", () => { const r = validateFlow(getFlow("أبي أحجز موعد")); return r.valid === true ? true : `errors: ${r.total_errors}`; });
test("summary فيه 5 gates", () => { const r = validateFlow(getFlow("أبي أحجز موعد")); return Object.keys(r.summary).length === 5 ? true : `${Object.keys(r.summary).length}`; });
test("null → valid=false", () => validateFlow(null).valid === false ? true : "ما فشل");
test("5 سيناريوهات → كلها valid", () => {
  const bad = ["أبي أحجز موعد", "أرسل فاتورة", "عميل جديد يتواصل", "أبي تقرير أسبوعي", "رد تلقائي على واتساب"]
    .filter(t => !validateFlow(getFlow(t)).valid);
  return bad.length === 0 ? true : bad.join(", ");
});

console.log("\n📋 Auto-Fix");
console.log("─────────────────────────────────────");
test("05 → +966", () => {
  const f = { steps: [{ piece_id: "whatsapp", action_name: "sendMessage", index: 1, settings: { input: { number: "0512345678" } } }] };
  autoFix(f);
  return f.steps[0].settings.input.number === "+966512345678" ? true : f.steps[0].settings.input.number;
});
test("لا يعدّل {{trigger}}", () => {
  const f = { steps: [{ piece_id: "whatsapp", action_name: "sendMessage", index: 1, settings: { input: { number: "{{trigger.body.phone}}" } } }] };
  autoFix(f);
  return f.steps[0].settings.input.number === "{{trigger.body.phone}}" ? true : "عدّل!";
});

console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  النتيجة: ${passed}/${total} نجحت`);
if (failed > 0) console.log(`  ❌ ${failed} فشلت`);
else console.log(`  ✅ كل الاختبارات نجحت!`);
console.log("═══════════════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
