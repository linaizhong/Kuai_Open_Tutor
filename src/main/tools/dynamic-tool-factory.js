/**
 * Dynamic Tool Factory
 * Creates new tools on-the-fly based on student needs
 *
 * @module tools/dynamic-tool-factory
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const BaseTool = require('./base');
const toolRegistry = require('./index');

// Custom error classes
class DynamicToolError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'DynamicToolError';
    this.cause = cause;
    this.timestamp = new Date().toISOString();
  }
}

class ToolGenerationError extends DynamicToolError {
  constructor(message, cause = null) {
    super(message, cause);
    this.name = 'ToolGenerationError';
  }
}

class ToolValidationError extends DynamicToolError {
  constructor(message, cause = null) {
    super(message, cause);
    this.name = 'ToolValidationError';
  }
}

/**
 * Dynamic Tool Factory
 * Creates and manages dynamically generated tools
 */
class DynamicToolFactory {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.modelManager - ModelManager instance for LLM calls
   * @param {string} options.toolsRoot - Absolute path to tools directory
   * @param {Object} options.logger - Logger instance (optional)
   * @param {Object} options.config - Configuration settings
   */
  constructor(options = {}) {
    const { modelManager, toolsRoot, logger = console, config = {} } = options;

    if (!modelManager) {
      throw new DynamicToolError('ModelManager is required');
    }
    if (!toolsRoot) {
      throw new DynamicToolError('Tools root path is required');
    }

    this.model = modelManager;
    this.toolsRoot = toolsRoot;
    this.logger = logger;
    this.config = {
      maxToolsPerSession: config.maxToolsPerSession || 5,
      maxGenerationsPerDay: config.maxGenerationsPerDay || 20,
      requireApproval: config.requireApproval !== false,
      toolTimeout: config.toolTimeout || 30000, // 30 seconds
      cacheGeneratedTools: config.cacheGeneratedTools !== false,
      ...config
    };

    // Track generated tools
    this.generatedTools = new Map(); // toolName -> { spec, instance, createdAt, usageCount }
    this.generationStats = {
      totalGenerations: 0,
      successfulGenerations: 0,
      failedGenerations: 0,
      lastGenerationTime: null,
      dailyGenerations: 0,
      lastDailyReset: new Date().toDateString()
    };

    // Ensure tools directory exists
    this._ensureToolsDirectory();

    this.logger.info('[DynamicToolFactory] Initialized', {
      toolsRoot,
      config: this.config
    });
  }

  /**
   * Ensure tools directory exists
   * @private
   */
  async _ensureToolsDirectory() {
    try {
      await fs.mkdir(this.toolsRoot, { recursive: true });
    } catch (err) {
      this.logger.error('[DynamicToolFactory] Failed to create tools directory:', err);
    }
  }

  /**
   * Reset daily counters if needed
   * @private
   */
  _checkDailyReset() {
    const today = new Date().toDateString();
    if (this.generationStats.lastDailyReset !== today) {
      this.generationStats.dailyGenerations = 0;
      this.generationStats.lastDailyReset = today;
    }
  }

  /**
   * Detect if a new tool is needed based on student query
   *
   * @param {string} userInput - Student's query
   * @param {Object} studentModel - Current student model
   * @param {Object} context - Execution context
   * @param {string} context.studentId - Student ID
   * @returns {Promise<Object|null>} Tool specification or null if not needed
   * @throws {DynamicToolError} If detection fails
   */
  async detectToolNeed(userInput, studentModel, context) {
    this._checkDailyReset();

    const startTime = Date.now();
    const detectionId = crypto.randomBytes(4).toString('hex');

    this.logger.info(`[DynamicToolFactory:${detectionId}] Detecting tool need`, {
      userInput: userInput.substring(0, 100),
      studentId: context.studentId
    });

    try {
      // Rate limiting check
      if (this.generationStats.dailyGenerations >= this.config.maxGenerationsPerDay) {
        this.logger.warn(`[DynamicToolFactory:${detectionId}] Daily generation limit reached`);
        return null;
      }

      // Get existing tools for context
      const existingTools = this._getExistingToolDescriptions();

      const prompt = [
        {
          role: 'system',
          content: `You are OpenTutor's intelligent tool designer. Analyze if the student's query requires a new teaching tool that doesn't exist yet.

EXISTING TOOLS:
${existingTools}

ANALYSIS REQUIREMENTS:
1. Can ANY existing tool handle this request? Be specific about which tool and why
2. If not, what NEW tool would solve the student's need?
3. The tool must be GENERAL PURPOSE - not specific to one student's question
4. Tool names should be lowercase-with-dashes (e.g., 'derivative-visualizer')

Return a JSON object with EXACTLY this structure:
{
  "needsNewTool": boolean,
  "reasoning": "Explain why existing tools can/cannot handle this",
  "toolSpec": {  // ONLY if needsNewTool is true
    "name": "tool-name",
    "description": "Clear description of what the tool does",
    "category": "math|english|general|visualization|calculation",
    "parameters": [
      {
        "name": "paramName",
        "type": "string|number|boolean|object",
        "description": "What this parameter is for",
        "required": true|false
      }
    ],
    "capabilities": ["capability1", "capability2"],
    "tags": ["tag1", "tag2"],
    "exampleUsage": "How a skill would call this tool",
    "expectedOutput": "What the tool returns"
  },
  "confidence": 0.0-1.0  // How confident you are about this recommendation
}

Be conservative - only suggest new tools when truly necessary.`
        },
        {
          role: 'user',
          content: `Student query: "${userInput}"

Student context:
- Mastery level: ${studentModel?.overallMastery || 'unknown'}
- Learning style: ${studentModel?.learningStyle?.preferredRepresentation || 'unknown'}
- Current engagement: ${studentModel?.affectiveState?.currentEngagement || 'unknown'}

Analyze if a new tool is needed.`
        }
      ];

      // Set timeout for model call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Model call timeout')), this.config.toolTimeout);
      });

      const modelPromise = this.model.chat(prompt, {
        temperature: 0.3,
        maxTokens: 1000,
        skillName: 'dynamic-tool-detection'
      });

      const response = await Promise.race([modelPromise, timeoutPromise]);

      let analysis;
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        analysis = JSON.parse(jsonMatch[0]);
      } catch (err) {
        throw new ToolValidationError('Failed to parse tool detection response', err);
      }

      // Validate analysis structure
      this._validateDetectionAnalysis(analysis);

      // Log detection result
      const duration = Date.now() - startTime;
      this.logger.info(`[DynamicToolFactory:${detectionId}] Detection complete`, {
        needsNewTool: analysis.needsNewTool,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        duration
      });

      if (!analysis.needsNewTool || analysis.confidence < 0.7) {
        return null;
      }

      return analysis.toolSpec;

    } catch (err) {
      const duration = Date.now() - startTime;
      this.logger.error(`[DynamicToolFactory:${detectionId}] Detection failed:`, {
        error: err.message,
        stack: err.stack,
        duration
      });

      if (err instanceof DynamicToolError) {
        throw err;
      }
      throw new DynamicToolError('Tool detection failed', err);
    }
  }

  /**
   * Validate detection analysis structure
   * @private
   */
  _validateDetectionAnalysis(analysis) {
    if (typeof analysis.needsNewTool !== 'boolean') {
      throw new ToolValidationError('needsNewTool must be boolean');
    }

    if (typeof analysis.reasoning !== 'string') {
      throw new ToolValidationError('reasoning must be string');
    }

    if (analysis.confidence !== undefined) {
      if (typeof analysis.confidence !== 'number' ||
          analysis.confidence < 0 || analysis.confidence > 1) {
        throw new ToolValidationError('confidence must be number between 0-1');
      }
    }

    if (analysis.needsNewTool) {
      this._validateToolSpec(analysis.toolSpec);
    }
  }

  /**
   * Validate tool specification
   * @private
   */
  _validateToolSpec(spec) {
    if (!spec) {
      throw new ToolValidationError('toolSpec is required when needsNewTool is true');
    }

    const required = ['name', 'description', 'parameters'];
    for (const field of required) {
      if (!spec[field]) {
        throw new ToolValidationError(`toolSpec.${field} is required`);
      }
    }

    // Validate name format (lowercase-with-dashes)
    if (!/^[a-z][a-z0-9-]*$/.test(spec.name)) {
      throw new ToolValidationError(
        'tool name must be lowercase-with-dashes (e.g., "derivative-visualizer")'
      );
    }

    // Validate parameters
    if (!Array.isArray(spec.parameters)) {
      throw new ToolValidationError('parameters must be an array');
    }

    for (const param of spec.parameters) {
      if (!param.name || !param.type) {
        throw new ToolValidationError('each parameter must have name and type');
      }
      const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
      if (!validTypes.includes(param.type)) {
        throw new ToolValidationError(`invalid parameter type: ${param.type}`);
      }
    }

    // Validate capabilities if present
    if (spec.capabilities && !Array.isArray(spec.capabilities)) {
      throw new ToolValidationError('capabilities must be an array');
    }

    // Validate tags if present
    if (spec.tags && !Array.isArray(spec.tags)) {
      throw new ToolValidationError('tags must be an array');
    }
  }

  /**
   * Generate a new tool implementation
   *
   * @param {Object} toolSpec - Tool specification from detectToolNeed
   * @param {Object} context - Generation context
   * @returns {Promise<BaseTool>} Generated tool instance
   * @throws {ToolGenerationError} If generation fails
   */
  async generateTool(toolSpec, context = {}) {
    const startTime = Date.now();
    const generationId = crypto.randomBytes(4).toString('hex');

    this.logger.info(`[DynamicToolFactory:${generationId}] Generating tool`, {
      toolName: toolSpec.name,
      description: toolSpec.description
    });

    try {
      // Check if tool already exists
      if (toolRegistry.hasTool(toolSpec.name)) {
        throw new ToolGenerationError(`Tool "${toolSpec.name}" already exists`);
      }

      // Check daily limit
      this._checkDailyReset();
      if (this.generationStats.dailyGenerations >= this.config.maxGenerationsPerDay) {
        throw new ToolGenerationError('Daily generation limit reached');
      }

      // Generate tool code
      const toolCode = await this._generateToolCode(toolSpec, generationId);

      // Validate generated code
      const validationResult = await this._validateToolCode(toolCode, toolSpec.name);
      if (!validationResult.valid) {
        throw new ToolGenerationError(
          `Generated tool validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      // Create tool instance
      const toolInstance = await this._instantiateTool(toolCode, toolSpec.name);

      // Test the tool
      await this._testTool(toolInstance, toolSpec);

      // Register with registry
      toolRegistry.register(toolInstance);

      // Save to disk if caching enabled
      if (this.config.cacheGeneratedTools) {
        await this._saveToolToDisk(toolCode, toolSpec);
      }

      // Track generation
      this.generatedTools.set(toolSpec.name, {
        spec: toolSpec,
        instance: toolInstance,
        createdAt: new Date().toISOString(),
        usageCount: 0,
        generationId
      });

      // Update stats
      this.generationStats.totalGenerations++;
      this.generationStats.successfulGenerations++;
      this.generationStats.dailyGenerations++;
      this.generationStats.lastGenerationTime = new Date().toISOString();

      const duration = Date.now() - startTime;
      this.logger.info(`[DynamicToolFactory:${generationId}] Tool generated successfully`, {
        toolName: toolSpec.name,
        duration
      });

      return toolInstance;

    } catch (err) {
      this.generationStats.failedGenerations++;

      this.logger.error(`[DynamicToolFactory:${generationId}] Tool generation failed:`, {
        error: err.message,
        stack: err.stack
      });

      if (err instanceof ToolGenerationError) {
        throw err;
      }
      throw new ToolGenerationError('Tool generation failed', err);
    }
  }

  /**
   * Generate tool code using LLM
   * @private
   */
  async _generateToolCode(toolSpec, generationId) {
    const prompt = [
      {
        role: 'system',
        content: `You are an expert Node.js developer. Generate a complete tool class for OpenTutor.

TOOL SPECIFICATION:
${JSON.stringify(toolSpec, null, 2)}

REQUIREMENTS:
1. The tool MUST extend BaseTool (import from '../base')
2. Implement constructor(name, description, version, capabilities, tags)
3. Implement execute(params, context) with proper error handling
4. Implement getParameters() returning the parameter specification
5. Add validation in validateParams() if needed
6. Include JSDoc comments
7. Use destructuring for params and context
8. Handle all errors gracefully
9. Log important steps using console.log with [ToolName] prefix
10. Return appropriate result structure

TEMPLATE:
\`\`\`javascript
const BaseTool = require('../base');

class ${this._toClassName(toolSpec.name)} extends BaseTool {
  constructor() {
    super(
      '${toolSpec.name}',
      '${toolSpec.description}',
      '1.0.0',
      ${JSON.stringify(toolSpec.capabilities || [])},
      ${JSON.stringify(toolSpec.tags || [])}
    );
  }

  getParameters() {
    return ${JSON.stringify(toolSpec.parameters, null, 2)};
  }

  async execute(params, context) {
    const { ${toolSpec.parameters.map(p => p.name).join(', ')} } = params;
    const { studentId, memory, studentModel, knowledgeBase } = context;

    console.log(\`[${this._toClassName(toolSpec.name)}] Executing\`, {
      ${toolSpec.parameters.map(p => `${p.name}: ${p.name}`).join(',\n      ')}
    });

    try {
      // TODO: Implement tool logic here
      // Use the parameters and context to perform the tool's function

      // Example implementation (replace with actual logic):
      const result = await this._implementLogic({
        ${toolSpec.parameters.map(p => p.name).join(',\n        ')}
      }, context);

      return {
        success: true,
        result,
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      console.error(\`[${this._toClassName(toolSpec.name)}] Execution failed:\`, err);
      throw new Error(\`Tool execution failed: \${err.message}\`);
    }
  }

  /**
   * Validate parameters before execution
   */
  validateParams(params) {
    const errors = [];
    const parameters = this.getParameters();

    for (const param of parameters) {
      if (param.required && (params[param.name] === undefined || params[param.name] === null)) {
        errors.push(\`Missing required parameter: \${param.name}\`);
      }

      if (params[param.name] !== undefined && param.type) {
        const actualType = typeof params[param.name];
        if (actualType !== param.type &&
            !(param.type === 'array' && Array.isArray(params[param.name]))) {
          errors.push(\`Parameter \${param.name} should be \${param.type}, got \${actualType}\`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(\`Validation failed: \${errors.join(', ')}\`);
    }
  }

  /**
   * Implement the actual tool logic
   * @private
   */
  async _implementLogic(params, context) {
    // This is a placeholder - the LLM should generate actual logic here
    // based on the tool's purpose

    // For a calculator tool:
    // return eval(expression);

    // For a visualizer:
    // return { svg: generateSVG(expression) };

    // For a knowledge query:
    // return knowledgeBase.query(topic);

    return { message: 'Tool executed successfully' };
  }
}

module.exports = ${this._toClassName(toolSpec.name)};
\`\`\`

Return ONLY the code, no explanation.`
      },
      {
        role: 'user',
        content: `Generate a complete tool class for: ${toolSpec.name}`
      }
    ];

    const response = await this.model.chat(prompt, {
      temperature: 0.2,
      maxTokens: 4000,
      skillName: 'dynamic-tool-generation'
    });

    // Extract code block
    const codeMatch = response.match(/```javascript\s*([\s\S]*?)```/);
    if (!codeMatch) {
      throw new ToolGenerationError('No code block found in generation response');
    }

    return codeMatch[1].trim();
  }

  /**
   * Validate generated tool code
   * @private
   */
  async _validateToolCode(code, toolName) {
    const errors = [];

    // Check for required elements
    if (!code.includes('extends BaseTool')) {
      errors.push('Tool must extend BaseTool');
    }

    if (!code.includes('async execute')) {
      errors.push('Tool must implement async execute method');
    }

    if (!code.includes('getParameters()')) {
      errors.push('Tool must implement getParameters method');
    }

    // Check for proper error handling
    if (!code.includes('try {') || !code.includes('catch')) {
      errors.push('Tool should include try-catch error handling');
    }

    // Check for logging
    if (!code.includes(`[${this._toClassName(toolName)}]`)) {
      errors.push('Tool should include logging with [ToolName] prefix');
    }

    // Basic syntax check
    try {
      new Function('require', code); // eslint-disable-line no-new-func
    } catch (err) {
      errors.push(`Syntax error: ${err.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Instantiate tool from generated code
   * @private
   */
  async _instantiateTool(code, toolName) {
    try {
      // Create module in isolated context
      const module = { exports: {} };
      const require = (moduleName) => {
        if (moduleName === '../base') {
          return BaseTool;
        }
        throw new Error(`Cannot require external module: ${moduleName}`);
      };

      // Execute code in sandbox
      const factory = new Function('module', 'exports', 'require', code);
      factory(module, module.exports, require);

      const ToolClass = module.exports;
      if (typeof ToolClass !== 'function') {
        throw new Error('Tool must export a class');
      }

      const instance = new ToolClass();
      if (!(instance instanceof BaseTool)) {
        throw new Error('Instance does not extend BaseTool');
      }

      return instance;

    } catch (err) {
      throw new ToolGenerationError(`Failed to instantiate tool: ${err.message}`, err);
    }
  }

  /**
   * Test the generated tool
   * @private
   */
  async _testTool(toolInstance, toolSpec) {
    try {
      // Create test parameters
      const testParams = {};
      for (const param of toolSpec.parameters) {
        // Generate test value based on type
        switch (param.type) {
          case 'string':
            testParams[param.name] = 'test';
            break;
          case 'number':
            testParams[param.name] = 42;
            break;
          case 'boolean':
            testParams[param.name] = true;
            break;
          case 'array':
            testParams[param.name] = ['test'];
            break;
          case 'object':
            testParams[param.name] = { test: true };
            break;
        }
      }

      // Test context
      const testContext = {
        studentId: 'test',
        memory: {
          getContext: () => ({})
        },
        studentModel: {},
        knowledgeBase: {}
      };

      // Execute test
      const result = await toolInstance.execute(testParams, testContext);

      if (!result) {
        throw new Error('Tool returned no result');
      }

    } catch (err) {
      throw new ToolGenerationError(`Tool test failed: ${err.message}`, err);
    }
  }

  /**
   * Save generated tool to disk
   * @private
   */
  async _saveToolToDisk(code, toolSpec) {
    try {
      const toolDir = path.join(this.toolsRoot, toolSpec.name);
      const toolPath = path.join(toolDir, 'index.js');

      await fs.mkdir(toolDir, { recursive: true });
      await fs.writeFile(toolPath, code, 'utf8');

      // Create basic SKILL.md for documentation
      const skillMd = this._generateToolDoc(toolSpec);
      await fs.writeFile(path.join(toolDir, 'README.md'), skillMd, 'utf8');

      this.logger.info(`[DynamicToolFactory] Saved tool to disk: ${toolPath}`);

    } catch (err) {
      this.logger.error('[DynamicToolFactory] Failed to save tool to disk:', err);
      // Non-fatal - tool is still registered in memory
    }
  }

  /**
   * Generate tool documentation
   * @private
   */
  _generateToolDoc(toolSpec) {
    return `# Tool: ${toolSpec.name}

## Description
${toolSpec.description}

## Category
${toolSpec.category || 'general'}

## Parameters

${toolSpec.parameters.map(p =>
  `### \`${p.name}\` (${p.type}) ${p.required ? '**(required)**' : ''}
${p.description}`
).join('\n\n')}

## Capabilities
${(toolSpec.capabilities || []).map(c => `- ${c}`).join('\n')}

## Tags
${(toolSpec.tags || []).map(t => `- ${t}`).join('\n')}

## Example Usage
\`\`\`javascript
${toolSpec.exampleUsage || '// TODO: Add example'}
\`\`\`

## Expected Output
${toolSpec.expectedOutput || 'Tool-specific result'}

## Generated
This tool was dynamically generated on ${new Date().toISOString()}
`;
  }

  /**
   * Get tool usage statistics
   *
   * @returns {Object} Tool statistics
   */
  getStats() {
    return {
      generatedTools: Array.from(this.generatedTools.entries()).map(([name, data]) => ({
        name,
        createdAt: data.createdAt,
        usageCount: data.usageCount,
        generationId: data.generationId
      })),
      generationStats: {
        ...this.generationStats,
        successRate: this.generationStats.totalGenerations > 0
          ? (this.generationStats.successfulGenerations / this.generationStats.totalGenerations) * 100
          : 0
      },
      config: this.config
    };
  }

  /**
   * Track tool usage
   *
   * @param {string} toolName - Name of tool used
   */
  trackToolUsage(toolName) {
    const tool = this.generatedTools.get(toolName);
    if (tool) {
      tool.usageCount++;
    }
  }

  /**
   * Convert kebab-case to PascalCase
   * @private
   */
  _toClassName(kebabCase) {
    return kebabCase
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Get existing tool descriptions
   * @private
   */
  _getExistingToolDescriptions() {
    const tools = toolRegistry.getAllTools();
    if (tools.length === 0) {
      return 'No existing tools';
    }

    return tools.map(tool => {
      const params = tool.getParameters().map(p =>
        `    - ${p.name} (${p.type})${p.required ? ' required' : ''}`
      ).join('\n');

      return `- ${tool.name}: ${tool.description}
  Parameters:\n${params || '    none'}
  Capabilities: ${(tool.capabilities || []).join(', ')}`;
    }).join('\n\n');
  }
}

module.exports = DynamicToolFactory;