// tools/base.js
// Base class for all tools - all tools must extend this class
// Provides common functionality and enforces consistent interface

'use strict';

class BaseTool {
  /**
   * @param {string} name - Unique tool identifier (lowercase-with-dashes)
   * @param {string} description - What the tool does
   * @param {string} version - Semantic version (e.g., '1.0.0')
   * @param {Array<string>} capabilities - Optional list of capabilities (e.g., ['math', 'plot'])
   * @param {Array<string>} tags - Optional tags for categorization
   */
  constructor(name, description, version = '1.0.0', capabilities = [], tags = []) {
    if (new.target === BaseTool) {
      throw new Error('BaseTool is abstract — instantiate a concrete tool instead.');
    }

    this.name = name;
    this.description = description;
    this.version = version;
    this.capabilities = capabilities;
    this.tags = tags;
    this.examples = []; // Can be populated by subclasses
  }

  /**
   * Execute the tool with given parameters
   * Must be implemented by all subclasses
   *
   * @param {object} params - Tool-specific parameters
   * @param {object} context - Execution context
   * @param {string} context.studentId - Current student ID
   * @param {object} context.memory - MemoryManager instance
   * @param {object} context.studentModel - Current student model
   * @param {object} context.knowledgeBase - Current subject's knowledge base
   * @param {object} context.model - ModelManager instance (optional)
   * @returns {Promise<any>} Tool result
   * @throws {Error} If execution fails
   */
  async execute(params, context) {
    throw new Error(`${this.constructor.name}.execute() not implemented`);
  }

  /**
   * Get tool metadata for the interpreter and UI
   * @returns {object} Tool manifest
   */
  getManifest() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      capabilities: this.capabilities,
      tags: this.tags,
      parameters: this.getParameters?.() || [],
      examples: this.examples || [],
    };
  }

  /**
   * Define expected parameters (override in subclasses)
   * @returns {Array<{name: string, type: string, description: string, required: boolean}>}
   */
  getParameters() {
    return [];
  }

  /**
   * Optional: Validate parameters before execution
   * @param {object} params - Parameters to validate
   * @throws {Error} If validation fails
   */
  validateParams(params) {
    const parameters = this.getParameters();
    const errors = [];

    for (const param of parameters) {
      if (param.required && (params[param.name] === undefined || params[param.name] === null)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }

      if (params[param.name] !== undefined && param.type) {
        const actualType = typeof params[param.name];
        if (actualType !== param.type) {
          errors.push(`Parameter ${param.name} should be ${param.type}, got ${actualType}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Optional: Initialize the tool (called once at registration)
   * @returns {Promise<void>}
   */
  async initialize() {
    // Override in subclasses if needed
  }

  /**
   * Optional: Clean up resources (called when app closes)
   * @returns {Promise<void>}
   */
  async shutdown() {
    // Override in subclasses if needed
  }

  /**
   * Optional: Get tool usage statistics
   * @returns {object} Usage statistics
   */
  getStats() {
    return {
      name: this.name,
      version: this.version,
      // Subclasses can track their own stats
    };
  }

  /**
   * Optional: Check if tool is available in current environment
   * @returns {boolean} True if tool can be used
   */
  isAvailable() {
    return true; // Override if tool has dependencies
  }
}

module.exports = BaseTool;