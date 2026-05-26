// curriculum/index.js
// Curriculum Manager - Loads and manages subject curricula

'use strict';

const fs = require('fs');
const path = require('path');

const CURRICULUM_DIR = path.join(__dirname);

class CurriculumLoader {
  /**
   * Load curriculum for a subject
   * @param {string} subjectId - e.g., 'maths-advanced'
   * @returns {object} Curriculum data
   */
  static loadSubject(subjectId) {
    const filePath = path.join(CURRICULUM_DIR, `${subjectId}.json`);

    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error(`[Curriculum] Failed to load ${subjectId}:`, err.message);
    }

    // Return default/empty curriculum
    return this.getDefaultCurriculum(subjectId);
  }

  /**
   * Get default curriculum for a subject
   * @param {string} subjectId
   * @returns {object}
   */
  static getDefaultCurriculum(subjectId) {
    const defaults = {
      'maths-advanced': {
        subject: 'HSC Mathematics Advanced',
        subjectId: 'maths-advanced',
        version: '1.0.0',
        topics: {
          'MA-F1': {
            name: 'Algebraic Techniques',
            prerequisites: [],
            dotPoints: ['MA-F1.1', 'MA-F1.2', 'MA-F1.3']
          },
          'MA-C1': {
            name: 'Introduction to Differentiation',
            prerequisites: ['MA-F1'],
            dotPoints: ['MA-C1.1', 'MA-C1.2', 'MA-C1.3']
          }
        }
      }
    };

    return defaults[subjectId] || {
      subject: subjectId,
      subjectId,
      version: '1.0.0',
      topics: {}
    };
  }

  /**
   * Get list of all available curricula
   * @returns {Array<string>} Subject IDs
   */
  static listAvailable() {
    try {
      const files = fs.readdirSync(CURRICULUM_DIR);
      return files
        .filter(f => f.endsWith('.json') && f !== 'index.js')
        .map(f => f.replace('.json', ''));
    } catch {
      return ['maths-advanced'];
    }
  }
}

module.exports = CurriculumLoader;