// adaptive-feedback/scaffold-adjuster.js
//
// Responsibility:
//   Decides whether the raw response needs a scaffolding note appended —
//   either a simplification suggestion (when student is overloaded/weak) or
//   a complexity reduction note (when cognitive load is elevated).
//
//   The adjuster does NOT rewrite the core content. It appends a short
//   contextual scaffold note when warranted.
//
//   Returns: { scaffoldNote, scaffoldApplied, verbosityLevel }
//   where scaffoldNote is a string to append (may be empty).

'use strict';

/**
 * Computes a scaffolding note based on mastery and cognitive load signals.
 *
 * @param {object} studentModel
 * @param {string} skillName
 * @param {object} skillResult
 * @returns {{ scaffoldNote: string, scaffoldApplied: string, verbosityLevel: string }}
 */
function adjust(studentModel, skillName, skillResult) {
  const engagement       = studentModel?.affectiveState?.currentEngagement || 'focused';
  const overallMastery   = studentModel?.overallMastery;
  const successRate      = studentModel?.affectiveState?.recentSuccessRate;
  const syllabusPoint    = skillResult?.syllabusPoint;
  const needsIntervention = studentModel?.velocity?.needsIntervention || [];
  const atRiskTopics     = studentModel?.atRiskTopics || [];

  let scaffoldNote   = '';
  let scaffoldApplied = 'none';
  let verbosityLevel  = 'normal';

  // ── Fatigued → reduce verbosity ───────────────────────────
  if (engagement === 'fatigued') {
    verbosityLevel  = 'brief';
    scaffoldApplied = 'brevity';
    // Note: actual truncation happens in index.js using this signal
  }

  // ── Very low mastery on this topic → suggest prerequisite ─
  const topicCode = syllabusPoint ? syllabusPoint.match(/^(MA-[A-Z]+)/)?.[1] : null;
  const isAtRisk  = topicCode && atRiskTopics.includes(topicCode);
  const isStuck   = topicCode && needsIntervention.includes(topicCode);

  if (isAtRisk && isStuck && !['general-conversation', 'emotional-support', 'session-summary'].includes(skillName)) {
    scaffoldNote   = `\n\n🔍 **Tip:** ${topicCode} is one of your trickier areas right now. If this still feels unclear, it may help to first review the prerequisite concepts — try asking me "what do I need to know before ${topicCode}?"`;
    scaffoldApplied = 'prerequisite-hint';
  }

  // ── Overloaded → suggest a break ─────────────────────────
  else if (engagement === 'fatigued' && successRate !== null && successRate < 0.35) {
    scaffoldNote   = '\n\n🧠 You\'ve been going hard — a 5-minute break now will actually help you retain more. Come back fresh!';
    scaffoldApplied = 'break-suggestion';
  }

  // ── Stalling on topic but not overloaded → suggest simpler approach ──
  else if (isStuck && !isAtRisk && overallMastery !== null && overallMastery < 0.55) {
    scaffoldNote   = `\n\n💬 This topic has been taking a while to click — that's okay. Want me to try explaining it a different way?`;
    scaffoldApplied = 'alternative-approach';
  }

  return { scaffoldNote, scaffoldApplied, verbosityLevel };
}

module.exports = { adjust };
