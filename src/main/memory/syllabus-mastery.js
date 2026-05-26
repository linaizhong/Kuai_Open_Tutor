// Memory Manager — Syllabus Mastery Operations
// Handles read/write of syllabus-mastery.json for each student
// Mastery scores are 0.0–1.0 per NESA dot-point code

const fs = require('fs');
const path = require('path');

function masteryPath(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId, 'syllabus-mastery.json');
}

const DEFAULT_MASTERY = {
  subject: 'HSC Mathematics Advanced',
  topics: {},
};

function ensureMasteryFile(dataRoot, studentId) {
  const p = masteryPath(dataRoot, studentId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(DEFAULT_MASTERY, null, 2), 'utf8');
  }
}

/**
 * Reads and returns the full mastery object for a student.
 */
function getSyllabusMastery(dataRoot, studentId) {
  ensureMasteryFile(dataRoot, studentId);
  const raw = fs.readFileSync(masteryPath(dataRoot, studentId), 'utf8');
  return JSON.parse(raw);
}

/**
 * Writes the mastery object back to disk.
 */
function saveSyllabusMastery(dataRoot, studentId, mastery) {
  fs.writeFileSync(masteryPath(dataRoot, studentId), JSON.stringify(mastery, null, 2), 'utf8');
}

/**
 * Returns the mastery score (0.0–1.0) for a specific dot-point.
 * Returns null if the dot-point has never been attempted.
 */
function getDotPointMastery(dataRoot, studentId, dotPointCode) {
  const mastery = getSyllabusMastery(dataRoot, studentId);
  return mastery.topics[dotPointCode]?.score ?? null;
}

/**
 * Updates the mastery score for a dot-point using a weighted rolling average.
 * New score = 0.7 * existing + 0.3 * new signal
 * On first attempt, the score is set directly from the signal.
 *
 * @param {string} dataRoot
 * @param {string} studentId
 * @param {string} dotPointCode   - e.g. "MA-C2.1"
 * @param {number} scoreSignal    - 0.0 (wrong) to 1.0 (fully correct)
 * @param {string} [source]       - optional: "quiz", "past-paper", "worked-example"
 */
function updateDotPointMastery(dataRoot, studentId, dotPointCode, scoreSignal, source = 'unknown') {
  const mastery = getSyllabusMastery(dataRoot, studentId);

  const existing = mastery.topics[dotPointCode];

  if (!existing) {
    mastery.topics[dotPointCode] = {
      score: scoreSignal,
      attempts: 1,
      lastUpdated: new Date().toISOString(),
      lastSource: source,
      history: [{ score: scoreSignal, source, timestamp: new Date().toISOString() }],
    };
  } else {
    const newScore = 0.7 * existing.score + 0.3 * scoreSignal;
    existing.score = parseFloat(newScore.toFixed(4));
    existing.attempts += 1;
    existing.lastUpdated = new Date().toISOString();
    existing.lastSource = source;
    existing.history = existing.history || [];
    existing.history.push({ score: scoreSignal, source, timestamp: new Date().toISOString() });
    // Keep history to last 20 entries to avoid unbounded growth
    if (existing.history.length > 20) existing.history = existing.history.slice(-20);
    mastery.topics[dotPointCode] = existing;
  }

  saveSyllabusMastery(dataRoot, studentId, mastery);
  return mastery.topics[dotPointCode].score;
}

/**
 * Returns all dot-points with mastery below a given threshold.
 * Default threshold is 0.6 (below 60% mastery = weak).
 */
function getWeakDotPoints(dataRoot, studentId, threshold = 0.6) {
  const mastery = getSyllabusMastery(dataRoot, studentId);
  return Object.entries(mastery.topics)
    .filter(([, v]) => v.score < threshold)
    .map(([code, v]) => ({ code, score: v.score, attempts: v.attempts }))
    .sort((a, b) => a.score - b.score);
}

/**
 * Returns mastery scores grouped by topic code (MA-F, MA-T, MA-C, etc.)
 * by averaging all dot-point scores within each topic.
 */
function getMasteryByTopic(dataRoot, studentId) {
  const mastery = getSyllabusMastery(dataRoot, studentId);
  const topicScores = {};

  for (const [code, data] of Object.entries(mastery.topics)) {
    // Topic code is the part before the first number e.g. "MA-F" from "MA-F1.3"
    const topicMatch = code.match(/^(MA-[A-Z]+)/);
    if (!topicMatch) continue;
    const topic = topicMatch[1];

    if (!topicScores[topic]) topicScores[topic] = { total: 0, count: 0 };
    topicScores[topic].total += data.score;
    topicScores[topic].count += 1;
  }

  const result = {};
  for (const [topic, { total, count }] of Object.entries(topicScores)) {
    result[topic] = parseFloat((total / count).toFixed(4));
  }
  return result;
}

/**
 * Returns a flat map of dotPointCode → score for use by the Student Model Module.
 */
function getMasteryProfile(dataRoot, studentId) {
  const mastery = getSyllabusMastery(dataRoot, studentId);
  const profile = {};
  for (const [code, data] of Object.entries(mastery.topics)) {
    profile[code] = data.score;
  }
  return profile;
}

module.exports = {
  getSyllabusMastery,
  saveSyllabusMastery,
  getDotPointMastery,
  updateDotPointMastery,
  getWeakDotPoints,
  getMasteryByTopic,
  getMasteryProfile,
};