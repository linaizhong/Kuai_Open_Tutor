// Skill Manager — Main Entry Point
// Scans skills/, registers all plugins, matches user input, and executes skills.
// Supports nested skill organization with category grouping.
// This is the ONLY file the Agent Coordinator imports.

const path    = require('path');
const { loadSkills }                                      = require('./loader');
const { findBestSkill, findBestSkillForSubject, getPassiveSkills, getTopMatches } = require('./matcher');

class SkillManager {
  /**
   * @param {string} skillsRoot - Absolute path to src/skills/
   */
  constructor(skillsRoot) {
    if (!skillsRoot) throw new Error('SkillManager: skillsRoot is required');
    this.skillsRoot = skillsRoot;
    this._skills    = [];        // all registered skills
    this._loaded    = false;
  }

  // ============================================================
  // INITIALISATION
  // ============================================================

  /**
   * Scans the skills directory and loads all skill plugins.
   * Must be called once on application startup before using the manager.
   */
  load() {
    this._skills = loadSkills(this.skillsRoot);
    this._loaded = true;
    return this;
  }

  /**
   * Reloads all skills from disk (useful during development).
   */
  reload() {
    // Clear require cache for skill modules so changes are picked up
    for (const skill of this._skills) {
      delete require.cache[require.resolve(path.join(skill.dirPath, 'index.js'))];
    }
    return this.load();
  }

  _assertLoaded() {
    if (!this._loaded) throw new Error('SkillManager: call load() before using the manager');
  }

  // ============================================================
  // SKILL LOOKUP
  // ============================================================

  /**
   * Returns all registered skills.
   */
  getAllSkills() {
    this._assertLoaded();
    return this._skills;
  }

  /**
   * Returns all active skills.
   */
  getActiveSkills() {
    this._assertLoaded();
    return this._skills.filter(s => s.type === 'active');
  }

  /**
   * Returns all passive skills.
   */
  getPassiveSkills() {
    this._assertLoaded();
    return getPassiveSkills(this._skills);
  }

  /**
   * Finds a skill by its directory name (canonical ID).
   * @param {string} name  e.g. "hsc-worked-example"
   * @returns {object|null}
   */
  getSkill(name) {
    this._assertLoaded();
    return this._skills.find(s => s.name === name) || null;
  }

  /**
   * Returns a summary list (name + type + description + category) for display in the UI.
   * @param {string|null} category - Optional filter by category
   */
  listSkills(category = null) {
    this._assertLoaded();

    let skills = this._skills;
    if (category) {
      skills = skills.filter(s => s.category === category);
    }

    return skills.map(s => ({
      name:        s.name,
      type:        s.type,
      category:    s.category,
      description: s.description,
    }));
  }

  // ============================================================
  // CATEGORY METHODS
  // ============================================================

  /**
   * Returns all unique skill categories.
   * @returns {string[]}
   */
  getCategories() {
    this._assertLoaded();
    const categories = new Set();
    for (const skill of this._skills) {
      if (skill.category) categories.add(skill.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Returns skills grouped by category.
   * @returns {Object} - { categoryName: [skills...] }
   */
  getSkillsByCategory() {
    this._assertLoaded();
    const grouped = {};

    for (const skill of this._skills) {
      const category = skill.category || 'uncategorized';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({
        name:        skill.name,
        type:        skill.type,
        description: skill.description,
      });
    }

    return grouped;
  }

  /**
   * Returns skills for a specific category.
   * @param {string} category - Category name (e.g., 'math', 'exam-prep')
   * @returns {object[]}
   */
  getSkillsByCategoryName(category) {
    this._assertLoaded();
    return this._skills.filter(s => s.category === category);
  }

  /**
   * Returns a hierarchical tree of skills by their folder structure.
   * Useful for debugging or displaying the full organization.
   * @returns {Object}
   */
  getSkillTree() {
    this._assertLoaded();
    const tree = {};

    for (const skill of this._skills) {
      if (!skill.relativePath) continue;

      const parts = skill.relativePath.split(path.sep);
      let current = tree;

      // Build the path hierarchy
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
      }

      // Add the skill at the leaf
      const leafName = parts[parts.length - 1];
      if (!current._skills) current._skills = [];
      current._skills.push({
        name: skill.name,
        type: skill.type,
      });
    }

    return tree;
  }

  // ============================================================
  // SKILL MATCHING
  // ============================================================

  /**
   * Finds the best matching active skill for the user's input.
   * Falls back to "general-conversation" if no skill matches.
   *
   * @param {string} userInput
   * @returns {{ skill: object|null, score: number, matchedBy: string }}
   */
  findSkill(userInput) {
    this._assertLoaded();
    return findBestSkill(userInput, this._skills);
  }

  /**
   * Returns the top N skill matches with scores (for debugging/logging).
   * @param {string} userInput
   * @param {number} [n=3]
   */
  getTopMatches(userInput, n = 3) {
    this._assertLoaded();
    return getTopMatches(userInput, this._skills, n);
  }

  // ============================================================
  // SKILL EXECUTION
  // ============================================================

  /**
   * Executes a named skill by its directory name.
   * NOTE: This should NOT be called directly for tool-based skills.
   * Use matchAndExecute instead, which routes through the SkillRouter.
   *
   * @param {string} skillName  - e.g. "hsc-worked-example"
   * @param {object} params     - input parameters for the skill
   * @param {object} context    - {
   *   studentId,
   *   memory,        // MemoryManager instance
   *   studentModel,  // synthesised Student Model object
   *   model,         // ModelManager instance
   *   knowledgeBase, // KnowledgeBase instance
   * }
   * @returns {Promise<object>} skill result
   */
  async executeSkill(skillName, params, context) {
    this._assertLoaded();

    const skill = this.getSkill(skillName);
    if (!skill) {
      throw new Error(`SkillManager: skill "${skillName}" not found`);
    }

    // Tool-based skills are now self-executing via MarkdownSkillRunner closure —
    // no need to block them here. Fall through to execute() below.

    try {
      const result = await skill.module.execute(params, context);
      return { ...result, _skillName: skillName, _skillType: skill.type, _skillCategory: skill.category };
    } catch (err) {
      throw new Error(`SkillManager: error executing "${skillName}": ${err.message}`);
    }
  }

  /**
   * Executes all passive skills silently after an interaction.
   * Passive skills return { memoryUpdates } which the Coordinator
   * applies to the Memory Manager.
   *
   * Errors in passive skills are caught and logged — they must never
   * crash the main conversation flow.
   *
   * @param {object} params   - interaction data (userInput, response, etc.)
   * @param {object} context  - same context as executeSkill()
   * @returns {Promise<object[]>} array of memoryUpdates from each passive skill
   */
  async executePassiveSkills(params, context) {
    this._assertLoaded();

    const passive = this.getPassiveSkills();
    const updates = [];

    for (const skill of passive) {
      try {
        const result = await skill.module.execute(params, context);
        if (result && result.memoryUpdates) {
          updates.push({
            skillName: skill.name,
            skillCategory: skill.category,
            memoryUpdates: result.memoryUpdates
          });
        }
      } catch (err) {
        // Passive skill errors must never interrupt the conversation
        console.error(`[SkillManager] Passive skill "${skill.name}" (${skill.category}) error: ${err.message}`);
      }
    }

    return updates;
  }

  /**
   * Convenience method: find the best skill for input, then execute it.
   * Used by the Agent Coordinator in the main conversation flow.
   *
   * @param {string} userInput
   * @param {object} params    - additional params merged with { userInput }
   * @param {object} context
   * @returns {Promise<{ result: object, skillName: string, matchScore: number, matchedBy: string, skillCategory: string, isToolBased: boolean }>}
   */
  async matchAndExecute(userInput, params, context) {
    this._assertLoaded();

    // Use subject-aware matcher so Maths-only skills never fire for English (and vice versa)
    const activeSubject = params?.activeSubject || 'maths-advanced';
    const { skill, score, matchedBy } = findBestSkillForSubject(
      userInput,
      this._skills,
      activeSubject,
      context.kbManager, // Pass kbManager for subject filtering
    );

    if (!skill) {
      return {
        result:     { result: null, message: 'No skill available to handle this input.' },
        skillName:  null,
        skillCategory: null,
        matchScore: 0,
        matchedBy:  'none',
        isToolBased: false,
      };
    }

    // Both tool-based and traditional skills now execute the same way —
    // tool-based skills call MarkdownSkillRunner inside their execute() closure,
    // so the Coordinator no longer needs to special-case them.
    const result = await this.executeSkill(skill.name, { userInput, ...params }, context);

    return {
      result,
      skillName:     skill.name,
      skillCategory: skill.category,
      matchScore:    score,
      matchedBy,
      isToolBased:   skill.source === 'tool-based',
    };
  }
}

module.exports = SkillManager;