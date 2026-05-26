/**
 * Dynamic Tool Skill
 * Skill that can request and use dynamically generated tools
 *
 * @module skills/dynamic-tool-skill
 */

'use strict';

const path = require('path');
const DynamicToolFactory = require('../tools/dynamic-tool-factory');

// Custom error class
class DynamicToolSkillError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'DynamicToolSkillError';
    this.cause = cause;
  }
}

module.exports = {
  meta: {
    name: 'dynamic-tool-skill',
    version: '1.0.0',
    type: 'active',
    category: 'core',
    description: 'Creates and uses dynamic tools based on student needs'
  },

  /**
   * Execute dynamic tool skill
   *
   * @param {Object} params - Skill parameters
   * @param {string} params.userInput - Student's query
   * @param {boolean} params.forceCreate - Force tool creation even if not needed
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Skill result
   */
  execute: async function(params, context) {
    const { userInput, forceCreate = false } = params;
    const { studentId, memory, studentModel, model, knowledgeBase, toolsRoot } = context;

    const startTime = Date.now();
    const logPrefix = `[DynamicToolSkill:${studentId}]`;

    console.log(`${logPrefix} Executing`, {
      userInput: userInput?.substring(0, 100),
      forceCreate
    });

    try {
      // Validate inputs
      if (!userInput) {
        throw new DynamicToolSkillError('userInput is required');
      }

      // Initialize dynamic tool factory
      const toolFactory = new DynamicToolFactory({
        modelManager: model,
        toolsRoot: toolsRoot || path.join(process.cwd(), 'src', 'tools'),
        logger: console,
        config: {
          maxToolsPerSession: 10,
          maxGenerationsPerDay: 50,
          requireApproval: true,
          cacheGeneratedTools: true
        }
      });

      // Step 1: Detect if new tool is needed
      console.log(`${logPrefix} Detecting tool need...`);
      const toolSpec = await toolFactory.detectToolNeed(
        userInput,
        studentModel,
        { studentId, memory }
      );

      // If no tool needed and not forcing creation, return
      if (!toolSpec && !forceCreate) {
        return {
          result: "I can handle this with existing tools. What specific aspect would you like help with?",
          action: 'no-tool-needed',
          duration: Date.now() - startTime
        };
      }

      // If no tool spec but forcing creation, create generic spec
      const finalSpec = toolSpec || this._createGenericSpec(userInput);

      // Step 2: Generate the tool
      console.log(`${logPrefix} Generating tool: ${finalSpec.name}`);
      const toolInstance = await toolFactory.generateTool(finalSpec, {
        studentId,
        memory,
        studentModel
      });

      // Step 3: Use the tool (if it has a default use case)
      let toolResult = null;
      if (finalSpec.parameters.length > 0) {
        try {
          // Extract parameters from user input
          const extractedParams = await this._extractParameters(
            userInput,
            finalSpec.parameters,
            model
          );

          // Execute tool
          toolResult = await toolInstance.execute(extractedParams, {
            studentId,
            memory,
            studentModel,
            knowledgeBase
          });

          toolFactory.trackToolUsage(finalSpec.name);

        } catch (err) {
          console.warn(`${logPrefix} Tool execution failed:`, err.message);
          // Non-fatal - we can still explain the tool
        }
      }

      // Step 4: Generate response
      const response = await this._generateResponse(
        finalSpec,
        toolResult,
        userInput,
        model
      );

      const duration = Date.now() - startTime;
      console.log(`${logPrefix} Completed in ${duration}ms`);

      return {
        result: response,
        toolCreated: {
          name: finalSpec.name,
          description: finalSpec.description
        },
        toolResult,
        action: 'tool-created',
        duration
      };

    } catch (err) {
      console.error(`${logPrefix} Failed:`, {
        error: err.message,
        stack: err.stack
      });

      // Fallback response
      return {
        result: "I tried to create a special tool to help you, but encountered an issue. Let me help you directly instead. What specific problem are you working on?",
        action: 'failed',
        error: err.message
      };
    }
  },

  /**
   * Create generic tool spec from user input
   * @private
   */
  _createGenericSpec(userInput) {
    const words = userInput.toLowerCase().split(' ');
    const relevantWords = words.filter(w => w.length > 4).slice(0, 3);
    const baseName = relevantWords.join('-') || 'custom-tool';

    return {
      name: baseName.replace(/[^a-z0-9-]/g, ''),
      description: `Custom tool for: ${userInput.substring(0, 100)}`,
      category: 'general',
      parameters: [
        {
          name: 'input',
          type: 'string',
          description: 'The input to process',
          required: true
        }
      ],
      capabilities: ['custom'],
      tags: ['generated'],
      exampleUsage: `await tool.execute({ input: "${userInput}" })`,
      expectedOutput: 'Processed result'
    };
  },

  /**
   * Extract parameters from user input
   * @private
   */
  async _extractParameters(userInput, paramSpecs, model) {
    const extracted = {};

    for (const spec of paramSpecs) {
      const prompt = [
        {
          role: 'system',
          content: `Extract the ${spec.name} (${spec.type}) from this user query.
          Return ONLY the value, no explanation.`
        },
        {
          role: 'user',
          content: userInput
        }
      ];

      const value = await model.chat(prompt, {
        temperature: 0.1,
        maxTokens: 100,
        skillName: 'parameter-extraction'
      });

      // Convert to correct type
      if (spec.type === 'number') {
        extracted[spec.name] = parseFloat(value) || 0;
      } else if (spec.type === 'boolean') {
        extracted[spec.name] = value.toLowerCase() === 'true';
      } else if (spec.type === 'array') {
        extracted[spec.name] = value.split(',').map(s => s.trim());
      } else {
        extracted[spec.name] = value;
      }
    }

    return extracted;
  },

  /**
   * Generate response about created tool
   * @private
   */
  async _generateResponse(toolSpec, toolResult, userInput, model) {
    const prompt = [
      {
        role: 'system',
        content: `You are OpenTutor. Explain to the student that you've created a custom tool to help them.

Tool created: ${toolSpec.name}
Description: ${toolSpec.description}

Generate a helpful response that:
1. Explains what the tool does in simple terms
2. Shows how they can use it
3. Asks what they'd like to do next

Keep it encouraging and clear.`
      },
      {
        role: 'user',
        content: `Student asked: "${userInput}"${toolResult ? '\nTool result: ' + JSON.stringify(toolResult) : ''}`
      }
    ];

    return await model.chat(prompt, {
      temperature: 0.5,
      maxTokens: 300,
      skillName: 'dynamic-tool-response'
    });
  }
};