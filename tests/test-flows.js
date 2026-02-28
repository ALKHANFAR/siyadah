const path = require("path");
const fs = require("fs");
const flowsPath = path.join(__dirname, "../") + "/data/flows";
const registryPath = path.join(__dirname, "../") + "/data/registry/tools.json";

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const regToolIds = new Set(registry.pieces.map(p => p.id));

const flowFiles = fs.readdirSync(flowsPath).filter(f => f.endsWith(".json"));
const flows = {};
flowFiles.forEach(f => {
  const data = JSON.parse(fs.readFileSync(`${flowsPath}/${f}`, "utf8"));
  flows[data._meta.id] = data;
});

let passed = 0, failed = 0, total = 0;
function test(name, fn) {
  total++;
  try {
    const r = fn();
    if (r === true) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name}: ${r}`); }
  } catch (e) { failed++; console.log(`  ❌ ${name}: ${e.message}`); }
}

console.log("═══════════════════════════════════════════");
console.log("  Flow Templates Tests v2.0");
console.log("═══════════════════════════════════════════\n");

const expectedFlows = ["lead-capture", "invoice-collection", "customer-journey", "weekly-report", "appointment-booking", "complaint-handling"];

// ═══════════ GROUP 1: الملفات ═══════════
console.log("📋 Group 1: الملفات");
console.log("─────────────────────────────────────");

test("6 ملفات flow موجودة", () => flowFiles.length === 6 ? true : `${flowFiles.length}`);

test("كل الـ 6 flows المتوقعة موجودة", () => {
  const missing = expectedFlows.filter(id => !flows[id]);
  return missing.length === 0 ? true : `ناقص: ${missing.join(", ")}`;
});

test("كل الملفات JSON صالح", () => {
  const bad = flowFiles.filter(f => {
    try { JSON.parse(fs.readFileSync(`${flowsPath}/${f}`, "utf8")); return false; }
    catch { return true; }
  });
  return bad.length === 0 ? true : bad.join(", ");
});

test("اسم الملف = flow ID", () => {
  const bad = flowFiles.filter(f => {
    const d = JSON.parse(fs.readFileSync(`${flowsPath}/${f}`, "utf8"));
    return d._meta.id !== f.replace(".json", "");
  });
  return bad.length === 0 ? true : bad.join(", ");
});

// ═══════════ GROUP 2: Metadata ═══════════
console.log("\n📋 Group 2: Metadata");
console.log("─────────────────────────────────────");

const metaFields = ["id", "version", "display_name", "display_name_en", "description", "category", "industries", "estimated_setup_time", "user_request_examples", "intent_keywords"];

test("كل flow فيه _meta كامل", () => {
  const bad = [];
  Object.entries(flows).forEach(([id, f]) => {
    metaFields.forEach(field => {
      if (f._meta[field] === undefined) bad.push(`${id}.${field}`);
    });
  });
  return bad.length === 0 ? true : `ناقص: ${bad.join(", ")}`;
});

test("أسماء عربية", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !/[\u0600-\u06FF]/.test(f._meta.display_name)).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

test(">= 3 أمثلة طلب لكل flow", () => {
  const bad = Object.entries(flows).filter(([id, f]) => f._meta.user_request_examples.length < 3).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

test(">= 3 intent_keywords لكل flow", () => {
  const bad = Object.entries(flows).filter(([id, f]) => f._meta.intent_keywords.length < 3).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

// ═══════════ GROUP 3: Triggers ═══════════
console.log("\n📋 Group 3: Triggers");
console.log("─────────────────────────────────────");

test("كل flow فيه trigger", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !f.trigger || !f.trigger.tool_id).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

test("trigger tool_ids في السجل", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !regToolIds.has(f.trigger.tool_id)).map(([id]) => `${id}→${flows[id].trigger.tool_id}`);
  return bad.length === 0 ? true : bad.join(", ");
});

test("كل flow فيه alternative_triggers", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !f.trigger.alternative_triggers || f.trigger.alternative_triggers.length === 0).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

// ═══════════ GROUP 4: Steps ═══════════
console.log("\n📋 Group 4: الخطوات");
console.log("─────────────────────────────────────");

test(">= 3 خطوات لكل flow", () => {
  const bad = Object.entries(flows).filter(([id, f]) => f.steps.length < 3).map(([id]) => `${id}(${flows[id].steps.length})`);
  return bad.length === 0 ? true : bad.join(", ");
});

test("خطوات فيها: order, id, tool_id, action, description", () => {
  const req = ["order", "id", "tool_id", "action", "description"];
  const bad = [];
  Object.entries(flows).forEach(([fid, f]) => {
    f.steps.forEach(s => {
      req.forEach(r => { if (s[r] === undefined) bad.push(`${fid}.${s.id||s.order}.${r}`); });
    });
  });
  return bad.length === 0 ? true : bad.slice(0, 5).join(", ");
});

test("الترتيب تسلسلي من 1", () => {
  const bad = [];
  Object.entries(flows).forEach(([id, f]) => {
    f.steps.forEach((s, i) => {
      if (s.order !== i + 1) bad.push(`${id}.step${i}`);
    });
  });
  return bad.length === 0 ? true : bad.join(", ");
});

test("step IDs فريدة داخل كل flow", () => {
  const bad = [];
  Object.entries(flows).forEach(([id, f]) => {
    const ids = f.steps.map(s => s.id);
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    if (dupes.length > 0) bad.push(`${id}: ${dupes.join(", ")}`);
  });
  return bad.length === 0 ? true : bad.join("; ");
});

test("step tool_ids في السجل", () => {
  const bad = [];
  Object.entries(flows).forEach(([fid, f]) => {
    f.steps.forEach(s => {
      if (s.tool_id && !regToolIds.has(s.tool_id)) bad.push(`${fid}.${s.id}→${s.tool_id}`);
    });
  });
  return bad.length === 0 ? true : bad.join(", ");
});

// ═══════════ GROUP 5: Connections ═══════════
console.log("\n📋 Group 5: الاتصالات");
console.log("─────────────────────────────────────");

test("كل flow فيه required_connections", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !f.required_connections || f.required_connections.length === 0).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

test("required_connections في السجل", () => {
  const bad = [];
  Object.entries(flows).forEach(([id, f]) => {
    (f.required_connections || []).forEach(c => {
      if (!regToolIds.has(c)) bad.push(`${id}→${c}`);
    });
  });
  return bad.length === 0 ? true : bad.join(", ");
});

test("Google Sheets في كل flow", () => {
  const bad = Object.entries(flows).filter(([id, f]) => {
    const all = [...(f.required_connections || []), ...(f.minimum_connections || [])];
    return !all.includes("google-sheets");
  }).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

// ═══════════ GROUP 6: فحوصات محددة ═══════════
console.log("\n📋 Group 6: فحوصات محددة");
console.log("─────────────────────────────────────");

test("lead-capture: webhook trigger", () => {
  return flows["lead-capture"].trigger.tool_id === "webhook" ? true : flows["lead-capture"].trigger.tool_id;
});

test("lead-capture: خطوة AI (openai)", () => {
  return flows["lead-capture"].steps.some(s => s.tool_id === "openai") ? true : "مفقود";
});

test("lead-capture: تفرع hot/warm/cold", () => {
  const b = flows["lead-capture"].branches.find(b => b.condition_field === "lead_type");
  return b && b.routes.hot && b.routes.warm && b.routes.cold ? true : "مفقود";
});

test("invoice-collection: schedule trigger", () => {
  return flows["invoice-collection"].trigger.tool_id === "schedule" ? true : flows["invoice-collection"].trigger.tool_id;
});

test("invoice-collection: loop step", () => {
  return flows["invoice-collection"].steps.some(s => s.tool_id === "loop") ? true : "مفقود";
});

test("customer-journey: >= 2 delay steps", () => {
  const d = flows["customer-journey"].steps.filter(s => s.tool_id === "delay").length;
  return d >= 2 ? true : `${d}`;
});

test("weekly-report: schedule trigger", () => {
  return flows["weekly-report"].trigger.tool_id === "schedule" ? true : flows["weekly-report"].trigger.tool_id;
});

test("appointment-booking: google-calendar trigger", () => {
  return flows["appointment-booking"].trigger.tool_id === "google-calendar" ? true : flows["appointment-booking"].trigger.tool_id;
});

test("complaint-handling: severity escalation", () => {
  const b = flows["complaint-handling"].branches.find(b => b.condition_field === "severity");
  return b && b.routes.high ? true : "مفقود";
});

// ═══════════ GROUP 7: البنية ═══════════
console.log("\n📋 Group 7: بنية إضافية");
console.log("─────────────────────────────────────");

test("كل flow فيه sheets_template", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !f.sheets_template || !f.sheets_template.columns).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

test("كل flow فيه industry_variants", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !f.industry_variants || Object.keys(f.industry_variants).length === 0).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

test("كل flow فيه required_variables", () => {
  const bad = Object.entries(flows).filter(([id, f]) => !f.required_variables).map(([id]) => id);
  return bad.length === 0 ? true : bad.join(", ");
});

// ═══════════ RESULTS ═══════════
console.log("\n═══════════════════════════════════════════");
console.log(`  النتيجة: ${passed}/${total} نجحت`);
if (failed > 0) console.log(`  ❌ ${failed} فشلت`);
else console.log(`  ✅ كل الاختبارات نجحت!`);
console.log("═══════════════════════════════════════════");

const totalSteps = Object.values(flows).reduce((s, f) => s + f.steps.length, 0);
const totalBranches = Object.values(flows).reduce((s, f) => s + (f.branches || []).length, 0);
console.log(`\n📊 Flows: ${flowFiles.length} | خطوات: ${totalSteps} | تفرعات: ${totalBranches}`);

process.exit(failed > 0 ? 1 : 0);
