// Memory Manager — Progress Operations
// Handles read/write of progress.json for each student

const fs = require('fs');
const path = require('path');

function progressPath(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId, 'progress.json');
}

const DEFAULT_PROGRESS = {
  sessions: [],
  totalAttempts: 0,
  totalCorrect: 0,
  totalSessions: 0,
  lastSessionDate: null,
};

function ensureProgressFile(dataRoot, studentId) {
  const p = progressPath(dataRoot, studentId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(DEFAULT_PROGRESS, null, 2), 'utf8');
  }
}

/**
 * Reads and returns the full progress object for a student.
 */
function getProgress(dataRoot, studentId) {
  ensureProgressFile(dataRoot, studentId);
  const raw = fs.readFileSync(progressPath(dataRoot, studentId), 'utf8');
  return JSON.parse(raw);
}

/**
 * Writes the progress object back to disk.
 */
function saveProgress(dataRoot, studentId, progress) {
  ensureProgressFile(dataRoot, studentId);
  fs.writeFileSync(progressPath(dataRoot, studentId), JSON.stringify(progress, null, 2), 'utf8');
}

/**
 * Records a single attempt against a problem.
 * Updates session stats and overall totals.
 *
 * @param {string} dataRoot
 * @param {string} studentId
 * @param {string} dotPoint   - NESA dot-point code e.g. "MA-C2.1"
 * @param {string} problem    - problem description or ID
 * @param {string} result     - student's answer summary
 * @param {boolean} isCorrect - whether the attempt was correct
 */
function recordAttempt(dataRoot, studentId, dotPoint, problem, result, isCorrect) {
  const progress = getProgress(dataRoot, studentId);

  const attempt = {
    timestamp: new Date().toISOString(),
    dotPoint,
    problem,
    result,
    isCorrect,
  };

  // Find or create today's session
  const today = new Date().toISOString().split('T')[0];
  let session = progress.sessions.find(s => s.date === today);

  if (!session) {
    session = {
      date: today,
      attempts: [],
      correct: 0,
      total: 0,
    };
    progress.sessions.push(session);
    progress.totalSessions += 1;
  }

  session.attempts.push(attempt);
  session.total += 1;
  if (isCorrect) session.correct += 1;

  progress.totalAttempts += 1;
  if (isCorrect) progress.totalCorrect += 1;
  progress.lastSessionDate = today;

  saveProgress(dataRoot, studentId, progress);
  return attempt;
}

/**
 * Returns overall accuracy rate (0–1) across all attempts.
 */
function getOverallAccuracy(dataRoot, studentId) {
  const progress = getProgress(dataRoot, studentId);
  if (progress.totalAttempts === 0) return 0;
  return progress.totalCorrect / progress.totalAttempts;
}

/**
 * Returns accuracy rate for a specific dot-point.
 */
function getAccuracyForDotPoint(dataRoot, studentId, dotPoint) {
  const progress = getProgress(dataRoot, studentId);
  const attempts = progress.sessions
    .flatMap(s => s.attempts)
    .filter(a => a.dotPoint === dotPoint);

  if (attempts.length === 0) return null;
  const correct = attempts.filter(a => a.isCorrect).length;
  return correct / attempts.length;
}

/**
 * Returns the most recent N sessions.
 */
function getRecentSessions(dataRoot, studentId, n = 5) {
  const progress = getProgress(dataRoot, studentId);
  return progress.sessions.slice(-n);
}

/**
 * Returns attempt count for a specific dot-point.
 */
function getAttemptCountForDotPoint(dataRoot, studentId, dotPoint) {
  const progress = getProgress(dataRoot, studentId);
  return progress.sessions
    .flatMap(s => s.attempts)
    .filter(a => a.dotPoint === dotPoint)
    .length;
}

module.exports = {
  getProgress,
  saveProgress,
  recordAttempt,
  getOverallAccuracy,
  getAccuracyForDotPoint,
  getRecentSessions,
  getAttemptCountForDotPoint,
};