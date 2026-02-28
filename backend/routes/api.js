/**
 * سيادة — API Routes
 * Phase 12: Complete API for Chat + Onboarding + Ops + Settings
 */
const { Database } = require("../db/schema");
const { AuthService } = require("../services/auth");
const { BillingService } = require("../services/billing");
const { ActivePiecesClient } = require("../services/activepieces");
const { WebhookManager } = require("../services/webhook");
const { Monitor } = require("../services/monitor");
const { executePipeline } = require("../../engine/pipeline");

class SiyadahAPI {
  constructor(config = {}) {
    this.db = new Database();
    this.auth = new AuthService(this.db);
    this.billing = new BillingService(this.db);
    this.ap = new ActivePiecesClient({ mock: true });
    this.webhooks = new WebhookManager();
    this.monitor = new Monitor();
  }

  // ══════════ Auth Routes ══════════
  register(body) { return this.auth.register(body); }
  login(body) { return this.auth.login(body); }
  logout(token) { return this.auth.logout(token); }
  validateToken(token) { return this.auth.validateToken(token); }

  // ══════════ Onboarding ══════════
  onboard(tenantId, data) {
    const tenant = this.db.getTenant(tenantId);
    if (!tenant) return { error: "TENANT_NOT_FOUND" };
    this.db.updateTenant(tenantId, {
      settings_json: { ...tenant.settings_json, ...data, onboarding_complete: true, onboarded_at: new Date().toISOString() }
    });
    this.db.logEvent(tenantId, "ONBOARDING_COMPLETE", data);
    return { success: true, message: "تم إعداد الشركة بنجاح!" };
  }

  // ══════════ Chat → Pipeline ══════════
  chat(tenantId, message) {
    const start = Date.now();
    // Check limits
    const aiCheck = this.billing.useResource(tenantId, "ai_calls");
    if (!aiCheck.success) return { error: "LIMIT_REACHED", message: aiCheck.message };

    // Execute pipeline
    const result = executePipeline(message);
    this.monitor.recordRequest(Date.now() - start, result.success);

    if (!result.success) {
      return { success: false, error: "PIPELINE_FAILED", stage: result.stage_reached, message: result.errors[0]?.message || "لم أفهم طلبك — جرب تصيغه بشكل ثاني" };
    }

    // Save automation
    const auto = this.db.createAutomation({
      tenant_id: tenantId,
      name: result.flow._metadata.name,
      flow_template: result.stages.select.intent,
    });

    this.db.logEvent(tenantId, "FLOW_CREATED", { intent: result.stages.select.intent, automation_id: auto.id });

    return {
      success: true,
      automation_id: auto.id,
      intent: result.stages.select.intent,
      intent_ar: result.stages.understand.primary_intent?.name_ar,
      confidence: result.stages.understand.primary_intent?.confidence,
      steps: result.flow.steps.map(s => ({ piece: s.piece_id, action: s.action_name, role: s.role })),
      trigger: { piece: result.flow.trigger.piece_id, type: result.flow.trigger.trigger_name },
      connections_required: result.flow.connections_required,
      validation: result.stages.validate.summary,
      message_ar: `تمام! بنيت لك أتمتة "${result.stages.understand.primary_intent?.name_ar}" بـ ${result.flow._metadata.total_steps} خطوات.`,
    };
  }

  // ══════════ Deploy ══════════
  deploy(tenantId, automationId) {
    const auto = this.db.tables.automations.find(a => a.id === automationId && a.tenant_id === tenantId);
    if (!auto) return { error: "NOT_FOUND" };

    // Check automation limit
    const activeCount = this.db.getAutomations(tenantId).filter(a => a.status === "active").length;
    const check = this.billing.checkLimit(tenantId, "automations");
    if (check.limit !== -1 && activeCount >= check.limit) return { error: "LIMIT_REACHED", message: "وصلت الحد الأقصى للأتمتة. رقّي خطتك!" };

    // Deploy to AP (mock)
    const apFlow = this.ap.importFlow(tenantId, { displayName: auto.name });
    this.ap.enableFlow(apFlow.id);

    this.db.updateAutomation(automationId, { status: "active", ap_flow_id: apFlow.id });
    this.db.logEvent(tenantId, "FLOW_DEPLOYED", { automation_id: automationId, ap_flow_id: apFlow.id });

    // Create webhook if needed
    const wh = this.webhooks.create(tenantId, apFlow.id);

    return { success: true, automation_id: automationId, ap_flow_id: apFlow.id, webhook_url: wh.url, status: "active", message_ar: "الأتمتة شغّالة الحين! 🎉" };
  }

  // ══════════ Operations Dashboard ══════════
  getOperations(tenantId) {
    const automations = this.db.getAutomations(tenantId);
    const usage = this.db.getUsage(tenantId);
    const sub = this.db.getSubscription(tenantId);
    const connections = this.db.getConnections(tenantId);

    return {
      automations: automations.map(a => ({ id: a.id, name: a.name, status: a.status, last_run: a.last_run, errors: a.error_count })),
      stats: { total: automations.length, active: automations.filter(a => a.status === "active").length, draft: automations.filter(a => a.status === "draft").length },
      usage: usage || { messages: 0, ai_calls: 0, automations: 0 },
      subscription: sub ? { plan: sub.plan, status: sub.status } : null,
      connections: connections.length,
    };
  }

  // ══════════ Settings ══════════
  getSettings(tenantId) {
    const tenant = this.db.getTenant(tenantId);
    const sub = this.db.getSubscription(tenantId);
    if (!tenant) return { error: "NOT_FOUND" };
    return { company: tenant, subscription: sub, connections: this.db.getConnections(tenantId) };
  }

  updateSettings(tenantId, data) {
    const tenant = this.db.updateTenant(tenantId, { settings_json: data });
    if (!tenant) return { error: "NOT_FOUND" };
    this.db.logEvent(tenantId, "SETTINGS_UPDATED", data);
    return { success: true };
  }

  // ══════════ Admin Dashboard ══════════
  getAdminDashboard() {
    return {
      total_users: this.db.tables.users.length,
      total_tenants: this.db.tables.tenants.length,
      total_automations: this.db.tables.automations.length,
      health: this.monitor.healthCheck(),
      db_stats: this.db.getStats(),
    };
  }
}

module.exports = { SiyadahAPI };
