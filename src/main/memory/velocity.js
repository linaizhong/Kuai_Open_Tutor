// Memory Manager — Learning Velocity Operations
// Handles read/write of velocity.json for each student
// Velocity measures how fast a student is improving per topic per session

const fs = require('fs');
const path = require('path');

function velocityPath(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId, 'velocity.json');
}

const DEFAULT_VELOCITY = {
  topics: {},
};

function ensureVelocityFile(dataRoot, studentId) {
  const p = velocityPath(dataRoot, studentId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(DEFAULT_VELOCITY, null, 2), 'utf8');
  }
}

/**
 * Returns the full velocity object for a student.
 */
function getVelocity(dataRoot, studentId) {
  ensureVelocityFile(dataRoot, studentId);
  const raw = fs.readFileSync(velocityPath(dataRoot, studentId), 'utf8');
  return JSON.parse(raw);
}

/**
 * Saves the velocity object back to disk.
 */
function saveVelocity(dataRoot, studentId, velocity) {
  fs.writeFileSync(velocityPath(dataRoot, studentId), JSON.stringify(velocity, null, 2), 'utf8');
}

/**
 * Records a mastery change event for a topic.
 * Called by the velocity-tracker passive skill after each session.
 *
 * @param {string} dataRoot
 * @param {string} studentId
 * @param {string} topicCode   - e.g. "MA-C" (topic level, not dot-point)
 * @param {string} topicLabel  - e.g. "Calculus"
 * @param {number} delta       - mastery change this session (+ve = improving, -ve = declining)
 * @param {number} attempts    - number of attempts made on this topic this session
 */
function updateVelocity(dataRoot, studentId, topicCode, topicLabel, delta, attempts) {
  const velocity = getVelocity(dataRoot, studentId);

  const existing = velocity.topics[topicCode];

  if (!existing) {
    velocity.topics[topicCode] = {
      label: topicLabel,
      velocityPerSession: delta,
      trend: delta > 0.01 ? 'improving' : delta < -0.01 ? 'declining' : 'stalling',
      avgAttemptsToConsolidate: attempts,
      sessionHistory: [{ delta, attempts, timestamp: new Date().toISOString() }],
    };
  } else {
    // Rolling average of velocity over last 5 sessions
    existing.sessionHistory = existing.sessionHistory || [];
    existing.sessionHistory.push({ delta, attempts, timestamp: new Date().toISOString() });
    if (existing.sessionHistory.length > 10) {
      existing.sessionHistory = existing.sessionHistory.slice(-10);
    }

    const recentDeltas = existing.sessionHistory.slice(-5).map(s => s.delta);
    const avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;
    existing.velocityPerSession = parseFloat(avgDelta.toFixed(4));

    // Determine trend from recent average
    if (avgDelta > 0.01) existing.trend = 'improving';
    else if (avgDelta < -0.01) existing.trend = 'declining';
    else existing.trend = 'stalling';

    // Rolling average of attempts needed
    const recentAttempts = existing.sessionHistory.slice(-5).map(s => s.attempts);
    existing.avgAttemptsToConsolidate = parseFloat(
      (recentAttempts.reduce((a, b) => a + b, 0) / recentAttempts.length).toFixed(1)
    );

    existing.label = topicLabel;
    velocity.topics[topicCode] = existing;
  }

  saveVelocity(dataRoot, studentId, velocity);
}

/**
 * Returns all topics currently flagged as stalling or declining.
 */
function getStallingTopics(dataRoot, studentId) {
  const velocity = getVelocity(dataRoot, studentId);
  return Object.entries(velocity.topics)
    .filter(([, v]) => v.trend === 'stalling' || v.trend === 'declining')
    .map(([code, v]) => ({ code, label: v.label, trend: v.trend, velocity: v.velocityPerSession }));
}

module.exports = {
  getVelocity,
  saveVelocity,
  updateVelocity,
  getStallingTopics,
};