const path = require("path");
const __BASE = path.join(__dirname, "..");
const fs = require("fs");

const BASE = __BASE;
let passed = 0;
let failed = 0;
let total = 0;

function test(name, condition) {
  total++;
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

console.log("═══════════════════════════════════════════");
console.log("  Phase 4: Templates & Vars + Prompt Library");
console.log("═══════════════════════════════════════════\n");

// ─── Constants ───
const INDUSTRIES = ["clinic", "ecommerce", "construction", "restaurant", "consulting", "training", "general_services"];
const REQUIRED_TEMPLATES = ["welcome", "follow_up_day3", "follow_up_day7", "complaint_ack"];
const REQUIRED_VAR_FILES = ["company", "customer", "context", "ai"];

// ─── Load all data ───
const messageFiles = {};
let totalMessages = 0;

INDUSTRIES.forEach(ind => {
  const filePath = path.join(BASE, "data/templates/messages", `${ind}.json`);
  if (fs.existsSync(filePath)) {
    messageFiles[ind] = loadJSON(filePath);
  }
});

const varFiles = {};
REQUIRED_VAR_FILES.forEach(v => {
  const filePath = path.join(BASE, "data/variables", `${v}.json`);
  if (fs.existsSync(filePath)) {
    varFiles[v] = loadJSON(filePath);
  }
});

const sheetsConfig = fs.existsSync(path.join(BASE, "data/templates/sheets/sheets-config.json"))
  ? loadJSON(path.join(BASE, "data/templates/sheets/sheets-config.json"))
  : null;

const promptsLib = fs.existsSync(path.join(BASE, "data/prompts/prompts-library.json"))
  ? loadJSON(path.join(BASE, "data/prompts/prompts-library.json"))
  : null;

// ════════════════════════════════════════
// Group 1: Message Templates - Files
// ════════════════════════════════════════
console.log("📋 Group 1: Message Template Files");
console.log("─────────────────────────────────────");

test("All 7 industry message files exist", INDUSTRIES.every(ind => messageFiles[ind]));

INDUSTRIES.forEach(ind => {
  test(`${ind}.json loads and has _meta`, messageFiles[ind] && messageFiles[ind]._meta);
});

test("All files have correct industry in _meta", INDUSTRIES.every(ind => {
  return messageFiles[ind] && messageFiles[ind]._meta.industry === ind;
}));

test("All files use saudi dialect", INDUSTRIES.every(ind => {
  return messageFiles[ind] && messageFiles[ind]._meta.dialect === "saudi";
}));

// ════════════════════════════════════════
// Group 2: Required Template Types
// ════════════════════════════════════════
console.log("\n📋 Group 2: Required Template Types");
console.log("─────────────────────────────────────");

INDUSTRIES.forEach(ind => {
  const templates = messageFiles[ind] ? messageFiles[ind].templates : {};
  const hasAll = REQUIRED_TEMPLATES.every(t => templates[t]);
  test(`${ind} has all 4 required templates (welcome, follow_up_day3, follow_up_day7, complaint_ack)`, hasAll);
});

// Count total messages
INDUSTRIES.forEach(ind => {
  if (messageFiles[ind]) {
    totalMessages += Object.keys(messageFiles[ind].templates).length;
  }
});
test(`Total messages >= 28 (found: ${totalMessages})`, totalMessages >= 28);

// ════════════════════════════════════════
// Group 3: Template Content Quality
// ════════════════════════════════════════
console.log("\n📋 Group 3: Template Content Quality");
console.log("─────────────────────────────────────");

let allHaveId = true;
let allHaveText = true;
let allHaveVarsUsed = true;
let allUnder500 = true;
let allHaveTone = true;
const allIds = new Set();
let duplicateIds = false;

INDUSTRIES.forEach(ind => {
  if (!messageFiles[ind]) return;
  Object.entries(messageFiles[ind].templates).forEach(([key, tmpl]) => {
    if (!tmpl.id) allHaveId = false;
    if (!tmpl.text || tmpl.text.length < 10) allHaveText = false;
    if (!tmpl.variables_used || !Array.isArray(tmpl.variables_used)) allHaveVarsUsed = false;
    if (tmpl.text && tmpl.text.length > 500) allUnder500 = false;
    if (!tmpl.tone) allHaveTone = false;
    if (allIds.has(tmpl.id)) duplicateIds = true;
    allIds.add(tmpl.id);
  });
});

test("All templates have unique id", !duplicateIds);
test("All templates have text (min 10 chars)", allHaveText);
test("All templates have variables_used array", allHaveVarsUsed);
test("All templates text <= 500 chars", allUnder500);
test("All templates have tone defined", allHaveTone);

// ════════════════════════════════════════
// Group 4: Variable Files
// ════════════════════════════════════════
console.log("\n📋 Group 4: Variable Files");
console.log("─────────────────────────────────────");

test("All 4 variable files exist (company, customer, context, ai)", 
  REQUIRED_VAR_FILES.every(v => varFiles[v]));

REQUIRED_VAR_FILES.forEach(v => {
  test(`${v}.json has _meta with category`, 
    varFiles[v] && varFiles[v]._meta && varFiles[v]._meta.category === v);
});

test("company.json has variables object", 
  varFiles.company && varFiles.company.variables && Object.keys(varFiles.company.variables).length > 0);
test("customer.json has variables object", 
  varFiles.customer && varFiles.customer.variables && Object.keys(varFiles.customer.variables).length > 0);
test("context.json has variables object", 
  varFiles.context && varFiles.context.variables && Object.keys(varFiles.context.variables).length > 0);
test("ai.json has variables object", 
  varFiles.ai && varFiles.ai.variables && Object.keys(varFiles.ai.variables).length > 0);

// Check key company vars exist
const companyVarKeys = varFiles.company ? Object.values(varFiles.company.variables).map(v => v.key) : [];
test("company.company_name variable defined", companyVarKeys.includes("company.company_name"));
test("company.phone variable defined", companyVarKeys.includes("company.phone"));
test("company.owner_phone variable defined", companyVarKeys.includes("company.owner_phone"));
test("company.industry variable defined", companyVarKeys.includes("company.industry"));
test("company.signature variable defined", companyVarKeys.includes("company.signature"));

// Check key context vars exist
const contextVarKeys = varFiles.context ? Object.values(varFiles.context.variables).map(v => v.key) : [];
test("context.greeting variable defined", contextVarKeys.includes("context.greeting"));
test("context.today variable defined", contextVarKeys.includes("context.today"));
test("context.now variable defined", contextVarKeys.includes("context.now"));

// ════════════════════════════════════════
// Group 5: No Orphan Variables
// ════════════════════════════════════════
console.log("\n📋 Group 5: No Orphan Variables");
console.log("─────────────────────────────────────");

// Collect all defined variable keys
const allDefinedVars = new Set();
REQUIRED_VAR_FILES.forEach(v => {
  if (varFiles[v] && varFiles[v].variables) {
    Object.values(varFiles[v].variables).forEach(variable => {
      allDefinedVars.add(variable.key);
    });
  }
});

// Collect all variables referenced in message templates
const templateVarsUsed = new Set();
INDUSTRIES.forEach(ind => {
  if (!messageFiles[ind]) return;
  Object.values(messageFiles[ind].templates).forEach(tmpl => {
    if (tmpl.variables_used) {
      tmpl.variables_used.forEach(v => templateVarsUsed.add(v));
    }
  });
});

// Check: template vars should reference known categories
const knownCategories = ["company", "customer", "context", "ai", "appointment", "invoice", "complaint", "order", "project", "stats"];
const unknownCategoryVars = [];
templateVarsUsed.forEach(v => {
  const cat = v.split(".")[0];
  if (!knownCategories.includes(cat)) {
    unknownCategoryVars.push(v);
  }
});
test("All template variables use known categories", unknownCategoryVars.length === 0);

// Check core vars (company.*, customer.*, context.*) are defined
const coreOrphans = [];
templateVarsUsed.forEach(v => {
  const cat = v.split(".")[0];
  if (["company", "customer", "context", "ai"].includes(cat)) {
    if (!allDefinedVars.has(v)) {
      coreOrphans.push(v);
    }
  }
});
test(`No orphan core variables (company/customer/context/ai): found ${coreOrphans.length}`, coreOrphans.length === 0);
if (coreOrphans.length > 0) {
  console.log(`    Orphans: ${coreOrphans.join(", ")}`);
}

// ════════════════════════════════════════
// Group 6: Variable Injection Test
// ════════════════════════════════════════
console.log("\n📋 Group 6: Variable Injection Test");
console.log("─────────────────────────────────────");

const sampleData = {
  "company.company_name": "عيادة النور",
  "company.phone": "+966501234567",
  "company.signature": "مع تحيات فريق عيادة النور",
  "company.address": "الرياض - حي الملقا",
  "company.website": "https://alnoor.sa",
  "company.working_hours": "السبت-الخميس 9ص-9م",
  "customer.name": "محمد الأحمدي",
  "customer.phone": "+966551234567",
  "context.greeting": "صباح الخير",
  "complaint.number": "SH-001",
  "invoice.number": "INV-2026-001",
  "invoice.amount": "1,500",
  "invoice.due_date": "2026-03-01",
  "invoice.days_overdue": "7",
  "appointment.date": "2026-03-05",
  "appointment.time": "10:00",
  "appointment.day": "الخميس"
};

function injectVars(text, data) {
  let result = text;
  Object.entries(data).forEach(([key, val]) => {
    result = result.replace(new RegExp(`\\{\\{${key.replace(".", "\\.")}\\}\\}`, "g"), val);
  });
  return result;
}

// Test injection on clinic welcome
const clinicWelcome = messageFiles.clinic ? messageFiles.clinic.templates.welcome.text : "";
const injected = injectVars(clinicWelcome, sampleData);
test("Injection: clinic welcome resolves company_name", injected.includes("عيادة النور"));
test("Injection: clinic welcome resolves customer name", injected.includes("محمد الأحمدي"));
test("Injection: clinic welcome resolves greeting", injected.includes("صباح الخير"));
test("Injection: no unresolved {{company.*}} vars", !injected.match(/\{\{company\./));
test("Injection: no unresolved {{customer\./}} vars", !injected.match(/\{\{customer\./));
test("Injection: no unresolved {{context\./}} vars", !injected.match(/\{\{context\./));

// Test injection on complaint ack
const clinicComplaint = messageFiles.clinic ? messageFiles.clinic.templates.complaint_ack.text : "";
const injectedComplaint = injectVars(clinicComplaint, sampleData);
test("Injection: complaint_ack resolves complaint number", injectedComplaint.includes("SH-001"));

// ════════════════════════════════════════
// Group 7: Saudi Dialect Check
// ════════════════════════════════════════
console.log("\n📋 Group 7: Saudi Dialect & Arabic Quality");
console.log("─────────────────────────────────────");

let allArabic = true;
let noEnglishSentences = true;

INDUSTRIES.forEach(ind => {
  if (!messageFiles[ind]) return;
  Object.values(messageFiles[ind].templates).forEach(tmpl => {
    const textNoVars = tmpl.text.replace(/\{\{[^}]+\}\}/g, "");
    const textNoEmoji = textNoVars.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");
    const textClean = textNoEmoji.replace(/[:\n\-\+\d\s📊💰📄👥🔥🟡🔵📅⏰📍📦🛍️🏗️📋🎓💚🍽️⭐✅🙏💡]/g, "");
    // Check for long English sequences (more than 3 consecutive English words)
    const engMatch = textClean.match(/[a-zA-Z]{4,}\s+[a-zA-Z]{4,}\s+[a-zA-Z]{4,}/);
    if (engMatch) noEnglishSentences = false;
    // Check has Arabic characters
    const hasArabic = /[\u0600-\u06FF]/.test(textClean);
    if (!hasArabic && textClean.trim().length > 0) allArabic = false;
  });
});

test("All templates contain Arabic text", allArabic);
test("No English sentences in templates (vars/URLs excluded)", noEnglishSentences);

// Check for Saudi dialect markers
let hasSaudiDialect = false;
const saudiMarkers = ["نبي", "أبي", "تبي", "يبي", "وش", "بنتواصل", "بنرد", "بنجهز", "الحين", "بكرة", "هالرسالة", "نحن هنا", "بنرسل", "بنحل", "بنراجع"];
INDUSTRIES.forEach(ind => {
  if (!messageFiles[ind]) return;
  const allText = Object.values(messageFiles[ind].templates).map(t => t.text).join(" ");
  if (saudiMarkers.some(m => allText.includes(m))) hasSaudiDialect = true;
});
test("Templates contain Saudi dialect markers", hasSaudiDialect);

// ════════════════════════════════════════
// Group 8: Sheets Configuration
// ════════════════════════════════════════
console.log("\n📋 Group 8: Sheets Configuration");
console.log("─────────────────────────────────────");

test("sheets-config.json exists and loads", sheetsConfig !== null);
test("Has base_sheets defined", sheetsConfig && sheetsConfig.base_sheets && Object.keys(sheetsConfig.base_sheets).length >= 4);
test("Has industry_extensions for all 7 industries", 
  sheetsConfig && sheetsConfig.industry_extensions && INDUSTRIES.every(ind => sheetsConfig.industry_extensions[ind]));
test("Has column_types defined", sheetsConfig && sheetsConfig.column_types && Object.keys(sheetsConfig.column_types).length > 0);

// Check base sheets match flows
const baseSheets = sheetsConfig ? sheetsConfig.base_sheets : {};
test("Base sheet 'leads' has columns matching lead-capture flow", 
  baseSheets.leads && baseSheets.leads.columns.includes("الاسم") && baseSheets.leads.columns.includes("الجوال"));
test("Base sheet 'invoices' has columns matching invoice-collection flow", 
  baseSheets.invoices && baseSheets.invoices.columns.includes("رقم_الفاتورة") && baseSheets.invoices.columns.includes("المبلغ"));
test("Base sheet 'complaints' has columns matching complaint-handling flow", 
  baseSheets.complaints && baseSheets.complaints.columns.includes("رقم_الشكوى") && baseSheets.complaints.columns.includes("الخطورة"));

// ════════════════════════════════════════
// Group 9: AI Prompts Library
// ════════════════════════════════════════
console.log("\n📋 Group 9: AI Prompts Library");
console.log("─────────────────────────────────────");

test("prompts-library.json exists and loads", promptsLib !== null);
test("Has prompts object", promptsLib && promptsLib.prompts && Object.keys(promptsLib.prompts).length > 0);

const requiredPrompts = ["classify_lead", "classify_complaint", "weekly_summary", "auto_reply"];
requiredPrompts.forEach(p => {
  test(`Prompt '${p}' exists`, promptsLib && promptsLib.prompts && promptsLib.prompts[p]);
});

// Check prompt structure
let allPromptsValid = true;
if (promptsLib && promptsLib.prompts) {
  Object.entries(promptsLib.prompts).forEach(([key, prompt]) => {
    if (!prompt.system_prompt || !prompt.user_prompt_template || !prompt.model) {
      allPromptsValid = false;
    }
    if (!prompt.fallback_on_failure) {
      allPromptsValid = false;
    }
  });
}
test("All prompts have system_prompt + user_prompt_template + model + fallback", allPromptsValid);

// Check classify_lead has industry additions for all 7
test("classify_lead has industry_additions for all 7 industries",
  promptsLib && promptsLib.prompts.classify_lead && 
  promptsLib.prompts.classify_lead.industry_additions &&
  INDUSTRIES.every(ind => promptsLib.prompts.classify_lead.industry_additions[ind]));

// Check classify_complaint has industry additions
test("classify_complaint has industry_additions for all 7 industries",
  promptsLib && promptsLib.prompts.classify_complaint && 
  promptsLib.prompts.classify_complaint.industry_additions &&
  INDUSTRIES.every(ind => promptsLib.prompts.classify_complaint.industry_additions[ind]));

// Check safety
test("Prompts library has banned_words list", promptsLib && promptsLib.banned_words && promptsLib.banned_words.length > 0);
test("auto_reply prompt has safety_check", 
  promptsLib && promptsLib.prompts.auto_reply && promptsLib.prompts.auto_reply.safety_check);

// ════════════════════════════════════════
// Group 10: Cross-Reference with Flows
// ════════════════════════════════════════
console.log("\n📋 Group 10: Cross-Reference with Flows");
console.log("─────────────────────────────────────");

// Load flows to check template references
const flowsDir = path.join(BASE, "data/flows");
const flowFiles = fs.readdirSync(flowsDir).filter(f => f.endsWith(".json"));
const flows = {};
flowFiles.forEach(f => {
  flows[f.replace(".json", "")] = loadJSON(path.join(flowsDir, f));
});

// Check that flow-referenced template types exist
test("lead-capture flow references templates.welcome — template exists for all industries",
  INDUSTRIES.every(ind => messageFiles[ind] && messageFiles[ind].templates.welcome));

test("customer-journey flow uses follow_up — templates exist",
  INDUSTRIES.every(ind => messageFiles[ind] && messageFiles[ind].templates.follow_up_day3 && messageFiles[ind].templates.follow_up_day7));

test("complaint-handling flow uses complaint_ack — template exists",
  INDUSTRIES.every(ind => messageFiles[ind] && messageFiles[ind].templates.complaint_ack));

// Check flow industry_variants reference valid industries
let allVariantsValid = true;
Object.entries(flows).forEach(([name, flow]) => {
  if (flow.industry_variants) {
    Object.keys(flow.industry_variants).forEach(ind => {
      if (!INDUSTRIES.includes(ind)) {
        allVariantsValid = false;
      }
    });
  }
});
test("All flow industry_variants reference valid industries", allVariantsValid);

// Check sheets config covers flow sheets
const flowSheetNames = new Set();
Object.values(flows).forEach(flow => {
  if (flow.sheets_template && flow.sheets_template.name) {
    flowSheetNames.add(flow.sheets_template.name);
  }
});
test(`Sheets config covers flow sheet types (flows use: ${[...flowSheetNames].join(", ")})`,
  sheetsConfig && sheetsConfig.base_sheets && 
  [...flowSheetNames].every(name => {
    return Object.values(sheetsConfig.base_sheets).some(s => s.name_ar === name);
  }));

// ════════════════════════════════════════
// Group 11: Variable Completeness
// ════════════════════════════════════════
console.log("\n📋 Group 11: Variable Completeness");
console.log("─────────────────────────────────────");

// Check all company vars referenced in flows exist in company.json
const flowCompanyVars = new Set();
Object.values(flows).forEach(flow => {
  const flowStr = JSON.stringify(flow);
  const matches = flowStr.match(/\{\{company\.[^}]+\}\}/g) || [];
  matches.forEach(m => {
    const key = m.replace(/[{}]/g, "");
    flowCompanyVars.add(key);
  });
});

const missingCompanyVars = [];
flowCompanyVars.forEach(v => {
  // Skip function-like references (e.g., company.customer_phone_lookup(...))
  if (v.includes("(")) return;
  if (!companyVarKeys.includes(v)) {
    missingCompanyVars.push(v);
  }
});
test(`All flow company.* vars defined in company.json (missing: ${missingCompanyVars.length})`, missingCompanyVars.length === 0);
if (missingCompanyVars.length > 0) {
  console.log(`    Missing: ${missingCompanyVars.join(", ")}`);
}

// Check required vars have validation rules
let allRequiredHaveValidation = true;
REQUIRED_VAR_FILES.forEach(v => {
  if (!varFiles[v] || !varFiles[v].variables) return;
  Object.values(varFiles[v].variables).forEach(variable => {
    if (variable.required && !variable.validation && !variable.source?.includes("computed")) {
      // Only company and customer vars need validation
      if (["company", "customer"].includes(v)) {
        allRequiredHaveValidation = false;
      }
    }
  });
});
test("All required company/customer vars have validation rules", allRequiredHaveValidation);

// ═══════════════════════════════════════
// Summary
// ═══════════════════════════════════════
console.log("\n═══════════════════════════════════════════");
console.log(`  Results: ${passed}/${total} passed`);
if (failed === 0) {
  console.log("  ✅ ALL TESTS PASSED");
} else {
  console.log(`  ❌ ${failed} TESTS FAILED`);
}
console.log("═══════════════════════════════════════════");

// Stats
console.log("\n📊 Phase 4 Stats:");
console.log(`  Industries: ${INDUSTRIES.length}`);
console.log(`  Message templates: ${totalMessages}`);
console.log(`  Variable files: ${REQUIRED_VAR_FILES.length}`);
console.log(`  Defined variables: ${allDefinedVars.size}`);
console.log(`  AI prompts: ${promptsLib ? Object.keys(promptsLib.prompts).length : 0}`);
console.log(`  Sheet types: ${sheetsConfig ? Object.keys(sheetsConfig.base_sheets).length : 0}`);

process.exit(failed > 0 ? 1 : 0);
