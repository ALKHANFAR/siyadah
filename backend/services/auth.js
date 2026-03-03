/**
 * سيادة — Auth + Multi-Tenancy
 * Phase 10: Registration, Login, Tenant Isolation
 */
const { hashPassword, verifyPassword, generateToken, verifyToken } = require("../middleware/security");

class AuthService {
  constructor(db) { this.db = db; }

  register({ email, password, name, company_name, industry }) {
    if (!email || !password || !name) return { error: "MISSING_FIELDS", message: "الإيميل والباسوورد والاسم مطلوبة" };
    if (password.length < 6) return { error: "WEAK_PASSWORD", message: "كلمة المرور لازم 6 حروف على الأقل" };
    const existing = this.db.getUserByEmail(email);
    if (existing) return { error: "EMAIL_EXISTS", message: "الإيميل مستخدم" };

    const password_hash = hashPassword(password);
    const user = this.db.createUser({ email, password_hash, name, role: "owner" });
    const tenant = this.db.createTenant({ owner_id: user.id, company_name: company_name || name, industry: industry || "general" });
    const sub = this.db.createSubscription({ tenant_id: tenant.id, plan: "free", trial_days: 14 });
    this.db.initUsage(tenant.id);
    this.db.logEvent(tenant.id, "REGISTERED", { email });

    const token = generateToken({ userId: user.id, tenantId: tenant.id, role: user.role });
    return { success: true, user: { id: user.id, email: user.email, name: user.name }, tenant: { id: tenant.id, company_name: tenant.company_name }, token, subscription: { plan: sub.plan, status: sub.status, trial_ends: sub.trial_ends } };
  }

  login({ email, password }) {
    if (!email || !password) return { error: "MISSING_FIELDS" };
    const user = this.db.getUserByEmail(email);
    if (!user) return { error: "INVALID_CREDENTIALS", message: "الإيميل أو كلمة المرور غلط" };
    if (!verifyPassword(password, user.password_hash)) return { error: "INVALID_CREDENTIALS", message: "الإيميل أو كلمة المرور غلط" };

    const tenant = this.db.getTenantByOwner(user.id);
    const token = generateToken({ userId: user.id, tenantId: tenant?.id, role: user.role });
    const session = this.db.createSession({ user_id: user.id, token, refresh_token: generateToken({ userId: user.id, type: "refresh" }), ip_address: "127.0.0.1" });
    this.db.logEvent(tenant?.id, "LOGIN", { email });
    return { success: true, user: { id: user.id, email: user.email, name: user.name }, tenant: tenant ? { id: tenant.id, company_name: tenant.company_name } : null, token, session_id: session.id };
  }

  logout(token) {
    const deleted = this.db.deleteSession(token);
    return { success: deleted };
  }

  validateToken(token) {
    const result = verifyToken(token);
    if (!result.valid) return { valid: false, error: result.error };
    const user = this.db.getUserById(result.payload.userId);
    if (!user) return { valid: false, error: "USER_NOT_FOUND" };
    return { valid: true, userId: user.id, tenantId: result.payload.tenantId, role: result.payload.role };
  }

  getTenantData(tenantId, requestingTenantId) {
    if (tenantId !== requestingTenantId) return { error: "ACCESS_DENIED", message: "ما تقدر توصل لبيانات عميل ثاني" };
    const tenant = this.db.getTenant(tenantId);
    if (!tenant) return { error: "NOT_FOUND" };
    return { success: true, tenant, automations: this.db.getAutomations(tenantId), usage: this.db.getUsage(tenantId), connections: this.db.getConnections(tenantId) };
  }
}

module.exports = { AuthService };
