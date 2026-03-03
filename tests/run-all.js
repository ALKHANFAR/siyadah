#!/usr/bin/env node
/**
 * npm test — يشغّل كل الاختبارات
 */

const { execSync } = require("child_process");
const path = require("path");

const tests = [
  { name: "Phase 1: Registry (602 أداة)",    file: "test-registry.js" },
  { name: "Phase 2: Tool Details (30 ملف)",  file: "test-tool-details.js" },
  { name: "Phase 3: Flow Templates (6 قوالب)", file: "test-flows.js" },
  { name: "Phase 4: Templates & Vars",       file: "test-templates.js" },
  { name: "Phase 5: Error Map",              file: "test-errors.js" },
  { name: "Phase 6: Intent + Tool Selector", file: "test-phase6.js" },
  { name: "Phase 7: Flow Builder",           file: "test-phase7.js" },
  { name: "Phase 8: Validator (5 Gates)",    file: "test-phase8.js" },
  { name: "Phase 9: Full Pipeline E2E",      file: "test-phase9.js" },
  { name: "Phase 9.5: AP+Security+Infra",   file: "test-phase95.js" },
  { name: "Phase 10-11: Auth+Billing",       file: "test-phase10-11.js" },
  { name: "Phase 11.5: Load Test+DevOps",    file: "test-phase115.js" },
  { name: "Phase 12: Full API+Integration",  file: "test-phase12.js" },
  { name: "50 Complex Flows",                file: "test-50-flows.js" },
];

console.log("═══════════════════════════════════════════════════════════");
console.log("  سيادة Siyadah — تشغيل كل الاختبارات");
console.log("═══════════════════════════════════════════════════════════\n");

let totalPassed = 0;
let totalFailed = 0;
let allOk = true;

for (const t of tests) {
  try {
    const output = execSync(`node ${path.join(__dirname, t.file)}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Extract result line
    const match = output.match(/(\d+)\/(\d+)\s*(نجحت|passed)/);
    if (match) {
      const [, p, tot] = match;
      const passed = parseInt(p);
      const total = parseInt(tot);
      const failed = total - passed;
      totalPassed += passed;
      totalFailed += failed;

      const status = failed === 0 ? "✅" : "❌";
      console.log(`  ${status} ${t.name.padEnd(35)} ${p}/${tot}`);

      if (failed > 0) allOk = false;
    } else {
      console.log(`  ✅ ${t.name.padEnd(35)} OK`);
    }
  } catch (e) {
    allOk = false;
    const output = e.stdout || "";
    const match = output.match(/(\d+)\/(\d+)\s*(نجحت|passed)/);
    if (match) {
      const [, p, tot] = match;
      totalPassed += parseInt(p);
      totalFailed += parseInt(tot) - parseInt(p);
      console.log(`  ❌ ${t.name.padEnd(35)} ${p}/${tot}`);
    } else {
      console.log(`  ❌ ${t.name.padEnd(35)} CRASH`);
    }
  }
}

const total = totalPassed + totalFailed;
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  المجموع: ${totalPassed}/${total}${allOk ? " ✅" : " ❌"}`);
console.log("═══════════════════════════════════════════════════════════");

process.exit(allOk ? 0 : 1);
