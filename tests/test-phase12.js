const { SiyadahAPI } = require("../backend/routes/api");

let passed = 0, failed = 0, total = 0;
function test(name, fn) { total++; try { const r = fn(); if (r === true) { passed++; console.log("  ✅ " + name); } else { failed++; console.log("  ❌ " + name + ": " + r); } } catch (e) { failed++; console.log("  ❌ " + name + ": " + e.message); } }

console.log("═══════════════════════════════════════════════════════════");
console.log("  Phase 12: Full API + Integration (E2E)");
console.log("═══════════════════════════════════════════════════════════\n");

const api = new SiyadahAPI();

// Register test users
const ceo = api.register({ email: "ceo@clinic.sa", password: "pass123", name: "د. أحمد", company_name: "عيادة الشفاء", industry: "clinic" });
const shop = api.register({ email: "owner@shop.sa", password: "pass123", name: "خالد", company_name: "متجر خالد", industry: "ecommerce" });

// ═══════ Auth ═══════
console.log("📋 Auth (Register + Login + Validate + Logout)");
console.log("─────────────────────────────────────");

test("register → success", () => ceo.success === true ? true : ceo.error);
test("register → token", () => ceo.token ? true : "no token");
test("register → tenant created", () => ceo.tenant?.id ? true : "no tenant");
test("register → subscription trialing", () => ceo.subscription?.status === "trialing" ? true : ceo.subscription?.status);
test("login → success", () => { const r = api.login({ email: "ceo@clinic.sa", password: "pass123" }); return r.success ? true : r.error; });
test("login wrong pass → error", () => { const r = api.login({ email: "ceo@clinic.sa", password: "wrong" }); return r.error === "INVALID_CREDENTIALS" ? true : r.error; });
test("validateToken → valid", () => { const r = api.validateToken(ceo.token); return r.valid && r.tenantId ? true : JSON.stringify(r); });
test("validateToken fake → invalid", () => api.validateToken("fake").valid === false ? true : "accepted!");
test("logout → success", () => { const l = api.login({ email: "ceo@clinic.sa", password: "pass123" }); return api.logout(l.token).success ? true : "failed"; });

// ═══════ Onboarding ═══════
console.log("\n📋 Onboarding");
console.log("─────────────────────────────────────");

test("onboard → success", () => {
  const r = api.onboard(ceo.tenant.id, { services: ["أسنان", "تقويم"], hours: "8AM-10PM", tone: "رسمي ودود" });
  return r.success ? true : r.error;
});
test("onboard → marks complete", () => {
  const s = api.getSettings(ceo.tenant.id);
  return s.company?.settings_json?.onboarding_complete === true ? true : "not marked";
});
test("onboard missing tenant → error", () => api.onboard("fake_tenant", {}).error === "TENANT_NOT_FOUND" ? true : "no error");

// ═══════ Chat → Pipeline ═══════
console.log("\n📋 Chat (Arabic → Automation)");
console.log("─────────────────────────────────────");

test("chat: حجز موعد → automation created", () => {
  const r = api.chat(ceo.tenant.id, "أبي أحجز موعد للمريض");
  return r.success && r.automation_id && r.intent === "appointment_book" ? true : JSON.stringify(r.error || r.intent);
});
test("chat: فاتورة → correct intent", () => {
  const r = api.chat(ceo.tenant.id, "أرسل فاتورة للعميل");
  return r.success && r.intent === "invoice_send" ? true : r.intent;
});
test("chat: عميل جديد → steps include sheets", () => {
  const r = api.chat(shop.tenant.id, "عميل جديد يتواصل معنا من الموقع");
  return r.success && r.steps.some(s => s.piece === "google-sheets") ? true : JSON.stringify(r.steps?.map(s=>s.piece));
});
test("chat: response has message_ar", () => {
  const r = api.chat(ceo.tenant.id, "أبي تقرير يومي");
  return r.success && r.message_ar && r.message_ar.includes("بنيت") ? true : r.message_ar;
});
test("chat: response has validation summary", () => {
  const r = api.chat(ceo.tenant.id, "أرسل واتساب للعميل");
  return r.validation ? true : "no validation";
});
test("chat: response has connections_required", () => {
  const r = api.chat(ceo.tenant.id, "أبي أحجز موعد");
  return r.connections_required?.length >= 1 ? true : "no connections";
});
test("chat: غامض → error with message", () => {
  const r = api.chat(ceo.tenant.id, "الجو حلو");
  return r.success === false && r.message ? true : "no error msg";
});

// ═══════ Deploy ═══════
console.log("\n📋 Deploy");
console.log("─────────────────────────────────────");

test("deploy → active + webhook", () => {
  const chat = api.chat(ceo.tenant.id, "أبي أحجز موعد");
  const r = api.deploy(ceo.tenant.id, chat.automation_id);
  return r.success && r.webhook_url && r.status === "active" ? true : JSON.stringify(r);
});
test("deploy → has message_ar", () => {
  const api2 = new SiyadahAPI();
  const r2 = api2.register({ email: "deploy@t.sa", password: "pass123", name: "T" });
  const chat = api2.chat(r2.tenant.id, "أرسل فاتورة");
  const r = api2.deploy(r2.tenant.id, chat.automation_id);
  return r.message_ar?.includes("🎉") ? true : r.message_ar || r.error;
});
test("deploy wrong tenant → NOT_FOUND", () => {
  const chat = api.chat(ceo.tenant.id, "أرسل واتساب");
  const r = api.deploy("fake_tenant", chat.automation_id);
  return r.error === "NOT_FOUND" ? true : r.error;
});

// ═══════ Operations Dashboard ═══════
console.log("\n📋 Operations Dashboard");
console.log("─────────────────────────────────────");

test("getOperations → automations list", () => {
  const r = api.getOperations(ceo.tenant.id);
  return r.automations.length >= 1 ? true : "count: " + r.automations.length;
});
test("getOperations → stats (active/draft)", () => {
  const r = api.getOperations(ceo.tenant.id);
  return r.stats.total >= 1 && r.stats.active !== undefined ? true : JSON.stringify(r.stats);
});
test("getOperations → usage data", () => {
  const r = api.getOperations(ceo.tenant.id);
  return r.usage && r.usage.ai_calls !== undefined ? true : "no usage";
});
test("getOperations → subscription info", () => {
  const r = api.getOperations(ceo.tenant.id);
  return r.subscription?.plan ? true : "no sub";
});

// ═══════ Settings ═══════
console.log("\n📋 Settings");
console.log("─────────────────────────────────────");

test("getSettings → company + subscription", () => {
  const r = api.getSettings(ceo.tenant.id);
  return r.company && r.subscription ? true : "missing data";
});
test("updateSettings → success", () => {
  const r = api.updateSettings(ceo.tenant.id, { tone: "ودي", signature: "مع تحيات عيادة الشفاء" });
  return r.success ? true : r.error;
});
test("getSettings fake tenant → error", () => api.getSettings("fake").error === "NOT_FOUND" ? true : "no error");

// ═══════ Admin Dashboard ═══════
console.log("\n📋 Admin Dashboard");
console.log("─────────────────────────────────────");

test("admin → total users/tenants", () => {
  const r = api.getAdminDashboard();
  return r.total_users >= 2 && r.total_tenants >= 2 ? true : `u:${r.total_users} t:${r.total_tenants}`;
});
test("admin → health status", () => {
  const r = api.getAdminDashboard();
  return r.health?.status ? true : "no health";
});
test("admin → db_stats", () => {
  const r = api.getAdminDashboard();
  return r.db_stats && r.db_stats.users >= 2 ? true : JSON.stringify(r.db_stats);
});

// ═══════ Tenant Isolation E2E ═══════
console.log("\n📋 Tenant Isolation (E2E)");
console.log("─────────────────────────────────────");

test("tenant A can't see tenant B's automations", () => {
  api.chat(ceo.tenant.id, "أبي أحجز موعد");
  api.chat(shop.tenant.id, "عميل جديد");
  const opsA = api.getOperations(ceo.tenant.id);
  const opsB = api.getOperations(shop.tenant.id);
  const aIds = new Set(opsA.automations.map(a => a.id));
  const bIds = new Set(opsB.automations.map(a => a.id));
  let overlap = 0;
  for (const id of aIds) if (bIds.has(id)) overlap++;
  return overlap === 0 ? true : "overlap: " + overlap;
});

// ═══════ Full User Journey ═══════
console.log("\n📋 Full User Journey (Non-technical CEO)");
console.log("─────────────────────────────────────");

test("Complete Journey: register → onboard → chat → deploy → monitor → settings", () => {
  const fresh = new SiyadahAPI();

  // 1. Register
  const reg = fresh.register({ email: "journey@test.sa", password: "pass123", name: "سارة", company_name: "أكاديمية سارة", industry: "training" });
  if (!reg.success) return "register: " + reg.error;

  // 2. Login
  const login = fresh.login({ email: "journey@test.sa", password: "pass123" });
  if (!login.success) return "login: " + login.error;

  // 3. Validate
  const valid = fresh.validateToken(login.token);
  if (!valid.valid) return "token: " + valid.error;

  // 4. Onboard
  const onboard = fresh.onboard(reg.tenant.id, { services: ["برمجة", "تصميم"], hours: "9-5", tone: "ودي" });
  if (!onboard.success) return "onboard: " + onboard.error;

  // 5. Chat → Build automation
  const chat1 = fresh.chat(reg.tenant.id, "لما أحد يسجل في الدورة، أرسل له إيميل ترحيب");
  if (!chat1.success) return "chat: " + chat1.error;

  // 6. Deploy
  const deploy = fresh.deploy(reg.tenant.id, chat1.automation_id);
  if (!deploy.success) return "deploy: " + deploy.error;

  // 7. Check Operations
  const ops = fresh.getOperations(reg.tenant.id);
  if (ops.automations.length < 1) return "no automations in ops";
  if (ops.stats.active < 1) return "no active automations";

  // 8. Update Settings
  const settings = fresh.updateSettings(reg.tenant.id, { signature: "أكاديمية سارة — نبني المستقبل" });
  if (!settings.success) return "settings: " + settings.error;

  // 9. Build another automation
  const chat2 = fresh.chat(reg.tenant.id, "أبي تقرير أسبوعي بعدد المسجلين");
  if (!chat2.success) return "chat2: " + chat2.error;

  // 10. Check admin
  const admin = fresh.getAdminDashboard();
  if (admin.total_users < 1) return "admin missing users";

  return true;
});

// ═══════ RESULTS ═══════
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  النتيجة: " + passed + "/" + total + " نجحت");
if (failed > 0) console.log("  ❌ " + failed + " فشلت");
else console.log("  ✅ كل الاختبارات نجحت!");
console.log("═══════════════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
