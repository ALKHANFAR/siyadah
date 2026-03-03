const path = require("path");
const __BASE = path.join(__dirname, "..");
const fs = require("fs");
const toolsDir = `${__BASE}/data/tools`;
const registryPath = `${__BASE}/data/registry/tools.json`;

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const pieces = registry.pieces;
const pieceMap = {};
pieces.forEach(p => pieceMap[p.id] = p);

const files = fs.readdirSync(toolsDir).filter(f => f.endsWith(".json"));
const toolDetails = {};
files.forEach(f => {
  const data = JSON.parse(fs.readFileSync(`${toolsDir}/${f}`, "utf8"));
  toolDetails[data.id] = data;
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
console.log("  Tool Details Tests v2.0");
console.log("═══════════════════════════════════════════\n");

// ═══════════ GROUP 1: الملفات ═══════════
console.log("📋 Group 1: الملفات والتغطية");
console.log("─────────────────────────────────────");

test("عدد ملفات التفاصيل >= 30", () => {
  return files.length >= 30 ? true : `${files.length}`;
});

test("كل ملف JSON صالح وفيه id", () => {
  const bad = files.filter(f => {
    try { const d = JSON.parse(fs.readFileSync(`${toolsDir}/${f}`, "utf8")); return !d.id; }
    catch { return true; }
  });
  return bad.length === 0 ? true : `فاسد: ${bad.join(", ")}`;
});

test("اسم الملف = id.json", () => {
  const bad = files.filter(f => {
    const d = JSON.parse(fs.readFileSync(`${toolsDir}/${f}`, "utf8"));
    return f !== `${d.id}.json`;
  });
  return bad.length === 0 ? true : `غير متطابق: ${bad.join(", ")}`;
});

test("كل ملف تفصيلي موجود في السجل", () => {
  const bad = Object.keys(toolDetails).filter(id => !pieceMap[id]);
  return bad.length === 0 ? true : `غير موجود في السجل: ${bad.join(", ")}`;
});

// ═══════════ GROUP 2: التزامن مع السجل ═══════════
console.log("\n📋 Group 2: التزامن مع السجل v2");
console.log("─────────────────────────────────────");

test("كل action في التفاصيل موجود في السجل", () => {
  const extra = [];
  Object.entries(toolDetails).forEach(([id, td]) => {
    const regPiece = pieceMap[id];
    if (!regPiece) return;
    const regActions = new Set(regPiece.actions.map(a => a.name));
    Object.keys(td.actions || {}).forEach(a => {
      if (!regActions.has(a)) extra.push(`${id}.${a}`);
    });
  });
  return extra.length === 0 ? true : `زائد: ${extra.slice(0, 5).join(", ")}`;
});

test("كل action في السجل موجود في التفاصيل", () => {
  const missing = [];
  Object.entries(toolDetails).forEach(([id, td]) => {
    const regPiece = pieceMap[id];
    if (!regPiece) return;
    const tdActions = new Set(Object.keys(td.actions || {}));
    regPiece.actions.forEach(a => {
      if (!tdActions.has(a.name)) missing.push(`${id}.${a.name}`);
    });
  });
  return missing.length === 0 ? true : `ناقص: ${missing.slice(0, 5).join(", ")}`;
});

test("كل trigger في التفاصيل موجود في السجل", () => {
  const extra = [];
  Object.entries(toolDetails).forEach(([id, td]) => {
    const regPiece = pieceMap[id];
    if (!regPiece) return;
    const regTriggers = new Set(regPiece.triggers.map(t => t.name));
    Object.keys(td.triggers || {}).forEach(t => {
      if (!regTriggers.has(t)) extra.push(`${id}.${t}`);
    });
  });
  return extra.length === 0 ? true : `زائد: ${extra.slice(0, 5).join(", ")}`;
});

test("كل trigger في السجل موجود في التفاصيل", () => {
  const missing = [];
  Object.entries(toolDetails).forEach(([id, td]) => {
    const regPiece = pieceMap[id];
    if (!regPiece) return;
    const tdTriggers = new Set(Object.keys(td.triggers || {}));
    regPiece.triggers.forEach(t => {
      if (!tdTriggers.has(t.name)) missing.push(`${id}.${t.name}`);
    });
  });
  return missing.length === 0 ? true : `ناقص: ${missing.slice(0, 5).join(", ")}`;
});

// ═══════════ GROUP 3: الأسماء الرسمية ═══════════
console.log("\n📋 Group 3: أسماء متحققة من المصدر");
console.log("─────────────────────────────────────");

test("Google Sheets: 21 actions, 4 triggers", () => {
  const gs = toolDetails["google-sheets"];
  if (!gs) return "غير موجود";
  const a = Object.keys(gs.actions || {}).length;
  const t = Object.keys(gs.triggers || {}).length;
  return a === 21 && t === 4 ? true : `A:${a}/20 T:${t}/4`;
});

test("Google Sheets: insert_row موجود", () => {
  return toolDetails["google-sheets"]?.actions?.insert_row ? true : "مفقود";
});

test("OpenAI: 9 actions", () => {
  const oi = toolDetails["openai"];
  if (!oi) return "غير موجود";
  const a = Object.keys(oi.actions || {}).length;
  return a === 9 ? true : `A:${a}`;
});

test("Gmail: 8 actions + 5 triggers", () => {
  const gm = toolDetails["gmail"];
  if (!gm) return "غير موجود";
  const a = Object.keys(gm.actions).length;
  const t = Object.keys(gm.triggers).length;
  return a === 8 && t === 5 ? true : `A:${a}/8 T:${t}/5`;
});

test("Slack: 26 actions, 12 triggers", () => {
  const sl = toolDetails["slack"];
  if (!sl) return "غير موجود";
  const a = Object.keys(sl.actions || {}).length;
  const t = Object.keys(sl.triggers || {}).length;
  return a === 26 && t === 12 ? true : `A:${a}/25 T:${t}/12`;
});

test("WhatsApp: 3 actions", () => {
  const wa = toolDetails["whatsapp"];
  if (!wa) return "غير موجود";
  return Object.keys(wa.actions).length === 3 && wa.actions.sendMessage ? true : "خطأ";
});

test("Twilio: 1 action (custom_api_call)", () => {
  const tw = toolDetails["twilio"];
  if (!tw) return "غير موجود";
  const a = Object.keys(tw.actions || {}).length;
  return a === 1 ? true : `A:${a}/1`;
});

test("Schedule: 0 actions, triggers فقط", () => {
  const sc = toolDetails["schedule"];
  if (!sc) return "غير موجود";
  const a = Object.keys(sc.actions || {}).length;
  const t = Object.keys(sc.triggers || {}).length;
  return a === 0 && t >= 4 ? true : `A:${a} T:${t}`;
});

// ═══════════ GROUP 4: لا أسماء مخترعة ═══════════
console.log("\n📋 Group 4: لا أسماء مخترعة");
console.log("─────────────────────────────────────");

const FABRICATED = {
  "gmail": ["read_email", "search_emails"],
  "google-sheets": ["get_values"]
};

Object.entries(FABRICATED).forEach(([toolId, fakeNames]) => {
  fakeNames.forEach(fakeName => {
    test(`حُذف: ${toolId}.${fakeName}`, () => {
      const td = toolDetails[toolId];
      if (!td) return true;
      return !td.actions?.[fakeName] && !td.triggers?.[fakeName] ? true : "لا يزال موجود!";
    });
  });
});

// ═══════════ GROUP 5: Props ═══════════
console.log("\n📋 Group 5: Props Structure");
console.log("─────────────────────────────────────");

test("كل action/trigger فيه props (array) أو فارغ", () => {
  const bad = [];
  Object.entries(toolDetails).forEach(([id, td]) => {
    [...Object.entries(td.actions || {}), ...Object.entries(td.triggers || {})].forEach(([name, item]) => {
      if (!Array.isArray(item.props) && !item._stub) {
        bad.push(`${id}.${name}`);
      }
    });
  });
  return bad.length === 0 ? true : `بدون props: ${bad.slice(0, 5).join(", ")}`;
});

test("الـ props الموجودة فيها name + type + required", () => {
  const bad = [];
  Object.entries(toolDetails).forEach(([id, td]) => {
    [...Object.values(td.actions || {}), ...Object.values(td.triggers || {})].forEach(item => {
      (item.props || []).forEach(p => {
        if (!p.name || !p.type || p.required === undefined)
          bad.push(`${id}: prop ${p.name || '?'}`);
      });
    });
  });
  return bad.length === 0 ? true : `ناقص: ${bad.slice(0, 3).join(", ")}`;
});

test("Google Sheets insert_row: props موجودة", () => {
  const gs = toolDetails["google-sheets"];
  if (!gs?.actions?.insert_row) return "مفقود";
  const props = gs.actions.insert_row.props || [];
  return props.length > 0 ? true : "لا props";
});

// ═══════════ GROUP 6: Auth ═══════════
console.log("\n📋 Group 6: المصادقة");
console.log("─────────────────────────────────────");

test("Google Sheets: oauth2", () => {
  return toolDetails["google-sheets"]?.auth?.type === "oauth2" ? true : "خطأ";
});

test("OpenAI: SECRET_TEXT", () => {
  return toolDetails["openai"]?.auth?.type === "SECRET_TEXT" ? true : "خطأ";
});

test("Schedule: لا يحتاج auth", () => {
  return toolDetails["schedule"]?.auth?.required === false ? true : "خطأ";
});

test("Webhook: لا يحتاج auth", () => {
  return toolDetails["webhook"]?.auth?.required === false ? true : "خطأ";
});

// ═══════════ GROUP 7: الإحصائيات ═══════════
console.log("\n📋 Group 7: الإحصائيات");
console.log("─────────────────────────────────────");

let totalA = 0, totalT = 0, totalProps = 0, totalStubs = 0;
Object.values(toolDetails).forEach(td => {
  totalA += Object.keys(td.actions || {}).length;
  totalT += Object.keys(td.triggers || {}).length;
  [...Object.values(td.actions || {}), ...Object.values(td.triggers || {})].forEach(item => {
    totalProps += (item.props || []).length;
    if (item._stub) totalStubs++;
  });
});

test(`Actions >= 250`, () => totalA >= 250 ? true : `${totalA}`);
test(`Triggers >= 50`, () => totalT >= 50 ? true : `${totalT}`);

// ═══════════ RESULTS ═══════════
console.log("\n═══════════════════════════════════════════");
console.log(`  النتيجة: ${passed}/${total} نجحت`);
if (failed > 0) console.log(`  ❌ ${failed} فشلت`);
else console.log(`  ✅ كل الاختبارات نجحت!`);
console.log("═══════════════════════════════════════════");

console.log(`\n📊 ملفات: ${files.length} | Actions: ${totalA} | Triggers: ${totalT} | Props: ${totalProps} | Stubs: ${totalStubs}`);

process.exit(failed > 0 ? 1 : 0);
