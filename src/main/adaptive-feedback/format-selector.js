// adaptive-feedback/format-selector.js
//
// Responsibility:
//   Detects whether the raw response already leads with the student's
//   preferred representation style. If not, prepends a brief framing
//   line to orient the explanation correctly.
//
//   This is a lightweight post-processor — the real format shaping
//   happens inside each skill's system prompt (which already uses
//   studentModel.learningStyle). This adjuster adds a framing note
//   when the skill response doesn't naturally lead with the right style.
//
//   Returns: { formatNote, formatApplied }

'use strict';

// Keywords that suggest a response already leads with a given style
const VISUAL_INDICATORS    = ['sketch', 'graph', 'diagram', 'geometri', 'picture', 'visually', 'plot', 'draw'];
const ALGEBRAIC_INDICATORS = ['formula', 'equation', 'differentiat', 'integrat', 'expand', 'factoris', 'substitut', 'algebraic'];
const NUMERICAL_INDICATORS = ['for example', 'e.g.', 'let x =', 'try x =', 'substitute x', 'numerically', 'concrete'];

/**
 * Checks if a response already reflects the preferred style.
 * @param {string} response  — lowercased response text
 * @param {string} style     — "visual" | "algebraic" | "numerical"
 * @returns {boolean}
 */
function responseMatchesStyle(response, style) {
  const lower = response.toLowerCase().slice(0, 400);  // check opening only
  let indicators;
  if (style === 'visual')    indicators = VISUAL_INDICATORS;
  else if (style === 'algebraic') indicators = ALGEBRAIC_INDICATORS;
  else if (style === 'numerical') indicators = NUMERICAL_INDICATORS;
  else return true;

  return indicators.some(kw => lower.includes(kw));
}

/**
 * Selects a format framing note based on learning style preference.
 *
 * @param {object} studentModel
 * @param {string} skillName
 * @param {string} rawResponse
 * @returns {{ formatNote: string, formatApplied: string }}
 */
function adjust(studentModel, skillName, rawResponse) {
  const style      = studentModel?.learningStyle?.preferredRepresentation;
  const confidence = studentModel?.learningStyle?.confidence || 'unknown';

  // Only apply if confidence is emerging or strong — don't guess on unknown
  if (!style || confidence === 'unknown') {
    return { formatNote: '', formatApplied: 'none' };
  }

  // Don't apply format notes to these skills — they manage format themselves
  const skipSkills = ['emotional-support', 'general-conversation', 'session-summary',
                      'progress-celebration', 'identify-syllabus-topic', 'exam-technique-coach'];
  if (skipSkills.includes(skillName)) {
    return { formatNote: '', formatApplied: 'none' };
  }

  // If the response already leads with the right style, nothing to do
  if (responseMatchesStyle(rawResponse, style)) {
    return { formatNote: '', formatApplied: 'already-correct' };
  }

  // Prepend a framing line to orient the student to their preferred mode
  let formatNote = '';
  if (style === 'visual') {
    formatNote = "*(You learn well from visual explanations — picture this geometrically as you read through.)*\n\n";
  } else if (style === 'numerical') {
    formatNote = "*(You find concrete numbers helpful — try substituting specific values as you follow these steps.)*\n\n";
  } else if (style === 'algebraic') {
    formatNote = "*(Focusing on the algebraic structure here will help it click.)*\n\n";
  }

  return {
    formatNote,
    formatApplied: style,
  };
}

module.exports = { adjust };