// Skill: explain-concept
// Migrated to MarkdownSkillRunner — all prompt logic lives in SKILL.md.
// This file is now a thin wrapper that resolves context and delegates to the runner.

'use strict';

const path               = require('path');
const MarkdownSkillRunner = require('../MarkdownSkillRunner');

const SKILL_MD_PATH = path.join(__dirname, 'SKILL.md');

// Singleton runner (stateless — safe to share)
let _runner = null;
function getRunner(model) {
  if (!_runner) _runner = new MarkdownSkillRunner({ model });
  return _runner;
}

// ─────────────────────────────────────────────────────────────
// Dot-point helpers (kept here — no prompt logic, pure data)
// ─────────────────────────────────────────────────────────────

function inferDotPoint(input, knowledgeBase) {
  if (!knowledgeBase?.syllabusMap) return null;
  const inputLower = input.toLowerCase();
  let bestMatch = null, bestScore = 0;
  try {
    for (const [code, dp] of Object.entries(knowledgeBase.dotPoints || {})) {
      let score = 0;
      for (const kw of (dp.keywords || [])) {
        if (inputLower.includes(kw.toLowerCase())) score++;
      }
      if (score > bestScore) { bestScore = score; bestMatch = code; }
    }
  } catch { /* KB not available */ }
  return bestScore > 0 ? bestMatch : null;
}

function getDotPointData(code, knowledgeBase) {
  if (!code || !knowledgeBase?.dotPoints) return null;
  return knowledgeBase.dotPoints[code] || null;
}

// ─────────────────────────────────────────────────────────────
// Skill export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name:    'explain-concept',
    version: '2.0.0',
    type:    'active',
  },

  /**
   * @param {object} params
   *   - userInput      {string}       — raw student message or topic name
   *   - dotPoint       {string|null}  — NESA dot-point code if already known
   *   - activeSubject  {string}       — current subject (e.g. 'maths-advanced')
   *   - teacherLedMode {boolean}      — whether called from Teacher-Led mode
   *
   * @param {object} context
   *   - studentId, memory, studentModel, model, knowledgeBase
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const {
      userInput,
      dotPoint: dotPointOverride,
      activeSubject,
      teacherLedMode = false,
    } = params;

    // ── 1. Resolve subject ───────────────────────────────────
    // Priority: explicit param → KB subjectId → studentModel → safe default
    const resolvedSubject =
      activeSubject ||
      knowledgeBase?.subjectId ||
      studentModel?.activeSubject ||
      'maths-advanced';

    // ── 2. Resolve dot-point ─────────────────────────────────
    const dotPointCode = dotPointOverride || inferDotPoint(userInput || '', knowledgeBase);
    const dotPointData = getDotPointData(dotPointCode, knowledgeBase);

    // ── 3. Get mastery level ─────────────────────────────────
    let masteryLevel = null;
    if (memory && dotPointCode) {
      try {
        const ctx = memory.getContext(studentId);
        masteryLevel = ctx?.syllabusMastery?.dotPoints?.[dotPointCode] ?? null;
      } catch { /* non-fatal */ }
    }

    // ── 4. Build enriched params for the runner ──────────────
    // MarkdownSkillRunner._buildUserMessage surfaces params.activeSubject
    // as the first line, so the LLM sees the correct subject immediately.
    const enrichedParams = {
      ...params,
      activeSubject: resolvedSubject,
      dotPoint:      dotPointCode,

      // Serialise dot-point context so the LLM can use it
      dotPointContext: dotPointData
        ? `Syllabus dot-point: ${dotPointData.code} — ${dotPointData.name}. ` +
          `Key concepts: ${(dotPointData.keyConcepts || []).slice(0, 4).join('; ')}.`
        : null,

      // Mastery hint for depth calibration
      masteryHint: masteryLevel !== null
        ? masteryLevel < 0.4
          ? 'Student has LOW mastery — keep foundational, avoid assumed knowledge.'
          : masteryLevel > 0.75
            ? 'Student has HIGH mastery — be concise, include deeper insight.'
            : null
        : null,

      // Teacher-led flag as readable string for the prompt
      teacherLedInstruction: teacherLedMode
        ? 'This is a Teacher-Led lesson section. Provide a complete self-contained explanation. Do NOT ask the student any questions.'
        : null,
    };

    // ── 5. Delegate to MarkdownSkillRunner ───────────────────
    const runner = getRunner(model);
    const result = await runner.execute(SKILL_MD_PATH, enrichedParams, context);

    // ── 6. Record attempt in memory ──────────────────────────
    if (memory && dotPointCode) {
      try {
        memory.recordAttempt(studentId, dotPointCode, userInput,
          'viewed concept explanation', null, null);
      } catch { /* non-fatal */ }
    }

    return {
      result:        result.result,
      visualization: null,
      syllabusPoint: dotPointCode,
      enhanced:      false,
    };
  },
};