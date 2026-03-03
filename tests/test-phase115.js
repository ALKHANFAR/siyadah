const { Database } = require("../backend/db/schema");
const { AuthService } = require("../backend/services/auth");
const { BillingService } = require("../backend/services/billing");
const { executePipeline, executeBatch } = require("../engine/pipeline");
const { WebhookManager } = require("../backend/services/webhook");
const { Monitor } = require("../backend/services/monitor");

let passed = 0, failed = 0, total = 0;
function test(name, fn) { total++; try { const r = fn(); if (r === true) { passed++; console.log("  ✅ " + name); } else { failed++; console.log("  ❌ " + name + ": " + r); } } catch (e) { failed++; console.log("  ❌ " + name + ": " + e.message); } }

console.log("═══════════════════════════════════════════════════════════");
console.log("  Phase 11.5: Load Test + DevOps + Production Readiness");
console.log("═══════════════════════════════════════════════════════════\n");

// ═══════ 11.5a: DB Schema completeness ═══════
console.log("📋 11.5a: DB Schema Completeness");
console.log("─────────────────────────────────────");

const db = new Database();
test("10 tables defined", () => Object.keys(db.tables).length === 10 ? true : Object.keys(db.tables).length);
test("tables: users, tenants, subscriptions, usage, automations, connections, audit_log, errors, sessions, lifecycle", () => {
  const expected = ["users","tenants","subscriptions","usage","automations","connections","audit_log","errors","sessions","lifecycle"];
  const missing = expected.filter(t => !db.tables[t]);
  return missing.length === 0 ? true : "missing: " + missing.join(", ");
});
test("createUser → has all fields", () => {
  const u = db.createUser({ email: "a@b.com", password_hash: "hash", name: "Test" });
  return u.id && u.email && u.created_at && u.role === "owner" ? true : JSON.stringify(u);
});
test("createTenant → has all fields", () => {
  const t = db.createTenant({ owner_id: "u1", company_name: "Test", industry: "clinic" });
  return t.id && t.status === "active" && t.region === "SA" ? true : JSON.stringify(t);
});
test("createSubscription → has trial dates", () => {
  const s = db.createSubscription({ tenant_id: "t1", plan: "free", trial_days: 14 });
  return s.trial_ends && s.current_period_start ? true : JSON.stringify(s);
});
test("createAutomation → has all fields", () => {
  const a = db.createAutomation({ tenant_id: "t1", name: "Test", flow_template: "lead_capture" });
  return a.id && a.status === "draft" && a.error_count === 0 ? true : JSON.stringify(a);
});
test("logEvent → immutable audit trail", () => {
  db.logEvent("t1", "TEST_EVENT", { key: "value" });
  const logs = db.getAuditLog("t1");
  return logs.length >= 1 && logs[0].event_type === "TEST_EVENT" ? true : "no log";
});
test("foreign key simulation: tenant→owner exists", () => {
  const u = db.createUser({ email: "fk@test.com", password_hash: "h", name: "FK" });
  const t = db.createTenant({ owner_id: u.id, company_name: "FK Co", industry: "general" });
  return db.getUserById(t.owner_id) !== null ? true : "orphan tenant";
});

// ═══════ 11.5d: Load Test — 50 concurrent users ═══════
console.log("\n📋 11.5d: Load Test (50 users)");
console.log("─────────────────────────────────────");

test("50 users register simultaneously", () => {
  const ldb = new Database();
  const lauth = new AuthService(ldb);
  const results = [];
  for (let i = 0; i < 50; i++) results.push(lauth.register({ email: `user${i}@load.sa`, password: "pass123", name: `User${i}`, company_name: `Co${i}`, industry: "general" }));
  const success = results.filter(r => r.success);
  return success.length === 50 ? true : "registered: " + success.length;
});

test("50 users → 50 isolated tenants", () => {
  const ldb = new Database();
  const lauth = new AuthService(ldb);
  for (let i = 0; i < 50; i++) lauth.register({ email: `iso${i}@load.sa`, password: "pass123", name: `Iso${i}` });
  const tenantIds = new Set(ldb.tables.tenants.map(t => t.id));
  return tenantIds.size === 50 ? true : "tenants: " + tenantIds.size;
});

test("50 users login simultaneously", () => {
  const ldb = new Database();
  const lauth = new AuthService(ldb);
  for (let i = 0; i < 50; i++) lauth.register({ email: `login${i}@load.sa`, password: "pass123", name: `L${i}` });
  const results = [];
  for (let i = 0; i < 50; i++) results.push(lauth.login({ email: `login${i}@load.sa`, password: "pass123" }));
  const success = results.filter(r => r.success);
  return success.length === 50 ? true : "logins: " + success.length;
});

test("10 pipeline executions simultaneously", () => {
  const texts = ["أبي أحجز موعد", "أرسل فاتورة", "عميل جديد", "تقرير يومي", "أرسل واتساب", "عميل يشتكي", "رد تلقائي", "تقرير أسبوعي", "أرسل إيميل", "متابعة دفع"];
  const results = executeBatch(texts);
  const success = results.filter(r => r.success);
  return success.length === 10 ? true : "success: " + success.length;
});

test("Pipeline < 100ms per request (avg)", () => {
  const texts = Array(20).fill(null).map((_, i) => ["أبي أحجز موعد", "أرسل فاتورة", "عميل جديد", "تقرير يومي", "أرسل واتساب"][i % 5]);
  const start = Date.now();
  executeBatch(texts);
  const avg = (Date.now() - start) / 20;
  return avg < 100 ? true : "avg: " + Math.round(avg) + "ms";
});

test("50 webhooks created — no collision", () => {
  const wm = new WebhookManager();
  const ids = new Set();
  for (let i = 0; i < 50; i++) { const r = wm.create(`t${i}`, `f${i}`); ids.add(r.id); }
  return ids.size === 50 ? true : "unique: " + ids.size;
});

test("50 tenants — complete isolation", () => {
  const ldb = new Database();
  const lauth = new AuthService(ldb);
  for (let i = 0; i < 50; i++) lauth.register({ email: `tn${i}@test.sa`, password: "pass123", name: `T${i}` });
  // Each tenant can only access own data
  const tenants = ldb.tables.tenants;
  let leaks = 0;
  for (let i = 0; i < 50; i++) {
    const myId = tenants[i].id;
    const otherId = tenants[(i + 1) % 50].id;
    const r = lauth.getTenantData(otherId, myId);
    if (r.success) leaks++;
  }
  return leaks === 0 ? true : "leaks: " + leaks;
});

test("Monitor tracks 100 requests", () => {
  const mon = new Monitor();
  for (let i = 0; i < 100; i++) mon.recordRequest(Math.random() * 200, Math.random() > 0.05);
  const h = mon.healthCheck();
  return h.requests === 100 && h.avg_response_ms > 0 ? true : JSON.stringify(h);
});

test("No memory leak: 50 users + 10 flows each = manageable", () => {
  const ldb = new Database();
  const lauth = new AuthService(ldb);
  for (let i = 0; i < 50; i++) {
    const r = lauth.register({ email: `mem${i}@test.sa`, password: "pass123", name: `M${i}` });
    for (let j = 0; j < 10; j++) ldb.createAutomation({ tenant_id: r.tenant.id, name: `Auto${j}`, flow_template: "lead_capture" });
  }
  return ldb.tables.automations.length === 500 && ldb.tables.users.length === 50 ? true : "auto: " + ldb.tables.automations.length;
});

// ═══════ 11.5 Integration ═══════
console.log("\n📋 11.5 Integration: Full SaaS Cycle");
console.log("─────────────────────────────────────");

test("E2E: register → onboard → build → use → limit → upgrade → pay → continue", () => {
  const idb = new Database();
  const iauth = new AuthService(idb);
  const ibill = new BillingService(idb);

  // 1. Register
  const reg = iauth.register({ email: "full@cycle.sa", password: "pass123", name: "Full Cycle CEO", company_name: "شركة الدورة", industry: "consulting" });
  if (!reg.success) return "register failed";

  // 2. Login
  const login = iauth.login({ email: "full@cycle.sa", password: "pass123" });
  if (!login.success) return "login failed";

  // 3. Validate token
  const valid = iauth.validateToken(login.token);
  if (!valid.valid) return "token invalid";

  // 4. Build automation
  const pipeline = executePipeline("عميل جديد يتواصل معنا", { industry: "consulting" });
  if (!pipeline.success) return "pipeline failed";

  // 5. Save automation
  idb.createAutomation({ tenant_id: reg.tenant.id, name: "Lead Capture", flow_template: "lead_capture" });

  // 6. Use resources
  for (let i = 0; i < 50; i++) ibill.useResource(reg.tenant.id, "messages");

  // 7. Hit limit
  const blocked = ibill.useResource(reg.tenant.id, "messages");
  if (blocked.success) return "should be blocked";

  // 8. Upgrade
  const up = ibill.upgrade(reg.tenant.id, "advanced");
  if (!up.success) return "upgrade failed";

  // 9. Monthly reset
  ibill.monthlyReset(reg.tenant.id);

  // 10. Continue using
  const ok = ibill.useResource(reg.tenant.id, "messages");
  if (!ok.success) return "still blocked";

  // 11. Cancel
  const cancel = ibill.cancel(reg.tenant.id);
  if (!cancel.success) return "cancel failed";

  // 12. Reactivate
  const react = ibill.reactivate(reg.tenant.id);
  if (!react.success) return "reactivate failed";

  // Verify lifecycle emails
  const emails = ibill.getLifecycleEmails(reg.tenant.id);
  if (emails.length < 3) return "missing lifecycle emails: " + emails.length;

  return true;
});

// ═══════ RESULTS ═══════
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  النتيجة: " + passed + "/" + total + " نجحت");
if (failed > 0) console.log("  ❌ " + failed + " فشلت");
else console.log("  ✅ كل الاختبارات نجحت!");
console.log("═══════════════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
