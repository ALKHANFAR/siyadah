#!/usr/bin/env node
/**
 * سيادة — اختبار سريع وعميق (الدرجة الثانية)
 * التشغيل: node quick-test.js
 * أو مع Railway: node quick-test.js https://hearty-cat-production.up.railway.app
 */
const TARGET = process.argv[2];
const C = { reset:"\x1b[0m", bold:"\x1b[1m", dim:"\x1b[2m", green:"\x1b[32m", red:"\x1b[31m", cyan:"\x1b[36m", magenta:"\x1b[35m", white:"\x1b[37m", bgGreen:"\x1b[42m", bgRed:"\x1b[41m" };
let passed=0, failed=0, total=0; const failures=[];

function test(name, fn) {
  total++;
  try { const r = fn(); if (r===true) { passed++; process.stdout.write(`  ${C.green}✅${C.reset} ${name}\n`); } else { failed++; failures.push({name,error:String(r)}); process.stdout.write(`  ${C.red}❌${C.reset} ${name}: ${C.dim}${r}${C.reset}\n`); } }
  catch(e) { failed++; failures.push({name,error:e.message}); process.stdout.write(`  ${C.red}❌${C.reset} ${name}: ${C.dim}${e.message}${C.reset}\n`); }
}

async function testA(name, fn) {
  total++;
  try { const r = await fn(); if (r===true) { passed++; process.stdout.write(`  ${C.green}✅${C.reset} ${name}\n`); } else { failed++; failures.push({name,error:String(r)}); process.stdout.write(`  ${C.red}❌${C.reset} ${name}: ${C.dim}${r}${C.reset}\n`); } }
  catch(e) { failed++; failures.push({name,error:e.message}); process.stdout.write(`  ${C.red}❌${C.reset} ${name}: ${C.dim}${e.message}${C.reset}\n`); }
}

function header(icon, title) { console.log(`\n${C.bold}${C.magenta}${icon} ${title}${C.reset}\n${C.dim}─────────────────────────────────────${C.reset}`); }

function runLocalTests() {
  const t0 = Date.now();
  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  👑 سيادة — اختبار الدرجة الثانية${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}`);

  let pipeline, id, ts, fb, val, adapt;
  try {
    pipeline = require("./engine/pipeline");
    id = require("./engine/intent-detector");
    ts = require("./engine/tool-selector");
    fb = require("./engine/flow-builder");
    val = require("./engine/validator");
    adapt = require("./engine/ap-adapter");
  } catch(e) { console.log(`\n${C.red}  ❌ فشل تحميل: ${e.message}${C.reset}\n${C.dim}  تأكد إنك داخل مجلد المشروع${C.reset}\n`); process.exit(1); }

  // ═══ 1. Intent Detection ═══
  header("🧠", "فهم النوايا — 10 جمل سعودية");
  const intents = [
    ["أبي أجذب عملاء","lead_capture"],
    ["مريض يبي يحجز كشف أسنان بكرة","appointment_book"],
    ["أرسل فاتورة 500 ريال للعميل","invoice_send"],
    ["ذكّر المرضى قبل مواعيدهم بساعة","appointment_remind"],
    ["أبي تقرير أسبوعي بأداء الفريق",["report_weekly","report_custom"]],
    ["عميل يشتكي من تأخر الطلب","support_ticket"],
    ["أرسل واتساب ترحيبي للعملاء الجدد",["notify_whatsapp","lead_capture","campaign_email"]],
    ["لما يجي أوردر جديد أبلّغ الفريق",["order_new","notify_whatsapp","lead_capture"]],
    ["أبي تقرير يومي بعدد العملاء",["report_daily","report_custom"]],
    ["رد تلقائي على شكاوى العملاء",["support_auto_reply","support_ticket"]],
  ];
  for (const [txt, exp] of intents) {
    test(`"${txt}"`, () => {
      const r = id.analyzeRequest(txt);
      const i = r.primary_intent?.intent || r.primary_intent;
      if (Array.isArray(exp)) return exp.includes(i) ? true : `→ ${i}`;
      return i === exp ? true : `→ ${i}`;
    });
  }

  // ═══ 2. Entities ═══
  header("🔍", "استخراج الكيانات");
  test("مبلغ: 500 ريال", () => { const r = id.analyzeRequest("فاتورة 500 ريال"); return (r.entities||[]).some(e => e.type==="amount") ? true : "لا مبلغ"; });
  test("رقم: 0501234567", () => { const r = id.analyzeRequest("واتساب 0501234567"); return (r.entities||[]).some(e => e.type==="phone") ? true : "لا رقم"; });
  test("أداة: واتساب", () => { const r = id.analyzeRequest("أرسل على الواتساب"); return (r.entities||[]).some(e => e.type==="tool") ? true : "لا أداة"; });
  test("كيانات متعددة", () => { const r = id.analyzeRequest("فاتورة 500 ريال 0501234567"); const t = (r.entities||[]).map(e=>e.type); return t.includes("phone") && t.includes("amount") ? true : t.join(","); });

  // ═══ 3. Tool Selection ═══
  header("🔧", "اختيار الأدوات");
  test("webhook trigger لـ عميل جديد", () => { const r = ts.selectTools(id.analyzeRequest("عميل جديد يتواصل")); return r.trigger?.piece==="webhook" ? true : r.trigger?.piece; });
  test("schedule trigger لـ تقرير يومي", () => { const r = ts.selectTools(id.analyzeRequest("تقرير يومي")); return r.trigger?.piece==="schedule" ? true : r.trigger?.piece; });
  test("Sheets + WhatsApp لـ lead", () => { const r = ts.selectTools(id.analyzeRequest("أجذب عملاء")); const p = (r.steps||[]).map(s=>s.piece); return p.includes("google-sheets") && p.includes("whatsapp") ? true : p.join(","); });
  test("كل step verified", () => { const r = ts.selectTools(id.analyzeRequest("عميل جديد")); const bad = (r.steps||[]).filter(s=>!s.verified); return bad.length===0 ? true : bad.map(s=>s.piece).join(","); });

  // ═══ 4. Flow Builder ═══
  header("🏗️", "بناء التدفقات");
  test("metadata + total_steps", () => { const r = fb.buildFlow(ts.selectTools(id.analyzeRequest("حجز موعد"))); const m = r.flow?._metadata; return m?.intent && m.total_steps>0 ? true : `${m?.intent}/${m?.total_steps}`; });
  test("trigger: piece_id + trigger_name", () => { const r = fb.buildFlow(ts.selectTools(id.analyzeRequest("عميل جديد"))); const t = r.flow?.trigger; return t?.piece_id && t?.trigger_name ? true : "ناقص"; });
  test("steps: piece_id + action_name", () => { const r = fb.buildFlow(ts.selectTools(id.analyzeRequest("فاتورة"))); return (r.flow?.steps||[]).every(s=>s.piece_id&&s.action_name) && r.flow.steps.length>0 ? true : "ناقص"; });
  test("error_handlers تلقائية", () => { const r = fb.buildFlow(ts.selectTools(id.analyzeRequest("حجز كشف"))); return (r.flow?.error_handlers?.length||0)>0 ? true : "صفر"; });
  test("trigger_type: instant/scheduled", () => { const r1 = fb.buildFlow(ts.selectTools(id.analyzeRequest("عميل جديد يتواصل"))); const r2 = fb.buildFlow(ts.selectTools(id.analyzeRequest("تقرير يومي"))); return r1.flow?.trigger?.trigger_type==="instant" && r2.flow?.trigger?.trigger_type==="scheduled" ? true : `${r1.flow?.trigger?.trigger_type}/${r2.flow?.trigger?.trigger_type}`; });

  // ═══ 5. Validator ═══
  header("🛡️", "المحقق — 5 بوابات");
  test("5 بوابات تمر", () => { const v = val.validateFlow(fb.buildFlow(ts.selectTools(id.analyzeRequest("حجز موعد")))); return v.valid ? true : `errors:${v.total_errors}`; });
  test("5 سيناريوهات valid", () => { let ok=0; for (const t of ["عميل جديد","فاتورة","تقرير يومي","واتساب","حجز موعد"]) { if (val.validateFlow(fb.buildFlow(ts.selectTools(id.analyzeRequest(t)))).valid) ok++; } return ok===5 ? true : `${ok}/5`; });

  // ═══ 6. AP Adapter ═══
  header("🔗", "AP Adapter — الأسماء المثبتة");
  test("catch_hook → catch_webhook", () => { const r = adapt.adaptFlowForAP({trigger:{piece_id:"webhook",trigger_name:"catch_hook"},steps:[]}); return r.trigger?.settings?.triggerName==="catch_webhook" ? true : r.trigger?.settings?.triggerName; });
  test("@activepieces/piece-* prefix", () => { const r = adapt.adaptFlowForAP({trigger:{piece_id:"webhook",trigger_name:"catch_webhook"},steps:[{piece_id:"gmail",action_name:"send_email",settings:{}}]}); return r.trigger?.settings?.pieceName?.startsWith("@activepieces/piece-") && r.actions?.[0]?.settings?.pieceName?.startsWith("@activepieces/piece-") ? true : "prefix غلط"; });
  test("webhook ~0.1.29", () => { const r = adapt.adaptFlowForAP({trigger:{piece_id:"webhook",trigger_name:"catch_webhook"},steps:[]}); return r.trigger?.settings?.pieceVersion==="~0.1.29" ? true : r.trigger?.settings?.pieceVersion; });
  test("Gmail: body_type + draft", () => { const r = adapt.adaptFlowForAP({trigger:{piece_id:"webhook",trigger_name:"catch_webhook"},steps:[{piece_id:"gmail",action_name:"send_email",settings:{}}]}); const i = r.actions?.[0]?.settings?.input||{}; return i.body_type==="plain_text" && i.draft===false ? true : `${i.body_type}/${i.draft}`; });
  test("Sheets: includeTeamDrives + first_row_headers", () => { const r = adapt.adaptFlowForAP({trigger:{piece_id:"webhook",trigger_name:"catch_webhook"},steps:[{piece_id:"google-sheets",action_name:"insert_row",settings:{}}]}); const i = r.actions?.[0]?.settings?.input||{}; return i.includeTeamDrives===false && i.first_row_headers===true ? true : `${i.includeTeamDrives}/${i.first_row_headers}`; });

  // ═══ 7. Full Pipeline ═══
  header("⚡", "Pipeline كامل — E2E");
  test("E2E → ready + flow + ap_format", () => { const r = pipeline.executePipeline("أبي أجذب عملاء جدد"); return r.success && r.stage_reached==="ready" && r.flow && r.ap_format ? true : `stage:${r.stage_reached}`; });
  test("< 50ms", () => { const r = pipeline.executePipeline("حجز موعد"); return r.execution_time_ms<50 ? true : `${r.execution_time_ms}ms`; });
  test("نص فارغ → فشل آمن", () => { const r = pipeline.executePipeline(""); return !r.success ? true : "ما فشل!"; });
  test("AP trigger = PIECE_TRIGGER", () => { const r = pipeline.executePipeline("عميل جديد"); return r.ap_format?.trigger?.type==="PIECE_TRIGGER" ? true : r.ap_format?.trigger?.type; });
  test("AP triggerName = catch_webhook", () => { const r = pipeline.executePipeline("عميل جديد يتواصل"); return r.ap_format?.trigger?.settings?.triggerName==="catch_webhook" ? true : "غلط"; });
  test("AP actions chain (nextAction)", () => { const r = pipeline.executePipeline("أبي أجذب عملاء"); const a = r.ap_format?.actions||[]; if (a.length<2) return `فقط ${a.length}`; for (let i=0;i<a.length-1;i++) if (!a[i].nextAction) return `action ${i} بدون chain`; return true; });
  test("10 طلبات سعودية → 10/10", () => { let ok=0; for (const t of ["أجذب عملاء","حجز موعد","فاتورة","تقرير يومي","واتساب","عميل يشتكي","متابعة مبيعات","رد تلقائي","عميل جديد","تقرير أسبوعي"]) if (pipeline.executePipeline(t).success) ok++; return ok===10 ? true : `${ok}/10`; });
  test("healthCheck → healthy", () => pipeline.healthCheck().healthy ? true : "unhealthy");

  // ═══ Results ═══
  const ms = Date.now()-t0;
  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}`);
  if (failed===0) console.log(`  ${C.bgGreen}${C.white}${C.bold}  ✅ ${passed}/${total} — الدرجة الثانية نجحت!  ${C.reset}`);
  else { console.log(`  ${C.bgRed}${C.white}${C.bold}  ❌ ${passed}/${total} — ${failed} فشلت  ${C.reset}`); console.log(); for (const f of failures) console.log(`    ${C.red}•${C.reset} ${f.name}: ${C.dim}${f.error}${C.reset}`); }
  console.log(`  ${C.dim}${ms}ms${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}\n`);
}

// ═══ Remote ═══
async function runRemote() {
  const http = TARGET.startsWith("https") ? require("https") : require("http");
  function fetch(url,opts) { return new Promise((ok,no) => { const u=new URL(url); const o={hostname:u.hostname,port:u.port||(u.protocol==="https:"?443:80),path:u.pathname+u.search,method:opts?.method||"GET",headers:{"Content-Type":"application/json"},timeout:15000}; const q=http.request(o,r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>{try{ok(JSON.parse(d))}catch{ok({_raw:d})}})});q.on("error",no);q.on("timeout",()=>{q.destroy();no(new Error("timeout"))});if(opts?.body)q.write(opts.body);q.end(); }); }
  const GET=p=>fetch(TARGET+p); const POST=(p,d)=>fetch(TARGET+p,{method:"POST",body:JSON.stringify(d)});

  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  👑 سيادة — اختبار سيرفر${C.reset}  ${C.dim}${TARGET}${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}`);
  header("🔌","الاتصال");
  await testA("Health", async()=>{const r=await GET("/health"); return r.status==="ok"?true:r.status;});
  await testA("AP Health", async()=>{const r=await GET("/api/ap/health"); return r.success!==false?true:r.error;});
  await testA("AP Login", async()=>{const r=await GET("/api/ap/check"); return r.connected===true?true:r.error;});
  header("⚡","Pipeline");
  await testA("أجذب عملاء → ready", async()=>{const r=await POST("/pipeline",{text:"أبي أجذب عملاء"}); return r.success&&r.stage_reached==="ready"?true:`stage:${r.stage_reached}`;});
  await testA("catch_webhook", async()=>{const r=await POST("/pipeline",{text:"عميل جديد"}); return r.ap_format?.trigger?.settings?.triggerName==="catch_webhook"?true:"wrong";});
  await testA("Chat API", async()=>{const r=await POST("/api/chat",{tenantId:"test",message:"أبي عملاء"}); return (r.reply||r.message||r.response)?true:"no reply";});
  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}`);
  if(failed===0) console.log(`  ${C.bgGreen}${C.white}${C.bold}  ✅ ${passed}/${total} نجحت  ${C.reset}`);
  else { console.log(`  ${C.bgRed}${C.white}${C.bold}  ❌ ${passed}/${total} — ${failed} فشلت  ${C.reset}`); for(const f of failures) console.log(`    ${C.red}•${C.reset} ${f.name}: ${C.dim}${f.error}${C.reset}`); }
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════${C.reset}\n`);
}

if(TARGET) runRemote().catch(e=>console.error(e.message)); else runLocalTests();
