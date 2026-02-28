/**
 * سيادة — محرك بناء التدفقات
 * Phase 7: Flow Builder
 * 
 * يحوّل اختيار الأدوات إلى flow كامل جاهز لـ ActivePieces
 */

const fs = require("fs");
const path = require("path");

const regPath = path.join(__dirname, "..", "data", "registry", "tools-full.json");
const registry = JSON.parse(fs.readFileSync(regPath, "utf8"));
const pieceMap = {};
registry.pieces.forEach(p => pieceMap[p.id] = p);

const errorMapPath = path.join(__dirname, "..", "data", "errors", "error-map.json");
const errorMap = JSON.parse(fs.readFileSync(errorMapPath, "utf8"));

// ═══════════════════════════════════════════════════════════
// بناء Flow من نتيجة Tool Selection
// ═══════════════════════════════════════════════════════════

function buildFlow(selection, options = {}) {
  if (!selection.success && selection.errors?.length > 0) {
    return { success: false, error: "Tool selection has errors", details: selection.errors };
  }

  if (!selection.trigger) {
    return { success: false, error: "No trigger defined", details: ["selection has no trigger"] };
  }

  const {
    name = `flow_${selection.intent}_${Date.now()}`,
    description = "",
    includeOptional = false,
    industry = "general",
  } = options;

  const flow = {
    _metadata: {
      name,
      description: description || `تدفق ${selection.intent} — مولّد تلقائياً`,
      intent: selection.intent,
      confidence: selection.confidence,
      industry,
      created: new Date().toISOString(),
      version: "1.0",
      total_steps: 0,
    },
    trigger: buildTrigger(selection.trigger),
    steps: [],
    error_handlers: [],
    connections_required: new Set(),
  };

  // Add main steps
  for (const step of selection.steps) {
    const built = buildStep(step, flow.steps.length + 1);
    if (built) {
      flow.steps.push(built);
      flow.connections_required.add(step.piece);
    }
  }

  // Add optional steps if requested
  if (includeOptional) {
    for (const step of (selection.optional_steps || [])) {
      const built = buildStep(step, flow.steps.length + 1);
      if (built) {
        flow.steps.push(built);
        flow.connections_required.add(step.piece);
      }
    }
  }

  // Add error handlers
  flow.error_handlers = buildErrorHandlers(flow);

  // Convert Set to Array
  flow.connections_required = [...flow.connections_required];
  flow._metadata.total_steps = flow.steps.length + 1; // +1 for trigger

  return { success: true, flow };
}

// ═══════════════════════════════════════════════════════════
// بناء Trigger
// ═══════════════════════════════════════════════════════════

function buildTrigger(triggerConfig) {
  const piece = pieceMap[triggerConfig.piece];
  if (!piece) return null;

  const triggerDef = piece.triggers.find(t => t.name === triggerConfig.trigger);

  return {
    type: "TRIGGER",
    piece_id: triggerConfig.piece,
    piece_name: piece.display_name,
    trigger_name: triggerConfig.trigger,
    display_name: triggerDef?.display_name || triggerConfig.trigger,
    trigger_type: triggerDef?.type || "instant",
    settings: {
      // Default settings based on trigger type
      ...(triggerConfig.trigger === "catch_webhook" ? {
        path: `/webhook/${Date.now().toString(36)}`,
        method: "POST",
      } : {}),
      ...(triggerConfig.trigger.startsWith("every_") ? {
        cronExpression: getCronForSchedule(triggerConfig.trigger),
        timezone: "Asia/Riyadh",
      } : {}),
    },
    output_schema: {
      // Generic output — real schema comes from AP runtime
      type: "object",
      description: "بيانات الحدث",
    },
  };
}

function getCronForSchedule(trigger) {
  switch (trigger) {
    case "every_hour": return "0 * * * *";
    case "every_day": return "0 8 * * *"; // 8 صباح بتوقيت الرياض
    case "every_week": return "0 8 * * 0"; // الأحد 8 صباح
    case "cron_expression": return "0 0 1 * *"; // أول الشهر
    default: return "0 * * * *";
  }
}

// ═══════════════════════════════════════════════════════════
// بناء Step
// ═══════════════════════════════════════════════════════════

function buildStep(stepConfig, index) {
  const piece = pieceMap[stepConfig.piece];
  if (!piece) return null;

  const actionDef = piece.actions.find(a => a.name === stepConfig.action);
  if (!actionDef) return null;

  // Get props from tool details if available
  const toolDetailPath = path.join(__dirname, "..", "data", "tools-full", `${stepConfig.piece}.json`);
  let props = [];
  if (fs.existsSync(toolDetailPath)) {
    try {
      const td = JSON.parse(fs.readFileSync(toolDetailPath, "utf8"));
      const actionDetail = td.actions?.[stepConfig.action];
      if (actionDetail?.props) {
        props = actionDetail.props;
      }
    } catch (e) {}
  }

  return {
    type: "ACTION",
    index,
    piece_id: stepConfig.piece,
    piece_name: piece.display_name,
    action_name: stepConfig.action,
    display_name: actionDef.display_name || stepConfig.action,
    description: actionDef.description || "",
    role: stepConfig.role || "",
    auth_type: piece.auth_type || "none",
    settings: {
      // Map props to settings template
      input: buildInputTemplate(props, stepConfig),
    },
    required_props: props.filter(p => p.required).map(p => ({
      name: p.name,
      displayName: p.displayName,
      type: p.type,
    })),
    output_ref: `{{steps.step_${index}}}`,
    error_handling: {
      strategy: "retry_and_continue",
      max_retries: 2,
      on_failure: "continue",
    },
  };
}

function buildInputTemplate(props, stepConfig) {
  const template = {};
  for (const prop of props) {
    if (prop.type === "MARKDOWN") continue;

    // Generate smart defaults based on role and prop type
    if (prop.name === "message" || prop.name === "body" || prop.name === "text") {
      template[prop.name] = "{{trigger.body.message}}";
    } else if (prop.name === "receiver" || prop.name === "to" || prop.name === "number") {
      template[prop.name] = "{{trigger.body.phone}}";
    } else if (prop.name === "subject") {
      template[prop.name] = "{{trigger.body.subject}}";
    } else if (prop.name === "channel" || prop.name === "channelName") {
      template[prop.name] = "{{config.slack_channel}}";
    } else if (prop.required) {
      template[prop.name] = `{{trigger.body.${prop.name}}}`;
    }
  }
  return template;
}

// ═══════════════════════════════════════════════════════════
// بناء Error Handlers
// ═══════════════════════════════════════════════════════════

function buildErrorHandlers(flow) {
  const handlers = [];
  const allPieces = new Set([
    flow.trigger.piece_id,
    ...flow.steps.map(s => s.piece_id),
  ]);

  // Map pieces to potential errors
  const allErrors = [];
  Object.values(errorMap.error_categories).forEach(cat => {
    cat.errors.forEach(e => allErrors.push(e));
  });

  for (const err of allErrors) {
    const affected = err.affected_pieces || [];
    const isRelevant = affected.includes("*") || affected.some(p => allPieces.has(p));

    if (isRelevant && err.auto_fix) {
      handlers.push({
        error_code: err.code,
        message_ar: errorMap.error_to_user_message[err.code] || err.message_ar,
        strategy: err.auto_fix.strategy,
        max_retries: err.auto_fix.max_retries || 1,
        affected_steps: flow.steps
          .filter(s => affected.includes("*") || affected.includes(s.piece_id))
          .map(s => s.index),
      });
    }
  }

  return handlers;
}

// ═══════════════════════════════════════════════════════════
// تحويل Flow إلى ActivePieces JSON format
// ═══════════════════════════════════════════════════════════

function toActivePiecesFormat(flowResult) {
  if (!flowResult.success) return null;

  const { flow } = flowResult;

  return {
    displayName: flow._metadata.name,
    description: flow._metadata.description,
    trigger: {
      name: "trigger",
      type: "PIECE_TRIGGER",
      settings: {
        pieceName: `@activepieces/piece-${flow.trigger.piece_id}`,
        triggerName: flow.trigger.trigger_name,
        input: flow.trigger.settings,
      },
      nextAction: flow.steps.length > 0 ? { name: "step_1" } : undefined,
    },
    actions: flow.steps.map((step, i) => ({
      name: `step_${step.index}`,
      type: "PIECE",
      settings: {
        pieceName: `@activepieces/piece-${step.piece_id}`,
        actionName: step.action_name,
        input: step.settings.input,
      },
      nextAction: i < flow.steps.length - 1 ? { name: `step_${flow.steps[i + 1].index}` } : undefined,
    })),
  };
}

// ═══════════════════════════════════════════════════════════
// Full pipeline: text → flow
// ═══════════════════════════════════════════════════════════

function textToFlow(text, options = {}) {
  const { analyzeRequest } = require("./intent-detector");
  const { selectTools } = require("./tool-selector");

  const analysis = analyzeRequest(text);
  const selection = selectTools(analysis);
  const flowResult = buildFlow(selection, options);

  return {
    input: text,
    analysis,
    selection,
    flow: flowResult,
    ap_format: flowResult.success ? toActivePiecesFormat(flowResult) : null,
  };
}

module.exports = {
  buildFlow,
  buildTrigger,
  buildStep,
  buildErrorHandlers,
  toActivePiecesFormat,
  textToFlow,
};
