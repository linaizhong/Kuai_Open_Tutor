// tools/new-tool/index.js
// Example tool template for creating new tools

const BaseTool = require('../base');

class NewTool extends BaseTool {
  constructor() {
    super(
      'new-tool',                    // Tool name (kebab-case)
      'Description of what this tool does', // Description
      '1.0.0',                       // Version
      ['capability1', 'capability2'], // Capabilities
      ['tag1', 'tag2']                // Tags for categorization
    );

    // Optional: Add example usages
    this.examples = [
      {
        description: 'Example usage 1',
        params: { param1: 'value1' },
      },
      {
        description: 'Example usage 2',
        params: { param1: 'value2' },
      },
    ];
  }

  /**
   * Define expected parameters
   */
  getParameters() {
    return [
      {
        name: 'param1',
        type: 'string',
        description: 'Description of param1',
        required: true,
      },
      {
        name: 'param2',
        type: 'number',
        description: 'Description of param2',
        required: false,
      },
    ];
  }

  /**
   * Execute the tool
   */
  async execute(params, context) {
    // 1. Validate parameters
    this.validateParams(params);

    // 2. Extract parameters
    const { param1, param2 = 42 } = params;
    const { studentId, memory, studentModel, knowledgeBase } = context;

    // 3. Tool implementation
    console.log(`[NewTool] Executing with param1=${param1}, param2=${param2}`);

    // 4. Return result
    return {
      result: `Processed ${param1} with value ${param2}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Optional: Check availability
   */
  isAvailable() {
    // Check if any dependencies are available
    return true;
  }
}

// Support both direct export and named export
module.exports = NewTool;
module.exports.NewTool = NewTool;