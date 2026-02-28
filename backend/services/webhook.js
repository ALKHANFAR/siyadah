/**
 * سيادة — Webhook Management
 * Phase 9.5c: Per-tenant webhook routing
 */
const crypto = require("crypto");
const { signWebhook, verifyWebhookSignature } = require("../middleware/security");

class WebhookManager {
  constructor() { this.webhooks = new Map(); this.logs = []; }

  create(tenantId, flowId) {
    const id = `wh_${crypto.randomBytes(8).toString("hex")}`;
    const secret = crypto.randomBytes(32).toString("hex");
    const url = `/webhooks/${tenantId}/${id}`;
    const wh = { id, tenantId, flowId, url, secret, active: true, created: new Date().toISOString(), calls: 0 };
    this.webhooks.set(id, wh);
    return { id, url, secret };
  }

  get(webhookId) { return this.webhooks.get(webhookId) || null; }

  verify(webhookId, payload, signature) {
    const wh = this.webhooks.get(webhookId);
    if (!wh) return { valid: false, error: "WEBHOOK_NOT_FOUND" };
    if (!wh.active) return { valid: false, error: "WEBHOOK_DISABLED" };
    try {
      const valid = verifyWebhookSignature(payload, signature, wh.secret);
      return { valid, webhookId, tenantId: wh.tenantId, flowId: wh.flowId };
    } catch (e) { return { valid: false, error: "SIGNATURE_MISMATCH" }; }
  }

  route(webhookId, payload) {
    const wh = this.webhooks.get(webhookId);
    if (!wh) return { routed: false, error: "NOT_FOUND" };
    if (!wh.active) return { routed: false, error: "DISABLED" };
    wh.calls++;
    this.logs.push({ webhookId, tenantId: wh.tenantId, flowId: wh.flowId, timestamp: new Date().toISOString() });
    return { routed: true, tenantId: wh.tenantId, flowId: wh.flowId };
  }

  disable(webhookId) { const wh = this.webhooks.get(webhookId); if (wh) { wh.active = false; return true; } return false; }
  delete(webhookId) { return this.webhooks.delete(webhookId); }
  listByTenant(tenantId) { return [...this.webhooks.values()].filter(w => w.tenantId === tenantId); }
  getStats() { return { total: this.webhooks.size, active: [...this.webhooks.values()].filter(w => w.active).length, totalCalls: this.logs.length }; }
}

module.exports = { WebhookManager };
