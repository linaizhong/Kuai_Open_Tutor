// Skill: session-planner
// Type: active
// Phase 2 — Plan the current study session by analysing mastery gaps,
// recent velocity, exam timeline and available time.

'use strict';

// ── Topic metadata ────────────────────────────────────────────
const TOPICS = [
  { code: 'MA-F', name: 'Functions',              examWeight: 20 },
  { code: 'MA-T', name: 'Trigonometry',            examWeight: 15 },
  { code: 'MA-C', name: 'Calculus',                examWeight: 30 },
  { code: 'MA-E', name: 'Exponential & Logs',      examWeight: 10 },
  { code: 'MA-S', name: 'Statistics',              examWeight: 15 },
  { code: 'MA-M', name: 'Financial Maths',         examWeight: 10 },
];

// ── Parse available minutes from free text ────────────────────
// e.g. "I have 90 minutes" → 90, "I have an hour" → 60, "30 mins" → 30
function parseAvailableMinutes(text) {
  if (!text) return null;

  const patterns = [
    { pattern: /(\d+)\s*(minutes?|mins?)/i,   factor: 1    },
    { pattern: /(\d+)\s*(hours?|hrs?)/i,       factor: 60   },
    { pattern: /(\d+\.?\d*)\s*(hours?|hrs?)/i, factor: 60   },
    { pattern: /half\s*(an?\s*)?hour/i,        fixed: 30    },
    { pattern: /an?\s*hour/i,                  fixed: 60    },
    { pattern: /two\s*hours?/i,                fixed: 120   },
    { pattern: /three\s*hours?/i,              fixed: 180   },
  ];

  for (const { pattern, factor, fixed } of patterns) {
    const m = text.match(pattern);
    if (m) return fixed !== undefined ? fixed : Math.round(parseFloat(m[1]) * factor);
  }
  return null;
}

// ── Score each topic for session priority ─────────────────────
// Combines: low mastery (gap), high exam weight, stalling velocity,
// and whether the topic is a prerequisite for others that are weak.
function scoreTopicsForSession(studentModel) {
  const mastery   = studentModel?.masteryProfile  || {};
  const velocity  = studentModel?.velocity        || {};
  const forecast  = studentModel?.examReadinessForecast?.byTopic || {};
  const weakest   = studentModel?.weakestTopics   || [];

  return TOPICS.map(topic => {
    const topicMastery   = mastery[topic.code] ?? null;
    const topicForecast  = forecast[topic.code] ?? null;
    const velocityData   = velocity[topic.code] || {};
    const isWeakest      = weakest.includes(topic.code);

    // Gap score: lower mastery → higher priority
    const gap = topicMastery !== null ? (1 - topicMastery) : 0.8; // unknown = high gap

    // Weight score: topics with higher exam % are worth more
    const weightScore = topic.examWeight / 100;

    // Urgency from forecast: low readiness = more urgent
    const forecastGap = topicForecast !== null ? (1 - topicForecast) : 0.8;

    // Velocity penalty: stalling topics get a boost (need attention)
    const velocityBoost = velocityData.trend === 'stalling' ? 0.15
                        : velocityData.trend === 'declining' ? 0.25
                        : 0;

    // Weakest flag
    const weakBoost = isWeakest ? 0.15 : 0;

    const score = (gap * 0.35) + (forecastGap * 0.25) + (weightScore * 0.25) + velocityBoost + weakBoost;

    return {
      ...topic,
      mastery:     topicMastery,
      forecast:    topicForecast,
      velocityTrend: velocityData.trend || 'unknown',
      score,
      isWeakest,
    };
  }).sort((a, b) => b.score - a.score);
}

// ── Allocate minutes across priority topics ───────────────────
// Returns a list of session blocks with recommended time and activity.
function buildSessionBlocks(rankedTopics, totalMinutes) {
  // Decide how many topics to cover based on available time
  const topicCount = totalMinutes <= 30  ? 1
                   : totalMinutes <= 60  ? 2
                   : totalMinutes <= 90  ? 3
                   : 4;

  // Reserve 5 min for session wrap-up if time allows
  const reviewMinutes = totalMinutes >= 30 ? 5 : 0;
  const studyMinutes  = totalMinutes - reviewMinutes;

  const selected = rankedTopics.slice(0, topicCount);

  // Weight allocation: highest-priority topic gets more time
  const totalWeight = selected.reduce((s, t) => s + t.score, 0);
  const blocks = selected.map((topic, i) => {
    const allocatedRaw = Math.round((topic.score / totalWeight) * studyMinutes);
    // Minimum 10 min per topic, maximum 60 min
    const allocated = Math.max(10, Math.min(60, allocatedRaw));

    const activity = topic.mastery === null
      ? 'Introduction — learn the core concepts and a worked example'
      : topic.mastery < 0.40
      ? 'Foundational practice — 2–3 guided worked examples, then attempt 1–2 questions'
      : topic.mastery < 0.70
      ? 'Consolidation practice — 3–4 mixed difficulty questions with self-marking'
      : topic.velocityTrend === 'stalling'
      ? 'Targeted review — revisit the specific dot-points where errors appear'
      : 'Challenge practice — attempt 1–2 harder questions or past paper questions';

    return {
      order:   i + 1,
      topic:   topic.name,
      code:    topic.code,
      minutes: allocated,
      mastery: topic.mastery,
      activity,
      reason:  buildReason(topic),
    };
  });

  if (reviewMinutes > 0) {
    blocks.push({
      order:    selected.length + 1,
      topic:    'Session wrap-up',
      code:     null,
      minutes:  reviewMinutes,
      activity: 'Review what you covered, note any questions to revisit, update your study list',
      reason:   'Consolidation and reflection improve long-term retention.',
    });
  }

  return blocks;
}

function buildReason(topic) {
  if (topic.mastery === null) return `You haven't started ${topic.name} yet — this is the right time to begin.`;
  if (topic.mastery < 0.40)   return `${topic.name} is your biggest gap right now (${Math.round(topic.mastery * 100)}% mastery) and worth ${topic.examWeight}% of the exam.`;
  if (topic.velocityTrend === 'stalling') return `Your progress in ${topic.name} has stalled — a focused session can get it moving again.`;
  if (topic.isWeakest)        return `${topic.name} is one of your identified weak areas.`;
  return `${topic.name} has high exam weight (${topic.examWeight}%) and still has room to improve.`;
}

// ── Build system prompt ───────────────────────────────────────
function buildSystemPrompt(blocks, totalMinutes, studentModel) {
  const name  = studentModel?.name  || null;
  const weeks = studentModel?.weeksRemaining ?? null;

  const blockSummary = blocks.map(b =>
    `  Block ${b.order}: ${b.topic}${b.code ? ` (${b.code})` : ''} — ${b.minutes} min\n` +
    `    Activity: ${b.activity}\n` +
    `    Reason: ${b.reason}`
  ).join('\n\n');

  const urgencyNote = weeks !== null
    ? weeks <= 4  ? 'URGENCY: Exam is in 4 weeks or less. Prioritise high-yield topics only. No time for low-priority content.'
    : weeks <= 8  ? 'The exam is approaching. Keep sessions focused and targeted.'
    : 'There is still time to build mastery systematically — cover gaps thoroughly.'
    : '';

  return `You are Tute, an expert HSC Mathematics Advanced study coach.
Your task is to present a clear, motivating study session plan.
${name ? `The student's name is ${name}.` : ''}
${urgencyNote}

PLANNED SESSION (${totalMinutes} minutes):
${blockSummary}

YOUR RESPONSE RULES:
- Present the plan as a clear, readable schedule the student can follow right now.
- For each block, briefly state: what to do, how long, and why it matters.
- Use a warm, coaching tone — like a tutor handing over a plan before walking away.
- Be encouraging but realistic — do not overpromise.
- End with one motivating sentence about what completing this session will achieve.
- You may use a simple numbered structure but keep each block concise (2–3 lines max).
- Do NOT use markdown headers. Keep it clean and readable as plain text.`;
}

// ═════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════
module.exports = {
  meta: {
    name: 'session-planner',
    version: '1.0.0',
    type: 'active',
  },

  execute: async function (params, context) {
    const { userInput = '', availableMinutes: paramMinutes } = params || {};
    const { studentModel, model }                            = context || {};

    // Resolve available time: param → parsed from text → default 60 min
    const totalMinutes = paramMinutes
      || parseAvailableMinutes(userInput)
      || 60;

    const rankedTopics  = scoreTopicsForSession(studentModel);
    const sessionBlocks = buildSessionBlocks(rankedTopics, totalMinutes);
    const systemPrompt  = buildSystemPrompt(sessionBlocks, totalMinutes, studentModel);

    const result = await model.chat(
      [{ role: 'user', content: `Please give me my study session plan for today. I have ${totalMinutes} minutes.` }],
      { system: systemPrompt, temperature: 0.3, maxTokens: 500 }
    );

    return { result, visualization: null, syllabusPoint: null };
  },
};