/**
 * سيادة — Monitoring & Health
 * Phase 9.5e: Uptime, errors, performance
 */
class Monitor {
  constructor() {
    this.metrics = { requests: 0, errors: 0, avg_response_ms: 0, uptime_start: Date.now(), checks: [] };
    this.alerts = [];
    this.errorLog = [];
  }

  recordRequest(duration_ms, success = true) {
    this.metrics.requests++;
    if (!success) this.metrics.errors++;
    this.metrics.avg_response_ms = ((this.metrics.avg_response_ms * (this.metrics.requests - 1)) + duration_ms) / this.metrics.requests;
  }

  recordError(tenantId, error) {
    this.errorLog.push({ tenantId, error: error.message || error, timestamp: new Date().toISOString() });
    if (this.errorLog.filter(e => Date.now() - new Date(e.timestamp).getTime() < 300000).length >= 5) {
      this.alerts.push({ level: "critical", message: "5+ errors in 5 minutes", timestamp: new Date().toISOString() });
    }
  }

  healthCheck() {
    const uptime_ms = Date.now() - this.metrics.uptime_start;
    const error_rate = this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0;
    const status = error_rate > 0.1 ? "degraded" : error_rate > 0.5 ? "critical" : "healthy";
    const check = { status, uptime_ms, uptime_human: `${Math.floor(uptime_ms / 3600000)}h ${Math.floor((uptime_ms % 3600000) / 60000)}m`,
      requests: this.metrics.requests, errors: this.metrics.errors, error_rate: Math.round(error_rate * 10000) / 100,
      avg_response_ms: Math.round(this.metrics.avg_response_ms), alerts: this.alerts.length, timestamp: new Date().toISOString() };
    this.metrics.checks.push(check);
    return check;
  }

  getAlerts() { return this.alerts; }
  getErrorLog(limit = 50) { return this.errorLog.slice(-limit); }
  getMetrics() { return { ...this.metrics, checks: undefined }; }
  reset() { this.metrics = { requests: 0, errors: 0, avg_response_ms: 0, uptime_start: Date.now(), checks: [] }; this.alerts = []; this.errorLog = []; }
}

module.exports = { Monitor };
