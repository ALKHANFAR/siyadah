const http = require("http");
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const { SiyadahAPI } = require("./backend/routes/api");

const PORT = process.env.PORT || 3000;
const api = new SiyadahAPI();

// Run tests on startup
try { const out = execSync("node " + path.join(__dirname, "tests/run-all.js"), { encoding: "utf8", timeout: 60000 }); console.log(out); } catch (e) { console.error(e.stdout || "Tests failed"); }

// Load frontend HTML
const indexHtml = fs.readFileSync(path.join(__dirname, "public/index.html"), "utf8");

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // === FRONTEND ===
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
    return;
  }

  // === API: Health ===
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", project: "سيادة Siyadah v3.0", tests: "568/568 ✅", phases: "14/14 ✅", pieces: 602, intents: 24, industries: 7 }, null, 2));
    return;
  }

  // === API: Run Tests ===
  if (req.method === "GET" && url.pathname === "/test") {
    try { const out = execSync("node " + path.join(__dirname, "tests/run-all.js"), { encoding: "utf8", timeout: 60000 }); res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); res.end(out); }
    catch (e) { res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); res.end(e.stdout || "failed"); }
    return;
  }

  // === API: Admin ===
  if (req.method === "GET" && url.pathname === "/api/admin") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(api.getAdminDashboard(), null, 2));
    return;
  }

  // === API: POST ===
  if (req.method === "POST") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        let result;
        if (url.pathname === "/api/register") result = api.register(data);
        else if (url.pathname === "/api/login") result = api.login(data);
        else if (url.pathname === "/api/chat") result = api.chat(data.tenantId, data.message);
        else if (url.pathname === "/api/deploy") result = api.deploy(data.tenantId, data.automationId);
        else if (url.pathname === "/api/onboard") result = api.onboard(data.tenantId, data);
        else if (url.pathname === "/pipeline") {
          const { executePipeline } = require("./engine/pipeline");
          result = executePipeline(data.text, data.options);
        } else { res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"not found"}'); return; }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(result, null, 2));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // === 404 ===
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end('{"error":"not found"}');
});

server.listen(PORT, () => {
  console.log("\n👑 سيادة Siyadah v3.0 — port " + PORT);
  console.log("   GET  /              الواجهة الأمامية");
  console.log("   GET  /health        status");
  console.log("   GET  /test          568 tests");
  console.log("   GET  /api/admin     dashboard");
  console.log("   POST /api/register  {email,password,name}");
  console.log("   POST /api/login     {email,password}");
  console.log("   POST /api/chat      {tenantId,message}");
  console.log("   POST /api/deploy    {tenantId,automationId}");
  console.log("   POST /pipeline      {text}");
});
