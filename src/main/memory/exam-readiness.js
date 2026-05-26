// Memory Manager — Exam Readiness Operations
// Handles read/write of exam-readiness.json for each student

const fs = require('fs');
const path = require('path');

function readinessPath(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId, 'exam-readiness.json');
}

const DEFAULT_READINESS = {
  overall: 0,
  byTopic: {},
  lastUpdated: null,
};

function ensureReadinessFile(dataRoot, studentId) {
  const p = readinessPath(dataRoot, studentId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(DEFAULT_READINESS, null, 2), 'utf8');
  }
}

/**
 * Returns the full exam readiness object for a student.
 */
function getExamReadiness(dataRoot, studentId) {
  ensureReadinessFile(dataRoot, studentId);
  const raw = fs.readFileSync(readinessPath(dataRoot, studentId), 'utf8');
  return JSON.parse(raw);
}

/**
 * Saves the exam readiness object back to disk.
 */
function saveExamReadiness(dataRoot, studentId, readiness) {
  readiness.lastUpdated = new Date().toISOString();
  fs.writeFileSync(readinessPath(dataRoot, studentId), JSON.stringify(readiness, null, 2), 'utf8');
}

/**
 * Updates the exam readiness scores.
 * This is typically called by the Readiness Forecaster in the Student Model Module.
 *
 * @param {string} dataRoot
 * @param {string} studentId
 * @param {number} overall       - 0.0–1.0 overall readiness estimate
 * @param {object} byTopic       - { "MA-F": 0.82, "MA-C": 0.55, ... }
 */
function updateExamReadiness(dataRoot, studentId, overall, byTopic) {
  const readiness = getExamReadiness(dataRoot, studentId);
  readiness.overall = parseFloat(overall.toFixed(4));
  readiness.byTopic = byTopic;
  saveExamReadiness(dataRoot, studentId, readiness);
}

module.exports = {
  getExamReadiness,
  saveExamReadiness,
  updateExamReadiness,
};