/**
 * سيادة — ActivePieces Client (v2 — مثبت بالتجربة)
 * 
 * الطريقة المثبتة:
 *   CREATE → UPDATE_TRIGGER(catch_webhook) → ADD_ACTION(s) → LOCK_AND_PUBLISH → POST /webhooks/{flowId}
 * 
 * الأخطاء المصححة:
 *   ❌ catch_hook       → ✅ catch_webhook
 *   ❌ CHANGE_STATUS    → ✅ LOCK_AND_PUBLISH
 *   ❌ /webhooks/{ext}  → ✅ /webhooks/{flowId}
 *   ❌ to               → ✅ receiver (Gmail)
 *   ❌ body_text        → ✅ body + body_type + draft (Gmail)
 */

const https = require("https");
const http = require("http");

// ═══════════════════════════════════════
// Prop Mapping: أسماء Props الصحيحة من Source Code
// ═══════════════════════════════════════

const PROVEN_PROPS = {
  gmail: {
    send_email: {
      required: ["receiver", "subject", "body_type", "body", "draft"],
      defaults: { body_type: "plain_text", draft: false },
      rename: { to: "receiver", body_text: "body", recipients: "receiver" },
      auth: "gmailAuth",
    },
  },
  "google-sheets": {
    insert_row: {
      required: ["spreadsheetId", "sheetId", "first_row_headers", "values"],
      defaults: { includeTeamDrives: false, first_row_headers: true },
      rename: { spreadsheet_id: "spreadsheetId", sheet_id: "sheetId" },
      auth: "googleSheetsAuth",
    },
  },
  whatsapp: {
    sendMessage: {
      required: ["phone_number_id", "to", "text"],
      defaults: {},
      rename: { message: "text", phone: "to", number: "to" },
      auth: "whatsappAuth",
    },
  },
  openai: {
    ask_chatgpt: {
      required: ["model", "prompt"],
      defaults: { model: "gpt-4o-mini", temperature: 0.7 },
      rename: { message: "prompt", text: "prompt", question: "prompt" },
      auth: "openaiAuth",
    },
  },
  slack: {
    send_channel_message: {
      required: ["channel", "text"],
      defaults: {},
      rename: { message: "text", channelName: "channel" },
      auth: "slackAuth",
    },
  },
};

// ═══════════════════════════════════════
// Trigger Names الصحيحة
// ═══════════════════════════════════════

const PROVEN_TRIGGERS = {
  webhook: { name: "catch_webhook", version: "~0.1.29" },
  schedule: {
    every_x_minutes: { name: "every_x_minutes", version: "~0.1.17" },
    every_hour: { name: "every_hour", version: "~0.1.17" },
    every_day: { name: "every_day", version: "~0.1.17" },
    every_week: { name: "every_week", version: "~0.1.17" },
  },
};

// ═══════════════════════════════════════
// Piece Versions المثبتة
// ═══════════════════════════════════════

const PIECE_VERSIONS = {
  "webhook": "~0.1.29",
  "schedule": "~0.1.17",
  "google-sheets": "~0.14.6",
  "gmail": "~0.11.4",
  "openai": "~0.7.5",
  "whatsapp": "~0.2.3",
  "slack": "~0.12.3",
  "telegram-bot": "~0.5.5",
  "google-calendar": "~0.8.4",
  "http": "~0.4.3",
  "code": "~0.4.6",
  "delay": "~0.1.8",
  "store": "~0.3.7",
  "branch": "~0.4.3",
  "loop-on-items": "~0.2.4",
};

class ActivePiecesClient {
  constructor(config) {
    config = config || {};
    this.baseUrl = (config.baseUrl || process.env.AP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
    this.email = config.email || process.env.AP_EMAIL || "";
    this.password = config.password || process.env.AP_PASSWORD || "";
    this.projectId = config.projectId || process.env.AP_PROJECT_ID || "";
    this.timeout = config.timeout || 30000;
    this._mock = config.mock === true;
    this._token = null;
    this._tokenExpiry = 0;
    this._connections = null;  // Cache
    this._connectionsExpiry = 0;

    // Support direct API key
    var apiKey = config.apiKey || process.env.AP_API_KEY || "";
    if (apiKey && apiKey.startsWith("eyJ")) {
      this._token = apiKey;
      this._tokenExpiry = Date.now() + 6 * 24 * 3600000;
    }

    // Override async methods with sync versions in mock mode
    if (this._mock) {
      var self = this;
      this.disableFlow = function(flowId) { return { id: flowId, status: "DISABLED" }; };
      this.deleteFlow = function(flowId) { return { deleted: true, id: flowId }; };
      this.listFlows = function(projectId) { return { data: [], total: 0 }; };
      this.health = function() { return { status: "ok", healthy: true }; };
      this.getFlow = function(flowId) { return { id: flowId, status: "ENABLED", displayName: "Mock" }; };
      this.sendWebhook = function(flowId, payload) { return { success: true, status: 200 }; };
      this.listFlowRuns = function(flowId) { return { data: [], total: 0 }; };
      this.listConnections = function() { return { success: true, data: [] }; };
    }
  }

  // ══════════ HTTP Layer ══════════

  _rawRequest(method, path, body, headers) {
    var self = this;
    var url = this.baseUrl + path;
    var urlObj;
    try { urlObj = new URL(url); } catch (e) {
      return Promise.resolve({ success: false, error: "INVALID_URL: " + url });
    }
    var isHttps = urlObj.protocol === "https:";
    var lib = isHttps ? https : http;

    return new Promise(function (resolve) {
      var opts = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers || self._headers(),
        timeout: self.timeout,
      };
      var req = lib.request(opts, function (res) {
        var data = "";
        res.on("data", function (c) { data += c; });
        res.on("end", function () {
          var json;
          try { json = JSON.parse(data); } catch (e) { json = data; }
          var ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ success: ok, status: res.statusCode, data: json, error: ok ? null : (json.message || json.error || data) });
        });
      });
      req.on("error", function (e) { resolve({ success: false, error: e.message, network: true }); });
      req.on("timeout", function () { req.destroy(); resolve({ success: false, error: "TIMEOUT", network: true }); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  _headers() {
    var h = { "Content-Type": "application/json" };
    if (this._token) h["Authorization"] = "Bearer " + this._token;
    return h;
  }

  // ══════════ Auth ══════════

  async _ensureToken() {
    if (this._mock) return true;
    if (this._token && Date.now() < this._tokenExpiry) return true;

    var r = await this._rawRequest("POST", "/api/v1/authentication/sign-in",
      { email: this.email, password: this.password },
      { "Content-Type": "application/json" });

    if (r.success && r.data && r.data.token) {
      this._token = r.data.token;
      this._tokenExpiry = Date.now() + 6 * 3600000;
      if (r.data.projectId) this.projectId = r.data.projectId;
      return true;
    }
    this._lastLoginError = r.error || "Unknown";
    return false;
  }

  async _request(method, path, body) {
    if (this._mock) return this._mockResponse(method, path, body);
    if (!(await this._ensureToken())) {
      return { success: false, error: "AP_LOGIN_FAILED: " + (this._lastLoginError || "") };
    }
    var r = await this._rawRequest(method, path, body);
    if (r.status === 401) {
      this._token = null;
      this._tokenExpiry = 0;
      if (await this._ensureToken()) r = await this._rawRequest(method, path, body);
    }
    return r;
  }

  // ══════════ Core: Proven Pipeline ══════════

  /**
   * إنشاء Flow جديد
   */
  async createFlow(displayName) {
    return this._request("POST", "/api/v1/flows", {
      projectId: this.projectId,
      displayName: displayName,
    });
  }

  /**
   * تحديث Trigger — يستخدم catch_webhook (الاسم الصحيح)
   */
  async updateTrigger(flowId, triggerConfig) {
    return this._request("POST", "/api/v1/flows/" + flowId, {
      type: "UPDATE_TRIGGER",
      request: triggerConfig,
    });
  }

  /**
   * إضافة Action
   */
  async addAction(flowId, parentStep, action) {
    return this._request("POST", "/api/v1/flows/" + flowId, {
      type: "ADD_ACTION",
      request: {
        parentStep: parentStep,
        stepLocationRelativeToParent: "AFTER",
        action: action,
      },
    });
  }

  /**
   * النشر والتفعيل — LOCK_AND_PUBLISH (مو CHANGE_STATUS!)
   * AP يفعّل تلقائي بسبب ENABLE_FLOW_ON_PUBLISH=true
   */
  async publishFlow(flowId) {
    var r = await this._request("POST", "/api/v1/flows/" + flowId, {
      type: "LOCK_AND_PUBLISH",
      request: {},
    });
    if (!r.success) return r;

    // انتظر التفعيل (max 20 sec)
    for (var i = 0; i < 7; i++) {
      await this._sleep(3000);
      var check = await this._request("GET", "/api/v1/flows/" + flowId);
      if (check.success && check.data) {
        if (check.data.status === "ENABLED" && check.data.operationStatus === "NONE") {
          return { success: true, data: check.data, status: check.status };
        }
      }
    }

    // Return whatever we have
    var final = await this._request("GET", "/api/v1/flows/" + flowId);
    return {
      success: final.data && final.data.status === "ENABLED",
      data: final.data,
      status: final.status,
      warning: final.data && final.data.status !== "ENABLED" ? "ENABLE_TIMEOUT" : null,
    };
  }

  /**
   * إيقاف Flow
   */
  async disableFlow(flowId) {
    var r = await this._request("POST", "/api/v1/flows/" + flowId, {
      type: "CHANGE_STATUS",
      request: { status: "DISABLED" },
    });
    await this._sleep(1000);
    return r;
  }

  /**
   * إرسال بيانات Webhook — يستخدم flowId (مو externalId!)
   */
  async sendWebhook(flowId, payload) {
    return this._rawRequest("POST", "/api/v1/webhooks/" + flowId, payload, {
      "Content-Type": "application/json",
    });
  }

  // ══════════ Read Operations ══════════

  async getFlow(flowId) {
    return this._request("GET", "/api/v1/flows/" + flowId);
  }

  async listFlows() {
    return this._request("GET", "/api/v1/flows?projectId=" + this.projectId);
  }

  async deleteFlow(flowId) {
    return this._request("DELETE", "/api/v1/flows/" + flowId);
  }

  async listFlowRuns(flowId, limit) {
    var q = "projectId=" + this.projectId + "&limit=" + (limit || 10);
    if (flowId) q += "&flowId=" + flowId;
    return this._request("GET", "/api/v1/flow-runs?" + q);
  }

  async getFlowRun(runId) {
    return this._request("GET", "/api/v1/flow-runs/" + runId);
  }

  // ══════════ Connections ══════════

  async listConnections(forceRefresh) {
    if (!forceRefresh && this._connections && Date.now() < this._connectionsExpiry) {
      return { success: true, data: this._connections };
    }
    var r = await this._request("GET", "/api/v1/app-connections?projectId=" + this.projectId);
    if (r.success) {
      this._connections = r.data;
      this._connectionsExpiry = Date.now() + 5 * 60000; // 5 min cache
    }
    return r;
  }

  /**
   * يلقى connection لـ piece معين
   */
  async findConnection(pieceName) {
    var r = await this.listConnections();
    if (!r.success) return null;
    var list = r.data.data || r.data || [];
    var fullName = pieceName.startsWith("@") ? pieceName : "@activepieces/piece-" + pieceName;
    var conn = list.find(function (c) { return c.pieceName === fullName && c.status === "ACTIVE"; });
    return conn || null;
  }

  // ══════════ Pieces ══════════

  async getPieceMetadata(pieceName) {
    var fullName = pieceName.startsWith("@") ? pieceName : "@activepieces/piece-" + pieceName;
    return this._request("GET", "/api/v1/pieces/" + encodeURIComponent(fullName));
  }

  // ══════════ Health ══════════

  async health() {
    var h = await this._rawRequest("GET", "/api/v1/health", null, { "Content-Type": "application/json" });
    var f = await this._rawRequest("GET", "/api/v1/flags", null, { "Content-Type": "application/json" });
    return {
      success: h.success,
      healthy: h.success && h.data && h.data.status === "Healthy",
      version: f.success ? f.data.CURRENT_VERSION : null,
      edition: f.success ? f.data.EDITION : null,
      enableOnPublish: f.success ? f.data.ENABLE_FLOW_ON_PUBLISH : null,
    };
  }

  async checkConnection() {
    if (!(await this._ensureToken())) {
      return { connected: false, error: this._lastLoginError };
    }
    var h = await this.health();
    return {
      connected: true,
      projectId: this.projectId,
      healthy: h.healthy,
      version: h.version,
    };
  }

  // ══════════ Full Deploy Pipeline (مثبت) ══════════

  /**
   * الـ Pipeline الكامل المثبت:
   * CREATE → TRIGGER → ACTIONS → PUBLISH → verify ENABLED
   *
   * @param {Object} flowConfig - { displayName, trigger, actions[] }
   * @returns {Object} { success, flowId, webhookUrl, ... }
   */
  async deployFullFlow(flowConfig) {
    var self = this;
    var stages = [];

    try {
      // Stage 1: Create
      var create = await this.createFlow(flowConfig.displayName || "سيادة_" + Date.now());
      if (!create.success) return { success: false, stage: "create", error: create.error, stages: stages };
      var flowId = create.data.id;
      stages.push({ stage: "create", flowId: flowId });

      // Stage 2: Trigger
      var trigConfig = flowConfig.trigger || this._buildWebhookTrigger(flowConfig.sampleData);
      var trig = await this.updateTrigger(flowId, trigConfig);
      var trigValid = trig.data && trig.data.version && trig.data.version.trigger && trig.data.version.trigger.valid;
      stages.push({ stage: "trigger", valid: trigValid });
      if (!trigValid) {
        await this.deleteFlow(flowId);
        return { success: false, stage: "trigger", error: "trigger.valid=false", stages: stages };
      }

      // Stage 3: Actions
      var parentStep = "trigger";
      var actions = flowConfig.actions || [];
      for (var i = 0; i < actions.length; i++) {
        var action = actions[i];
        var addResult = await this.addAction(flowId, parentStep, action);
        stages.push({ stage: "action_" + (i + 1), name: action.name, status: addResult.status });
        parentStep = action.name;
      }

      // Stage 4: Publish (LOCK_AND_PUBLISH)
      var pub = await this.publishFlow(flowId);
      stages.push({ stage: "publish", enabled: pub.success, status: pub.data ? pub.data.status : null });

      if (!pub.success) {
        return { success: false, stage: "publish", flowId: flowId, error: pub.warning || "ENABLE_FAILED", stages: stages };
      }

      // Success!
      return {
        success: true,
        flowId: flowId,
        webhookUrl: this.baseUrl + "/api/v1/webhooks/" + flowId,
        status: "ENABLED",
        publishedVersionId: pub.data.publishedVersionId,
        stages: stages,
        message_ar: "الأتمتة شغّالة! 🎉",
      };

    } catch (err) {
      return { success: false, stage: "error", error: err.message, stages: stages };
    }
  }

  // ══════════ Builder Helpers ══════════

  /**
   * يبني webhook trigger بالطريقة الصحيحة
   */
  _buildWebhookTrigger(sampleData) {
    return {
      name: "trigger",
      valid: true,
      displayName: "Catch Webhook",
      type: "PIECE_TRIGGER",
      settings: {
        pieceName: "@activepieces/piece-webhook",
        pieceVersion: PIECE_VERSIONS["webhook"],
        triggerName: "catch_webhook",
        input: { authType: "none" },
        sampleData: sampleData || { body: {} },
        propertySettings: { authType: { type: "MANUAL" } },
        inputUiInfo: { currentSelectedData: "none" },
      },
    };
  }

  /**
   * يبني schedule trigger
   */
  _buildScheduleTrigger(type, value) {
    var triggerName = type || "every_day";
    var input = {};
    if (triggerName === "every_x_minutes") input.minutes = value || 5;
    if (triggerName === "every_hour") input.hour_of_the_day = value || 8;
    if (triggerName === "every_day") { input.hour_of_the_day = value || 8; input.day_of_the_week = "SUNDAY"; }
    if (triggerName === "cron_expression") input.cron_expression = value || "0 8 * * 0";

    return {
      name: "trigger",
      valid: true,
      displayName: triggerName.replace(/_/g, " "),
      type: "PIECE_TRIGGER",
      settings: {
        pieceName: "@activepieces/piece-schedule",
        pieceVersion: PIECE_VERSIONS["schedule"],
        triggerName: triggerName,
        input: input,
        sampleData: {},
        propertySettings: {},
        inputUiInfo: {},
      },
    };
  }

  /**
   * يبني action بالأسماء الصحيحة + connection
   */
  buildAction(stepName, pieceId, actionName, input, connection) {
    var fullPiece = "@activepieces/piece-" + pieceId;
    var version = PIECE_VERSIONS[pieceId] || "~0.1.0";

    // Fix prop names
    var fixedInput = this._fixProps(pieceId, actionName, input);

    // Build propertySettings
    var propertySettings = {};
    Object.keys(fixedInput).forEach(function (k) {
      propertySettings[k] = { type: "MANUAL" };
    });

    var action = {
      name: stepName,
      skip: false,
      type: "PIECE",
      valid: true,
      displayName: stepName,
      settings: {
        pieceName: fullPiece,
        pieceVersion: version,
        actionName: actionName,
        input: fixedInput,
        sampleData: {},
        propertySettings: propertySettings,
        inputUiInfo: {},
        errorHandlingOptions: {
          retryOnFailure: { value: false },
          continueOnFailure: { value: true },
        },
      },
    };

    // Link connection
    if (connection && connection.externalId) {
      action.settings.input["auth"] = "{{connections." + connection.externalId + "}}";
    }

    return action;
  }

  /**
   * يصلح أسماء الـ Props بناءً على الـ PROVEN_PROPS
   */
  _fixProps(pieceId, actionName, input) {
    var fixed = Object.assign({}, input);
    var spec = PROVEN_PROPS[pieceId] && PROVEN_PROPS[pieceId][actionName];
    if (!spec) return fixed;

    // Rename wrong props
    if (spec.rename) {
      Object.keys(spec.rename).forEach(function (wrong) {
        if (fixed[wrong] !== undefined && fixed[spec.rename[wrong]] === undefined) {
          fixed[spec.rename[wrong]] = fixed[wrong];
          delete fixed[wrong];
        }
      });
    }

    // Add defaults for missing required
    if (spec.defaults) {
      Object.keys(spec.defaults).forEach(function (k) {
        if (fixed[k] === undefined) fixed[k] = spec.defaults[k];
      });
    }

    // Gmail receiver must be Array
    if (pieceId === "gmail" && actionName === "send_email") {
      if (fixed.receiver && !Array.isArray(fixed.receiver)) {
        fixed.receiver = [fixed.receiver];
      }
    }

    return fixed;
  }

  // ══════════ Utils ══════════

  // ══════════ Phase 9.5 API Methods ══════════

  createProject(name, displayName) {
    if (this._mock) return { id: "proj_" + Date.now().toString(36), name: name, displayName: displayName || name, status: "active" };
    throw new Error("createProject requires async — use await");
  }

  getProject(projectId) {
    if (this._mock) return { id: projectId, status: "active", created: new Date().toISOString() };
    throw new Error("getProject requires async — use await");
  }

  deleteProject(projectId) {
    if (this._mock) return { deleted: true, id: projectId };
    throw new Error("deleteProject requires async — use await");
  }

  importFlow(projectId, flowConfig) {
    if (this._mock) return { id: "flow_" + Date.now().toString(36), projectId: projectId, displayName: (flowConfig && flowConfig.displayName) || "Imported", status: "DISABLED" };
    throw new Error("importFlow requires async — use await");
  }

  enableFlow(flowId) {
    if (this._mock) return { id: flowId, status: "ENABLED" };
    throw new Error("enableFlow requires async — use await");
  }

  getFlowStatus(flowId) {
    if (this._mock) return { id: flowId, status: "ENABLED", runs: 0, errors: 0, lastRun: null };
    throw new Error("getFlowStatus requires async — use await");
  }

  createConnection(projectId, pieceName, config) {
    if (this._mock) return { id: "conn_" + Date.now().toString(36), projectId: projectId, pieceName: pieceName, status: "ACTIVE" };
    throw new Error("createConnection requires async — use await");
  }

  testFlow(flowId, testData) {
    if (this._mock) return { id: "run_" + Date.now().toString(36), flowId: flowId, status: "SUCCEEDED", duration_ms: 42 };
    throw new Error("testFlow requires async — use await");
  }

  _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ══════════ Mock (backward compat) ══════════

  _mockResponse(method, path, body) {
    var ts = Date.now().toString(36);
    if (path.includes("/flows") && method === "POST") return { success: true, data: { id: "flow_" + ts, displayName: (body && body.displayName) || "Mock", status: "DISABLED" } };
    if (path.includes("/flows") && method === "GET") return { success: true, data: { data: [], total: 0 } };
    if (path.includes("/flows") && method === "DELETE") return { success: true, data: { deleted: true } };
    if (path.includes("/flow-runs")) return { success: true, data: { data: [], total: 0 } };
    if (path.includes("/app-connections")) return { success: true, data: { data: [] } };
    return { success: true, data: {} };
  }
}

// Static exports for adapter
ActivePiecesClient.PROVEN_PROPS = PROVEN_PROPS;
ActivePiecesClient.PROVEN_TRIGGERS = PROVEN_TRIGGERS;
ActivePiecesClient.PIECE_VERSIONS = PIECE_VERSIONS;

module.exports = { ActivePiecesClient };
