// agent/skill-router.js
// Routes skill execution for the Coordinator.
//
// Since loader.js now makes ALL skill types (traditional, embedded-code, tool-based)
// self-executing via their module.execute() closure, this router simply calls
// skill.module.execute() for every skill type. The type-specific branching that
// used to live here has moved into the loader/MarkdownSkillRunner layer.

const toolRegistry = require('../tools');

class SkillRouter {
  constructor(model, memory, skillManager) {
    this.model        = model;
    this.memory       = memory;
    this.skillManager = skillManager;
  }

  /**
   * Execute a skill.
   * All skill types (traditional, embedded-code, tool-based) are now self-executing —
   * their execute() closure handles the routing internally.
   *
   * @param {object} skill   - Skill object from loader
   * @param {object} params  - Skill parameters
   * @param {object} context - Execution context
   * @returns {Promise<object>} Skill result
   */
  async execute(skill, params, context) {
    // Handle auto-advance special message — never route to a skill
    if (params.userInput === '__AUTO_ADVANCE__') {
      console.log('[SkillRouter] Auto-advance message detected, returning empty result');
      return { result: '', autoAdvance: true, type: 'auto_advance' };
    }

    console.log(`[SkillRouter] Executing skill: ${skill.name} (source: ${skill.source})`);

    // All skill types execute the same way — the loader wired the right
    // implementation into module.execute() for each source type.
    const result = await skill.module.execute(params, context);

    return typeof result === 'string' ? { result } : result;
  }

  /**
   * Get skill capabilities (for debugging/UI).
   * @param {object} skill
   * @returns {object}
   */
  getCapabilities(skill) {
    return {
      type:     skill.source,
      workflow: skill.workflow || [],
      tools:    skill.tools    || [],
      module:   skill.module?.meta || {},
    };
  }

  /**
   * Extract tool references from markdown text.
   * @param {string} markdown
   * @returns {string[]}
   */
  extractToolsFromMarkdown(markdown) {
    const tools  = [];
    const regex  = /`([^`]+)`/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      if (toolRegistry.hasTool(match[1])) tools.push(match[1]);
    }
    return [...new Set(tools)];
  }
}

module.exports = SkillRouter;