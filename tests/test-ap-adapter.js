/**
 * سيادة — اختبار AP Adapter Layer
 * يتحقق من:
 *   1. تحويل trigger (catch_webhook مو catch_hook)
 *   2. تحويل actions (أسماء props صحيحة)
 *   3. fixProps (Gmail: receiver, body, body_type, draft)
 *   4. fixProps (Sheets: spreadsheetId, sheetId)
 *   5. Full adapt pipeline
 *   6. Connection needs extraction
 */

const { adaptFlowForAP, adaptTrigger, adaptAction, fixProps } = require("../engine/ap-adapter");
const { ActivePiecesClient } = require("../backend/services/activepieces");

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log("  ✅ " + name);
  } catch (e) {
    failed++;
    console.log("  🔴 " + name + " — " + e.message);
  }
}

function assert(val, msg) { if (!val) throw new Error(msg || "Assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || "") + " expected " + JSON.stringify(b) + " got " + JSON.stringify(a)); }

// ═══════════════════════════════════════
console.log("\n═══ 1. Trigger Adaptation ═══\n");
// ═══════════════════════════════════════

test("webhook trigger → catch_webhook (مو catch_hook)", function () {
  var t = adaptTrigger({ piece_id: "webhook", trigger_name: "catch_hook" });
  eq(t.settings.triggerName, "catch_webhook");
  eq(t.settings.pieceName, "@activepieces/piece-webhook");
  eq(t.type, "PIECE_TRIGGER");
});

test("webhook trigger → correct version", function () {
  var t = adaptTrigger({ piece_id: "webhook" });
  eq(t.settings.pieceVersion, "~0.1.29");
});

test("webhook trigger → valid:true", function () {
  var t = adaptTrigger({ piece_id: "webhook" });
  eq(t.valid, true);
});

test("webhook trigger → authType:none", function () {
  var t = adaptTrigger({ piece_id: "webhook" });
  eq(t.settings.input.authType, "none");
});

test("webhook trigger → propertySettings present", function () {
  var t = adaptTrigger({ piece_id: "webhook" });
  assert(t.settings.propertySettings, "missing propertySettings");
  assert(t.settings.propertySettings.authType, "missing authType in propertySettings");
});

test("null trigger → default webhook", function () {
  var t = adaptTrigger(null);
  eq(t.settings.triggerName, "catch_webhook");
});

test("schedule trigger → correct structure", function () {
  var t = adaptTrigger({ piece_id: "schedule", trigger_name: "every_day" });
  eq(t.settings.pieceName, "@activepieces/piece-schedule");
  eq(t.settings.triggerName, "every_day");
  eq(t.settings.pieceVersion, "~0.1.17");
});

test("schedule trigger → fixes wrong triggerName", function () {
  var t = adaptTrigger({ piece_id: "schedule", trigger_name: "catch_webhook" });
  eq(t.settings.triggerName, "every_day"); // Fixed!
});

test("gmail trigger → passes through", function () {
  var t = adaptTrigger({ piece_id: "gmail", trigger_name: "gmail_new_email_received" });
  eq(t.settings.pieceName, "@activepieces/piece-gmail");
  eq(t.settings.triggerName, "gmail_new_email_received");
});

// ═══════════════════════════════════════
console.log("\n═══ 2. Gmail Props Fix ═══\n");
// ═══════════════════════════════════════

test("Gmail: 'to' → 'receiver'", function () {
  var fixed = fixProps("gmail", "send_email", { to: "test@test.com", subject: "Hi" });
  assert(fixed.receiver, "missing receiver");
  assert(!fixed.to, "still has 'to'");
});

test("Gmail: 'body_text' → 'body'", function () {
  var fixed = fixProps("gmail", "send_email", { body_text: "Hello" });
  assert(fixed.body, "missing body");
  assert(!fixed.body_text, "still has body_text");
});

test("Gmail: adds body_type default", function () {
  var fixed = fixProps("gmail", "send_email", {});
  eq(fixed.body_type, "plain_text");
});

test("Gmail: adds draft default", function () {
  var fixed = fixProps("gmail", "send_email", {});
  eq(fixed.draft, false);
});

test("Gmail: receiver becomes Array", function () {
  var fixed = fixProps("gmail", "send_email", { receiver: "test@test.com" });
  assert(Array.isArray(fixed.receiver), "receiver should be Array");
  eq(fixed.receiver[0], "test@test.com");
});

test("Gmail: receiver Array stays Array", function () {
  var fixed = fixProps("gmail", "send_email", { receiver: ["a@b.com", "c@d.com"] });
  assert(Array.isArray(fixed.receiver));
  eq(fixed.receiver.length, 2);
});

test("Gmail: complete correct output", function () {
  var fixed = fixProps("gmail", "send_email", {
    to: "{{trigger.body.email}}",
    subject: "مرحباً",
    body_text: "شكراً لتواصلك",
  });
  assert(fixed.receiver, "has receiver");
  assert(Array.isArray(fixed.receiver), "receiver is Array");
  eq(fixed.receiver[0], "{{trigger.body.email}}");
  eq(fixed.subject, "مرحباً");
  eq(fixed.body, "شكراً لتواصلك");
  eq(fixed.body_type, "plain_text");
  eq(fixed.draft, false);
  assert(!fixed.to, "no 'to'");
  assert(!fixed.body_text, "no 'body_text'");
});

// ═══════════════════════════════════════
console.log("\n═══ 3. Google Sheets Props Fix ═══\n");
// ═══════════════════════════════════════

test("Sheets: 'spreadsheet_id' → 'spreadsheetId'", function () {
  var fixed = fixProps("google-sheets", "insert_row", { spreadsheet_id: "abc123" });
  assert(fixed.spreadsheetId, "missing spreadsheetId");
  assert(!fixed.spreadsheet_id, "still has spreadsheet_id");
});

test("Sheets: 'sheet_id' → 'sheetId'", function () {
  var fixed = fixProps("google-sheets", "insert_row", { sheet_id: "sheet1" });
  assert(fixed.sheetId, "missing sheetId");
  assert(!fixed.sheet_id, "still has sheet_id");
});

test("Sheets: adds defaults", function () {
  var fixed = fixProps("google-sheets", "insert_row", {});
  eq(fixed.includeTeamDrives, false);
  eq(fixed.first_row_headers, true);
});

// ═══════════════════════════════════════
console.log("\n═══ 4. WhatsApp Props Fix ═══\n");
// ═══════════════════════════════════════

test("WhatsApp: 'message' → 'text'", function () {
  var fixed = fixProps("whatsapp", "sendMessage", { message: "مرحبا" });
  assert(fixed.text, "missing text");
  assert(!fixed.message, "still has message");
});

test("WhatsApp: 'phone' → 'to'", function () {
  var fixed = fixProps("whatsapp", "sendMessage", { phone: "+966501234567" });
  assert(fixed.to, "missing to");
  assert(!fixed.phone, "still has phone");
});

// ═══════════════════════════════════════
console.log("\n═══ 5. OpenAI Props Fix ═══\n");
// ═══════════════════════════════════════

test("OpenAI: 'message' → 'prompt'", function () {
  var fixed = fixProps("openai", "ask_chatgpt", { message: "صنّف العميل" });
  assert(fixed.prompt, "missing prompt");
  assert(!fixed.message, "still has message");
});

test("OpenAI: adds model default", function () {
  var fixed = fixProps("openai", "ask_chatgpt", {});
  eq(fixed.model, "gpt-4o-mini");
});

// ═══════════════════════════════════════
console.log("\n═══ 6. Slack Props Fix ═══\n");
// ═══════════════════════════════════════

test("Slack: 'message' → 'text'", function () {
  var fixed = fixProps("slack", "send_channel_message", { message: "عميل جديد!", channel: "sales" });
  assert(fixed.text, "missing text");
  assert(!fixed.message, "still has message");
  eq(fixed.channel, "sales");
});

// ═══════════════════════════════════════
console.log("\n═══ 7. Action Adaptation ═══\n");
// ═══════════════════════════════════════

test("adaptAction → correct structure", function () {
  var a = adaptAction({ piece_id: "gmail", action_name: "send_email", settings: { input: { to: "test@test.com" } } }, 1);
  eq(a.name, "step_1");
  eq(a.type, "PIECE");
  eq(a.settings.pieceName, "@activepieces/piece-gmail");
  eq(a.settings.actionName, "send_email");
  assert(a.settings.propertySettings, "has propertySettings");
  assert(a.settings.errorHandlingOptions, "has errorHandlingOptions");
});

test("adaptAction → fixes props in action", function () {
  var a = adaptAction({ piece_id: "gmail", action_name: "send_email", settings: { input: { to: "x@y.com", body_text: "hi" } } }, 2);
  assert(a.settings.input.receiver, "has receiver");
  assert(a.settings.input.body, "has body");
  assert(!a.settings.input.to, "no 'to'");
  assert(!a.settings.input.body_text, "no 'body_text'");
});

test("adaptAction → null returns null", function () {
  var a = adaptAction(null, 1);
  eq(a, null);
});

// ═══════════════════════════════════════
console.log("\n═══ 8. Full Flow Adaptation ═══\n");
// ═══════════════════════════════════════

test("adaptFlowForAP → full flow with webhook trigger", function () {
  var siyadahFlow = {
    flow: {
      _metadata: { name: "جذب_عملاء" },
      trigger: { piece_id: "webhook", trigger_name: "catch_hook" },
      steps: [
        { piece_id: "google-sheets", action_name: "insert_row", settings: { input: { spreadsheet_id: "abc" } } },
        { piece_id: "gmail", action_name: "send_email", settings: { input: { to: "{{trigger.body.email}}", subject: "مرحباً", body_text: "شكراً" } } },
      ],
    },
  };

  var adapted = adaptFlowForAP(siyadahFlow);

  // Trigger
  eq(adapted.trigger.settings.triggerName, "catch_webhook"); // Fixed!
  eq(adapted.trigger.valid, true);

  // Actions
  eq(adapted.actions.length, 2);

  // Sheets action
  eq(adapted.actions[0].settings.pieceName, "@activepieces/piece-google-sheets");
  assert(adapted.actions[0].settings.input.spreadsheetId, "sheets has spreadsheetId");

  // Gmail action
  eq(adapted.actions[1].settings.pieceName, "@activepieces/piece-gmail");
  assert(adapted.actions[1].settings.input.receiver, "gmail has receiver");
  assert(Array.isArray(adapted.actions[1].settings.input.receiver), "receiver is Array");
  assert(adapted.actions[1].settings.input.body, "gmail has body");
  eq(adapted.actions[1].settings.input.body_type, "plain_text");
  eq(adapted.actions[1].settings.input.draft, false);
});

test("adaptFlowForAP → connections_needed", function () {
  var flow = {
    flow: {
      trigger: { piece_id: "webhook" },
      steps: [
        { piece_id: "gmail", action_name: "send_email", settings: { input: {} } },
        { piece_id: "google-sheets", action_name: "insert_row", settings: { input: {} } },
      ],
    },
  };
  var adapted = adaptFlowForAP(flow);
  assert(adapted.connections_needed.length >= 2, "needs gmail + sheets connections");
});

// ═══════════════════════════════════════
console.log("\n═══ 9. ActivePiecesClient Builder Helpers ═══\n");
// ═══════════════════════════════════════

test("_buildWebhookTrigger → correct", function () {
  var client = new ActivePiecesClient({ mock: true });
  var t = client._buildWebhookTrigger({ body: { test: true } });
  eq(t.settings.triggerName, "catch_webhook");
  eq(t.valid, true);
  eq(t.settings.input.authType, "none");
});

test("_buildScheduleTrigger → correct", function () {
  var client = new ActivePiecesClient({ mock: true });
  var t = client._buildScheduleTrigger("every_x_minutes", 5);
  eq(t.settings.triggerName, "every_x_minutes");
  eq(t.settings.input.minutes, 5);
});

test("buildAction → correct with fixProps", function () {
  var client = new ActivePiecesClient({ mock: true });
  var a = client.buildAction("step_1", "gmail", "send_email", {
    to: "test@test.com",
    subject: "Hi",
    body_text: "Hello",
  });
  eq(a.name, "step_1");
  assert(a.settings.input.receiver, "has receiver");
  assert(!a.settings.input.to, "no to");
  assert(a.settings.input.body, "has body");
  eq(a.settings.input.body_type, "plain_text");
  eq(a.settings.input.draft, false);
});

test("_fixProps → unknown piece passes through", function () {
  var client = new ActivePiecesClient({ mock: true });
  var fixed = client._fixProps("unknown-piece", "unknown-action", { foo: "bar" });
  eq(fixed.foo, "bar");
});

// ═══════════════════════════════════════
console.log("\n═══ 10. PIECE_VERSIONS ═══\n");
// ═══════════════════════════════════════

test("PIECE_VERSIONS has all critical pieces", function () {
  var pv = ActivePiecesClient.PIECE_VERSIONS;
  assert(pv["webhook"], "webhook");
  assert(pv["schedule"], "schedule");
  assert(pv["gmail"], "gmail");
  assert(pv["google-sheets"], "google-sheets");
  assert(pv["openai"], "openai");
  assert(pv["whatsapp"], "whatsapp");
  assert(pv["slack"], "slack");
});

test("PIECE_VERSIONS format ~x.y.z", function () {
  var pv = ActivePiecesClient.PIECE_VERSIONS;
  Object.keys(pv).forEach(function (k) {
    assert(pv[k].startsWith("~"), k + " should start with ~");
    assert(pv[k].split(".").length === 3, k + " should be ~x.y.z format");
  });
});

// ═══════════════════════════════════════
console.log("\n═══ 11. PROVEN_PROPS Coverage ═══\n");
// ═══════════════════════════════════════

test("PROVEN_PROPS covers gmail, sheets, whatsapp, openai, slack", function () {
  var pp = ActivePiecesClient.PROVEN_PROPS;
  assert(pp["gmail"], "gmail");
  assert(pp["google-sheets"], "google-sheets");
  assert(pp["whatsapp"], "whatsapp");
  assert(pp["openai"], "openai");
  assert(pp["slack"], "slack");
});

test("PROVEN_PROPS gmail.send_email has all required", function () {
  var spec = ActivePiecesClient.PROVEN_PROPS["gmail"]["send_email"];
  assert(spec.required.includes("receiver"), "receiver");
  assert(spec.required.includes("subject"), "subject");
  assert(spec.required.includes("body_type"), "body_type");
  assert(spec.required.includes("body"), "body");
  assert(spec.required.includes("draft"), "draft");
});

// ═══════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════

console.log("\n═══════════════════════════════════════");
console.log("  النتيجة: " + passed + "/" + total + " passed" + (failed > 0 ? " | " + failed + " FAILED 🔴" : " ✅"));
console.log("═══════════════════════════════════════\n");

process.exit(failed > 0 ? 1 : 0);
