/**
 * سيادة — محرك اختيار الأدوات
 * Phase 6: Tool Selector
 * 
 * يحوّل النوايا المكتشفة إلى أدوات وأكشنات حقيقية من السجل
 */

const fs = require("fs");
const path = require("path");

// Load registry
const regPath = path.join(__dirname, "..", "data", "registry", "tools-full.json");
const registry = JSON.parse(fs.readFileSync(regPath, "utf8"));
const pieceMap = {};
registry.pieces.forEach(p => pieceMap[p.id] = p);

// ═══════════════════════════════════════════════════════════
// خريطة النوايا → الأدوات
// كل نية مربوطة بمجموعة أدوات حقيقية من السجل
// ═══════════════════════════════════════════════════════════

const INTENT_TOOL_MAP = {
  lead_capture: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "google-sheets", action: "insert_row", role: "log" },
      { piece: "hubspot", action: "create-or-update-contact", role: "crm" },
      { piece: "whatsapp", action: "sendMessage", role: "notify_customer" },
      { piece: "slack", action: "send_channel_message", role: "notify_team" },
    ],
    optional: [
      { piece: "openai", action: "ask_chatgpt", role: "classify" },
      { piece: "gmail", action: "send_email", role: "email_welcome" },
    ],
  },

  lead_qualify: {
    trigger: { piece: "hubspot", trigger: "new-contact" },
    steps: [
      { piece: "openai", action: "extract-structured-data", role: "analyze" },
      { piece: "hubspot", action: "update-contact", role: "update_score" },
      { piece: "slack", action: "send_channel_message", role: "notify_team" },
    ],
    optional: [
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  contact_update: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "hubspot", action: "find-contact", role: "find" },
      { piece: "hubspot", action: "update-contact", role: "update" },
      { piece: "google-sheets", action: "update_row", role: "sync" },
    ],
  },

  sales_followup: {
    trigger: { piece: "schedule", trigger: "cron_expression" },
    steps: [
      { piece: "google-sheets", action: "find_rows", role: "find_no_reply" },
      { piece: "openai", action: "ask_chatgpt", role: "write_followup" },
      { piece: "gmail", action: "send_email", role: "send_followup" },
      { piece: "slack", action: "send_channel_message", role: "notify_sales" },
    ],
    optional: [
      { piece: "whatsapp", action: "sendMessage", role: "whatsapp_followup" },
      { piece: "google-sheets", action: "update_row", role: "update_status" },
    ],
  },

  appointment_book: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "google-calendar", action: "google_calendar_get_events", role: "check_availability" },
      { piece: "google-calendar", action: "create_google_calendar_event", role: "create_event" },
      { piece: "whatsapp", action: "sendMessage", role: "confirm_customer" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
    optional: [
      { piece: "gmail", action: "send_email", role: "email_confirm" },
      { piece: "slack", action: "send_channel_message", role: "notify_team" },
    ],
  },

  appointment_remind: {
    trigger: { piece: "google-calendar", trigger: "event_starts_in" },
    steps: [
      { piece: "google-calendar", action: "google_calendar_get_event_by_id", role: "get_details" },
      { piece: "whatsapp", action: "send-template-message", role: "remind_customer" },
    ],
    optional: [
      { piece: "gmail", action: "send_email", role: "email_remind" },
      { piece: "google-sheets", action: "update_row", role: "log" },
    ],
  },

  appointment_cancel: {
    trigger: { piece: "google-calendar", trigger: "event_cancelled" },
    steps: [
      { piece: "google-sheets", action: "find_rows", role: "find_booking" },
      { piece: "whatsapp", action: "sendMessage", role: "notify_customer" },
      { piece: "google-sheets", action: "update_row", role: "update_status" },
    ],
    optional: [
      { piece: "google-calendar", action: "create_quick_event", role: "reschedule" },
    ],
  },

  invoice_send: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "google-sheets", action: "find_rows", role: "get_client" },
      { piece: "stripe", action: "create_invoice", role: "create_invoice" },
      { piece: "stripe", action: "create_payment_link", role: "payment_link" },
      { piece: "whatsapp", action: "sendMessage", role: "send_to_customer" },
      { piece: "gmail", action: "send_email", role: "email_invoice" },
    ],
    optional: [
      { piece: "google-sheets", action: "update_row", role: "mark_sent" },
    ],
  },

  payment_follow: {
    trigger: { piece: "schedule", trigger: "every_day" },
    steps: [
      { piece: "google-sheets", action: "find_rows", role: "find_overdue" },
      { piece: "whatsapp", action: "sendMessage", role: "remind_customer" },
      { piece: "google-sheets", action: "update_row", role: "log_follow" },
    ],
    optional: [
      { piece: "gmail", action: "send_email", role: "email_remind" },
      { piece: "slack", action: "send_channel_message", role: "notify_team" },
    ],
  },

  notify_whatsapp: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "whatsapp", action: "sendMessage", role: "send" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  notify_email: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "gmail", action: "send_email", role: "send" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  notify_sms: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "twilio", action: "custom_api_call", role: "send" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  notify_multi: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "whatsapp", action: "sendMessage", role: "whatsapp" },
      { piece: "gmail", action: "send_email", role: "email" },
      { piece: "slack", action: "send_channel_message", role: "slack" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  report_daily: {
    trigger: { piece: "schedule", trigger: "every_day" },
    steps: [
      { piece: "google-sheets", action: "get_next_rows", role: "fetch_data" },
      { piece: "openai", action: "ask_chatgpt", role: "summarize" },
      { piece: "slack", action: "send_channel_message", role: "post_report" },
    ],
    optional: [
      { piece: "gmail", action: "send_email", role: "email_report" },
    ],
  },

  report_weekly: {
    trigger: { piece: "schedule", trigger: "every_week" },
    steps: [
      { piece: "google-sheets", action: "get_next_rows", role: "fetch_data" },
      { piece: "openai", action: "ask_chatgpt", role: "summarize" },
      { piece: "slack", action: "send_channel_message", role: "post_report" },
      { piece: "gmail", action: "send_email", role: "email_report" },
    ],
  },

  report_custom: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "google-sheets", action: "find_rows", role: "query" },
      { piece: "openai", action: "ask_chatgpt", role: "analyze" },
      { piece: "slack", action: "send_channel_message", role: "deliver" },
    ],
  },

  support_ticket: {
    trigger: { piece: "gmail", trigger: "gmail_new_email_received" },
    steps: [
      { piece: "openai", action: "ask_chatgpt", role: "classify" },
      { piece: "jira-cloud", action: "create_issue", role: "create_ticket" },
      { piece: "slack", action: "send_channel_message", role: "notify_team" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  support_auto_reply: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "openai", action: "ask_chatgpt", role: "generate_reply" },
      { piece: "whatsapp", action: "sendMessage", role: "reply" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
    optional: [
      { piece: "notion", action: "create_database_item", role: "knowledge_base" },
    ],
  },

  order_new: {
    trigger: { piece: "shopify", trigger: "new_abandoned_checkout" },
    steps: [
      { piece: "shopify", action: "get_customer", role: "get_customer" },
      { piece: "whatsapp", action: "sendMessage", role: "confirm" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
    optional: [
      { piece: "slack", action: "send_channel_message", role: "notify_team" },
      { piece: "gmail", action: "send_email", role: "email_receipt" },
    ],
  },

  order_status: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "shopify", action: "get_customer_orders", role: "lookup" },
      { piece: "whatsapp", action: "sendMessage", role: "reply_status" },
    ],
  },

  inventory_alert: {
    trigger: { piece: "schedule", trigger: "every_day" },
    steps: [
      { piece: "shopify", action: "get_products", role: "check_stock" },
      { piece: "slack", action: "send_channel_message", role: "alert" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  data_sync: {
    trigger: { piece: "schedule", trigger: "every_hour" },
    steps: [
      { piece: "google-sheets", action: "get_next_rows", role: "source" },
      { piece: "google-sheets", action: "update_row", role: "destination" },
    ],
    optional: [
      { piece: "airtable", action: "airtable_update_record", role: "alt_destination" },
    ],
  },

  sheet_log: {
    trigger: { piece: "webhook", trigger: "catch_webhook" },
    steps: [
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  campaign_email: {
    trigger: { piece: "schedule", trigger: "every_week" },
    steps: [
      { piece: "openai", action: "ask_chatgpt", role: "write_content" },
      { piece: "mailchimp", action: "create_campaign", role: "create" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
  },

  social_post: {
    trigger: { piece: "schedule", trigger: "every_day" },
    steps: [
      { piece: "openai", action: "ask_chatgpt", role: "write" },
      { piece: "twitter", action: "create-tweet", role: "post" },
      { piece: "google-sheets", action: "insert_row", role: "log" },
    ],
    optional: [
      { piece: "linkedin", action: "create_share_update", role: "linkedin" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════
// أسماء الأدوات (عربي ↔ ID)
// ═══════════════════════════════════════════════════════════

const TOOL_ALIASES = {
  "واتساب": "whatsapp", "واتس": "whatsapp", "واتسب": "whatsapp",
  "جيميل": "gmail", "إيميل": "gmail", "ايميل": "gmail", "بريد": "gmail",
  "شيت": "google-sheets", "شيتس": "google-sheets", "جدول": "google-sheets", "اكسل": "google-sheets",
  "سلاك": "slack",
  "كالندر": "google-calendar", "التقويم": "google-calendar",
  "هبسبوت": "hubspot",
  "شوبيفاي": "shopify",
  "سترايب": "stripe",
  "تلغرام": "telegram-bot",
  "نوشن": "notion",
  "جيرا": "jira-cloud",
  "ديسكورد": "discord",
  "تويتر": "twitter",
  "لينكدإن": "linkedin",
  "ميلشيمب": "mailchimp",
  "تيمز": "microsoft-teams",
  "اوتلوك": "microsoft-outlook",
  "زووم": "zoom",
};

// ═══════════════════════════════════════════════════════════
// اختيار الأدوات بناءً على النوايا
// ═══════════════════════════════════════════════════════════

function selectTools(analysisResult) {
  const { primary_intent, secondary_intents, entities } = analysisResult;

  if (!primary_intent) {
    return { success: false, error: "لم يتم تحديد نية واضحة", tools: [] };
  }

  const intentId = primary_intent.intent;
  const mapping = INTENT_TOOL_MAP[intentId];

  if (!mapping) {
    return { success: false, error: `لا توجد خريطة أدوات للنية: ${intentId}`, tools: [] };
  }

  // Validate all pieces exist in registry
  const errors = [];
  const trigger = mapping.trigger;
  if (!pieceMap[trigger.piece]) {
    errors.push(`trigger piece '${trigger.piece}' not in registry`);
  } else {
    const triggers = new Set(pieceMap[trigger.piece].triggers.map(t => t.name));
    if (!triggers.has(trigger.trigger)) {
      errors.push(`trigger '${trigger.trigger}' not in ${trigger.piece}`);
    }
  }

  const selectedSteps = [];
  for (const step of mapping.steps) {
    if (!pieceMap[step.piece]) {
      errors.push(`piece '${step.piece}' not in registry`);
      continue;
    }
    const actions = new Set(pieceMap[step.piece].actions.map(a => a.name));
    if (!actions.has(step.action)) {
      errors.push(`action '${step.action}' not in ${step.piece}`);
      continue;
    }
    selectedSteps.push({ ...step, verified: true });
  }

  // Check entities to add/modify tools
  const mentionedTools = entities
    .filter(e => e.type === "tool")
    .map(e => TOOL_ALIASES[normalizeToolName(e.value)])
    .filter(Boolean);

  // Add optional steps that match mentioned tools
  const optionalSteps = [];
  if (mapping.optional) {
    for (const opt of mapping.optional) {
      if (mentionedTools.includes(opt.piece)) {
        if (pieceMap[opt.piece]) {
          optionalSteps.push({ ...opt, verified: true, reason: "user_mentioned" });
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    intent: intentId,
    confidence: primary_intent.confidence,
    trigger: {
      piece: trigger.piece,
      trigger: trigger.trigger,
      display_name: pieceMap[trigger.piece]?.display_name || trigger.piece,
    },
    steps: selectedSteps,
    optional_steps: optionalSteps,
    mentioned_tools: mentionedTools,
    errors,
    total_steps: selectedSteps.length + optionalSteps.length + 1, // +1 for trigger
  };
}

function normalizeToolName(text) {
  return text.replace(/[إأآا]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
}

// ═══════════════════════════════════════════════════════════
// تحليل كامل: نص → أدوات
// ═══════════════════════════════════════════════════════════

function fullAnalysis(text) {
  const { analyzeRequest } = require("./intent-detector");
  const analysis = analyzeRequest(text);
  const selection = selectTools(analysis);

  return {
    input: text,
    analysis,
    selection,
  };
}

module.exports = {
  INTENT_TOOL_MAP,
  TOOL_ALIASES,
  selectTools,
  fullAnalysis,
  pieceMap,
};
