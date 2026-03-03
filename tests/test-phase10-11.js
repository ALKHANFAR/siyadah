const { Database } = require("../backend/db/schema");
const { AuthService } = require("../backend/services/auth");
const { BillingService, PLANS } = require("../backend/services/billing");

let passed = 0, failed = 0, total = 0;
function test(name, fn) { total++; try { const r = fn(); if (r === true) { passed++; console.log("  ✅ " + name); } else { failed++; console.log("  ❌ " + name + ": " + r); } } catch (e) { failed++; console.log("  ❌ " + name + ": " + e.message); } }

console.log("═══════════════════════════════════════════════════════════");
console.log("  Phase 10-11: Auth + Tenancy + Billing + Usage");
console.log("═══════════════════════════════════════════════════════════\n");

// ═══════ Phase 10: Auth ═══════
console.log("📋 Phase 10a: Registration");
console.log("─────────────────────────────────────");

const db = new Database();
const auth = new AuthService(db);

test("register → success + token", () => {
  const r = auth.register({ email: "ceo@clinic.sa", password: "pass123", name: "أحمد", company_name: "عيادة الشفاء", industry: "clinic" });
  return r.success && r.token && r.user.id && r.tenant.id ? true : JSON.stringify(r.error);
});
test("register duplicate email → error", () => {
  const r = auth.register({ email: "ceo@clinic.sa", password: "pass123", name: "أحمد" });
  return r.error === "EMAIL_EXISTS" ? true : r.error;
});
test("register weak password → error", () => {
  const r = auth.register({ email: "weak@test.sa", password: "12", name: "test" });
  return r.error === "WEAK_PASSWORD" ? true : r.error;
});
test("register missing fields → error", () => {
  const r = auth.register({ email: "x@x.com" });
  return r.error === "MISSING_FIELDS" ? true : r.error;
});
test("register → creates tenant + subscription + usage", () => {
  const r = auth.register({ email: "ceo2@shop.sa", password: "pass123", name: "خالد", company_name: "متجر خالد", industry: "ecommerce" });
  return r.tenant && r.subscription.plan === "free" && r.subscription.status === "trialing" ? true : JSON.stringify(r);
});

console.log("\n📋 Phase 10b: Login");
console.log("─────────────────────────────────────");

test("login valid → success + token", () => {
  const r = auth.login({ email: "ceo@clinic.sa", password: "pass123" });
  return r.success && r.token ? true : JSON.stringify(r.error);
});
test("login wrong password → error", () => {
  const r = auth.login({ email: "ceo@clinic.sa", password: "wrong" });
  return r.error === "INVALID_CREDENTIALS" ? true : r.error;
});
test("login unknown email → error", () => {
  const r = auth.login({ email: "nobody@x.com", password: "pass" });
  return r.error === "INVALID_CREDENTIALS" ? true : r.error;
});

console.log("\n📋 Phase 10c: Token Validation");
console.log("─────────────────────────────────────");

test("validateToken valid → userId + tenantId", () => {
  const login = auth.login({ email: "ceo@clinic.sa", password: "pass123" });
  const r = auth.validateToken(login.token);
  return r.valid && r.userId && r.tenantId ? true : JSON.stringify(r);
});
test("validateToken fake → invalid", () => {
  const r = auth.validateToken("fake.token.here");
  return r.valid === false ? true : "accepted fake!";
});

console.log("\n📋 Phase 10d: Logout");
console.log("─────────────────────────────────────");

test("logout → deletes session", () => {
  const login = auth.login({ email: "ceo@clinic.sa", password: "pass123" });
  const r = auth.logout(login.token);
  return r.success === true ? true : "not deleted";
});

console.log("\n📋 Phase 10e: Tenant Isolation");
console.log("─────────────────────────────────────");

test("tenant can access own data", () => {
  const r1 = auth.register({ email: "t1@a.com", password: "pass123", name: "A" });
  const r = auth.getTenantData(r1.tenant.id, r1.tenant.id);
  return r.success === true ? true : r.error;
});
test("tenant CANNOT access other's data", () => {
  const r1 = auth.register({ email: "t2@a.com", password: "pass123", name: "B" });
  const r2 = auth.register({ email: "t3@a.com", password: "pass123", name: "C" });
  const r = auth.getTenantData(r1.tenant.id, r2.tenant.id);
  return r.error === "ACCESS_DENIED" ? true : r.error;
});

console.log("\n📋 Phase 10f: DB Schema");
console.log("─────────────────────────────────────");

test("10 tables exist", () => {
  const stats = db.getStats();
  return Object.keys(stats).length === 10 ? true : "tables: " + Object.keys(stats).length;
});
test("audit_log records events", () => {
  const logs = db.getAuditLog(db.tables.tenants[0]?.id);
  return logs.length >= 1 ? true : "no logs";
});
test("sessions created on login", () => {
  return db.tables.sessions.length >= 1 ? true : "no sessions";
});

// ═══════ Phase 11: Billing ═══════
console.log("\n📋 Phase 11a: Plans");
console.log("─────────────────────────────────────");

const db2 = new Database();
const auth2 = new AuthService(db2);
const billing = new BillingService(db2);
const reg = auth2.register({ email: "bill@test.sa", password: "pass123", name: "Test", company_name: "Test Co", industry: "general" });
const tenantId = reg.tenant.id;

test("4 plans defined", () => Object.keys(PLANS).length === 4 ? true : Object.keys(PLANS).length);
test("free plan: 0 SAR", () => PLANS.free.price === 0 ? true : PLANS.free.price);
test("business plan: 999 SAR", () => PLANS.business.price === 999 ? true : PLANS.business.price);
test("business: unlimited automations (-1)", () => PLANS.business.automations === -1 ? true : PLANS.business.automations);

console.log("\n📋 Phase 11b: Usage Limits");
console.log("─────────────────────────────────────");

test("checkLimit → allowed on free (50 messages)", () => {
  const r = billing.checkLimit(tenantId, "messages");
  return r.allowed && r.limit === 50 ? true : JSON.stringify(r);
});
test("useResource → decrements remaining", () => {
  const r = billing.useResource(tenantId, "messages", 1);
  return r.success && r.remaining === 49 ? true : "remaining: " + r.remaining;
});
test("useResource at limit → LIMIT_REACHED", () => {
  for (let i = 0; i < 49; i++) billing.useResource(tenantId, "messages");
  const r = billing.useResource(tenantId, "messages");
  return r.success === false && r.error === "LIMIT_REACHED" ? true : JSON.stringify(r);
});

console.log("\n📋 Phase 11c: Upgrade/Downgrade");
console.log("─────────────────────────────────────");

test("upgrade free → basic", () => {
  const r = billing.upgrade(tenantId, "basic");
  return r.success && r.new_plan === "basic" && r.price === 199 ? true : JSON.stringify(r);
});
test("upgrade → creates invoice", () => {
  return billing.getInvoices(tenantId).length >= 1 ? true : "no invoices";
});
test("upgrade → lifecycle email sent", () => {
  const emails = billing.getLifecycleEmails(tenantId);
  return emails.some(e => e.type === "PLAN_UPGRADED") ? true : "no email";
});
test("upgrade to same plan → error", () => {
  const r = billing.upgrade(tenantId, "basic");
  return r.error === "SAME_PLAN" ? true : r.error;
});
test("downgrade basic → free", () => {
  const r = billing.downgrade(tenantId, "free");
  return r.success && r.new_plan === "free" ? true : JSON.stringify(r);
});

console.log("\n📋 Phase 11d: Cancel/Freeze");
console.log("─────────────────────────────────────");

test("cancel → frozen (not deleted)", () => {
  const r = billing.cancel(tenantId);
  return r.success && r.status === "frozen" ? true : JSON.stringify(r);
});
test("reactivate → active again", () => {
  const r = billing.reactivate(tenantId);
  return r.success && r.status === "active" ? true : JSON.stringify(r);
});

console.log("\n📋 Phase 11e: Trial");
console.log("─────────────────────────────────────");

test("new user → in trial", () => {
  const db3 = new Database();
  const auth3 = new AuthService(db3);
  const bill3 = new BillingService(db3);
  const r = auth3.register({ email: "trial@test.sa", password: "pass123", name: "Trial" });
  const t = bill3.checkTrial(r.tenant.id);
  return t.inTrial && t.daysLeft > 0 ? true : JSON.stringify(t);
});

console.log("\n📋 Phase 11f: Monthly Reset");
console.log("─────────────────────────────────────");

test("monthlyReset → new usage period", () => {
  const r = billing.monthlyReset(tenantId);
  const u = db2.getUsage(tenantId);
  return r.success && u.messages === 0 ? true : "messages: " + u?.messages;
});

console.log("\n📋 Phase 11g: Full Cycle");
console.log("─────────────────────────────────────");

test("E2E: register → use → hit limit → upgrade → continue", () => {
  const db4 = new Database();
  const auth4 = new AuthService(db4);
  const bill4 = new BillingService(db4);
  // Register
  const r = auth4.register({ email: "e2e@test.sa", password: "pass123", name: "E2E", industry: "clinic" });
  const tid = r.tenant.id;
  // Use all free messages
  for (let i = 0; i < 50; i++) bill4.useResource(tid, "messages");
  // Hit limit
  const blocked = bill4.useResource(tid, "messages");
  if (blocked.success) return "should be blocked";
  // Upgrade
  const up = bill4.upgrade(tid, "basic");
  if (!up.success) return "upgrade failed";
  // Reset
  bill4.monthlyReset(tid);
  // Use again
  const ok = bill4.useResource(tid, "messages");
  return ok.success === true ? true : "still blocked after upgrade";
});

// ═══════ RESULTS ═══════
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  النتيجة: " + passed + "/" + total + " نجحت");
if (failed > 0) console.log("  ❌ " + failed + " فشلت");
else console.log("  ✅ كل الاختبارات نجحت!");
console.log("═══════════════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
