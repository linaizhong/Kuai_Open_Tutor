// student-model/readiness-forecaster.js
//
// Responsibility:
//   Forecasts the student's predicted exam readiness score — both overall and
//   per topic — given their current mastery trajectory and time remaining.
//
//   The forecast answers: "If the student keeps studying at their current pace,
//   what mastery level will they reach by exam day?"
//
//   Formula:
//     forecastedMastery = currentMastery + (velocity × weeksRemaining × sessionsPerWeek)
//     clamped to [0.0, 1.0]
//
//   The forecast also produces:
//     - A readiness band: "on track" | "needs work" | "at risk" | "critical"
//     - A priority list of topics to focus on for maximum exam yield
//     - An urgency flag for the AFE

'use strict';

const { TOPIC_EXAM_WEIGHTS } = require('./mastery-synthesiser');

// Assumed study sessions per week (conservative default)
const DEFAULT_SESSIONS_PER_WEEK = 3;

// Readiness bands (forecast score thresholds)
const BAND_ON_TRACK   = 0.75;
const BAND_NEEDS_WORK = 0.55;
const BAND_AT_RISK    = 0.40;
// Below AT_RISK = "critical"

/**
 * Forecasts exam readiness given mastery, velocity, and time remaining.
 *
 * @param {object} masteryData   — output of mastery-synthesiser.synthesise()
 * @param {object} velocityData  — output of velocity-analyser.analyse()
 * @param {number|null} weeksRemaining
 * @param {number} sessionsPerWeek
 * @returns {object}
 */
function forecast(masteryData, velocityData, weeksRemaining, sessionsPerWeek = DEFAULT_SESSIONS_PER_WEEK) {
  const topicMastery  = masteryData?.topicMastery  || {};
  const velocityTopics = velocityData?.topics || {};

  const weeksLeft = weeksRemaining !== null && weeksRemaining !== undefined
    ? Math.max(0, weeksRemaining)
    : null;

  const sessionsLeft = weeksLeft !== null
    ? weeksLeft * sessionsPerWeek
    : null;

  // ── Per-topic forecast ────────────────────────────────────
  const byTopic = {};
  const topicPriorities = [];

  for (const [topicCode, currentMastery] of Object.entries(topicMastery)) {
    const vel        = velocityTopics[topicCode]?.velocityPerSession || 0;
    const examWeight = TOPIC_EXAM_WEIGHTS[topicCode] || (1 / 6);

    // Forecast: current mastery + expected improvement
    const expectedGain = sessionsLeft !== null
      ? Math.max(0, vel * sessionsLeft)
      : 0;

    const forecastedMastery = Math.min(1.0, currentMastery + expectedGain);

    // Gap to "on track" — how much more improvement is needed
    const gapToOnTrack = Math.max(0, BAND_ON_TRACK - forecastedMastery);

    // Priority score: high exam weight × large gap = most important to study
    const priorityScore = examWeight * gapToOnTrack;

    byTopic[topicCode] = {
      currentMastery:   Math.round(currentMastery   * 100) / 100,
      forecastedMastery: Math.round(forecastedMastery * 100) / 100,
      expectedGain:     Math.round(expectedGain     * 100) / 100,
      band:             classifyBand(forecastedMastery),
      examWeight,
      priorityScore,
    };

    topicPriorities.push({ code: topicCode, priorityScore, forecastedMastery, examWeight });
  }

  // Sort by priority score descending (highest-yield topics first)
  topicPriorities.sort((a, b) => b.priorityScore - a.priorityScore);

  // ── Overall forecast ──────────────────────────────────────
  // Weighted average of forecasted mastery by exam weight
  let weightedSum = 0, weightedTotal = 0;
  for (const [topicCode, data] of Object.entries(byTopic)) {
    weightedSum   += data.forecastedMastery * data.examWeight;
    weightedTotal += data.examWeight;
  }
  const overallForecast = weightedTotal > 0
    ? Math.round((weightedSum / weightedTotal) * 100) / 100
    : null;

  const overallBand = overallForecast !== null
    ? classifyBand(overallForecast)
    : 'unknown';

  // ── Urgency flag ──────────────────────────────────────────
  // High urgency if exam is soon AND overall forecast is below on-track
  const isUrgent = weeksLeft !== null && weeksLeft <= 6
    && overallForecast !== null && overallForecast < BAND_ON_TRACK;

  const criticalTopics = topicPriorities
    .filter(t => byTopic[t.code]?.band === 'critical')
    .map(t => t.code);

  return {
    overall:          overallForecast,
    overallBand,
    byTopic,
    priorityOrder:    topicPriorities.map(t => t.code),
    criticalTopics,
    isUrgent,
    weeksRemaining:   weeksLeft,
    sessionsRemaining: sessionsLeft,
  };
}

/**
 * Classifies a mastery score into a readiness band.
 * @param {number} score
 * @returns {"on track"|"needs work"|"at risk"|"critical"}
 */
function classifyBand(score) {
  if (score >= BAND_ON_TRACK)   return 'on track';
  if (score >= BAND_NEEDS_WORK) return 'needs work';
  if (score >= BAND_AT_RISK)    return 'at risk';
  return 'critical';
}

module.exports = { forecast, classifyBand, BAND_ON_TRACK, BAND_NEEDS_WORK, BAND_AT_RISK };