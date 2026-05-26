// Memory Manager — Learning Style Operations
// Handles read/write of learning-style.json for each student
// Learning style is inferred passively by the detect-learning-style skill

const fs = require('fs');
const path = require('path');

function learningStylePath(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId, 'learning-style.json');
}

const DEFAULT_LEARNING_STYLE = {
  preferredRepresentation: null,   // "visual" | "algebraic" | "numerical"
  respondsWellTo: [],              // e.g. ["worked examples", "analogies"]
  strugglesWith: [],               // e.g. ["abstract notation"]
  observationCount: 0,
  lastUpdated: null,
};

function ensureLearningStyleFile(dataRoot, studentId) {
  const p = learningStylePath(dataRoot, studentId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(DEFAULT_LEARNING_STYLE, null, 2), 'utf8');
  }
}

/**
 * Returns the full learning style object for a student.
 */
function getLearningStyle(dataRoot, studentId) {
  ensureLearningStyleFile(dataRoot, studentId);
  const raw = fs.readFileSync(learningStylePath(dataRoot, studentId), 'utf8');
  return JSON.parse(raw);
}

/**
 * Saves the learning style object back to disk.
 */
function saveLearningStyle(dataRoot, studentId, style) {
  style.lastUpdated = new Date().toISOString();
  fs.writeFileSync(learningStylePath(dataRoot, studentId), JSON.stringify(style, null, 2), 'utf8');
}

/**
 * Updates the learning style based on a new observation signal.
 * Called by the detect-learning-style passive skill after each interaction.
 *
 * @param {string} dataRoot
 * @param {string} studentId
 * @param {object} signal - {
 *   preferredRepresentation: "visual" | "algebraic" | "numerical" | null,
 *   respondsWellTo: string[],    // new positive signals to add
 *   strugglesWith: string[],     // new struggle signals to add
 * }
 */
function updateLearningStyle(dataRoot, studentId, signal) {
  const style = getLearningStyle(dataRoot, studentId);

  // Update preferred representation using simple vote counting
  // (the passive skill sends its best guess; we accumulate observations)
  if (signal.preferredRepresentation) {
    style.preferredRepresentation = signal.preferredRepresentation;
  }

  // Merge respondsWellTo — avoid duplicates
  if (signal.respondsWellTo && signal.respondsWellTo.length > 0) {
    const existing = new Set(style.respondsWellTo);
    for (const item of signal.respondsWellTo) {
      existing.add(item);
    }
    style.respondsWellTo = Array.from(existing);
  }

  // Merge strugglesWith — avoid duplicates
  if (signal.strugglesWith && signal.strugglesWith.length > 0) {
    const existing = new Set(style.strugglesWith);
    for (const item of signal.strugglesWith) {
      existing.add(item);
    }
    style.strugglesWith = Array.from(existing);
  }

  style.observationCount += 1;
  saveLearningStyle(dataRoot, studentId, style);
}

module.exports = {
  getLearningStyle,
  saveLearningStyle,
  updateLearningStyle,
};