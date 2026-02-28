/**
 * سيادة — Database Schema
 * Phase 10 + 11.5a: Complete PostgreSQL schema (in-memory for testing)
 */

class Database {
  constructor() {
    this.tables = {
      users: [],
      tenants: [],
      subscriptions: [],
      usage: [],
      automations: [],
      connections: [],
      audit_log: [],
      errors: [],
      sessions: [],
      lifecycle: [],
    };
    this._autoId = {};
  }

  _nextId(table) { this._autoId[table] = (this._autoId[table] || 0) + 1; return `${table}_${this._autoId[table]}`; }

  // ══════════ Users ══════════
  createUser({ email, password_hash, name, role = "owner" }) {
    if (this.tables.users.find(u => u.email === email)) return { error: "EMAIL_EXISTS" };
    const user = { id: this._nextId("users"), email, password_hash, name, role, verified: false, created_at: new Date().toISOString() };
    this.tables.users.push(user);
    return user;
  }
  getUserByEmail(email) { return this.tables.users.find(u => u.email === email) || null; }
  getUserById(id) { return this.tables.users.find(u => u.id === id) || null; }
  verifyUser(id) { const u = this.getUserById(id); if (u) u.verified = true; return u; }

  // ══════════ Tenants ══════════
  createTenant({ owner_id, company_name, industry, region = "SA" }) {
    const tenant = { id: this._nextId("tenants"), owner_id, company_name, industry, region, ap_project_id: null, settings_json: {}, status: "active", created_at: new Date().toISOString() };
    this.tables.tenants.push(tenant);
    return tenant;
  }
  getTenant(id) { return this.tables.tenants.find(t => t.id === id) || null; }
  getTenantByOwner(owner_id) { return this.tables.tenants.find(t => t.owner_id === owner_id) || null; }
  updateTenant(id, data) { const t = this.getTenant(id); if (t) Object.assign(t, data); return t; }

  // ══════════ Subscriptions ══════════
  createSubscription({ tenant_id, plan = "free", trial_days = 14 }) {
    const now = new Date();
    const trial_ends = new Date(now.getTime() + trial_days * 86400000);
    const sub = { id: this._nextId("subs"), tenant_id, plan, status: trial_days > 0 ? "trialing" : "active", trial_ends: trial_ends.toISOString(), current_period_start: now.toISOString(), current_period_end: trial_ends.toISOString(), stripe_id: null, created_at: now.toISOString() };
    this.tables.subscriptions.push(sub);
    return sub;
  }
  getSubscription(tenant_id) { return this.tables.subscriptions.find(s => s.tenant_id === tenant_id) || null; }
  updateSubscription(tenant_id, data) { const s = this.getSubscription(tenant_id); if (s) Object.assign(s, data); return s; }

  // ══════════ Usage ══════════
  initUsage(tenant_id) {
    const month = new Date().toISOString().slice(0, 7);
    const existing = this.tables.usage.find(u => u.tenant_id === tenant_id && u.month === month);
    if (existing) { existing.automations = 0; existing.messages = 0; existing.ai_calls = 0; existing.sheet_writes = 0; return existing; }
    const u = { id: this._nextId("usage"), tenant_id, month, automations: 0, messages: 0, ai_calls: 0, sheet_writes: 0 };
    this.tables.usage.push(u);
    return u;
  }
  getUsage(tenant_id) {
    const month = new Date().toISOString().slice(0, 7);
    return this.tables.usage.find(u => u.tenant_id === tenant_id && u.month === month) || null;
  }
  incrementUsage(tenant_id, field, amount = 1) {
    let u = this.getUsage(tenant_id);
    if (!u) u = this.initUsage(tenant_id);
    if (u[field] !== undefined) u[field] += amount;
    return u;
  }

  // ══════════ Automations ══════════
  createAutomation({ tenant_id, name, flow_template, ap_flow_id = null }) {
    const a = { id: this._nextId("auto"), tenant_id, name, flow_template, ap_flow_id, status: "draft", last_run: null, error_count: 0, created_at: new Date().toISOString() };
    this.tables.automations.push(a);
    return a;
  }
  getAutomations(tenant_id) { return this.tables.automations.filter(a => a.tenant_id === tenant_id); }
  updateAutomation(id, data) { const a = this.tables.automations.find(x => x.id === id); if (a) Object.assign(a, data); return a; }

  // ══════════ Connections ══════════
  createConnection({ tenant_id, tool_id, auth_type, tokens_encrypted = null }) {
    const c = { id: this._nextId("conn"), tenant_id, tool_id, auth_type, tokens_encrypted, status: "active", expires_at: null, created_at: new Date().toISOString() };
    this.tables.connections.push(c);
    return c;
  }
  getConnections(tenant_id) { return this.tables.connections.filter(c => c.tenant_id === tenant_id); }

  // ══════════ Audit Log ══════════
  logEvent(tenant_id, event_type, details = {}) {
    const e = { id: this._nextId("audit"), tenant_id, event_type, details_json: details, created_at: new Date().toISOString() };
    this.tables.audit_log.push(e);
    return e;
  }
  getAuditLog(tenant_id, limit = 50) { return this.tables.audit_log.filter(e => e.tenant_id === tenant_id).slice(-limit); }

  // ══════════ Sessions ══════════
  createSession({ user_id, token, refresh_token, ip_address = null }) {
    const s = { id: this._nextId("sess"), user_id, token, refresh_token, expires_at: new Date(Date.now() + 86400000).toISOString(), ip_address, created_at: new Date().toISOString() };
    this.tables.sessions.push(s);
    return s;
  }
  getSession(token) { return this.tables.sessions.find(s => s.token === token) || null; }
  deleteSession(token) { const i = this.tables.sessions.findIndex(s => s.token === token); if (i >= 0) { this.tables.sessions.splice(i, 1); return true; } return false; }

  // ══════════ Stats ══════════
  getStats() { return Object.fromEntries(Object.entries(this.tables).map(([k, v]) => [k, v.length])); }
}

module.exports = { Database };
