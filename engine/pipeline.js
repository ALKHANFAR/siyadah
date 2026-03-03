const { analyzeRequest } = require("./intent-detector");
const { selectTools } = require("./tool-selector");
const { buildFlow, toActivePiecesFormat } = require("./flow-builder");
const { validateFlow, autoFix } = require("./validator");

const STAGES = { UNDERSTAND:"understand", SELECT:"select", BUILD:"build", VALIDATE:"validate", FIX:"fix", FORMAT:"format", READY:"ready", FAILED:"failed" };

function executePipeline(text, options = {}) {
  const startTime = Date.now();
  const log = [];
  let currentStage = STAGES.UNDERSTAND;
  const result = { input: text, success: false, stage_reached: null, stages: {}, flow: null, ap_format: null, errors: [], warnings: [], execution_time_ms: 0 };

  try {
    // Stage 1: Understand
    currentStage = STAGES.UNDERSTAND;
    const analysis = analyzeRequest(text);
    result.stages.understand = { primary_intent: analysis.primary_intent, entities: analysis.entities, has_automation: analysis.has_automation_intent };
    log.push("understand: " + (analysis.primary_intent?.intent || "none"));
    if (!analysis.primary_intent) { result.stage_reached = STAGES.UNDERSTAND; result.errors.push({ stage: "understand", code: "NO_INTENT", message: "لم يتم تحديد نية" }); result.execution_time_ms = Date.now() - startTime; result.log = log; return result; }

    // Stage 2: Select
    currentStage = STAGES.SELECT;
    const selection = selectTools(analysis);
    result.stages.select = { intent: selection.intent, steps_count: selection.steps?.length || 0, trigger: selection.trigger };
    log.push("select: " + (selection.steps?.length || 0) + " steps");
    if (!selection.success && selection.errors?.length > 0) { result.stage_reached = STAGES.SELECT; result.errors = selection.errors.map(e => ({ stage: "select", message: e })); result.execution_time_ms = Date.now() - startTime; result.log = log; return result; }

    // Stage 3: Build
    currentStage = STAGES.BUILD;
    const flowResult = buildFlow(selection, options);
    if (!flowResult.success) { result.stage_reached = STAGES.BUILD; result.errors.push({ stage: "build", message: flowResult.error }); result.execution_time_ms = Date.now() - startTime; result.log = log; return result; }
    log.push("build: " + flowResult.flow._metadata.total_steps + " total");

    // Stage 4: Validate
    currentStage = STAGES.VALIDATE;
    let validation = validateFlow(flowResult);
    result.stages.validate = { valid: validation.valid, errors: validation.total_errors, warnings: validation.total_warnings, summary: validation.summary };
    if (validation.total_warnings > 0) result.warnings = Object.values(validation.gates).flatMap(g => g.warnings);

    // Stage 5: Auto-Fix
    if (!validation.valid) {
      currentStage = STAGES.FIX;
      const fixResult = autoFix(flowResult.flow);
      if (fixResult.fixed) { log.push("fix: " + fixResult.fixes.length); validation = validateFlow(flowResult); result.stages.validate.valid = validation.valid; result.stages.fix = fixResult.fixes; }
      if (!validation.valid) { result.stage_reached = STAGES.VALIDATE; result.errors = Object.values(validation.gates).flatMap(g => g.errors); result.execution_time_ms = Date.now() - startTime; result.log = log; return result; }
    }
    log.push("validate: 5/5 gates");

    // Stage 6: Format
    currentStage = STAGES.FORMAT;
    const apFormat = toActivePiecesFormat(flowResult);
    result.stages.format = { trigger: apFormat?.trigger?.settings?.pieceName, actions: apFormat?.actions?.length || 0 };
    log.push("format: AP-ready");

    result.success = true;
    result.stage_reached = STAGES.READY;
    result.flow = flowResult.flow;
    result.ap_format = apFormat;
  } catch (err) {
    result.stage_reached = currentStage;
    result.errors.push({ stage: currentStage, message: err.message });
  }
  result.execution_time_ms = Date.now() - startTime;
  result.log = log;
  return result;
}

function executeBatch(requests) { return requests.map(t => executePipeline(t)); }

function healthCheck() {
  const tests = ["أبي أحجز موعد", "أرسل فاتورة للعميل", "عميل جديد يتواصل", "أبي تقرير يومي", "أرسل واتساب"];
  const results = tests.map(t => { const r = executePipeline(t); return { text: t, success: r.success, stage: r.stage_reached, time_ms: r.execution_time_ms }; });
  return { healthy: results.every(r => r.success), tests: results, timestamp: new Date().toISOString() };
}

module.exports = { executePipeline, executeBatch, healthCheck, STAGES };
