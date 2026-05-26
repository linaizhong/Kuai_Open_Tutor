// agent/tool-interpreter.js
// Interprets OpenClaw-style skill markdown and maps to tools
// Now with full workflow execution engine

const toolRegistry = require('../tools');
const yaml = require('js-yaml'); // You'll need to add this to package.json

class ToolInterpreter {
  constructor(model, memory) {
    this.model = model;
    this.memory = memory;
    this.fallbackSkill = null; // Will be set when needed
  }

  /**
   * Execute a skill from markdown (legacy method for embedded code skills)
   * @param {string} skillMarkdown - Full SKILL.md content
   * @param {object} params - User input and context
   * @param {object} context - { studentId, studentModel, knowledgeBase }
   * @returns {Promise<object>} Skill result
   */
  async execute(skillMarkdown, params, context) {
    // 1. Parse the markdown
    const parsed = this.parseMarkdown(skillMarkdown);

    // 2. Extract user intent from params.userInput
    const userInput = params.userInput || '';

    // 3. Match user input to workflow steps
    const plan = await this.createExecutionPlan(userInput, parsed, context);

    // 4. Execute each step using tools
    return await this.executeWorkflow(plan.steps, parsed, params, context);
  }

//  /**
//   * Execute a tool-based skill from workflow steps
//   * @param {Array} workflow - List of workflow steps (strings)
//   * @param {Array} tools - List of tools used
//   * @param {object} params - User parameters
//   * @param {object} context - Execution context
//   * @returns {Promise<object>} Skill result with all tool outputs
//   */
//  async executeFromWorkflow(workflow, tools, params, context) {
//    console.log(`[ToolInterpreter] Executing workflow with ${workflow.length} steps using tools: ${tools.join(', ')}`);
//
//    // Store fallback skill for later use
//    //    this.fallbackSkill = context.skillManager?.getSkill('fallback-llm');
//    // Store fallback skill for later use
//    console.log('[ToolInterpreter] Attempting to get fallback-llm skill');
//    this.fallbackSkill = context.skillManager?.getSkill('fallback-llm');
//    if (!this.fallbackSkill) {
//      console.log('[ToolInterpreter] fallback-llm not found. Available skills:',
//        context.skillManager?.listSkills().map(s => s.name).join(', '));
//
//      // Try alternative names
//      const altNames = ['fallbackLlm', 'fallback_llm', 'fallback'];
//      for (const name of altNames) {
//        const skill = context.skillManager?.getSkill(name);
//        if (skill) {
//          console.log(`[ToolInterpreter] Found alternative skill: ${name}`);
//          this.fallbackSkill = skill;
//          break;
//        }
//      }
//    }
//
//    // 1. Validate that all required tools exist
//    const missingTools = tools.filter(t => !toolRegistry.hasTool(t));
//    if (missingTools.length > 0) {
//      console.warn(`[ToolInterpreter] Missing tools: ${missingTools.join(', ')}. Falling back to fallback-llm.`);
//      return this.fallbackToLLM(params, context);
//    }
//
//    // 2. Create execution plan from workflow steps
//    let steps;
//    try {
//      steps = await this.createStepsFromWorkflow(workflow, params, context);
//    } catch (err) {
//      console.error('[ToolInterpreter] Failed to create steps from workflow:', err.message);
//      return this.fallbackToLLM(params, context);
//    }
//
//    // 3. Check if we have any valid steps
//    if (!steps || steps.length === 0) {
//      console.warn('[ToolInterpreter] No valid steps created from workflow. Falling back to fallback-llm.');
//      return this.fallbackToLLM(params, context);
//    }
//
//    // 4. Execute the workflow
//    try {
//      const result = await this.executeWorkflow(steps, { tools, workflow }, params, context);
//
//      // Check if the result is just a placeholder (indicating failure)
//      if (result && result.result &&
//          (result.result.includes("Here's some help with your English question") ||
//           result.result.includes("How can I assist you"))) {
//        console.warn('[ToolInterpreter] Workflow produced placeholder response. Falling back to fallback-llm.');
//        return this.fallbackToLLM(params, context);
//      }
//
//      return result;
//    } catch (err) {
//      console.error('[ToolInterpreter] Workflow execution failed:', err.message);
//      return this.fallbackToLLM(params, context);
//    }
//  }

    /**
     * Execute a tool-based skill from workflow steps
     * @param {Array} workflow - List of workflow steps (strings)
     * @param {Array} tools - List of tools used
     * @param {object} params - User parameters
     * @param {object} context - Execution context
     * @returns {Promise<object>} Skill result with all tool outputs
     */
    async executeFromWorkflow(workflow, tools, params, context) {
      console.log(`[ToolInterpreter] Executing workflow with ${workflow.length} steps using tools: ${tools.join(', ')}`);

        // Store fallback skill for later use
        console.log('[ToolInterpreter] Attempting to get fallback-llm skill');
        console.log('[ToolInterpreter] skillManager exists?', !!context.skillManager);
        if (context.skillManager) {
          console.log('[ToolInterpreter] skillManager methods:', Object.keys(context.skillManager));
        }
        this.fallbackSkill = context.skillManager?.getSkill('fallback-llm');
        if (!this.fallbackSkill) {
          // Try to get all skills to see what's available
          const allSkills = context.skillManager?.getAllSkills?.() || [];
          console.log('[ToolInterpreter] Available skills count:', allSkills.length);
          console.log('[ToolInterpreter] Available skills:', allSkills.map(s => s.name).join(', '));

          // Try alternative names
          const altNames = ['fallbackLlm', 'fallback_llm', 'fallback'];
          for (const name of altNames) {
            const skill = context.skillManager?.getSkill(name);
            if (skill) {
              console.log(`[ToolInterpreter] Found alternative skill: ${name}`);
              this.fallbackSkill = skill;
              break;
            }
          }
        }

      // 1. Validate that all required tools exist
      const missingTools = tools.filter(t => !toolRegistry.hasTool(t));
      if (missingTools.length > 0) {
        console.warn(`[ToolInterpreter] Missing tools: ${missingTools.join(', ')}. Falling back to fallback-llm.`);
        return this.fallbackToLLM(params, context);
      }

      // 2. Create execution plan from workflow steps
      let steps;
      try {
        steps = await this.createStepsFromWorkflow(workflow, params, context);
      } catch (err) {
        console.error('[ToolInterpreter] Failed to create steps from workflow:', err.message);
        return this.fallbackToLLM(params, context);
      }

      // 3. Check if we have any valid steps
      if (!steps || steps.length === 0) {
        console.warn('[ToolInterpreter] No valid steps created from workflow. Falling back to fallback-llm.');
        return this.fallbackToLLM(params, context);
      }

      // 4. Execute the workflow
      try {
        const result = await this.executeWorkflow(steps, { tools, workflow }, params, context);

        // Check if the result is just a placeholder (indicating failure)
        if (result && result.result &&
            (result.result.includes("Here's some help with your English question") ||
             result.result.includes("How can I assist you"))) {
          console.warn('[ToolInterpreter] Workflow produced placeholder response. Falling back to fallback-llm.');
          return this.fallbackToLLM(params, context);
        }

        return result;
      } catch (err) {
        console.error('[ToolInterpreter] Workflow execution failed:', err.message);
        return this.fallbackToLLM(params, context);
      }
    }

    /**
     * Fall back to using the fallback-llm skill
     * @param {object} params - User parameters
     * @param {object} context - Execution context
     * @returns {Promise<object>}
     */
    async fallbackToLLM(params, context) {
      console.log('[ToolInterpreter] Falling back to fallback-llm skill');

      if (!this.fallbackSkill) {
        console.error('[ToolInterpreter] fallback-llm skill not available');
        // If fallback skill isn't available, use direct LLM call as last resort
        return this.directLLMFallback(params, context);
      }

      // Execute the fallback skill directly
      try {
        console.log('[ToolInterpreter] Executing fallback-llm skill');
        const result = await this.fallbackSkill.module.execute(params, context);
        return result;
      } catch (err) {
        console.error('[ToolInterpreter] Fallback skill execution failed:', err.message);
        // If fallback skill fails, use direct LLM call as last resort
        return this.directLLMFallback(params, context);
      }
    }

    /**
     * Ultimate fallback - direct LLM call when fallback-llm skill is unavailable
     * @param {object} params - User parameters
     * @param {object} context - Execution context
     * @returns {Promise<object>}
     */
    async directLLMFallback(params, context) {
      console.log('[ToolInterpreter] Using direct LLM fallback');

      const { studentModel, model } = context;
      const userInput = params.userInput || '';
      const activeSubject = params.activeSubject || 'general';

      // Get subject metadata if available
      let subjectContext = '';
      if (context.knowledgeBase?.subjectMeta) {
        subjectContext = `The student is studying ${context.knowledgeBase.subjectMeta.name || activeSubject}.`;
      }

      const systemPrompt = `You are Tute, a helpful AI tutor. ${subjectContext}
    The student asks: "${userInput}"
    Provide a clear, helpful response.`;

      try {
        const response = await model.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ], {
          temperature: 0.7,
          maxTokens: 800,
          skillName: 'direct-fallback',
          studentId: context.studentId
        });

        return {
          result: response,
          visualization: null,
          syllabusPoint: null
        };
      } catch (err) {
        console.error('[ToolInterpreter] Direct LLM fallback failed:', err.message);
        return {
          result: "I'm having trouble processing your request. Please try again.",
          visualization: null,
          syllabusPoint: null
        };
      }
    }

  /**
   * Parse SKILL.md into structured data
   * @param {string} markdown
   * @returns {object} { frontmatter, description, workflow, examples, tools }
   */
  parseMarkdown(markdown) {
    // Extract YAML frontmatter (between --- lines)
    const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
    let frontmatter = {};
    if (frontmatterMatch) {
      try {
        frontmatter = yaml.load(frontmatterMatch[1]);
      } catch (err) {
        console.warn('[ToolInterpreter] Failed to parse YAML frontmatter:', err.message);
      }
    }

    // Remove frontmatter to get content
    let content = markdown;
    if (frontmatterMatch) {
      content = markdown.slice(frontmatterMatch[0].length).trim();
    }

    // Extract description (first paragraph after frontmatter)
    const descriptionMatch = content.match(/^([^#\n][^\n]*)/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Extract workflow steps (numbered or bullet points after ## Workflow)
    const workflowMatch = content.match(/## Workflow\s*\n([\s\S]*?)(?=\n##|$)/);
    let workflow = [];
    if (workflowMatch) {
      const workflowText = workflowMatch[1];
      const stepMatches = workflowText.match(/(?:\d+\.|\*)\s*(.+)/g) || [];
      workflow = stepMatches.map(line => line.replace(/^\d+\.\s*|\*\s*/, '').trim());
    }

    // Extract tool references (after ## Tools Used)
    const toolsMatch = content.match(/## Tools Used\s*\n([\s\S]*?)(?=\n##|$)/);
    let tools = [];
    if (toolsMatch) {
      const toolsText = toolsMatch[1];
      const toolMatches = toolsText.match(/`([^`]+)`/g) || [];
      tools = toolMatches.map(t => t.replace(/`/g, ''));
    }

    // Extract examples (JSON code blocks)
    const examples = [];
    const exampleRegex = /```(?:json|javascript)\n([\s\S]*?)```/g;
    let match;
    while ((match = exampleRegex.exec(content)) !== null) {
      try {
        examples.push(JSON.parse(match[1]));
      } catch {
        // If not JSON, store as string
        examples.push(match[1]);
      }
    }

    return {
      frontmatter,
      description,
      workflow,
      tools,
      examples,
      raw: markdown,
    };
  }

  /**
   * Create executable steps from workflow strings
   * @param {Array} workflowSteps - Array of step descriptions
   * @param {object} params - User parameters
   * @param {object} context - Execution context
   * @returns {Promise<Array>} Array of executable steps with tool mappings
   */
  async createStepsFromWorkflow(workflowSteps, params, context) {
    const { studentModel, knowledgeBase } = context;
    const steps = [];

    for (let i = 0; i < workflowSteps.length; i++) {
      const stepDesc = workflowSteps[i];
      const mapping = await this.mapStepToTool(stepDesc, params, context);

      if (mapping.skipTool) {
        // This step should be handled internally by the interpreter
        steps.push({
          description: stepDesc,
          internal: true,
          intent: mapping.intent,
          order: i + 1,
        });
      } else {
        // This step uses a tool
        steps.push({
          description: stepDesc,
          tool: mapping.tool,
          params: this.prepareToolParams(mapping.tool, mapping.params, params, context),
          order: i + 1,
        });
      }
    }

    return steps;
  }

  /**
   * Map a workflow step to a specific tool using LLM
   * @param {string} stepDesc - Step description
   * @param {object} params - User parameters
   * @param {object} context - Execution context
   * @returns {Promise<object>} { tool, params, skipTool }
   */
  async mapStepToTool(stepDesc, params, context) {
    const lowerStep = stepDesc.toLowerCase();

    // ===== PATTERN MATCHING FOR COMMON STEPS =====
    // This prevents unnecessary LLM calls for predictable steps

    // General conversation steps (already present)
    if (lowerStep.includes('greeting') ||
        lowerStep.includes('farewell') ||
        lowerStep.includes('personalize') ||
        lowerStep.includes('return the final response')) {
      return {
        skipTool: true,
        intent: lowerStep.includes('greeting') ? 'greeting' :
                lowerStep.includes('farewell') ? 'farewell' :
                lowerStep.includes('personalize') ? 'personalize' : 'finalize'
      };
    }

    // ===== ENGLISH-SPECIFIC PATTERNS =====
    // Detect prescribed text
    if (lowerStep.includes('prescribed text') || lowerStep.includes('hsc texts')) {
      return {
        tool: 'knowledge-query',
        params: {
          type: 'dotPoint',
          query: params.userInput || '',
          subject: params.activeSubject || 'english-advanced'
        }
      };
    }

    // Identify English task type
    if (lowerStep.includes('identify') && lowerStep.includes('task type')) {
      return {
        skipTool: true,
        intent: 'detect-english-task'
      };
    }

    // Retrieve textual analysis guidance
    if (lowerStep.includes('retrieve') && lowerStep.includes('textual analysis')) {
      return {
        tool: 'knowledge-query',
        params: {
          type: 'dotPoint',
          query: 'textual analysis',
          subject: params.activeSubject || 'english-advanced'
        }
      };
    }

    // Generate response based on task type
    if (lowerStep.includes('generate appropriate response') || lowerStep.includes('based on task type')) {
      return {
        skipTool: true,
        intent: 'generate-english-response'
      };
    }

    // Provide feedback on writing
    if (lowerStep.includes('provide feedback') || lowerStep.includes('writing if submitted')) {
      if (params.studentWriting || params.userInput) {
        return {
          tool: 'marking-guideline',
          params: {
            response: params.studentWriting || params.userInput,
            taskType: 'english-essay',
            subject: params.activeSubject || 'english-advanced'
          }
        };
      }
      return { skipTool: true, intent: 'skip-feedback' };
    }

    // Track progress
    if (lowerStep.includes('track progress') || lowerStep.includes('track in english')) {
      return {
        tool: 'velocity-tracker',
        params: {
          topicCode: 'english-advanced',
          topicLabel: 'English Advanced',
          score: 0.5, // Placeholder, actual score would come from previous steps
          studentId: context.studentId
        }
      };
    }

    // ===== MATH-SPECIFIC PATTERNS =====
    if (lowerStep.includes('calculate') || lowerStep.includes('solve equation')) {
      return {
        tool: 'calculator',
        params: { expression: params.userInput || '', steps: true }
      };
    }

    if (lowerStep.includes('plot') || lowerStep.includes('graph')) {
      return {
        tool: 'plotter',
        params: { function: params.userInput || '' }
      };
    }

    // ===== GENERAL PATTERNS =====
    // Detect intent/detect query
    if (lowerStep.includes('detect') || lowerStep.includes('intent') || lowerStep.includes('query')) {
      return { skipTool: true, intent: 'detect' };
    }

    // Query subjects
    if (lowerStep.includes('query') || lowerStep.includes('subjects') || lowerStep.includes('available subjects')) {
      return { tool: 'knowledge-query', params: { type: 'subjects', query: 'all' } };
    }

    // Template or response handling
    if (lowerStep.includes('template') || lowerStep.includes('response')) {
      return { skipTool: true, intent: 'respond' };
    }

    // ===== FALLBACK TO LLM =====
    // For steps that don't match any pattern, use LLM
    const availableTools = toolRegistry.getAllTools();
    const toolsList = availableTools.map(t =>
      `- ${t.name}: ${t.description} (parameters: ${JSON.stringify(t.parameters || [])})`
    ).join('\n');

    const prompt = `
You are a workflow interpreter. Given a workflow step and available tools, map it to the most appropriate tool.

Workflow step: "${stepDesc}"

Available tools:
${toolsList}

User parameters: ${JSON.stringify(params, null, 2)}

Return ONLY a valid JSON object with this exact format, no markdown, no backticks:
{
  "tool": "name of the tool to use",
  "params": {
    // Tool-specific parameters
  }
}
`;

    const response = await this.model.chat([
      { role: 'system', content: 'You are a workflow interpreter. Return ONLY raw JSON.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.2, maxTokens: 300 });

    try {
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.trim()
        .replace(/^```json\n?/, '')
        .replace(/^```\n?/, '')
        .replace(/\n?```$/, '');

      return JSON.parse(cleanResponse);
    } catch (err) {
      console.warn(`[ToolInterpreter] Failed to parse tool mapping for step: "${stepDesc}"`, err.message);

      // Intelligent fallbacks based on step content
      if (lowerStep.includes('detect') || lowerStep.includes('intent')) {
        return { skipTool: true, intent: 'detect' };
      }
      if (lowerStep.includes('query') || lowerStep.includes('subjects')) {
        return { tool: 'knowledge-query', params: { type: 'subjects', query: 'all' } };
      }
      if (lowerStep.includes('template') || lowerStep.includes('response')) {
        return { skipTool: true, intent: 'respond' };
      }

      return { skipTool: true, intent: 'unknown' };
    }
  }

  /**
   * Prepare parameters for a tool call
   * @param {string} toolName - Tool to call
   * @param {object} mappedParams - Parameters from mapping
   * @param {object} userParams - Original user parameters
   * @param {object} context - Execution context
   * @returns {object} Prepared parameters
   */
  prepareToolParams(toolName, mappedParams, userParams, context) {
    // Merge mapped params with user params where appropriate
    const prepared = { ...mappedParams };

    // Common parameter mappings
    if (toolName === 'knowledge-query') {
      if (userParams.questionId && !prepared.query) {
        prepared.query = userParams.questionId;
      }
      if (userParams.subject && !prepared.subject) {
        prepared.subject = userParams.subject;
      }
    }

    if (toolName === 'syllabus-matcher') {
      if (userParams.userInput && !prepared.text) {
        prepared.text = userParams.userInput;
      }
    }

    if (toolName === 'marking-guideline') {
      if (userParams.userInput && !prepared.response) {
        prepared.response = userParams.userInput;
      }
    }

    if (toolName === 'error-analyzer') {
      if (userParams.userInput && !prepared.text) {
        prepared.text = userParams.userInput;
      }
    }

    return prepared;
  }

  /**
   * Create execution plan using LLM (for legacy embedded code skills)
   * @param {string} userInput
   * @param {object} parsed - Parsed skill data
   * @param {object} context
   * @returns {Promise<object>} { steps: Array<{tool, params}>, explanation }
   */
  async createExecutionPlan(userInput, parsed, context) {
    const availableTools = toolRegistry.getAllTools().map(t => t.name).join(', ');

    const prompt = `
You are a skill interpreter. Given:
- User input: "${userInput}"
- Skill description: ${parsed.description}
- Workflow steps: ${parsed.workflow.join(' → ')}
- Available tools: ${availableTools}
- Examples: ${JSON.stringify(parsed.examples)}

Create an execution plan that maps the user's request to specific tools.
Return a JSON object with:
{
  "steps": [
    {
      "tool": "toolName",
      "params": { ... }  // Parameters for the tool
    }
  ],
  "explanation": "Brief explanation of the plan"
}

The params should match what the tool expects. Use the examples as guidance.
`;

    const response = await this.model.chat([
      { role: 'system', content: 'You are a helpful assistant that creates execution plans for skills.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 800 });

    try {
      return JSON.parse(response);
    } catch {
      // Fallback: treat as explanation with no structured steps
      return {
        steps: [],
        explanation: response,
      };
    }
  }

  /**
   * Execute a workflow of steps
   * @param {Array} steps - Array of step objects with tool and params
   * @param {object} skillMeta - Skill metadata
   * @param {object} params - Original user parameters
   * @param {object} context - Execution context
   * @returns {Promise<object>} Aggregated results
   */
  async executeWorkflow(steps, skillMeta, params, context) {
    const { studentModel } = context;
    const results = [];
    const stepOutputs = {};
    let finalResponse = '';

    console.log(`[ToolInterpreter] Executing ${steps.length} workflow steps`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (step.internal) {
        // Handle internal steps
        console.log(`[ToolInterpreter] Step ${i+1}: ${step.description} (internal)`);

        if (step.intent === 'greeting') {
          finalResponse = "Hello! I'm Tute, your personal AI tutor. How can I help you today?";
        } else if (step.intent === 'farewell') {
          finalResponse = "Goodbye! Great work today. Come back anytime!";
        } else if (step.intent === 'personalize' && studentModel?.profile?.name) {
          finalResponse = finalResponse.replace('!', `, ${studentModel.profile.name}!`);
        } else if (step.intent === 'detect') {
          // Intent detection would happen here
          finalResponse = "I'm here to help with your studies!";
        } else if (step.intent === 'respond') {
          finalResponse = finalResponse || "How can I assist you with your studies today?";
        }
        // English-specific internal steps
        else if (step.intent === 'detect-english-task') {
          const userInput = params.userInput?.toLowerCase() || '';
          if (userInput.includes('essay') || userInput.includes('model response')) {
            finalResponse = 'I see you want help with an essay or model response. Let me find some examples for you.';
          } else if (userInput.includes('analysis') || userInput.includes('quote')) {
            finalResponse = 'I can help you analyze that text. Let me find some guidance.';
          } else {
            finalResponse = "I'll help with your English Advanced question.";
          }
        } else if (step.intent === 'generate-english-response') {
          finalResponse = "Here's some help with your English question:";
        } else if (step.intent === 'skip-feedback') {
          finalResponse = finalResponse || "I'll help with your English question.";
        }

        stepOutputs[`step${i+1}`] = { response: finalResponse };

      } else {
        // Tool-based step
        console.log(`[ToolInterpreter] Step ${i+1}: ${step.description} (using ${step.tool})`);

        try {
          // Prepare context with previous step outputs
          const stepContext = {
            ...context,
            previousOutputs: stepOutputs,
            currentStep: i + 1,
            totalSteps: steps.length,
          };

          // Execute the tool
          const result = await toolRegistry.executeTool(step.tool, step.params, stepContext);

          // Store result
          const stepResult = {
            success: true,
            tool: step.tool,
            result,
            stepNumber: i + 1,
            description: step.description,
          };

          results.push(stepResult);
          stepOutputs[`step${i+1}`] = result;
          stepOutputs[step.tool] = result;

        } catch (err) {
          console.error(`[ToolInterpreter] Step ${i+1} failed:`, err.message);

          const stepResult = {
            success: false,
            tool: step.tool,
            error: err.message,
            stepNumber: i + 1,
            description: step.description,
          };

          results.push(stepResult);

          // Decide whether to continue or stop based on error severity
          if (this._isFatalError(err)) {
            break;
          }
        }
      }
    }

    // If we have a final response from internal steps, return it
    if (finalResponse) {
      return {
        result: finalResponse,
        visualization: null,
        syllabusPoint: null,
        stepResults: results,
      };
    }

    // Otherwise format the workflow response
    return this.formatWorkflowResponse(results, stepOutputs, skillMeta, params, context);
  }

  /**
   * Format workflow results into a cohesive response
   * @param {Array} results - Step execution results
   * @param {object} stepOutputs - Outputs from each step
   * @param {object} skillMeta - Skill metadata
   * @param {object} params - Original parameters
   * @param {object} context - Execution context
   * @returns {Promise<object>} Formatted response
   */
  async formatWorkflowResponse(results, stepOutputs, skillMeta, params, context) {
    const { studentModel } = context;

    // Check if we have a template in the skill markdown
    if (params.template) {
      return this.fillTemplate(params.template, results, stepOutputs);
    }

    // Build a summary of what was executed
    const summary = results.map(r =>
      r.success
        ? `✓ Step ${r.stepNumber}: ${r.description} completed successfully`
        : `✗ Step ${r.stepNumber}: ${r.description} failed - ${r.error}`
    ).join('\n');

    // Extract key outputs for different tool types
    let mainResult = '';
    let score = null;
    let visualization = null;
    let syllabusPoint = null;

    // Look for specific tool outputs
    if (stepOutputs['marking-guideline']) {
      mainResult = stepOutputs['marking-guideline'].formatted || stepOutputs['marking-guideline'].result;
      score = stepOutputs['marking-guideline'].score;
    } else if (stepOutputs['knowledge-query']) {
      mainResult = stepOutputs['knowledge-query'].formatted;
      if (stepOutputs['knowledge-query'].result?.data?.code) {
        syllabusPoint = stepOutputs['knowledge-query'].result.data.code;
      }
    } else if (stepOutputs['plotter']) {
      mainResult = stepOutputs['plotter'].formatted;
      visualization = stepOutputs['plotter'].visualization;
    } else if (stepOutputs['calculator']) {
      mainResult = stepOutputs['calculator'].formatted;
    } else if (stepOutputs['syllabus-matcher'] && stepOutputs['syllabus-matcher'].matches?.length > 0) {
      syllabusPoint = stepOutputs['syllabus-matcher'].matches[0].code;
    }

    // If no main result from tools, use LLM to generate
    if (!mainResult) {
      mainResult = await this.generateResponseFromResults(results, stepOutputs, params, context);
    }

    return {
      result: mainResult,
      score,
      visualization,
      syllabusPoint,
      stepResults: results,
      memoryUpdates: this.extractMemoryUpdates(results, stepOutputs),
    };
  }

  /**
   * Generate a natural language response from results using LLM
   * @param {Array} results - Step results
   * @param {object} stepOutputs - Step outputs
   * @param {object} params - Original parameters
   * @param {object} context - Execution context
   * @returns {Promise<string>} Generated response
   */
  async generateResponseFromResults(results, stepOutputs, params, context) {
    const { studentModel } = context;

    const resultsText = results
      .map(r => r.success
        ? `Step ${r.stepNumber} (${r.tool}): ${JSON.stringify(r.result)}`
        : `Step ${r.stepNumber} (${r.tool}): FAILED - ${r.error}`)
      .join('\n\n');

    const prompt = `
You are a TOEFL tutor. Based on these tool execution results, generate a helpful response for the student.

Tool Results:
${resultsText}

Student's original input: ${params.userInput || 'N/A'}
Student's affective state: ${studentModel?.affectiveState?.currentEngagement || 'focused'}

Generate a natural, encouraging response that:
1. Addresses the student's request
2. Includes any scores or feedback from the tools
3. Provides specific, actionable advice
4. Matches the tone to the student's affective state
5. Ends with a question or next step

Response:
`;

    const response = await this.model.chat([
      { role: 'system', content: 'You are a helpful TOEFL tutor. Generate clear, encouraging responses.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.5, maxTokens: 600 });

    return response;
  }

  /**
   * Extract memory updates from tool results
   * @param {Array} results - Step results
   * @param {object} stepOutputs - Step outputs
   * @returns {object|null} Memory updates
   */
  extractMemoryUpdates(results, stepOutputs) {
    const updates = {};

    // Check for score from marking-guideline
    if (stepOutputs['marking-guideline']?.score !== undefined) {
      updates.score = stepOutputs['marking-guideline'].score;
      updates.type = 'assessment';
    }

    // Check for errors from error-analyzer
    if (stepOutputs['error-analyzer']?.errors) {
      updates.errors = stepOutputs['error-analyzer'].errors;
      updates.type = 'error-analysis';
    }

    // Check for velocity tracking
    if (stepOutputs['velocity-tracker']) {
      updates.velocity = stepOutputs['velocity-tracker'];
    }

    return Object.keys(updates).length > 0 ? updates : null;
  }

  /**
   * Fill a template with results
   * @param {string} template
   * @param {Array} results
   * @param {object} stepOutputs
   * @returns {string}
   */
  fillTemplate(template, results, stepOutputs) {
    let filled = template;

    // Replace {{result.N}} with step results
    for (let i = 0; i < results.length; i++) {
      const placeholder = `{{result.${i + 1}}}`;
      const value = results[i].success
        ? (results[i].result?.formatted || JSON.stringify(results[i].result, null, 2))
        : `Error: ${results[i].error}`;
      filled = filled.replace(new RegExp(placeholder, 'g'), value);
    }

    // Replace {{output.toolName}} with tool outputs
    for (const [tool, output] of Object.entries(stepOutputs)) {
      const placeholder = `{{output.${tool}}}`;
      const value = output?.formatted || JSON.stringify(output, null, 2);
      filled = filled.replace(new RegExp(placeholder, 'g'), value);
    }

    // Replace {{explanation}} with a summary
    const summary = results.map(r =>
      r.success ? `✓ ${r.description}` : `✗ ${r.description}`
    ).join('\n');
    filled = filled.replace(/{{explanation}}/g, summary);

    return filled;
  }

  /**
   * Execute a single step using a tool
   * @param {object} step - { tool, params }
   * @param {object} context
   * @returns {Promise<object>} Step result
   */
  async executeStep(step, context) {
    const { tool, params } = step;

    try {
      const result = await toolRegistry.executeTool(tool, params, context);
      return {
        success: true,
        tool,
        result,
      };
    } catch (err) {
      console.error(`[ToolInterpreter] Tool ${tool} failed:`, err.message);
      return {
        success: false,
        tool,
        error: err.message,
      };
    }
  }

  /**
   * Determine if an error is fatal and should stop workflow
   * @param {Error} err
   * @returns {boolean}
   */
  _isFatalError(err) {
    const fatalMessages = [
      'not found',
      'unavailable',
      'unauthorized',
      'invalid API',
    ];
    return fatalMessages.some(msg => err.message.toLowerCase().includes(msg));
  }
}

module.exports = ToolInterpreter;