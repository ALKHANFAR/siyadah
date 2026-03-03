/**
 * سيادة — Billing + Usage + Lifecycle
 * Phase 11: Plans, Limits, Lifecycle Emails
 */

const PLANS = {
  free:     { name: "مجاني", price: 0,   automations: 1,  messages: 50,   ai_calls: 50,   users: 1,  whatsapp: false },
  basic:    { name: "أساسي", price: 199,  automations: 5,  messages: 500,  ai_calls: 500,  users: 2,  whatsapp: true },
  advanced: { name: "متقدم", price: 499,  automations: 15, messages: 2000, ai_calls: 2000, users: 5,  whatsapp: true },
  business: { name: "أعمال", price: 999,  automations: -1, messages: 10000,ai_calls: 10000,users: 15, whatsapp: true },
};

class BillingService {
  constructor(db) { this.db = db; this.invoices = []; this.lifecycle_emails = []; }

  // ══════════ Plans ══════════
  getPlans() { return PLANS; }
  getPlan(planId) { return PLANS[planId] || null; }

  // ══════════ Usage Check ══════════
  checkLimit(tenantId, field) {
    const sub = this.db.getSubscription(tenantId);
    if (!sub) return { allowed: false, error: "NO_SUBSCRIPTION" };
    const plan = PLANS[sub.plan];
    if (!plan) return { allowed: false, error: "INVALID_PLAN" };
    const limit = plan[field];
    if (limit === -1) return { allowed: true, remaining: Infinity, usage: 0, limit: -1 }; // unlimited
    const usage = this.db.getUsage(tenantId);
    const current = usage ? (usage[field] || 0) : 0;
    const remaining = limit - current;
    const atWarning = remaining <= limit * 0.2 && remaining > 0;
    return { allowed: remaining > 0, remaining: Math.max(0, remaining), usage: current, limit, atWarning, plan: sub.plan };
  }

  useResource(tenantId, field, amount = 1) {
    const check = this.checkLimit(tenantId, field);
    if (!check.allowed) return { success: false, error: "LIMIT_REACHED", message: `وصلت الحد الأقصى لـ ${field}. رقّي خطتك!`, ...check };
    this.db.incrementUsage(tenantId, field, amount);
    if (check.atWarning) this._sendLifecycleEmail(tenantId, "USAGE_WARNING", { field, usage: check.usage + amount, limit: check.limit });
    return { success: true, remaining: check.remaining - amount };
  }

  // ══════════ Upgrade/Downgrade ══════════
  upgrade(tenantId, newPlan) {
    if (!PLANS[newPlan]) return { error: "INVALID_PLAN" };
    const sub = this.db.getSubscription(tenantId);
    if (!sub) return { error: "NO_SUBSCRIPTION" };
    const oldPlan = sub.plan;
    if (oldPlan === newPlan) return { error: "SAME_PLAN" };
    this.db.updateSubscription(tenantId, { plan: newPlan, status: "active" });
    this._createInvoice(tenantId, newPlan, "upgrade");
    this._sendLifecycleEmail(tenantId, "PLAN_UPGRADED", { from: oldPlan, to: newPlan });
    this.db.logEvent(tenantId, "PLAN_UPGRADE", { from: oldPlan, to: newPlan });
    return { success: true, old_plan: oldPlan, new_plan: newPlan, price: PLANS[newPlan].price };
  }

  downgrade(tenantId, newPlan) {
    if (!PLANS[newPlan]) return { error: "INVALID_PLAN" };
    const sub = this.db.getSubscription(tenantId);
    if (!sub) return { error: "NO_SUBSCRIPTION" };
    this.db.updateSubscription(tenantId, { plan: newPlan });
    this._sendLifecycleEmail(tenantId, "PLAN_DOWNGRADED", { from: sub.plan, to: newPlan });
    return { success: true, new_plan: newPlan };
  }

  // ══════════ Cancel / Freeze ══════════
  cancel(tenantId) {
    const sub = this.db.getSubscription(tenantId);
    if (!sub) return { error: "NO_SUBSCRIPTION" };
    this.db.updateSubscription(tenantId, { status: "frozen", frozen_at: new Date().toISOString() });
    this._sendLifecycleEmail(tenantId, "SUBSCRIPTION_CANCELLED", {});
    this.db.logEvent(tenantId, "CANCELLED", {});
    return { success: true, status: "frozen", message: "الاشتراك مجمّد لمدة 30 يوم — بياناتك محفوظة" };
  }

  reactivate(tenantId) {
    const sub = this.db.getSubscription(tenantId);
    if (!sub) return { error: "NO_SUBSCRIPTION" };
    this.db.updateSubscription(tenantId, { status: "active", frozen_at: null });
    return { success: true, status: "active" };
  }

  // ══════════ Monthly Reset ══════════
  monthlyReset(tenantId) {
    this.db.initUsage(tenantId);
    const sub = this.db.getSubscription(tenantId);
    if (sub && sub.status === "active" && sub.plan !== "free") this._createInvoice(tenantId, sub.plan, "renewal");
    this._sendLifecycleEmail(tenantId, "MONTHLY_RESET", { plan: sub?.plan });
    return { success: true };
  }

  // ══════════ Trial ══════════
  checkTrial(tenantId) {
    const sub = this.db.getSubscription(tenantId);
    if (!sub || sub.status !== "trialing") return { inTrial: false };
    const ends = new Date(sub.trial_ends);
    const daysLeft = Math.max(0, Math.ceil((ends - Date.now()) / 86400000));
    if (daysLeft <= 0) { this.db.updateSubscription(tenantId, { status: "expired" }); this._sendLifecycleEmail(tenantId, "TRIAL_EXPIRED", {}); return { inTrial: false, expired: true }; }
    if (daysLeft <= 3) this._sendLifecycleEmail(tenantId, "TRIAL_ENDING", { daysLeft });
    return { inTrial: true, daysLeft, trial_ends: sub.trial_ends };
  }

  // ══════════ Internal ══════════
  _createInvoice(tenantId, plan, type) {
    const inv = { id: `inv_${Date.now().toString(36)}`, tenantId, plan, amount: PLANS[plan]?.price || 0, type, status: "pending", created: new Date().toISOString() };
    this.invoices.push(inv);
    return inv;
  }

  _sendLifecycleEmail(tenantId, type, data) {
    this.lifecycle_emails.push({ tenantId, type, data, sent_at: new Date().toISOString() });
  }

  getInvoices(tenantId) { return this.invoices.filter(i => i.tenantId === tenantId); }
  getLifecycleEmails(tenantId) { return this.lifecycle_emails.filter(e => e.tenantId === tenantId); }
}

module.exports = { BillingService, PLANS };
