// adaptive-feedback/urgency-calibrator.js
//
// Responsibility:
//   Calibrates whether an urgency signal should be injected into the response
//   based on the student's exam timeline and their readiness forecast.
//
//   Urgency is only surfaced when ALL three conditions are true:
//     1. Exam is close (≤ 6 weeks)
//     2. Overall readiness forecast is below "on track" (< 0.75)
//     3. The skill is a substantive teaching/practice skill (not chat/emotion)
//
//   Urgency levels:
//     "high"    — ≤ 2 weeks remaining
//     "medium"  — 3–4 weeks remaining
//     "low"     — 5–6 weeks remaining
//     "none"    — > 6 weeks or already on track
//
//   Returns: { urgencyNote, urgencyLevel, priorityTopic }

'use strict';

const URGENCY_HIGH_WEEKS   = 2;
const URGENCY_MEDIUM_WEEKS = 4;
const URGENCY_LOW_WEEKS    = 6;
const ON_TRACK_THRESHOLD   = 0.75;

// Skills where urgency notes are inappropriate
const SKIP_SKILLS = [
  'emotional-support', 'general-conversation', 'progress-celebration',
  'session-summary', 'exam-technique-coach',
];

/**
 * Computes an urgency note for the response.
 *
 * @param {object} studentModel
 * @param {string} skillName
 * @returns {{ urgencyNote: string, urgencyLevel: string, priorityTopic: string|null }}
 */
function calibrate(studentModel, skillName) {
  const weeksRemaining  = studentModel?.weeksRemaining;
  const overallForecast = studentModel?.examReadinessForecast?.overall;
  const priorityOrder   = studentModel?.examReadinessForecast?.priorityOrder || [];
  const byTopic         = studentModel?.examReadinessForecast?.byTopic || {};
  const isUrgent        = studentModel?.examReadinessForecast?.isUrgent;

  // Early exits
  if (SKIP_SKILLS.includes(skillName)) {
    return { urgencyNote: '', urgencyLevel: 'none', priorityTopic: null };
  }
  if (!isUrgent || weeksRemaining === null) {
    return { urgencyNote: '', urgencyLevel: 'none', priorityTopic: null };
  }
  if (overallForecast !== null && overallForecast >= ON_TRACK_THRESHOLD) {
    return { urgencyNote: '', urgencyLevel: 'none', priorityTopic: null };
  }

  // Determine urgency level
  let urgencyLevel = 'none';
  if (weeksRemaining <= URGENCY_HIGH_WEEKS)        urgencyLevel = 'high';
  else if (weeksRemaining <= URGENCY_MEDIUM_WEEKS) urgencyLevel = 'medium';
  else if (weeksRemaining <= URGENCY_LOW_WEEKS)    urgencyLevel = 'low';

  if (urgencyLevel === 'none') {
    return { urgencyNote: '', urgencyLevel: 'none', priorityTopic: null };
  }

  // Find the highest-priority topic that is "at risk" or "critical"
  const priorityTopic = priorityOrder.find(code => {
    const band = byTopic[code]?.band;
    return band === 'critical' || band === 'at risk';
  }) || null;

  // Build the urgency note
  let urgencyNote = '';
  const weekWord  = weeksRemaining === 1 ? 'week' : 'weeks';

  if (urgencyLevel === 'high') {
    urgencyNote = `\n\n⚠️ **${weeksRemaining} ${weekWord} to the HSC.** Focus only on the highest-yield topics right now.`;
    if (priorityTopic) {
      urgencyNote += ` **${priorityTopic}** needs the most attention.`;
    }
  } else if (urgencyLevel === 'medium') {
    urgencyNote = `\n\n📅 **${weeksRemaining} ${weekWord} remaining.** Make every session count — prioritise your weak topics.`;
    if (priorityTopic) {
      urgencyNote += ` ${priorityTopic} is your highest-priority area right now.`;
    }
  } else {
    urgencyNote = `\n\n📅 ${weeksRemaining} ${weekWord} to go — stay consistent and keep targeting your weak areas.`;
  }

  return { urgencyNote, urgencyLevel, priorityTopic };
}

module.exports = { calibrate };