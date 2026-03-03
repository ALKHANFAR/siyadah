/**
 * سيادة — AP Adapter Layer
 * 
 * يحوّل output الـ flow-builder (format سيادة الداخلي) → 
 * AP API calls حقيقية بالطريقة المثبتة
 * 
 * الطريقة المثبتة:
 *   CREATE → UPDATE_TRIGGER(catch_webhook) → ADD_ACTION(s) → LOCK_AND_PUBLISH
 *   Webhook URL = /api/v1/webhooks/{flowId}
 */

const { ActivePiecesClient } = require("../backend/services/activepieces");

const PIECE_VERSIONS = ActivePiecesClient.PIECE_VERSIONS;
const PROVEN_PROPS = ActivePiecesClient.PROVEN_PROPS;

// ═══════════════════════════════════════════════════════════
// تحويل Flow (سيادة) → AP Format المثبت
// ═══════════════════════════════════════════════════════════

/**
 * يحوّل الـ flow الداخلي (من flow-builder) إلى AP-ready config
 * بالأسماء الصحيحة المثبتة بالتجربة
 */
function adaptFlowForAP(siyadahFlow, options) {
  options = options || {};
  var flow = siyadahFlow.flow || siyadahFlow;

  // ═══ Trigger ═══
  var trigger = adaptTrigger(flow.trigger);

  // ═══ Actions ═══
  var actions = [];
  var steps = flow.steps || [];
  for (var i = 0; i < steps.length; i++) {
    var action = adaptAction(steps[i], i + 1);
    if (action) actions.push(action);
  }

  return {
    displayName: (flow._metadata && flow._metadata.name) || options.displayName || "سيادة_" + Date.now(),
    trigger: trigger,
    actions: actions,
    sampleData: options.sampleData || buildSampleData(flow),
    connections_needed: extractConnectionNeeds(steps),
  };
}

// ═══════════════════════════════════════════════════════════
// تحويل Trigger
// ═══════════════════════════════════════════════════════════

function adaptTrigger(trig) {
  if (!trig) return buildDefaultWebhookTrigger();

  var pieceId = trig.piece_id || "webhook";

  // Webhook trigger
  if (pieceId === "webhook") {
    return {
      name: "trigger",
      valid: true,
      displayName: trig.display_name || "Catch Webhook",
      type: "PIECE_TRIGGER",
      settings: {
        pieceName: "@activepieces/piece-webhook",
        pieceVersion: PIECE_VERSIONS["webhook"] || "~0.1.29",
        triggerName: "catch_webhook",        // ← الاسم الصحيح!
        input: { authType: "none" },
        sampleData: trig.sampleData || { body: {} },
        propertySettings: { authType: { type: "MANUAL" } },
        inputUiInfo: { currentSelectedData: "none" },
      },
    };
  }

  // Schedule trigger
  if (pieceId === "schedule") {
    var trigName = trig.trigger_name || "every_day";
    // Fix: سيادة يستخدم catch_webhook للجدولة أحياناً — نصلحها
    if (trigName === "catch_webhook" || trigName === "catch_hook") trigName = "every_day";

    var input = {};
    if (trig.settings) {
      if (trig.settings.cronExpression) input.cron_expression = trig.settings.cronExpression;
      if (trig.settings.timezone) input.timezone = trig.settings.timezone;
      if (trig.settings.minutes) input.minutes = trig.settings.minutes;
    }

    return {
      name: "trigger",
      valid: true,
      displayName: trig.display_name || trigName.replace(/_/g, " "),
      type: "PIECE_TRIGGER",
      settings: {
        pieceName: "@activepieces/piece-schedule",
        pieceVersion: PIECE_VERSIONS["schedule"] || "~0.1.17",
        triggerName: trigName,
        input: input,
        sampleData: {},
        propertySettings: {},
        inputUiInfo: {},
      },
    };
  }

  // Other piece triggers (gmail new_email, sheets new_row, etc)
  var fullPiece = "@activepieces/piece-" + pieceId;
  return {
    name: "trigger",
    valid: true,
    displayName: trig.display_name || trig.trigger_name,
    type: "PIECE_TRIGGER",
    settings: {
      pieceName: fullPiece,
      pieceVersion: PIECE_VERSIONS[pieceId] || "~0.1.0",
      triggerName: trig.trigger_name,
      input: trig.settings || {},
      sampleData: {},
      propertySettings: {},
      inputUiInfo: {},
    },
  };
}

function buildDefaultWebhookTrigger() {
  return adaptTrigger({ piece_id: "webhook" });
}

// ═══════════════════════════════════════════════════════════
// تحويل Action (مع تصحيح أسماء Props)
// ═══════════════════════════════════════════════════════════

function adaptAction(step, index) {
  if (!step) return null;

  var pieceId = step.piece_id;
  var actionName = step.action_name;
  var fullPiece = "@activepieces/piece-" + pieceId;
  var version = PIECE_VERSIONS[pieceId] || "~0.1.0";
  var stepName = "step_" + index;

  // Get input from step.settings.input or build from what we have
  var rawInput = {};
  if (step.settings && step.settings.input) {
    rawInput = Object.assign({}, step.settings.input);
  }

  // Fix prop names using PROVEN_PROPS
  var fixedInput = fixProps(pieceId, actionName, rawInput);

  // Build propertySettings (AP needs this for each input key)
  var propertySettings = {};
  Object.keys(fixedInput).forEach(function (k) {
    propertySettings[k] = { type: "MANUAL" };
  });

  return {
    name: stepName,
    skip: false,
    type: "PIECE",
    valid: true,
    displayName: step.display_name || step.role || stepName,
    settings: {
      pieceName: fullPiece,
      pieceVersion: version,
      actionName: actionName,
      input: fixedInput,
      sampleData: {},
      propertySettings: propertySettings,
      inputUiInfo: {},
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: true },
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════
// تصحيح أسماء Props
// ═══════════════════════════════════════════════════════════

function fixProps(pieceId, actionName, input) {
  var fixed = Object.assign({}, input);

  var spec = PROVEN_PROPS[pieceId] && PROVEN_PROPS[pieceId][actionName];
  if (!spec) return fixed;

  // Step 1: Rename wrong prop names
  if (spec.rename) {
    Object.keys(spec.rename).forEach(function (wrong) {
      var correct = spec.rename[wrong];
      if (fixed[wrong] !== undefined && fixed[correct] === undefined) {
        fixed[correct] = fixed[wrong];
        delete fixed[wrong];
      }
    });
  }

  // Step 2: Add defaults for missing required
  if (spec.defaults) {
    Object.keys(spec.defaults).forEach(function (k) {
      if (fixed[k] === undefined) fixed[k] = spec.defaults[k];
    });
  }

  // Step 3: Type fixes
  // Gmail receiver must be Array
  if (pieceId === "gmail" && actionName === "send_email") {
    if (fixed.receiver && !Array.isArray(fixed.receiver)) {
      fixed.receiver = [fixed.receiver];
    }
  }

  return fixed;
}

// ═══════════════════════════════════════════════════════════
// Sample Data Builder
// ═══════════════════════════════════════════════════════════

function buildSampleData(flow) {
  // Build generic sample data from trigger type
  if (!flow.trigger) return { body: {} };

  if (flow.trigger.piece_id === "webhook") {
    return {
      body: {
        name: "أحمد",
        phone: "+966501234567",
        email: "test@example.com",
        message: "اختبار",
        source: "website",
      },
    };
  }

  return { body: {} };
}

// ═══════════════════════════════════════════════════════════
// Connection Needs
// ═══════════════════════════════════════════════════════════

function extractConnectionNeeds(steps) {
  var needs = [];
  var seen = {};

  (steps || []).forEach(function (step) {
    var pieceId = step.piece_id;
    if (seen[pieceId]) return;
    seen[pieceId] = true;

    var spec = PROVEN_PROPS[pieceId];
    if (spec) {
      var actionSpec = spec[step.action_name];
      if (actionSpec && actionSpec.auth) {
        needs.push({
          pieceId: pieceId,
          pieceName: "@activepieces/piece-" + pieceId,
          authProp: actionSpec.auth,
        });
      }
    }
  });

  return needs;
}

// ═══════════════════════════════════════════════════════════
// Full Deploy: سيادة flow → AP API → ENABLED
// ═══════════════════════════════════════════════════════════

/**
 * يأخذ نتيجة pipeline (أو flow-builder) → ينشر على AP حقيقي
 *
 * @param {ActivePiecesClient} apClient
 * @param {Object} pipelineResult - from executePipeline() or buildFlow()
 * @param {Object} options - { displayName, sampleData }
 * @returns {Object} deploy result
 */
async function deployToAP(apClient, pipelineResult, options) {
  options = options || {};

  // Get the flow from pipeline result
  var flow = pipelineResult.flow || pipelineResult;
  if (!flow.trigger && !flow.steps) {
    return { success: false, error: "INVALID_FLOW", message: "Flow ما فيه trigger أو steps" };
  }

  // Adapt to AP format
  var adapted = adaptFlowForAP(flow, options);

  // Build trigger config
  var triggerConfig = adapted.trigger;

  // Inject sampleData into trigger
  if (adapted.sampleData && triggerConfig.settings) {
    triggerConfig.settings.sampleData = adapted.sampleData;
  }

  // Deploy using proven pipeline
  var result = await apClient.deployFullFlow({
    displayName: adapted.displayName,
    trigger: triggerConfig,
    actions: adapted.actions,
    sampleData: adapted.sampleData,
  });

  // Add connection info
  result.connections_needed = adapted.connections_needed;

  return result;
}

// ═══════════════════════════════════════════════════════════
// Quick Deploy: نص عربي → AP مباشرة
// ═══════════════════════════════════════════════════════════

/**
 * من نص عربي → pipeline → adapter → AP → ENABLED
 */
async function quickDeploy(apClient, arabicText, options) {
  var { executePipeline } = require("./pipeline");

  // Run pipeline
  var result = executePipeline(arabicText, options);
  if (!result.success) {
    return {
      success: false,
      stage: "pipeline",
      pipeline_stage: result.stage_reached,
      errors: result.errors,
      message_ar: "ما قدرت أبني الأتمتة: " + (result.errors[0] && result.errors[0].message || "خطأ غير معروف"),
    };
  }

  // Deploy
  var deployResult = await deployToAP(apClient, result, options);

  return Object.assign({}, deployResult, {
    intent: result.stages && result.stages.select && result.stages.select.intent,
    pipeline: {
      stage_reached: result.stage_reached,
      total_steps: result.flow && result.flow._metadata && result.flow._metadata.total_steps,
    },
  });
}

module.exports = {
  adaptFlowForAP,
  adaptTrigger,
  adaptAction,
  fixProps,
  deployToAP,
  quickDeploy,
  PIECE_VERSIONS,
  PROVEN_PROPS,
};
