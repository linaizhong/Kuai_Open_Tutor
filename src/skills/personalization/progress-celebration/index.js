// Skill: progress-celebration
// Type: active
// Phase 3 — Proactively surface genuine improvements in mastery, velocity
// or accuracy to reinforce motivation and a growth mindset.

'use strict';

// ── Topic display names ───────────────────────────────────────
const TOPIC_NAMES = {
  'MA-F': 'Functions',
  'MA-T': 'Trigonometry',
  'MA-C': 'Calculus',
  'MA-E': 'Exponential & Logarithms',
  'MA-S': 'Statistics',
  'MA-M': 'Financial Maths',
};

// ── Achievement detector ──────────────────────────────────────
// Returns a sorted list of genuine achievements, heaviest first.
function extractAchievements(studentModel) {
  const achievements = [];
  if (!studentModel) return achievements;

  const mastery   = studentModel.masteryProfile       || {};
  const velocity  = studentModel.velocity             || {};
  const forecast  = studentModel.examReadinessForecast || {};
  const affective = studentModel.affectiveState        || {};

  // 1. Mastered dot-points (≥ 85%)
  const mastered = Object.entries(mastery)
    .filter(([, v]) => v >= 0.85)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([code, score]) => ({ code, score }));

  if (mastered.length > 0) {
    achievements.push({
      type:    'mastered_dotpoints',
      weight:  4,
      summary: `mastered ${mastered.length} dot-point${mastered.length > 1 ? 's' : ''}: ${mastered.map(d => d.code).join(', ')}`,
      detail:  mastered,
    });
  }

  // 2. High overall exam readiness
  if (forecast.overall >= 0.60) {
    achievements.push({
      type:    'overall_readiness',
      weight:  3,
      summary: `overall exam readiness is ${Math.round(forecast.overall * 100)}%`,
      detail:  { overall: forecast.overall },
    });
  }

  // 3. Topics with improving velocity
  const improving = Object.entries(velocity)
    .filter(([, v]) => v?.trend === 'improving')
    .map(([code, v]) => ({ code, name: TOPIC_NAMES[code] || code, velocity: v.velocityPerSession }));

  if (improving.length > 0) {
    achievements.push({
      type:    'improving_velocity',
      weight:  3,
      summary: `momentum is building in ${improving.map(t => t.name).join(' and ')}`,
      detail:  improving,
    });
  }

  // 4. Topics with strong exam readiness forecast (≥ 70%)
  const strongTopics = Object.entries(forecast.byTopic || {})
    .filter(([, v]) => v >= 0.70)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([code, score]) => ({ code, name: TOPIC_NAMES[code] || code, score }));

  if (strongTopics.length > 0) {
    achievements.push({
      type:    'strong_topics',
      weight:  2,
      summary: `exam-ready in ${strongTopics.map(t => t.name).join(', ')}`,
      detail:  strongTopics,
    });
  }

  // 5. High recent session success rate
  if (affective.recentSuccessRate >= 0.70) {
    achievements.push({
      type:    'high_success_rate',
      weight:  2,
      summary: `${Math.round(affective.recentSuccessRate * 100)}% accuracy this session`,
      detail:  { rate: affective.recentSuccessRate },
    });
  }

  // 6. Session count milestones
  const sessions = studentModel.sessionCount ?? 0;
  if ([5, 10, 25, 50, 100].includes(sessions)) {
    achievements.push({
      type:    'session_milestone',
      weight:  1,
      summary: `completed ${sessions} study sessions`,
      detail:  { sessions },
    });
  }

  return achievements.sort((a, b) => b.weight - a.weight);
}

// ── Build celebration system prompt ───────────────────────────
function buildSystemPrompt(achievements, studentModel) {
  const name        = studentModel?.name        || null;
  const weeks       = studentModel?.weeksRemaining ?? null;
  const motStyle    = studentModel?.learningStyle?.motivationStyle || null;

  const summaries = achievements
    .slice(0, 4)
    .map(a => `  • ${a.summary}`)
    .join('\n');

  const motivationNote =
    motStyle === 'progress visibility'
      ? 'This student is motivated by seeing concrete progress numbers — be specific and quantitative.'
      : motStyle === 'challenge'
      ? 'After celebrating, end with a brief stretch goal or next challenge to aim for.'
      : motStyle === 'encouragement'
      ? 'Emphasise how far they have come and how their effort is paying off.'
      : '';

  return `You are Tute, a warm and enthusiastic HSC Mathematics Advanced tutor.
Your task is to celebrate genuine, specific progress this student has made.
${name ? `The student's name is ${name}.` : ''}
${weeks !== null ? `They have ${weeks} weeks until their HSC exam.` : ''}
${motivationNote}

GENUINE ACHIEVEMENTS TO HIGHLIGHT:
${summaries || '  • Showing up and making consistent effort'}

YOUR RESPONSE RULES:
- Lead with the most impressive achievement. Be specific — cite actual topics, dot-points, percentages.
- Sound like a proud, caring human tutor, not a chatbot generating praise.
- Do NOT use hollow phrases like "Great job!", "Well done!", "Keep it up!", "Amazing!".
- Be warm and natural. Contractions are fine. Vary your sentence rhythm.
- 3–5 sentences maximum.
- End with one forward-looking statement — what this progress means for their HSC.
- Do NOT use bullet points, headers, or lists. Write as natural flowing prose.`;
}

// ═════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════
module.exports = {
  meta: {
    name: 'progress-celebration',
    version: '1.0.0',
    type: 'active',
  },

  execute: async function (params, context) {
    const { studentModel, model } = context || {};

    const achievements = extractAchievements(studentModel);

    // Nothing measurable yet — give an honest, encouraging response
    if (achievements.length === 0) {
      return {
        result: `You're still in the early stages, and that's completely fine — everyone starts somewhere. The fact that you're here asking about your progress means you're taking this seriously. Let's focus on one topic today and get the first points on the board.`,
        visualization: null,
        syllabusPoint: null,
      };
    }

    const systemPrompt = buildSystemPrompt(achievements, studentModel);

    const result = await model.chat(
      [{ role: 'user', content: 'Please celebrate my progress and tell me specifically what I have achieved.' }],
      { system: systemPrompt, temperature: 0.75, maxTokens: 280 }
    );

    return { result, visualization: null, syllabusPoint: null };
  },
};