#!/usr/bin/env node
/**
 * سيادة — تشغيل جميع الاختبارات
 * npm test
 */

const { execSync } = require("child_process");
const path = require("path");

const TESTS = [
  { name: "① Registry (السجل)", file: "test-registry.js" },
  { name: "② Tool Details (تفاصيل الأدوات)", file: "test-tool-details.js" },
  { name: "③ Flow Templates (قوالب التدفق)", file: "test-flows.js" },
  { name: "④ Complex Flows (50 تدفق معقد)", file: "test-50-flows.js" },
];

const testsDir = __dirname;
let totalPass = 0;
let totalFail = 0;
let results = [];

console.log("\n╔══════════════════════════════════════════════╗");
console.log("║        سيادة — اختبار شامل للمشروع          ║");
console.log("╚══════════════════════════════════════════════╝\n");

for (const t of TESTS) {
  const filePath = path.join(testsDir, t.file);
  try {
    const output = execSync(`node "${filePath}" 2>&1`, { encoding: "utf8" });
    const pass = (output.match(/✅/g) || []).length;
    const fail = (output.match(/❌/g) || []).length;
    totalPass += pass;
    totalFail += fail;
    const status = fail === 0 ? "✅" : "❌";
    results.push({ name: t.name, pass, fail, status });
    console.log(`${status} ${t.name}: ${pass} نجح${fail > 0 ? ` / ${fail} فشل` : ""}`);
  } catch (err) {
    const output = err.stdout || "";
    const pass = (output.match(/✅/g) || []).length;
    const fail = (output.match(/❌/g) || []).length;
    totalPass += pass;
    totalFail += fail;
    results.push({ name: t.name, pass, fail, status: "❌" });
    console.log(`❌ ${t.name}: ${pass} نجح / ${fail || "?"} فشل`);
  }
}

console.log("\n──────────────────────────────────────────────");
console.log(`المجموع: ${totalPass + totalFail} اختبار — ${totalPass} ✅ نجح / ${totalFail} ❌ فشل`);

if (totalFail === 0) {
  console.log("\n🎉 كل الاختبارات نجحت!\n");
  process.exit(0);
} else {
  console.log("\n⚠️  يوجد اختبارات فاشلة\n");
  process.exit(1);
}
