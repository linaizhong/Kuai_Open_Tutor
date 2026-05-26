// src/main/knowledge-base/index.js
// Knowledge Base Manager
// Dynamically discovers and loads all subjects from the knowledge-base folder
//
// EXPORT: Direct class export for use with: const KnowledgeBaseManager = require('./knowledge-base');

'use strict';

const fs = require('fs');
const path = require('path');

class KnowledgeBaseManager {
  /**
   * @param {string} kbRoot - Absolute path to knowledge-base directory
   */
  constructor(kbRoot) {
    this.kbRoot = kbRoot;
    this.subjects = new Map();  // subjectId → subject metadata
    this.cache = new Map();     // subjectId → loaded knowledge base
  }

  /**
   * Scan the knowledge-base directory and discover all subjects
   * @returns {Map} Map of discovered subjects
   */
  discoverSubjects() {
    console.log(`[KBManager] Scanning for subjects in: ${this.kbRoot}`);

    if (!fs.existsSync(this.kbRoot)) {
      console.warn(`[KBManager] Knowledge base directory not found: ${this.kbRoot}`);
      return this.subjects;
    }

    const entries = fs.readdirSync(this.kbRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subjectPath = path.join(this.kbRoot, entry.name);
        const manifestPath = path.join(subjectPath, 'manifest.json');

        // Check if this is a valid subject directory
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            this.subjects.set(manifest.id, {
              id: manifest.id,
              name: manifest.name,
              shortName: manifest.shortName,
              path: subjectPath,
              categories: manifest.categories || [],
              suggestions: manifest.suggestions || [],
              quickActions: manifest.quickActions || [],
              filenames: manifest.filenames || this._getDefaultFilenames(),
              icon: manifest.icon,
              enabled: manifest.enabled !== false,
            });
            console.log(`[KBManager] Discovered subject: ${manifest.id} (${manifest.name})`);
          } catch (err) {
            console.error(`[KBManager] Failed to load manifest for ${entry.name}:`, err.message);
          }
        } else {
          // Skip folders without manifest.json - they're not subjects
          console.log(`[KBManager] Skipping ${entry.name} - no manifest.json (not a subject)`);
        }
      }
    }

    console.log(`[KBManager] Total subjects discovered: ${this.subjects.size}`);
    return this.subjects;
  }

  /**
   * Load a specific subject's knowledge base
   * @param {string} subjectId - Subject ID to load
   * @returns {object|null} Loaded knowledge base object
   */
  getActiveSubject(subjectId) {
    // Return from cache if already loaded
    if (this.cache.has(subjectId)) {
      return this.cache.get(subjectId);
    }

    const subject = this.subjects.get(subjectId);
    if (!subject) {
      console.error(`[KBManager] Subject not found: ${subjectId}`);
      return null;
    }

    try {
      const filenames = subject.filenames;
      const basePath = subject.path;

      const knowledgeBase = {
        subjectId,
        subjectMeta: {
          name: subject.name,
          shortName: subject.shortName,
          icon: subject.icon,
          categories: subject.categories,
          suggestions: subject.suggestions,
          quickActions: subject.quickActions,
        },
        syllabusMap: this._safeRequire(path.join(basePath, 'syllabus', filenames.syllabusMap)),
        dotPoints: this._safeRequire(path.join(basePath, 'syllabus', filenames.dotPoints)),
        questionIndex: this._safeRequire(path.join(basePath, 'past-papers', filenames.questionIndex)) || [],
        questions: this._safeRequire(path.join(basePath, 'past-papers', 'questions', filenames.questions)) || {},
        markingGuidelinesIndex: this._safeRequire(path.join(basePath, 'marking-guidelines', filenames.markingGuidelinesIndex)),
      };

      this.cache.set(subjectId, knowledgeBase);
      console.log(`[KBManager] Loaded subject: ${subjectId}`);
      return knowledgeBase;
    } catch (err) {
      console.error(`[KBManager] Failed to load subject ${subjectId}:`, err.message);
      return null;
    }
  }

  /**
   * Get all enabled subjects (for UI dropdown)
   * @returns {Array} Array of subject metadata
   */
  getAllSubjects() {
    return Array.from(this.subjects.values())
      .filter(s => s.enabled)
      .map(s => ({
        id: s.id,
        name: s.name,
        shortName: s.shortName,
        icon: s.icon,
        categories: s.categories,
        suggestions: s.suggestions,
        quickActions: s.quickActions,
      }));
  }

  /**
   * Get subject by ID
   * @param {string} subjectId
   * @returns {object|null} Subject metadata
   */
  getSubject(subjectId) {
    return this.subjects.get(subjectId) || null;
  }

  /**
   * Check if a subject exists
   * @param {string} subjectId
   * @returns {boolean}
   */
  hasSubject(subjectId) {
    return this.subjects.has(subjectId);
  }

  /**
   * Reload a subject (clear cache)
   * @param {string} subjectId
   * @returns {object|null} Reloaded knowledge base
   */
  reloadSubject(subjectId) {
    this.cache.delete(subjectId);
    return this.getActiveSubject(subjectId);
  }

  // ========== CATEGORY MANAGEMENT METHODS ==========

  /**
   * Get categories for a subject
   * @param {string} subjectId
   * @returns {string[]} Array of category names
   */
  getSubjectCategories(subjectId) {
    const subject = this.subjects.get(subjectId);
    if (!subject) return [];

    // Return from manifest, or infer if not present
    return subject.categories || this._inferCategories(subjectId);
  }

  /**
   * Check if a skill category is relevant for a subject
   * @param {string} subjectId
   * @param {string} skillCategory
   * @returns {boolean}
   */
  isCategoryRelevantForSubject(subjectId, skillCategory) {
    const categories = this.getSubjectCategories(subjectId);
    return categories.includes(skillCategory);
  }

  /**
   * Get all skill categories that are relevant for a subject
   * @param {string} subjectId
   * @returns {string[]}
   */
  getRelevantSkillCategories(subjectId) {
    return this.getSubjectCategories(subjectId);
  }

  // ========== SUGGESTION METHODS ==========

  /**
   * Get suggestions and quick actions for a subject
   * @param {string} subjectId
   * @returns {{ suggestions: Array, quickActions: Array }}
   */
  getSubjectSuggestions(subjectId) {
    const subject = this.subjects.get(subjectId);
    return {
      success: true,
      suggestions: subject?.suggestions || [],
      quickActions: subject?.quickActions || [],
    };
  }

  /**
   * Get quick actions for a subject
   * @param {string} subjectId
   * @returns {Array} Array of quick action objects
   */
  getSubjectQuickActions(subjectId) {
    const subject = this.subjects.get(subjectId);
    return subject?.quickActions || [];
  }

  // ========== HELPER METHODS ==========

  /**
   * Helper: safely require a JSON file
   * @param {string} filePath
   * @returns {object|null}
   * @private
   */
  _safeRequire(filePath) {
    try {
      return require(filePath);
    } catch (err) {
      // File doesn't exist or is invalid JSON - return null
      return null;
    }
  }

  /**
   * Helper: get default filenames
   * @returns {object}
   * @private
   */
  _getDefaultFilenames() {
    return {
      syllabusMap: 'syllabus-map.json',
      dotPoints: 'dot-points.json',
      questionIndex: 'index.json',
      questions: 'questions.json',
      markingGuidelinesIndex: 'marking-guidelines-index.json',
    };
  }

  /**
   * Helper: infer categories from subject name (fallback if not in manifest)
   * @param {string} folderName
   * @returns {string[]}
   * @private
   */
  _inferCategories(folderName) {
    if (folderName.includes('math')) {
      return ['math', 'assessment', 'exam-prep'];
    }
    if (folderName.includes('english')) {
      return ['english', 'writing', 'reading'];
    }
    if (folderName.includes('toefl')) {
      return ['toefl', 'writing', 'reading', 'listening', 'speaking'];
    }
    if (folderName.includes('physics')) {
      return ['science', 'math', 'assessment', 'lab', 'calculation', 'plotting'];
    }
    return ['general'];
  }
}

// ============================================================
// EXPORT: Direct class export
// Use in other files: const KnowledgeBaseManager = require('./knowledge-base');
// ============================================================
module.exports = KnowledgeBaseManager;