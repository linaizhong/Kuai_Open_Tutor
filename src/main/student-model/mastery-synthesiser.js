// student-model/mastery-synthesiser.js
//
// Responsibility:
//   Aggregates raw dot-point mastery scores from syllabus-mastery.json into
//   meaningful higher-level insights:
//     - topic-level mastery (weighted by exam weight)
//     - weakest dot-points (sorted, with gap-to-passing threshold)
//     - weakest topics (sorted by topic-level mastery)
//     - coverage (% of dot-points with any recorded attempt)

'use strict';

// Exam weight per topic as defined in the NESA syllabus.
// Used to weight topic-level mastery — Calculus matters 3× more than Financial Maths.
const TOPIC_EXAM_WEIGHTS = {
  'MA-F': 0.20,
  'MA-T': 0.15,
  'MA-C': 0.30,
  'MA-E': 0.10,
  'MA-S': 0.15,
  'MA-M': 0.10,
};

// Mastery threshold below which a dot-point is considered "weak"
const WEAK_THRESHOLD    = 0.60;

// Mastery threshold below which a topic is flagged as "at risk"
const AT_RISK_THRESHOLD = 0.55;

/**
 * Derives the topic code from a dot-point code.
 * e.g. "MA-C1.3" → "MA-C", "MA-S2.1" → "MA-S"
 *
 * @param {string} dotPointCode
 * @returns {string|null}
 */
function topicFromDotPoint(dotPointCode) {
  if (!dotPointCode) return null;
  // Match "MA-" followed by one or two uppercase letters
  const match = dotPointCode.match(/^(MA-[A-Z]{1,2})/);
  return match ? match[1] : null;
}

/**
 * Synthesises mastery data from raw syllabus-mastery.json content.
 *
 * @param {object} syllabusMastery  — raw data from memory.getContext().syllabusMastery
 * @param {object} syllabusMap      — knowledge base syllabusMap (for dot-point metadata)
 * @returns {object}
 */
function synthesise(syllabusMastery, syllabusMap) {
  const dotPoints = syllabusMastery?.dotPoints || {};

  // ── 1. Dot-point level ───────────────────────────────────
  const allDotPoints = Object.entries(dotPoints).map(([code, score]) => ({
    code,
    score,
    topic: topicFromDotPoint(code),
    gap:   Math.max(0, WEAK_THRESHOLD - score),
  }));

  const weakDotPoints = allDotPoints
    .filter(dp => dp.score < WEAK_THRESHOLD)
    .sort((a, b) => a.score - b.score);   // weakest first

  // ── 2. Topic level ───────────────────────────────────────
  // Group dot-points by topic, then compute simple average per topic
  const topicScores  = {};
  const topicCounts  = {};

  for (const { code, score } of allDotPoints) {
    const topic = topicFromDotPoint(code);
    if (!topic) continue;
    topicScores[topic]  = (topicScores[topic]  || 0) + score;
    topicCounts[topic]  = (topicCounts[topic]  || 0) + 1;
  }

  const topicMastery = {};
  for (const topic of Object.keys(topicScores)) {
    topicMastery[topic] = topicScores[topic] / topicCounts[topic];
  }

  const weakestTopics = Object.entries(topicMastery)
    .sort((a, b) => a[1] - b[1])
    .map(([code, score]) => ({ code, score }));

  const atRiskTopics = weakestTopics
    .filter(t => t.score < AT_RISK_THRESHOLD)
    .map(t => t.code);

  // ── 3. Weighted overall mastery ──────────────────────────
  // Weight each topic's average mastery by its NESA exam weight
  let weightedSum   = 0;
  let weightedTotal = 0;
  for (const [topic, score] of Object.entries(topicMastery)) {
    const weight = TOPIC_EXAM_WEIGHTS[topic] || (1 / 6);
    weightedSum   += score * weight;
    weightedTotal += weight;
  }
  const overallMastery = weightedTotal > 0
    ? weightedSum / weightedTotal
    : null;

  // ── 4. Coverage ──────────────────────────────────────────
  // % of expected dot-points with a recorded score
  const totalDotPointsInSyllabus = syllabusMap
    ? Object.keys(syllabusMap.dotPoints || {}).length
    : 30;   // known total from our KB
  const attempted = allDotPoints.length;
  const coverage  = totalDotPointsInSyllabus > 0
    ? Math.min(1.0, attempted / totalDotPointsInSyllabus)
    : null;

  return {
    masteryProfile:  dotPoints,        // raw { dotPointCode: score }
    topicMastery,                      // { "MA-C": 0.61, ... }
    weakDotPoints,                     // [{ code, score, topic, gap }] weakest first
    weakestTopics,                     // [{ code, score }] weakest first
    atRiskTopics,                      // ["MA-S", ...] topics below AT_RISK_THRESHOLD
    overallMastery,                    // 0.0–1.0 weighted by exam weight
    coverage,                          // 0.0–1.0 proportion of syllabus attempted
    dotPointCount: allDotPoints.length,
  };
}

module.exports = { synthesise, WEAK_THRESHOLD, AT_RISK_THRESHOLD, TOPIC_EXAM_WEIGHTS };