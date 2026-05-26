// Memory Manager — Student Profile Operations
// Handles read/write of profile.md for each student

const fs = require('fs');
const path = require('path');

/**
 * Returns the path to a student's data directory.
 */
function studentDir(dataRoot, studentId) {
  return path.join(dataRoot, 'students', studentId);
}

/**
 * Returns the path to a student's profile.md file.
 */
function profilePath(dataRoot, studentId) {
  return path.join(studentDir(dataRoot, studentId), 'profile.md');
}

/**
 * Ensures the student directory exists, creating it with default files if needed.
 */
function ensureStudentExists(dataRoot, studentId) {
  const dir = studentDir(dataRoot, studentId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const profile = profilePath(dataRoot, studentId);
  if (!fs.existsSync(profile)) {
    const defaultProfile = `## Student Profile

- Name: ${studentId}
- HSC Exam Date: 
- Weekly Study Hours: 
- Subject Confidence: 
- Motivation Style: 
- Year 11 Background: 
- Extension 1 Experience: 
`;
    fs.writeFileSync(profile, defaultProfile, 'utf8');
  }
}

/**
 * Reads the raw Markdown profile for a student.
 * Returns the profile as a plain string.
 */
function getProfile(dataRoot, studentId) {
  ensureStudentExists(dataRoot, studentId);
  const p = profilePath(dataRoot, studentId);
  return fs.readFileSync(p, 'utf8');
}

/**
 * Parses the profile Markdown into a structured object.
 * Extracts known fields from the "- Key: Value" format.
 */
function parseProfile(markdown) {
  const profile = {
    name: null,
    examDate: null,
    weeklyStudyHours: null,
    subjectConfidence: null,
    motivationStyle: null,
    year11Background: null,
    extension1Experience: null,
    raw: markdown,
  };

  const fieldMap = {
    'name': 'name',
    'hsc exam date': 'examDate',
    'weekly study hours': 'weeklyStudyHours',
    'subject confidence': 'subjectConfidence',
    'motivation style': 'motivationStyle',
    'year 11 background': 'year11Background',
    'extension 1 experience': 'extension1Experience',
  };

  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^-\s+(.+?):\s*(.*)$/);
    if (match) {
      const key = match[1].toLowerCase().trim();
      const value = match[2].trim();
      if (fieldMap[key] && value) {
        profile[fieldMap[key]] = value;
      }
    }
  }

  return profile;
}

/**
 * Writes a new or updated profile.md for a student.
 * Accepts a structured profile object and serialises it to Markdown.
 */
function saveProfile(dataRoot, studentId, profileData) {
  ensureStudentExists(dataRoot, studentId);

  const markdown = `## Student Profile

- Name: ${profileData.name || ''}
- HSC Exam Date: ${profileData.examDate || ''}
- Weekly Study Hours: ${profileData.weeklyStudyHours || ''}
- Subject Confidence: ${profileData.subjectConfidence || ''}
- Motivation Style: ${profileData.motivationStyle || ''}
- Year 11 Background: ${profileData.year11Background || ''}
- Extension 1 Experience: ${profileData.extension1Experience || ''}
`;

  fs.writeFileSync(profilePath(dataRoot, studentId), markdown, 'utf8');
}

/**
 * Returns the parsed profile object for a student.
 */
function getProfileParsed(dataRoot, studentId) {
  const raw = getProfile(dataRoot, studentId);
  return parseProfile(raw);
}

module.exports = {
  ensureStudentExists,
  getProfile,
  getProfileParsed,
  saveProfile,
  parseProfile,
};