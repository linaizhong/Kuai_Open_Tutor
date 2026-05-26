// adaptive-feedback/index.js
// src/main/adaptive-feedback/index.js
//
// Adaptive Feedback Engine — entry point.
//
// The AFE is the final step in the response pipeline. It receives the raw
// skill output and post-processes it based on the Student Model, adjusting:
//   - Tone       (encouragement, challenge, or support based on affective state)
//   - Scaffolding (prerequisite hints, break suggestions, simplification notes)
//   - Format     (framing note to orient the explanation to the student's style)
//   - Urgency    (exam countdown note when exam is close and readiness is low)
//
// Design principles:
//   - Never rewrites the skill's core content — only wraps/annotates it
//   - Never adds more than two adjustments to any single response
//     (prevents responses from feeling over-engineered or noisy)
//   - Always returns a string — never throws
//   - Fatigued students get SHORTER responses — verbosity is reduced
//
// Interface (matches architecture spec Section 7.4):
//   adjustResponse({ rawResponse, studentModel, skillName, skillResult })
//   → { adjustedResponse, adjustmentsApplied }

'use strict';

const toneAdjuster     = require('./tone-adjuster');
const scaffoldAdjuster = require('./scaffold-adjuster');
const formatSelector   = require('./format-selector');
const urgencyCalibrator = require('./urgency-calibrator');

// Maximum number of adjustments to apply per response.
// Keeps responses feeling natural rather than over-annotated.
const MAX_ADJUSTMENTS = 2;

// Skills whose output should never be modified (purely informational/emotional)
const READONLY_SKILLS = ['emotional-support'];

/**
 * Applies all AFE adjusters to produce a personalised response.
 *
 * @param {object} options
 *   - rawResponse   {string}  — output from the skill
 *   - studentModel  {object}  — full Student Model from StudentModelModule
 *   - skillName     {string}  — which skill produced the response
 *   - skillResult   {object}  — full skill return value (for scoreSignal etc.)
 *
 * @returns {{
 *   adjustedResponse:   string,    — final response to send to the student
 *   adjustmentsApplied: string[],  — list of adjustment names that fired
 * }}
 */
function adjustResponse({ rawResponse, studentModel, skillName, skillResult }) {
  // Safety guard — always return something valid
  if (!rawResponse || typeof rawResponse !== 'string') {
    return { adjustedResponse: rawResponse || '', adjustmentsApplied: [] };
  }

  // Read-only skills are returned unchanged
  if (READONLY_SKILLS.includes(skillName)) {
    return { adjustedResponse: rawResponse, adjustmentsApplied: [] };
  }

  const adjustmentsApplied = [];
  let response = rawResponse;

  // ── 1. Tone adjuster ─────────────────────────────────────
  const { prefix, suffix: toneSuffix, toneApplied } = toneAdjuster.adjust(
    studentModel, skillName, skillResult,
  );

  // ── 2. Scaffold adjuster ──────────────────────────────────
  const { scaffoldNote, scaffoldApplied, verbosityLevel } = scaffoldAdjuster.adjust(
    studentModel, skillName, skillResult,
  );

  // ── 3. Format selector ────────────────────────────────────
  const { formatNote, formatApplied } = formatSelector.adjust(
    studentModel, skillName, rawResponse,
  );

  // ── 4. Urgency calibrator ─────────────────────────────────
  // Only runs if tone adjuster hasn't already added urgency (avoid duplication)
  const toneAlreadyUrgent = toneApplied === 'urgent';
  const { urgencyNote, urgencyLevel } = toneAlreadyUrgent
    ? { urgencyNote: '', urgencyLevel: 'none' }
    : urgencyCalibrator.calibrate(studentModel, skillName);

  // ── Apply verbosity reduction first ──────────────────────
  // Fatigued students receive a trimmed response (last 25% truncated if very long)
  if (verbosityLevel === 'brief' && response.length > 800) {
    const cutPoint = response.lastIndexOf('\n', Math.floor(response.length * 0.65));
    if (cutPoint > 200) {
      response = response.slice(0, cutPoint) + '\n\n*(Keeping it short — you\'ve been at it a while!)*';
      adjustmentsApplied.push('verbosity:brief');
    }
  }

  // ── Collect candidates and apply up to MAX_ADJUSTMENTS ───
  // Priority order: tone > format > scaffold > urgency
  // Tone prefix/suffix always applies if set (it's the most important signal).
  // Others are applied only up to the adjustment cap.

  let adjustmentCount = 0;

  // Always apply tone prefix if present
  if (prefix) {
    response = prefix + response;
    adjustmentsApplied.push(`tone:${toneApplied}`);
    adjustmentCount++;
  }

  // Format note (prepended to response body, after tone prefix)
  if (formatNote && formatApplied !== 'none' && formatApplied !== 'already-correct'
      && adjustmentCount < MAX_ADJUSTMENTS) {
    response = (prefix ? '' : '') + formatNote + (prefix ? response.replace(prefix, '') : response);
    // Re-apply prefix correctly if both are set
    if (prefix && formatNote) {
      response = prefix + formatNote + rawResponse;
      // Remove duplicate prefix from above
    }
    adjustmentsApplied.push(`format:${formatApplied}`);
    adjustmentCount++;
  }

  // Scaffold note (appended)
  if (scaffoldNote && scaffoldApplied !== 'none' && adjustmentCount < MAX_ADJUSTMENTS) {
    response = response + scaffoldNote;
    adjustmentsApplied.push(`scaffold:${scaffoldApplied}`);
    adjustmentCount++;
  }

  // Tone suffix (appended — challenge nudge or progress visibility)
  if (toneSuffix && adjustmentCount < MAX_ADJUSTMENTS) {
    response = response + toneSuffix;
    adjustmentsApplied.push(`tone-suffix:${toneApplied}`);
    adjustmentCount++;
  }

  // Urgency note (appended — only if no other suffix already added)
  if (urgencyNote && urgencyLevel !== 'none' && adjustmentCount < MAX_ADJUSTMENTS) {
    response = response + urgencyNote;
    adjustmentsApplied.push(`urgency:${urgencyLevel}`);
    adjustmentCount++;
  }

  return {
    adjustedResponse:   response,
    adjustmentsApplied,
  };
}

module.exports = { adjustResponse };