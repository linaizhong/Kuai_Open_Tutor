// Memory Manager — Affective History Operations
// Handles read/write of affective-history.json for each student
// Tracks emotional engagement signals to personalise tone and pacing

const fs = require('fs');
const path = require('path');

function affectivePath(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId, 'affective-history.json');
}

const DEFAULT_AFFECTIVE = {
  sessions: [],
};

function ensureAffectiveFile(dataRoot, studentId) {
  const p = affectivePath(dataRoot, studentId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(DEFAULT_AFFECTIVE, null, 2), 'utf8');
  }
}

/**
 * Returns the full affective history object for a student.
 */
function getAffectiveHistory(dataRoot, studentId) {
  ensureAffectiveFile(dataRoot, studentId);
  const raw = fs.readFileSync(affectivePath(dataRoot, studentId), 'utf8');
  return JSON.parse(raw);
}

/**
 * Saves the affective history object back to disk.
 */
function saveAffectiveHistory(dataRoot, studentId, history) {
  fs.writeFileSync(affectivePath(dataRoot, studentId), JSON.stringify(history, null, 2), 'utf8');
}

/**
 * Records a new affective state signal for the current session.
 * Called by the engagement-tracker passive skill.
 *
 * @param {string} dataRoot
 * @param {string} studentId
 * @param {object} signal - {
 *   engagement: "focused" | "frustrated" | "fatigued" | "confident" | "disengaged",
 *   sessionAttempts: number,
 *   recentSuccessRate: number,   // 0.0–1.0 over last N attempts
 *   notes: string,               // optional free text
 * }
 */
function updateAffectiveState(dataRoot, studentId, signal) {
  const history = getAffectiveHistory(dataRoot, studentId);

  const today = new Date().toISOString().split('T')[0];
  let session = history.sessions.find(s => s.date === today);

  if (!session) {
    session = {
      date: today,
      signals: [],
      dominantState: null,
    };
    history.sessions.push(session);
  }

  session.signals.push({
    timestamp: new Date().toISOString(),
    engagement: signal.engagement,
    sessionAttempts: signal.sessionAttempts,
    recentSuccessRate: signal.recentSuccessRate,
    notes: signal.notes || null,
  });

  // Derive dominant state from the most recent signals (last 3)
  const recent = session.signals.slice(-3).map(s => s.engagement);
  const counts = {};
  for (const e of recent) counts[e] = (counts[e] || 0) + 1;
  session.dominantState = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  // Keep sessions to last 30 days
  if (history.sessions.length > 30) {
    history.sessions = history.sessions.slice(-30);
  }

  saveAffectiveHistory(dataRoot, studentId, history);
}

/**
 * Returns the most recent affective signal for the current session.
 * Used by the Student Model Module to determine current engagement.
 */
function getCurrentAffectiveState(dataRoot, studentId) {
  const history = getAffectiveHistory(dataRoot, studentId);
  const today = new Date().toISOString().split('T')[0];
  const session = history.sessions.find(s => s.date === today);

  if (!session || session.signals.length === 0) {
    return {
      currentEngagement: 'focused',   // default assumption
      sessionAttempts: 0,
      recentSuccessRate: null,
    };
  }

  const latest = session.signals[session.signals.length - 1];
  return {
    currentEngagement: session.dominantState || latest.engagement,
    sessionAttempts: latest.sessionAttempts,
    recentSuccessRate: latest.recentSuccessRate,
  };
}

module.exports = {
  getAffectiveHistory,
  saveAffectiveHistory,
  updateAffectiveState,
  getCurrentAffectiveState,
};