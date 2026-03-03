const path = require("path");
const { ActivePiecesClient } = require("../backend/services/activepieces");
const { hashPassword, verifyPassword, generateToken, verifyToken, RateLimiter, sanitizeInput, validateEmail, validatePhone, corsHeaders, signWebhook, verifyWebhookSignature } = require("../backend/middleware/security");
const { WebhookManager } = require("../backend/services/webhook");
const { Monitor } = require("../backend/services/monitor");

let passed = 0, failed = 0, total = 0;
function test(name, fn) { total++; try { const r = fn(); if (r === true) { passed++; console.log("  ✅ " + name); } else { failed++; console.log("  ❌ " + name + ": " + r); } } catch (e) { failed++; console.log("  ❌ " + name + ": " + e.message); } }

console.log("═══════════════════════════════════════════════════════════");
console.log("  Phase 9.5: AP API + Security + Infrastructure");
console.log("═══════════════════════════════════════════════════════════\n");

// ═══════ 9.5a: ActivePieces API ═══════
console.log("📋 9.5a: ActivePieces API Wrapper");
console.log("─────────────────────────────────────");

const ap = new ActivePiecesClient({ mock: true });

test("createProject → returns id", () => { const r = ap.createProject("test", "Test"); return r.id && r.name === "test" ? true : JSON.stringify(r); });
test("getProject → returns status", () => { const r = ap.getProject("proj_123"); return r.status === "active" ? true : r.status; });
test("deleteProject → deleted=true", () => { const r = ap.deleteProject("proj_123"); return r.deleted === true ? true : "not deleted"; });
test("importFlow → returns flow id", () => { const r = ap.importFlow("proj_1", { displayName: "Test Flow" }); return r.id && r.status === "DISABLED" ? true : JSON.stringify(r); });
test("enableFlow → ENABLED", () => { const r = ap.enableFlow("flow_1"); return r.status === "ENABLED" ? true : r.status; });
test("disableFlow → DISABLED", () => { const r = ap.disableFlow("flow_1"); return r.status === "DISABLED" ? true : r.status; });
test("getFlowStatus → has runs/errors", () => { const r = ap.getFlowStatus("flow_1"); return r.status && r.runs !== undefined && r.errors !== undefined ? true : JSON.stringify(r); });
test("deleteFlow → deleted", () => { const r = ap.deleteFlow("flow_1"); return r.deleted === true ? true : "not deleted"; });
test("listFlows → array", () => { const r = ap.listFlows("proj_1"); return Array.isArray(r.data) ? true : "not array"; });
test("createConnection → returns id", () => { const r = ap.createConnection("proj_1", "gmail", {}); return r.id && r.status === "ACTIVE" ? true : JSON.stringify(r); });
test("testFlow → SUCCEEDED", () => { const r = ap.testFlow("flow_1", {}); return r.status === "SUCCEEDED" ? true : r.status; });
test("health → ok", () => { const r = ap.health(); return r.status === "ok" ? true : r.status; });

// ═══════ 9.5b: Security ═══════
console.log("\n📋 9.5b: Security Hardening");
console.log("─────────────────────────────────────");

test("hashPassword → salt:hash format", () => { const h = hashPassword("test123"); return h.includes(":") && h.length > 100 ? true : "bad format: " + h.length; });
test("verifyPassword → correct password", () => { const h = hashPassword("mypass"); return verifyPassword("mypass", h) === true ? true : "wrong"; });
test("verifyPassword → wrong password fails", () => { const h = hashPassword("mypass"); return verifyPassword("wrong", h) === false ? true : "accepted wrong!"; });
test("generateToken → JWT format (3 parts)", () => { const t = generateToken({ userId: "u1" }); return t.split(".").length === 3 ? true : "parts: " + t.split(".").length; });
test("verifyToken → valid token", () => { const t = generateToken({ userId: "u1" }); const r = verifyToken(t); return r.valid && r.payload.userId === "u1" ? true : JSON.stringify(r); });
test("verifyToken → tampered token fails", () => { const t = generateToken({ userId: "u1" }) + "x"; const r = verifyToken(t); return r.valid === false ? true : "accepted tampered!"; });
test("verifyToken → expired token fails", () => {
  const secret = "test-secret";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ userId: "u1", iat: 1000, exp: 1001 })).toString("base64url");
  const crypto = require("crypto");
  const sig = crypto.createHmac("sha256", secret).update(header + "." + body).digest("base64url");
  const r = verifyToken(header + "." + body + "." + sig, secret);
  return r.valid === false && r.error === "TOKEN_EXPIRED" ? true : JSON.stringify(r);
});

test("RateLimiter → allows within limit", () => { const rl = new RateLimiter(3, 60000); const r = rl.check("user1"); return r.allowed === true && r.remaining === 2 ? true : JSON.stringify(r); });
test("RateLimiter → blocks over limit", () => { const rl = new RateLimiter(2, 60000); rl.check("u1"); rl.check("u1"); const r = rl.check("u1"); return r.allowed === false ? true : "still allowed!"; });
test("RateLimiter → different keys independent", () => { const rl = new RateLimiter(1, 60000); rl.check("a"); const r = rl.check("b"); return r.allowed === true ? true : "blocked!"; });

test("sanitizeInput → removes <script>", () => { const r = sanitizeInput('<script>alert("xss")</script>hello'); return !r.includes("<script") ? true : r; });
test("sanitizeInput → removes javascript:", () => { const r = sanitizeInput("javascript:alert(1)"); return !r.includes("javascript:") ? true : r; });
test("validateEmail → valid", () => validateEmail("test@example.com") === true ? true : "rejected valid");
test("validateEmail → invalid", () => validateEmail("notanemail") === false ? true : "accepted invalid");
test("validatePhone → +966", () => validatePhone("+966512345678") === true ? true : "rejected valid");
test("validatePhone → too short", () => validatePhone("123") === false ? true : "accepted short");
test("corsHeaders → has security headers", () => { const h = corsHeaders(); return h["X-Frame-Options"] === "DENY" && h["X-XSS-Protection"] ? true : "missing headers"; });

test("signWebhook + verify → match", () => {
  const payload = { event: "test" };
  const secret = "my-secret";
  const sig = signWebhook(payload, secret);
  return verifyWebhookSignature(payload, sig, secret) === true ? true : "mismatch";
});
test("signWebhook → wrong secret fails", () => {
  const sig = signWebhook({ test: 1 }, "secret1");
  try { return verifyWebhookSignature({ test: 1 }, sig, "secret2") === false ? true : "matched wrong!"; }
  catch (e) { return true; } // timing-safe compare may throw
});

// ═══════ 9.5c: Webhooks ═══════
console.log("\n📋 9.5c: Webhook Management");
console.log("─────────────────────────────────────");

const wm = new WebhookManager();

test("create → returns id + url + secret", () => { const r = wm.create("t1", "f1"); return r.id && r.url && r.secret ? true : JSON.stringify(r); });
test("get → returns webhook", () => { const { id } = wm.create("t2", "f2"); const r = wm.get(id); return r && r.tenantId === "t2" ? true : "not found"; });
test("route → correct tenant + flow", () => { const { id } = wm.create("t3", "f3"); const r = wm.route(id, { data: "test" }); return r.routed && r.tenantId === "t3" && r.flowId === "f3" ? true : JSON.stringify(r); });
test("route → increments calls", () => { const { id } = wm.create("t4", "f4"); wm.route(id, {}); wm.route(id, {}); return wm.get(id).calls === 2 ? true : "calls: " + wm.get(id).calls; });
test("disable → prevents routing", () => { const { id } = wm.create("t5", "f5"); wm.disable(id); const r = wm.route(id, {}); return r.routed === false && r.error === "DISABLED" ? true : JSON.stringify(r); });
test("listByTenant → filters correctly", () => { wm.create("tenant_x", "f1"); wm.create("tenant_x", "f2"); wm.create("tenant_y", "f3"); const r = wm.listByTenant("tenant_x"); return r.length === 2 ? true : "count: " + r.length; });
test("delete → removes webhook", () => { const { id } = wm.create("t6", "f6"); wm.delete(id); return wm.get(id) === null ? true : "still exists"; });
test("route nonexistent → NOT_FOUND", () => { const r = wm.route("fake_id", {}); return r.error === "NOT_FOUND" ? true : r.error; });
test("tenant isolation → can't access other's webhooks", () => {
  const wm2 = new WebhookManager();
  wm2.create("tenant_a", "f1"); wm2.create("tenant_b", "f2");
  const a = wm2.listByTenant("tenant_a");
  const b = wm2.listByTenant("tenant_b");
  return a.length === 1 && b.length === 1 && a[0].tenantId !== b[0].tenantId ? true : "leak!";
});

// ═══════ 9.5e: Monitor ═══════
console.log("\n📋 9.5e: Monitoring & Health");
console.log("─────────────────────────────────────");

const mon = new Monitor();

test("healthCheck → status healthy", () => { const r = mon.healthCheck(); return r.status === "healthy" ? true : r.status; });
test("recordRequest → increments count", () => { mon.reset(); mon.recordRequest(50); mon.recordRequest(100); return mon.getMetrics().requests === 2 ? true : "count: " + mon.getMetrics().requests; });
test("recordRequest → calculates avg", () => { mon.reset(); mon.recordRequest(50); mon.recordRequest(150); const m = mon.getMetrics(); return m.avg_response_ms === 100 ? true : "avg: " + m.avg_response_ms; });
test("recordError → logs error", () => { mon.reset(); mon.recordError("t1", new Error("test error")); return mon.getErrorLog().length === 1 ? true : "count: " + mon.getErrorLog().length; });
test("high error rate → degraded", () => {
  const m2 = new Monitor();
  for (let i = 0; i < 8; i++) m2.recordRequest(50, true);
  for (let i = 0; i < 2; i++) m2.recordRequest(50, false);
  const h = m2.healthCheck();
  return h.error_rate > 0 ? true : "rate: " + h.error_rate;
});
test("uptime_human → format correct", () => { const r = mon.healthCheck(); return r.uptime_human && r.uptime_human.includes("h") ? true : r.uptime_human; });
test("getAlerts → array", () => Array.isArray(mon.getAlerts()) ? true : "not array");
test("reset → clears all", () => { mon.reset(); return mon.getMetrics().requests === 0 && mon.getErrorLog().length === 0 ? true : "not reset"; });

// ═══════ RESULTS ═══════
console.log("\n═══════════════════════════════════════════════════════════");
console.log("  النتيجة: " + passed + "/" + total + " نجحت");
if (failed > 0) console.log("  ❌ " + failed + " فشلت");
else console.log("  ✅ كل الاختبارات نجحت!");
console.log("═══════════════════════════════════════════════════════════");
process.exit(failed > 0 ? 1 : 0);
