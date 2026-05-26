// tools/index.js
// Tool Registry - Auto-scan version
// Automatically discovers and registers all tools in the tools/ directory
// Each tool must be in its own folder with an index.js that exports a class extending BaseTool

'use strict';

const fs = require('fs');
const path = require('path');
const BaseTool = require('./base');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this._discoverTools();
  }

  /**
   * Automatically discover all tools in the tools directory
   * Scans each subfolder for an index.js file, loads it, and verifies it extends BaseTool
   * @private
   */
  _discoverTools() {
    const toolsDir = __dirname;
    console.log(`[ToolRegistry] Scanning for tools in: ${toolsDir}`);

    if (!fs.existsSync(toolsDir)) {
      console.warn(`[ToolRegistry] Tools directory not found: ${toolsDir}`);
      return;
    }

    const entries = fs.readdirSync(toolsDir, { withFileTypes: true });
    let discoveredCount = 0;

    for (const entry of entries) {
      // Skip non-directories and special files
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const toolPath = path.join(toolsDir, entry.name, 'index.js');

      if (fs.existsSync(toolPath)) {
        try {
          // Clear require cache to allow hot reload in development
          delete require.cache[require.resolve(toolPath)];

          // Load the tool module
          const ToolClass = require(toolPath);

          // Handle both direct export and { ToolName } export
          let ToolConstructor = ToolClass;
          if (ToolClass && typeof ToolClass === 'object') {
            // Check for named export matching folder name
            const possibleClassName = this._toClassName(entry.name);
            if (ToolClass[possibleClassName]) {
              ToolConstructor = ToolClass[possibleClassName];
            } else {
              // Take the first exported class that extends BaseTool
              for (const key of Object.keys(ToolClass)) {
                if (this._isToolClass(ToolClass[key])) {
                  ToolConstructor = ToolClass[key];
                  break;
                }
              }
            }
          }

          // Instantiate the tool
          const tool = new ToolConstructor();

          // Verify it's a proper tool
          if (tool instanceof BaseTool) {
            this.register(tool);
            discoveredCount++;
            console.log(`[ToolRegistry] ✅ Discovered tool: ${tool.name} (v${tool.version}) from ${entry.name}`);
          } else {
            console.warn(`[ToolRegistry] ⚠️  ${entry.name}/index.js does not export a class extending BaseTool`);
          }
        } catch (err) {
          console.error(`[ToolRegistry] ❌ Failed to load tool from ${entry.name}:`, err.message);
          if (err.stack) {
            console.debug(err.stack);
          }
        }
      }
    }

    console.log(`[ToolRegistry] Total tools discovered: ${discoveredCount}`);

    // Log all registered tools for debugging
    if (discoveredCount > 0) {
      const toolList = Array.from(this.tools.values()).map(t => `${t.name} (${t.version})`).join(', ');
      console.log(`[ToolRegistry] Registered tools: ${toolList}`);
    }
  }

  /**
   * Convert folder name to class name (kebab-case to PascalCase)
   * e.g., 'knowledge-query' -> 'KnowledgeQueryTool'
   * @private
   */
  _toClassName(folderName) {
    return folderName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') + 'Tool';
  }

  /**
   * Check if a value is a constructor that extends BaseTool
   * @private
   */
  _isToolClass(value) {
    if (typeof value !== 'function') return false;
    // Walk the prototype chain instead of instantiating — avoids crashes
    // when a tool constructor requires arguments.
    let proto = Object.getPrototypeOf(value);
    while (proto && proto !== Function.prototype) {
      if (proto === BaseTool) return true;
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }

  /**
   * Register a tool instance
   * @param {BaseTool} tool - Tool instance to register
   */
  register(tool) {
    if (!(tool instanceof BaseTool)) {
      throw new Error('Tool must be an instance of BaseTool');
    }

    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Warning: Overwriting existing tool "${tool.name}"`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {BaseTool|null} Tool instance or null if not found
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Get all registered tools
   * @returns {Array<BaseTool>} Array of tool instances
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get manifests for all tools (for UI display)
   * @returns {Array<object>} Array of tool manifests
   */
  getAllToolManifests() {
    return Array.from(this.tools.values()).map(t => t.getManifest());
  }

  /**
   * Execute a tool by name
   * @param {string} toolName - Name of the tool to execute
   * @param {object} params - Tool-specific parameters
   * @param {object} context - Execution context { studentId, memory, studentModel, knowledgeBase }
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(toolName, params, context) {
    const tool = this.getTool(toolName);
    if (!tool) {
      const availableTools = Array.from(this.tools.keys()).join(', ');
      throw new Error(
        `Tool not found: "${toolName}".\n` +
        `Available tools: ${availableTools || 'none'}`
      );
    }

    // Validate parameters if tool has validation
    if (tool.validateParams) {
      tool.validateParams(params);
    }

    // Log tool execution for debugging
    console.log(`[ToolRegistry] Executing tool: ${toolName}`, {
      params: Object.keys(params),
      context: context ? Object.keys(context) : 'none'
    });

    const startTime = Date.now();

    try {
      const result = await tool.execute(params, context);
      const executionTime = Date.now() - startTime;

      console.log(`[ToolRegistry] ✅ Tool ${toolName} executed in ${executionTime}ms`);

      return result;
    } catch (err) {
      console.error(`[ToolRegistry] ❌ Tool ${toolName} execution failed:`, err.message);
      throw err;
    }
  }

  /**
   * Find tools by capability
   * @param {string} capability - Capability to search for (e.g., 'math', 'plot', 'analyze')
   * @returns {Array<BaseTool>} Array of matching tools
   */
  findToolsByCapability(capability) {
    const matches = [];
    for (const tool of this.tools.values()) {
      if (tool.capabilities && Array.isArray(tool.capabilities) &&
          tool.capabilities.includes(capability)) {
        matches.push(tool);
      }
    }
    return matches;
  }

  /**
   * Check if a tool exists
   * @param {string} toolName - Tool name to check
   * @returns {boolean} True if tool exists
   */
  hasTool(toolName) {
    return this.tools.has(toolName);
  }

  /**
   * Get tool names by category/tag
   * @param {string} tag - Tag to filter by
   * @returns {Array<string>} Array of tool names
   */
  getToolsByTag(tag) {
    const matches = [];
    for (const tool of this.tools.values()) {
      if (tool.tags && Array.isArray(tool.tags) && tool.tags.includes(tag)) {
        matches.push(tool.name);
      }
    }
    return matches;
  }

  /**
   * Get tool statistics
   * @returns {object} Tool statistics
   */
  getStats() {
    const tools = Array.from(this.tools.values());
    return {
      total: tools.length,
      byVersion: tools.reduce((acc, t) => {
        acc[t.version] = (acc[t.version] || 0) + 1;
        return acc;
      }, {}),
      names: tools.map(t => t.name),
    };
  }

  /**
   * Reload all tools (useful for development)
   * Clears require cache and rediscovers all tools
   * @returns {number} Number of tools reloaded
   */
  reloadTools() {
    console.log('[ToolRegistry] Reloading all tools...');

    // Clear all registered tools
    this.tools.clear();

    // Clear require cache for all tool modules
    const toolsDir = __dirname;
    const entries = fs.readdirSync(toolsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const toolPath = path.join(toolsDir, entry.name, 'index.js');
        if (fs.existsSync(toolPath)) {
          delete require.cache[require.resolve(toolPath)];
        }
      }
    }

    // Rediscover tools
    this._discoverTools();

    return this.tools.size;
  }

  /**
   * Get tool by name with fuzzy matching (for forgiving lookups)
   * @param {string} name - Tool name or partial name
   * @returns {BaseTool|null} Best matching tool or null
   */
  findTool(name) {
    const lowerName = name.toLowerCase();

    // Try exact match first
    if (this.tools.has(name)) {
      return this.tools.get(name);
    }

    // Try case-insensitive match
    for (const [toolName, tool] of this.tools.entries()) {
      if (toolName.toLowerCase() === lowerName) {
        return tool;
      }
    }

    // Try partial match
    let bestMatch = null;
    let bestScore = 0;

    for (const [toolName, tool] of this.tools.entries()) {
      const lowerToolName = toolName.toLowerCase();

      // Check if name contains the search term
      if (lowerToolName.includes(lowerName)) {
        const score = lowerName.length / lowerToolName.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = tool;
        }
      }

      // Check if search term contains tool name (abbreviation)
      if (lowerName.includes(lowerToolName)) {
        const score = lowerToolName.length / lowerName.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = tool;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Batch execute multiple tools
   * @param {Array<{name: string, params: object}>} toolCalls - Array of tool calls
   * @param {object} context - Shared execution context
   * @returns {Promise<Array>} Array of results in same order
   */
  async batchExecute(toolCalls, context) {
    return Promise.all(
      toolCalls.map(async ({ name, params }) => {
        try {
          const result = await this.executeTool(name, params, context);
          return { success: true, name, result };
        } catch (err) {
          return { success: false, name, error: err.message };
        }
      })
    );
  }

  /**
   * Get tool documentation/summary
   * @param {string} toolName - Tool name
   * @returns {object|null} Tool documentation or null
   */
  getToolDocumentation(toolName) {
    const tool = this.getTool(toolName);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      version: tool.version,
      parameters: tool.getParameters ? tool.getParameters() : [],
      examples: tool.examples || [],
      tags: tool.tags || [],
      capabilities: tool.capabilities || [],
    };
  }

  /**
   * Validate if a tool exists and parameters are valid
   * @param {string} toolName - Tool name
   * @param {object} params - Parameters to validate
   * @returns {object} Validation result { valid: boolean, errors: string[] }
   */
  validateToolCall(toolName, params) {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool "${toolName}" not found`]
      };
    }

    const errors = [];
    const parameters = tool.getParameters ? tool.getParameters() : [];

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

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================
// Export a singleton instance
// The same instance is used throughout the application
// ============================================================
const instance = new ToolRegistry();

// REMOVED: Object.freeze(instance) - This was causing the error!

module.exports = instance;

// ============================================================
// Also export the class for testing or creating isolated instances
// ============================================================
module.exports.ToolRegistry = ToolRegistry;