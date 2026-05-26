// student-model/style-inferrer.js
//
// Responsibility:
//   Infers the student's preferred learning style from the accumulated
//   observation history in learning-style.json.
//
//   Three representation modes are tracked:
//     "visual"      — prefers graphs, diagrams, geometric interpretations
//     "algebraic"   — prefers symbolic manipulation and formulae
//     "numerical"   — prefers concrete numbers and worked examples
//
//   Confidence levels:
//     "strong"   — ≥10 observations, clear winner
//     "emerging" — 4–9 observations, or weak signal
//     "unknown"  — <4 observations
//
//   The style inference intentionally degrades gracefully — if no clear
//   preference exists, skills receive null and use a balanced approach.

'use strict';

// Minimum observations before we trust the inferred style
const MIN_OBSERVATIONS_EMERGING = 4;
const MIN_OBSERVATIONS_STRONG   = 10;

// Minimum ratio of top style to second style to consider it "clear"
const CLEAR_PREFERENCE_RATIO = 1.4;

/**
 * Infers learning style from raw learning-style.json data.
 *
 * @param {object} learningStyleData — raw data from memory.getContext().learningStyle
 * @returns {object}
 */
function infer(learningStyleData) {
  if (!learningStyleData) {
    return _unknown();
  }

  const observationCount = learningStyleData.observationCount || 0;

  // ── Confidence level ──────────────────────────────────────
  let confidence = 'unknown';
  if (observationCount >= MIN_OBSERVATIONS_STRONG)   confidence = 'strong';
  else if (observationCount >= MIN_OBSERVATIONS_EMERGING) confidence = 'emerging';

  // If we have a directly stored preferred representation, use it
  // (written by detect-learning-style passive skill)
  const storedPreference = learningStyleData.preferredRepresentation || null;

  // Check for a clear vs. ambiguous preference
  // The passive skill stores representation counts in representationCounts
  const counts = learningStyleData.representationCounts || {};
  const visual    = counts.visual    || 0;
  const algebraic = counts.algebraic || 0;
  const numerical = counts.numerical || 0;
  const total     = visual + algebraic + numerical;

  let inferredPreference = storedPreference;
  let isAmbiguous = false;

  if (total > 0) {
    // Determine the leader
    const sorted = [
      { style: 'visual',    count: visual },
      { style: 'algebraic', count: algebraic },
      { style: 'numerical', count: numerical },
    ].sort((a, b) => b.count - a.count);

    const top    = sorted[0];
    const second = sorted[1];

    // Only declare a clear preference if the leader is meaningfully ahead
    if (second.count === 0 || top.count / second.count >= CLEAR_PREFERENCE_RATIO) {
      inferredPreference = top.style;
    } else {
      isAmbiguous = true;
      inferredPreference = storedPreference || null;
    }
  }

  // Downgrade to null if not enough observations to be meaningful
  if (confidence === 'unknown') {
    inferredPreference = null;
  }

  return {
    preferredRepresentation: inferredPreference,    // "visual"|"algebraic"|"numerical"|null
    confidence,                                      // "strong"|"emerging"|"unknown"
    isAmbiguous,
    respondsWellTo:  learningStyleData.respondsWellTo  || [],
    strugglesWith:   learningStyleData.strugglesWith   || [],
    observationCount,
    representationCounts: { visual, algebraic, numerical },
  };
}

function _unknown() {
  return {
    preferredRepresentation: null,
    confidence:              'unknown',
    isAmbiguous:             false,
    respondsWellTo:          [],
    strugglesWith:           [],
    observationCount:        0,
    representationCounts:    { visual: 0, algebraic: 0, numerical: 0 },
  };
}

module.exports = { infer };