/**
 * سيادة — المحقق (5 بوابات أمان)
 * Phase 8: Validator
 */

const fs = require("fs");
const path = require("path");

const regPath = path.join(__dirname, "..", "data", "registry", "tools-full.json");
const registry = JSON.parse(fs.readFileSync(regPath, "utf8"));
const pieceMap = {};
registry.pieces.forEach(p => pieceMap[p.id] = p);

function validateStructure(flow) {
  const errors = [], warnings = [];
  if (!flow) { errors.push({ gate: 1, code: "NO_FLOW", message: "Flow is null" }); return { passed: false, errors, warnings }; }
  if (!flow.trigger) errors.push({ gate: 1, code: "NO_TRIGGER", message: "No trigger" });
  if (!flow.steps || flow.steps.length === 0) errors.push({ gate: 1, code: "NO_STEPS", message: "No steps" });
  if (!flow._metadata) warnings.push({ gate: 1, code: "NO_METADATA", message: "No metadata" });
  if (flow.trigger) {
    if (!flow.trigger.piece_id) errors.push({ gate: 1, code: "TRIGGER_NO_PIECE", message: "Trigger missing piece_id" });
    if (!flow.trigger.trigger_name) errors.push({ gate: 1, code: "TRIGGER_NO_NAME", message: "Trigger missing trigger_name" });
  }
  if (flow.steps) {
    flow.steps.forEach((s, i) => {
      if (!s.piece_id) errors.push({ gate: 1, code: "STEP_NO_PIECE", message: `Step ${i+1} missing piece_id` });
      if (!s.action_name) errors.push({ gate: 1, code: "STEP_NO_ACTION", message: `Step ${i+1} missing action_name` });
      if (!s.index) errors.push({ gate: 1, code: "STEP_NO_INDEX", message: `Step ${i+1} missing index` });
    });
    const idx = flow.steps.map(s => s.index);
    const dupes = idx.filter((v, i) => idx.indexOf(v) !== i);
    if (dupes.length) errors.push({ gate: 1, code: "DUPLICATE_INDEX", message: `Duplicate indices: ${dupes}` });
  }
  return { passed: errors.length === 0, errors, warnings };
}

function validateRegistry(flow) {
  const errors = [], warnings = [];
  if (flow.trigger) {
    const p = pieceMap[flow.trigger.piece_id];
    if (!p) errors.push({ gate: 2, code: "TRIGGER_PIECE_NOT_FOUND", message: `Trigger '${flow.trigger.piece_id}' not in registry` });
    else if (!p.triggers.some(t => t.name === flow.trigger.trigger_name))
      errors.push({ gate: 2, code: "TRIGGER_NOT_FOUND", message: `Trigger '${flow.trigger.trigger_name}' not in ${flow.trigger.piece_id}` });
  }
  (flow.steps || []).forEach(s => {
    const p = pieceMap[s.piece_id];
    if (!p) errors.push({ gate: 2, code: "PIECE_NOT_FOUND", message: `Step ${s.index}: '${s.piece_id}' not in registry` });
    else if (!p.actions.some(a => a.name === s.action_name))
      errors.push({ gate: 2, code: "ACTION_NOT_FOUND", message: `Step ${s.index}: '${s.action_name}' not in ${s.piece_id}` });
  });
  return { passed: errors.length === 0, errors, warnings };
}

function validateConnections(flow) {
  const errors = [], warnings = [];
  const builtins = new Set(["webhook", "schedule", "branch", "code", "delay", "loop", "storage", "http"]);
  const allPieces = [flow.trigger?.piece_id, ...(flow.steps || []).map(s => s.piece_id)].filter(Boolean);
  const declared = new Set(flow.connections_required || []);
  for (const pid of allPieces) {
    if (builtins.has(pid)) continue;
    const p = pieceMap[pid];
    if (!p) { errors.push({ gate: 3, code: "UNKNOWN_PIECE", message: `'${pid}' not in registry` }); continue; }
    if (p.auth_type && p.auth_type !== "none" && !declared.has(pid))
      warnings.push({ gate: 3, code: "MISSING_CONNECTION", message: `'${pid}' needs auth but not declared` });
  }
  return { passed: errors.length === 0, errors, warnings };
}

function validateVariables(flow) {
  const errors = [], warnings = [];
  const definedOutputs = new Set(["trigger", "config"]);
  (flow.steps || []).forEach(s => definedOutputs.add(`steps.step_${s.index}`));
  (flow.steps || []).forEach(step => {
    const input = step.settings?.input || {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== "string") continue;
      const refs = value.match(/steps\.step_(\d+)/g) || [];
      for (const ref of refs) {
        const refIdx = parseInt(ref.replace("steps.step_", ""));
        if (refIdx >= step.index)
          errors.push({ gate: 4, code: "FORWARD_REF", message: `Step ${step.index}: refs future step_${refIdx}` });
      }
    }
  });
  return { passed: errors.length === 0, errors, warnings };
}

function validateSafety(flow) {
  const errors = [], warnings = [];
  const dangerous = [
    { pattern: /rm\s+-rf/i, code: "DANGEROUS_CMD" },
    { pattern: /DROP\s+TABLE/i, code: "SQL_INJECTION" },
    { pattern: /<script/i, code: "XSS" },
    { pattern: /eval\s*\(/i, code: "CODE_INJECTION" },
  ];
  (flow.steps || []).forEach(step => {
    const input = step.settings?.input || {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== "string") continue;
      for (const d of dangerous) {
        if (d.pattern.test(value))
          errors.push({ gate: 5, code: d.code, message: `Step ${step.index} (${key}): ${d.code}` });
      }
      if ((key === "message" || key === "body") && value.length > 4096)
        warnings.push({ gate: 5, code: "LONG_MESSAGE", message: `Step ${step.index}: >4096 chars` });
    }
  });
  const pieceCounts = {};
  (flow.steps || []).forEach(s => { pieceCounts[s.piece_id] = (pieceCounts[s.piece_id] || 0) + 1; });
  for (const [pid, c] of Object.entries(pieceCounts))
    if (c > 5) warnings.push({ gate: 5, code: "HIGH_API_USAGE", message: `'${pid}' used ${c}x` });
  return { passed: errors.length === 0, errors, warnings };
}

function validateFlow(flowResult) {
  if (!flowResult?.success || !flowResult?.flow) {
    return { valid: false, gates: { 1: { passed: false, errors: [{ gate: 1, code: "INVALID_INPUT", message: "Invalid" }], warnings: [] } }, total_errors: 1, total_warnings: 0 };
  }
  const flow = flowResult.flow;
  const gates = { 1: validateStructure(flow), 2: validateRegistry(flow), 3: validateConnections(flow), 4: validateVariables(flow), 5: validateSafety(flow) };
  const te = Object.values(gates).reduce((s, g) => s + g.errors.length, 0);
  const tw = Object.values(gates).reduce((s, g) => s + g.warnings.length, 0);
  return {
    valid: te === 0, gates, total_errors: te, total_warnings: tw,
    summary: { gate_1: gates[1].passed?"✅":"❌", gate_2: gates[2].passed?"✅":"❌", gate_3: gates[3].passed?"✅":"❌", gate_4: gates[4].passed?"✅":"❌", gate_5: gates[5].passed?"✅":"❌" },
  };
}

function autoFix(flow) {
  const fixes = [];
  (flow.steps || []).forEach((step, i) => {
    if (!step.index) { step.index = i + 1; fixes.push({ step: i+1, fix: "add_index" }); }
    const input = step.settings?.input || {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value !== "string") continue;
      if ((key === "number" || key === "receiver" || key === "to") && !value.startsWith("{{") && /^05\d{8}$/.test(value)) {
        input[key] = "+966" + value.substring(1); fixes.push({ step: step.index, field: key, fix: "phone_normalize" });
      }
    }
  });
  return { fixed: fixes.length > 0, fixes, flow };
}

module.exports = { validateStructure, validateRegistry, validateConnections, validateVariables, validateSafety, validateFlow, autoFix };
