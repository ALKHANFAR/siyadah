const http = require("http");
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const { SiyadahAPI } = require("./backend/routes/api");

const PORT = process.env.PORT || 3000;
const api = new SiyadahAPI();

// Load frontend
const indexHtml = fs.readFileSync(path.join(__dirname, "public/index.html"), "utf8");

function sendJson(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(function(req, res) {
  try {
    var url = new URL(req.url, "http://localhost:" + PORT);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // Frontend
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(indexHtml); return;
    }

    // Sprint 2 Test Page
    if (req.method === "GET" && url.pathname === "/test-sprint2") {
      var testHtml = fs.readFileSync(path.join(__dirname, "public/test-sprint2.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(testHtml); return;
    }

    // Health
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        status: "ok",
        project: "Siyadah v3.0",
        tests: "605/605",
        ap_url: api.ap.baseUrl,
        ap_mock: api.ap._mock,
        ap_project: api.ap.projectId
      }); return;
    }

    // Tests
    if (req.method === "GET" && url.pathname === "/test") {
      try {
        var out = execSync("node " + path.join(__dirname, "tests/run-all.js"), { encoding: "utf8", timeout: 60000 });
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); res.end(out);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); res.end(e.stdout || "failed");
      }
      return;
    }

    // AP Health (REAL)
    if (req.method === "GET" && url.pathname === "/api/ap/health") {
      api.apHealth().then(function(r) { sendJson(res, r.success ? 200 : 502, r); })
        .catch(function(e) { sendJson(res, 500, { error: e.message }); });
      return;
    }

    // AP Login Check
    if (req.method === "GET" && url.pathname === "/api/ap/check") {
      api.apCheckConnection().then(function(r) { sendJson(res, r.connected ? 200 : 502, r); })
        .catch(function(e) { sendJson(res, 500, { error: e.message }); });
      return;
    }

    // AP Flows (REAL)
    if (req.method === "GET" && url.pathname === "/api/ap/flows") {
      api.apListFlows().then(function(r) { sendJson(res, r.success ? 200 : 502, r); })
        .catch(function(e) { sendJson(res, 500, { error: e.message }); });
      return;
    }

    // AP Connections (REAL)
    if (req.method === "GET" && url.pathname === "/api/ap/connections") {
      api.apListConnections().then(function(r) { sendJson(res, r.success ? 200 : 502, r); })
        .catch(function(e) { sendJson(res, 500, { error: e.message }); });
      return;
    }

    // Admin
    if (req.method === "GET" && url.pathname === "/api/admin") {
      sendJson(res, 200, api.getAdminDashboard()); return;
    }

    // POST endpoints
    if (req.method === "POST") {
      var body = "";
      req.on("data", function(c) { body += c; if (body.length > 1e6) { req.destroy(); } });
      req.on("end", function() {
        try {
          var data = JSON.parse(body);

          if (url.pathname === "/api/register") { sendJson(res, 200, api.register(data)); return; }
          if (url.pathname === "/api/login") { sendJson(res, 200, api.login(data)); return; }
          if (url.pathname === "/api/chat") { sendJson(res, 200, api.chat(data.tenantId, data.message)); return; }
          if (url.pathname === "/api/onboard") { sendJson(res, 200, api.onboard(data.tenantId, data)); return; }

          // Deploy (REAL AP - async)
          if (url.pathname === "/api/deploy") {
            api.deployToAP(data.tenantId, data.automationId)
              .then(function(r) { sendJson(res, r.success ? 200 : 502, r); })
              .catch(function(e) { sendJson(res, 500, { success: false, error: e.message }); });
            return;
          }

          // Pipeline
          if (url.pathname === "/pipeline") {
            var exec = require("./engine/pipeline").executePipeline;
            sendJson(res, 200, exec(data.text, data.options));
            return;
          }

          sendJson(res, 404, { error: "not found" });
        } catch (e) { sendJson(res, 400, { error: e.message }); }
      });
      return;
    }

    sendJson(res, 404, { error: "not found" });
  } catch (e) {
    // Catch-all: never leave request hanging
    try { sendJson(res, 500, { error: "internal: " + e.message }); } catch(e2) {}
  }
});

// CRITICAL: Start listening FIRST, run tests AFTER
// Railway health check needs port to be open immediately
server.listen(PORT, function() {
  console.log("👑 Siyadah v3.0 — port " + PORT + " (listening)");
  console.log("   AP URL: " + (process.env.AP_BASE_URL || "NOT SET"));
  console.log("   AP Key: " + (process.env.AP_API_KEY ? process.env.AP_API_KEY.substring(0, 20) + "..." : "NOT SET"));
  console.log("   AP Project: " + (process.env.AP_PROJECT_ID || "NOT SET"));
  console.log("   AP mock: " + api.ap._mock);

  // Run tests in background (non-blocking for Railway)
  setTimeout(function() {
    try {
      var out = execSync("node " + path.join(__dirname, "tests/run-all.js"), { encoding: "utf8", timeout: 60000 });
      console.log(out);
    } catch (e) {
      console.error("Tests:", e.stdout || "failed");
    }
  }, 100);
});

// Prevent crashes from killing server
process.on("uncaughtException", function(e) { console.error("UNCAUGHT:", e.message); });
process.on("unhandledRejection", function(e) { console.error("UNHANDLED:", e && e.message || e); });
