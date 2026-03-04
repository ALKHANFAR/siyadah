/**
 * سيادة — API Routes
 * Phase 12: Complete API + Real ActivePieces Connection
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
    this.ap = new ActivePiecesClient({ mock: false }); // REAL AP connection
    this.webhooks = new WebhookManager();
    this.monitor = new Monitor();
  }

  // ══════════ Auth ══════════
  register(body) { return this.auth.register(body); }
  login(body) { return this.auth.login(body); }
  logout(token) { return this.auth.logout(token); }
  validateToken(token) { return this.auth.validateToken(token); }

  // ══════════ Onboarding ══════════
  onboard(tenantId, data) {
    var tenant = this.db.getTenant(tenantId);
    if (!tenant) return { error: "TENANT_NOT_FOUND" };
    this.db.updateTenant(tenantId, {
      settings_json: Object.assign({}, tenant.settings_json, data, { onboarding_complete: true, onboarded_at: new Date().toISOString() })
    });
    this.db.logEvent(tenantId, "ONBOARDING_COMPLETE", data);
    return { success: true, message: "تم إعداد الشركة بنجاح!" };
  }

  // ══════════ Chat → Pipeline ══════════
  chat(tenantId, message) {
    var start = Date.now();
    var aiCheck = this.billing.useResource(tenantId, "ai_calls");
    if (!aiCheck.success) return { success: false, error: "LIMIT_REACHED", message: aiCheck.message, message_ar: "وصلت الحد الأقصى — جرّب تحدّث الصفحة" };

    var result = executePipeline(message);
    this.monitor.recordRequest(Date.now() - start, result.success);

    if (!result.success) {
      return { success: false, error: "PIPELINE_FAILED", stage: result.stage_reached, message: result.errors[0]?.message || "لم أفهم طلبك — جرب تصيغه بشكل ثاني" };
    }

    var auto = this.db.createAutomation({
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
      steps: result.flow.steps.map(function(s) { return { piece: s.piece_id, action: s.action_name, role: s.role }; }),
      trigger: { piece: result.flow.trigger.piece_id, type: result.flow.trigger.trigger_name },
      connections_required: result.flow.connections_required,
      ap_format: result.ap_format,
      validation: result.stages.validate.summary,
      message_ar: "تمام! بنيت لك أتمتة \"" + (result.stages.understand.primary_intent?.name_ar) + "\" بـ " + result.flow._metadata.total_steps + " خطوات.",
    };
  }

  // ══════════ Deploy (SYNC — for tests + mock) ══════════
  deploy(tenantId, automationId) {
    var auto = this.db.tables.automations.find(function(a) { return a.id === automationId && a.tenant_id === tenantId; });
    if (!auto) return { error: "NOT_FOUND" };

    var activeCount = this.db.getAutomations(tenantId).filter(function(a) { return a.status === "active"; }).length;
    var check = this.billing.checkLimit(tenantId, "automations");
    if (check.limit !== -1 && activeCount >= check.limit) return { error: "LIMIT_REACHED", message: "وصلت الحد الأقصى للأتمتة. رقّي خطتك!" };

    // Mock AP call (sync)
    var apFlow = this.ap._mockResponse("POST", "/flows", { displayName: auto.name });
    var flowId = apFlow.data.id;

    this.db.updateAutomation(automationId, { status: "active", ap_flow_id: flowId });
    this.db.logEvent(tenantId, "FLOW_DEPLOYED", { automation_id: automationId, ap_flow_id: flowId });
    var wh = this.webhooks.create(tenantId, flowId);

    return { success: true, automation_id: automationId, ap_flow_id: flowId, webhook_url: wh.url, status: "active", message_ar: "الأتمتة شغّالة الحين! 🎉" };
  }

  // ══════════ Deploy to REAL ActivePieces (ASYNC) ══════════
  async deployToAP(tenantId, automationId) {
    var auto = this.db.tables.automations.find(function(a) { return a.id === automationId && a.tenant_id === tenantId; });
    if (!auto) return { error: "NOT_FOUND" };

    var activeCount = this.db.getAutomations(tenantId).filter(function(a) { return a.status === "active"; }).length;
    var check = this.billing.checkLimit(tenantId, "automations");
    if (check.limit !== -1 && activeCount >= check.limit) return { error: "LIMIT_REACHED", message: "وصلت الحد الأقصى للأتمتة. رقّي خطتك!" };

    // REAL AP call
    var apResult = await this.ap.deployFlow({ displayName: "سيادة: " + auto.name });

    if (!apResult.success) {
      this.db.logEvent(tenantId, "DEPLOY_FAILED", { automation_id: automationId, error: apResult.error });
      return {
        success: false,
        error: "AP_DEPLOY_FAILED",
        ap_error: apResult.error,
        ap_status: apResult.status,
        message_ar: "فشل الربط مع ActivePieces: " + (apResult.error || "خطأ غير معروف"),
      };
    }

    var flowId = apResult.flowId;
    this.db.updateAutomation(automationId, { status: "active", ap_flow_id: flowId });
    this.db.logEvent(tenantId, "FLOW_DEPLOYED_AP", { automation_id: automationId, ap_flow_id: flowId });
    var wh = this.webhooks.create(tenantId, flowId);

    return {
      success: true,
      automation_id: automationId,
      ap_flow_id: flowId,
      webhook_url: wh.url,
      status: "active",
      real_ap: true,
      message_ar: "الأتمتة شغّالة في ActivePieces! 🎉 Flow ID: " + flowId,
    };
  }

  // ══════════ AP Status (REAL async) ══════════
  async apHealth() { return this.ap.health(); }
  async apListFlows() { return this.ap.listFlows(); }
  async apListConnections() { return this.ap.listConnections(); }
  async apCheckConnection() { return this.ap.checkConnection(); }

  // ══════════ Operations ══════════
  getOperations(tenantId) {
    var automations = this.db.getAutomations(tenantId);
    var usage = this.db.getUsage(tenantId);
    var sub = this.db.getSubscription(tenantId);
    var connections = this.db.getConnections(tenantId);
    return {
      automations: automations.map(function(a) { return { id: a.id, name: a.name, status: a.status, last_run: a.last_run, errors: a.error_count }; }),
      stats: { total: automations.length, active: automations.filter(function(a) { return a.status === "active"; }).length, draft: automations.filter(function(a) { return a.status === "draft"; }).length },
      usage: usage || { messages: 0, ai_calls: 0, automations: 0 },
      subscription: sub ? { plan: sub.plan, status: sub.status } : null,
      connections: connections.length,
    };
  }

  // ══════════ Settings ══════════
  getSettings(tenantId) {
    var tenant = this.db.getTenant(tenantId);
    var sub = this.db.getSubscription(tenantId);
    if (!tenant) return { error: "NOT_FOUND" };
    return { company: tenant, subscription: sub, connections: this.db.getConnections(tenantId) };
  }

  updateSettings(tenantId, data) {
    var tenant = this.db.updateTenant(tenantId, { settings_json: data });
    if (!tenant) return { error: "NOT_FOUND" };
    this.db.logEvent(tenantId, "SETTINGS_UPDATED", data);
    return { success: true };
  }

  // ══════════ Admin ══════════
  getAdminDashboard() {
    return {
      total_users: this.db.tables.users.length,
      total_tenants: this.db.tables.tenants.length,
      total_automations: this.db.tables.automations.length,
      ap_url: this.ap.baseUrl,
      ap_project: this.ap.projectId,
      ap_mock: this.ap._mock,
      health: this.monitor.healthCheck(),
      db_stats: this.db.getStats(),
    };
  }
}

module.exports = { SiyadahAPI };
