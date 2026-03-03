const path = require("path");
const __BASE = path.join(__dirname, "..");
const fs = require("fs");

const errorMap = JSON.parse(fs.readFileSync(`${__BASE}/data/errors/error-map.json`, "utf8"));
const reg = JSON.parse(fs.readFileSync(`${__BASE}/data/registry/tools-full.json`, "utf8"));
const pieceIds = new Set(reg.pieces.map(p => p.id));

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
console.log("  Phase 5: Error Map Tests");
console.log("═══════════════════════════════════════════\n");

// Collect all errors
const allErrors = [];
const categories = errorMap.error_categories;
Object.values(categories).forEach(cat => {
  cat.errors.forEach(e => allErrors.push(e));
});

// ═══════════ GROUP 1: البنية ═══════════
console.log("📋 Group 1: البنية");
console.log("─────────────────────────────────────");

test("_metadata موجود", () => errorMap._metadata ? true : "مفقود");
test("error_categories موجود", () => Object.keys(categories).length >= 5 ? true : `${Object.keys(categories).length}`);
test("retry_strategies موجود", () => Object.keys(errorMap.retry_strategies).length >= 5 ? true : "ناقص");
test("error_to_user_message موجود", () => Object.keys(errorMap.error_to_user_message).length >= 20 ? true : `${Object.keys(errorMap.error_to_user_message).length}`);
test("أخطاء >= 20", () => allErrors.length >= 20 ? true : `${allErrors.length}`);

// ═══════════ GROUP 2: بنية كل خطأ ═══════════
console.log("\n📋 Group 2: بنية الأخطاء");
console.log("─────────────────────────────────────");

test("كل خطأ فيه code", () => {
  const bad = allErrors.filter(e => !e.code);
  return bad.length === 0 ? true : `${bad.length} بدون code`;
});

test("كل خطأ فيه message_ar + message_en", () => {
  const bad = allErrors.filter(e => !e.message_ar || !e.message_en);
  return bad.length === 0 ? true : `${bad.length} ناقص`;
});

test("كل خطأ فيه frequency", () => {
  const bad = allErrors.filter(e => !["high", "medium", "low"].includes(e.frequency));
  return bad.length === 0 ? true : bad.map(e => e.code).join(", ");
});

test("أكواد فريدة بلا تكرار", () => {
  const codes = allErrors.map(e => e.code);
  const dupes = codes.filter((v, i) => codes.indexOf(v) !== i);
  return dupes.length === 0 ? true : `مكرر: ${dupes}`;
});

// ═══════════ GROUP 3: الأدوات المتأثرة ═══════════
console.log("\n📋 Group 3: الأدوات المتأثرة");
console.log("─────────────────────────────────────");

test("affected_pieces تشير لأدوات حقيقية", () => {
  const bad = [];
  allErrors.forEach(e => {
    (e.affected_pieces || []).forEach(pid => {
      if (pid !== "*" && !pieceIds.has(pid)) bad.push(`${e.code}→${pid}`);
    });
  });
  return bad.length === 0 ? true : bad.join(", ");
});

test("AUTH_TOKEN_EXPIRED يشمل google-sheets + gmail", () => {
  const e = allErrors.find(e => e.code === "AUTH_TOKEN_EXPIRED");
  return e && e.affected_pieces.includes("google-sheets") && e.affected_pieces.includes("gmail") ? true : "ناقص";
});

test("RATE_LIMIT_EXCEEDED يشمل openai + slack", () => {
  const e = allErrors.find(e => e.code === "RATE_LIMIT_EXCEEDED");
  return e && e.affected_pieces.includes("openai") && e.affected_pieces.includes("slack") ? true : "ناقص";
});

test("INVALID_PHONE_FORMAT يشمل whatsapp + twilio", () => {
  const e = allErrors.find(e => e.code === "INVALID_PHONE_FORMAT");
  return e && e.affected_pieces.includes("whatsapp") && e.affected_pieces.includes("twilio") ? true : "ناقص";
});

// ═══════════ GROUP 4: Auto-Fix ═══════════
console.log("\n📋 Group 4: الإصلاح التلقائي");
console.log("─────────────────────────────────────");

const withFix = allErrors.filter(e => e.auto_fix);
const withoutFix = allErrors.filter(e => !e.auto_fix);

test(`>= 15 أخطاء فيها auto_fix`, () => withFix.length >= 15 ? true : `${withFix.length}`);

test("كل auto_fix فيه strategy + steps", () => {
  const bad = withFix.filter(e => !e.auto_fix.strategy || !e.auto_fix.steps || e.auto_fix.steps.length === 0);
  return bad.length === 0 ? true : bad.map(e => e.code).join(", ");
});

test("بدون auto_fix فيهم user_action", () => {
  const bad = withoutFix.filter(e => !e.user_action);
  return bad.length === 0 ? true : bad.map(e => e.code).join(", ");
});

test("RATE_LIMIT: exponential_backoff + max_retries", () => {
  const e = allErrors.find(e => e.code === "RATE_LIMIT_EXCEEDED");
  return e?.auto_fix?.strategy === "exponential_backoff" && e?.auto_fix?.max_retries >= 3 ? true : "خطأ";
});

test("AUTH_TOKEN_EXPIRED: refresh_token strategy", () => {
  const e = allErrors.find(e => e.code === "AUTH_TOKEN_EXPIRED");
  return e?.auto_fix?.strategy === "refresh_token" ? true : "خطأ";
});

test("INVALID_PHONE_FORMAT: phone_normalization + SA patterns", () => {
  const e = allErrors.find(e => e.code === "INVALID_PHONE_FORMAT");
  return e?.auto_fix?.strategy === "phone_normalization" && e?.auto_fix?.sa_patterns ? true : "ناقص";
});

test("DUPLICATE_RECORD: find_and_update strategy", () => {
  const e = allErrors.find(e => e.code === "DUPLICATE_RECORD");
  return e?.auto_fix?.strategy === "find_and_update" ? true : "خطأ";
});

// ═══════════ GROUP 5: Retry Strategies ═══════════
console.log("\n📋 Group 5: استراتيجيات إعادة المحاولة");
console.log("─────────────────────────────────────");

const strategies = errorMap.retry_strategies;

test("refresh_token strategy", () => strategies.refresh_token ? true : "مفقود");
test("exponential_backoff strategy", () => strategies.exponential_backoff ? true : "مفقود");
test("phone_normalization مع rules", () => strategies.phone_normalization?.rules?.length >= 3 ? true : "ناقص");
test("كل strategy فيها applicable_codes", () => {
  const bad = Object.entries(strategies).filter(([k, v]) => !v.applicable_codes || v.applicable_codes.length === 0);
  return bad.length === 0 ? true : bad.map(([k]) => k).join(", ");
});
test("applicable_codes تشير لأكواد حقيقية", () => {
  const allCodes = new Set(allErrors.map(e => e.code));
  const bad = [];
  Object.entries(strategies).forEach(([sname, s]) => {
    (s.applicable_codes || []).forEach(code => {
      if (!allCodes.has(code)) bad.push(`${sname}→${code}`);
    });
  });
  return bad.length === 0 ? true : bad.join(", ");
});

// ═══════════ GROUP 6: رسائل المستخدم ═══════════
console.log("\n📋 Group 6: رسائل المستخدم");
console.log("─────────────────────────────────────");

const messages = errorMap.error_to_user_message;

test("كل كود خطأ فيه رسالة مستخدم", () => {
  const codes = allErrors.map(e => e.code);
  const missing = codes.filter(c => !messages[c]);
  return missing.length === 0 ? true : `ناقص: ${missing.join(", ")}`;
});

test("كل الرسائل بالعربي", () => {
  const bad = Object.entries(messages).filter(([k, v]) => !/[\u0600-\u06FF]/.test(v));
  return bad.length === 0 ? true : bad.map(([k]) => k).join(", ");
});

test("رسائل فيها {piece_name} placeholder", () => {
  const withPlaceholder = Object.values(messages).filter(m => m.includes("{piece_name}"));
  return withPlaceholder.length >= 5 ? true : `${withPlaceholder.length}`;
});

// ═══════════ GROUP 7: الفئات ═══════════
console.log("\n📋 Group 7: الفئات");
console.log("─────────────────────────────────────");

const expectedCats = ["auth", "rate_limit", "not_found", "validation", "connection", "permission", "flow_engine", "data"];
test("كل الفئات المتوقعة موجودة", () => {
  const missing = expectedCats.filter(c => !categories[c]);
  return missing.length === 0 ? true : `ناقص: ${missing.join(", ")}`;
});

test("كل فئة فيها display_name + display_name_en", () => {
  const bad = Object.entries(categories).filter(([k, v]) => !v.display_name || !v.display_name_en);
  return bad.length === 0 ? true : bad.map(([k]) => k).join(", ");
});

test("كل فئة فيها >= 1 خطأ", () => {
  const bad = Object.entries(categories).filter(([k, v]) => v.errors.length === 0);
  return bad.length === 0 ? true : bad.map(([k]) => k).join(", ");
});

// ═══════════ GROUP 8: HTTP Status Codes ═══════════
console.log("\n📋 Group 8: HTTP Status Codes");
console.log("─────────────────────────────────────");

test("401 errors موجودة", () => allErrors.some(e => e.http_status === 401) ? true : "مفقود");
test("403 errors موجودة", () => allErrors.some(e => e.http_status === 403) ? true : "مفقود");
test("404 errors موجودة", () => allErrors.some(e => e.http_status === 404) ? true : "مفقود");
test("429 errors موجودة", () => allErrors.some(e => e.http_status === 429) ? true : "مفقود");
test("400 errors موجودة", () => allErrors.some(e => e.http_status === 400) ? true : "مفقود");
test("أخطاء بدون HTTP (flow_engine)", () => allErrors.some(e => e.http_status === null) ? true : "مفقود");

// ═══════════ GROUP 9: السعودية ═══════════
console.log("\n📋 Group 9: تخصيص سعودي");
console.log("─────────────────────────────────────");

test("تطبيع الجوال: 05 → +966", () => {
  const e = allErrors.find(e => e.code === "INVALID_PHONE_FORMAT");
  const patterns = e?.auto_fix?.sa_patterns;
  return patterns?.["05xxxxxxxx"] === "+9665xxxxxxxx" ? true : "مفقود";
});

test("timezone السعودية في التواريخ", () => {
  const e = allErrors.find(e => e.code === "INVALID_DATE_FORMAT");
  return e?.auto_fix?.steps?.some(s => s.includes("+3") || s.includes("AST") || s.includes("السعودية")) ? true : "مفقود";
});

test("حدود Rate limit لكل أداة", () => {
  const e = allErrors.find(e => e.code === "RATE_LIMIT_EXCEEDED");
  return e?.per_piece_limits && Object.keys(e.per_piece_limits).length >= 5 ? true : "ناقص";
});

test("حدود حجم البيانات محددة", () => {
  const e = allErrors.find(e => e.code === "PAYLOAD_TOO_LARGE");
  return e?.auto_fix?.size_limits && Object.keys(e.auto_fix.size_limits).length >= 3 ? true : "ناقص";
});

// ═══════════ RESULTS ═══════════
console.log("\n═══════════════════════════════════════════");
console.log(`  النتيجة: ${passed}/${total} نجحت`);
if (failed > 0) console.log(`  ❌ ${failed} فشلت`);
else console.log(`  ✅ كل الاختبارات نجحت!`);
console.log("═══════════════════════════════════════════");

console.log(`\n📊 Phase 5 Stats:`);
console.log(`  فئات: ${Object.keys(categories).length}`);
console.log(`  أخطاء: ${allErrors.length}`);
console.log(`  مع auto_fix: ${withFix.length}`);
console.log(`  بدون auto_fix: ${withoutFix.length}`);
console.log(`  استراتيجيات: ${Object.keys(strategies).length}`);
console.log(`  رسائل مستخدم: ${Object.keys(messages).length}`);

process.exit(failed > 0 ? 1 : 0);
