// adaptive-feedback/tone-adjuster.js
//
// Responsibility:
//   Determines what tone prefix/suffix to wrap around the raw skill response,
//   based on the student's current affective state, motivation style, and
//   frustration depth.
//
//   The adjuster does NOT rewrite the skill's core content — it prepends a
//   brief empathetic opener and/or appends a motivational closer when the
//   student's emotional state calls for it.
//
//   Returns: { prefix, suffix, toneApplied }
//   where prefix/suffix are strings to prepend/append (may be empty).

'use strict';

/**
 * Computes a tone prefix and suffix for the response.
 *
 * @param {object} studentModel
 * @param {string} skillName       — which skill produced the response
 * @param {object} skillResult     — full skill return value
 * @returns {{ prefix: string, suffix: string, toneApplied: string }}
 */
function adjust(studentModel, skillName, skillResult) {
  const engagement     = studentModel?.affectiveState?.currentEngagement || 'focused';
  const frustDepth     = studentModel?.affectiveState?.frustrationDepth  || 'none';
  const motivStyle     = studentModel?.profile?.motivationStyle          || '';
  const successRate    = studentModel?.affectiveState?.recentSuccessRate;
  const weeksRemaining = studentModel?.weeksRemaining;

  let prefix = '';
  let suffix = '';
  let toneApplied = 'neutral';

  // ── Frustrated student ────────────────────────────────────
  if (engagement === 'frustrated') {
    if (frustDepth === 'severe') {
      prefix = "I can see this is really tough right now — that's completely normal, even for strong students. Let's slow right down.\n\n";
      toneApplied = 'very-supportive';
    } else if (frustDepth === 'moderate') {
      prefix = "This is a tricky one — you're not alone in finding it hard. Let's work through it carefully.\n\n";
      toneApplied = 'supportive';
    } else {
      prefix = "Hang in there — let's look at this together.\n\n";
      toneApplied = 'encouraging';
    }
  }

  // ── Fatigued student ─────────────────────────────────────
  else if (engagement === 'fatigued') {
    prefix = "You've been working hard — let's keep this short and clear.\n\n";
    toneApplied = 'concise';
  }

  // ── Confident / high success rate ────────────────────────
  else if (engagement === 'confident' || (successRate !== null && successRate >= 0.85)) {
    // Only add a challenge nudge for substantive skills, not general chat
    if (!['general-conversation', 'emotional-support'].includes(skillName)) {
      suffix = "\n\n💡 You're on a roll — want to try a harder version of this?";
      toneApplied = 'challenging';
    }
  }

  // ── Progress-visibility motivation style ─────────────────
  // Append a mastery note when there's a score signal to surface
  if (motivStyle === 'progress visibility' && skillResult?.scoreSignal !== undefined) {
    const score = skillResult.scoreSignal;
    if (score >= 0.8) {
      suffix += "\n\n📈 That's your mastery on this topic improving — great work.";
    } else if (score >= 0.5) {
      suffix += "\n\n📊 You're making progress on this topic — keep going.";
    }
  }

  // ── Exam urgency ──────────────────────────────────────────
  if (
    weeksRemaining !== null &&
    weeksRemaining <= 4 &&
    !['emotional-support', 'general-conversation', 'progress-celebration'].includes(skillName)
  ) {
    suffix += `\n\n⏰ With ${weeksRemaining} week${weeksRemaining === 1 ? '' : 's'} to go, every session counts — keep pushing.`;
    if (toneApplied === 'neutral') toneApplied = 'urgent';
  }

  return { prefix, suffix, toneApplied };
}

module.exports = { adjust };