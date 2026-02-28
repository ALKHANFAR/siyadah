/**
 * سيادة — ActivePieces API Wrapper
 * Phase 9.5a: كل عمليات AP في ملف واحد
 */

class ActivePiecesClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.AP_BASE_URL || "http://localhost:8080";
    this.apiKey = config.apiKey || process.env.AP_API_KEY || "";
    this.timeout = config.timeout || 10000;
    this._mock = config.mock !== false; // mock by default until real AP
  }

  _headers() {
    return { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` };
  }

  // ══════════ Projects (Tenants) ══════════

  createProject(name, displayName) {
    if (this._mock) return { id: `proj_${Date.now().toString(36)}`, name, displayName, created: new Date().toISOString() };
    const res = this._request("POST", "/v1/projects", { name, displayName });
    return res;
  }

  getProject(projectId) {
    if (this._mock) return { id: projectId, name: "mock", displayName: "Mock Project", status: "active" };
    return this._request("GET", `/v1/projects/${projectId}`);
  }

  deleteProject(projectId) {
    if (this._mock) return { deleted: true, id: projectId };
    return this._request("DELETE", `/v1/projects/${projectId}`);
  }

  // ══════════ Flows ══════════

  importFlow(projectId, flowData) {
    if (this._mock) return { id: `flow_${Date.now().toString(36)}`, projectId, displayName: flowData.displayName || "Unnamed", status: "DISABLED", version: 1, created: new Date().toISOString() };
    return this._request("POST", `/v1/flows`, { projectId, ...flowData });
  }

  getFlow(flowId) {
    if (this._mock) return { id: flowId, status: "ENABLED", lastRun: null, version: 1 };
    return this._request("GET", `/v1/flows/${flowId}`);
  }

  enableFlow(flowId) {
    if (this._mock) return { id: flowId, status: "ENABLED" };
    return this._request("POST", `/v1/flows/${flowId}/enable`);
  }

  disableFlow(flowId) {
    if (this._mock) return { id: flowId, status: "DISABLED" };
    return this._request("POST", `/v1/flows/${flowId}/disable`);
  }

  deleteFlow(flowId) {
    if (this._mock) return { deleted: true, id: flowId };
    return this._request("DELETE", `/v1/flows/${flowId}`);
  }

  getFlowStatus(flowId) {
    if (this._mock) return { id: flowId, status: "ENABLED", runs: 0, lastRun: null, errors: 0 };
    return this._request("GET", `/v1/flows/${flowId}/status`);
  }

  listFlows(projectId) {
    if (this._mock) return { data: [], total: 0, projectId };
    return this._request("GET", `/v1/flows?projectId=${projectId}`);
  }

  // ══════════ Connections (OAuth) ══════════

  createConnection(projectId, pieceName, config) {
    if (this._mock) return { id: `conn_${Date.now().toString(36)}`, projectId, pieceName, status: "ACTIVE", created: new Date().toISOString() };
    return this._request("POST", `/v1/connections`, { projectId, pieceName, ...config });
  }

  getConnection(connectionId) {
    if (this._mock) return { id: connectionId, status: "ACTIVE", expiresAt: null };
    return this._request("GET", `/v1/connections/${connectionId}`);
  }

  deleteConnection(connectionId) {
    if (this._mock) return { deleted: true, id: connectionId };
    return this._request("DELETE", `/v1/connections/${connectionId}`);
  }

  // ══════════ Flow Runs ══════════

  getFlowRuns(flowId, limit = 10) {
    if (this._mock) return { data: [], total: 0, flowId };
    return this._request("GET", `/v1/flow-runs?flowId=${flowId}&limit=${limit}`);
  }

  testFlow(flowId, payload = {}) {
    if (this._mock) return { runId: `run_${Date.now().toString(36)}`, flowId, status: "SUCCEEDED", duration_ms: 1200, steps: [] };
    return this._request("POST", `/v1/flows/${flowId}/test`, payload);
  }

  // ══════════ Health ══════════

  health() {
    if (this._mock) return { status: "ok", version: "0.36.1", uptime: 99999 };
    return this._request("GET", `/v1/health`);
  }

  // ══════════ Internal ══════════

  _request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const opts = { method, headers: this._headers(), timeout: this.timeout };
    if (body) opts.body = JSON.stringify(body);

    // In real implementation, use fetch/axios
    // For now this is the interface contract
    throw new Error(`Real HTTP not implemented — use mock mode. URL: ${url}`);
  }
}

module.exports = { ActivePiecesClient };
