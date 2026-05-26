// Memory Manager — Mistake Record Operations
// Handles read/write of mistakes.md for each student

const fs = require('fs');
const path = require('path');

function mistakesPath(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId, 'mistakes.md');
}

/**
 * Initialises mistakes.md if it doesn't exist.
 */
function ensureMistakesFile(dataRoot, studentId) {
  const p = mistakesPath(dataRoot, studentId);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, '## Mistake Record\n\n', 'utf8');
  }
}

/**
 * Returns the raw mistakes Markdown string.
 */
function getMistakesRaw(dataRoot, studentId) {
  ensureMistakesFile(dataRoot, studentId);
  return fs.readFileSync(mistakesPath(dataRoot, studentId), 'utf8');
}

/**
 * Parses mistakes.md into a structured array of mistake objects.
 * Each mistake block is expected to be formatted as:
 *
 * ### [timestamp] dot-point-code
 * - Problem: ...
 * - Student Answer: ...
 * - Error Type: conceptual | computational | misread
 * - Notes: ...
 */
function parseMistakes(markdown) {
  const mistakes = [];
  const blocks = markdown.split(/(?=###\s)/);

  for (const block of blocks) {
    if (!block.startsWith('###')) continue;

    const headerMatch = block.match(/^###\s+\[(.+?)\]\s+(\S+)/);
    if (!headerMatch) continue;

    const mistake = {
      timestamp: headerMatch[1],
      dotPoint: headerMatch[2],
      problem: null,
      studentAnswer: null,
      errorType: null,
      notes: null,
    };

    const lines = block.split('\n');
    for (const line of lines) {
      const m = line.match(/^-\s+(.+?):\s*(.+)$/);
      if (!m) continue;
      const key = m[1].toLowerCase().trim();
      const val = m[2].trim();
      if (key === 'problem') mistake.problem = val;
      else if (key === 'student answer') mistake.studentAnswer = val;
      else if (key === 'error type') mistake.errorType = val;
      else if (key === 'notes') mistake.notes = val;
    }

    mistakes.push(mistake);
  }

  return mistakes;
}

/**
 * Records a new mistake entry to mistakes.md.
 *
 * @param {string} dataRoot
 * @param {string} studentId
 * @param {object} mistake - { dotPoint, problem, studentAnswer, errorType, notes }
 */
function recordMistake(dataRoot, studentId, mistake) {
  ensureMistakesFile(dataRoot, studentId);

  const timestamp = new Date().toISOString();
  const entry = `
### [${timestamp}] ${mistake.dotPoint || 'unknown'}
- Problem: ${mistake.problem || ''}
- Student Answer: ${mistake.studentAnswer || ''}
- Error Type: ${mistake.errorType || 'unknown'}
- Notes: ${mistake.notes || ''}
`;

  fs.appendFileSync(mistakesPath(dataRoot, studentId), entry, 'utf8');
}

/**
 * Returns parsed mistake array for a student.
 */
function getMistakes(dataRoot, studentId) {
  const raw = getMistakesRaw(dataRoot, studentId);
  return parseMistakes(raw);
}

/**
 * Returns mistakes filtered to a specific dot-point code.
 */
function getMistakesForDotPoint(dataRoot, studentId, dotPointCode) {
  return getMistakes(dataRoot, studentId).filter(m => m.dotPoint === dotPointCode);
}

/**
 * Returns mistake count grouped by dot-point code.
 * Useful for identifying weak areas.
 */
function getMistakeSummary(dataRoot, studentId) {
  const mistakes = getMistakes(dataRoot, studentId);
  const summary = {};
  for (const m of mistakes) {
    summary[m.dotPoint] = (summary[m.dotPoint] || 0) + 1;
  }
  return summary;
}

module.exports = {
  getMistakesRaw,
  getMistakes,
  getMistakesForDotPoint,
  getMistakeSummary,
  recordMistake,
};