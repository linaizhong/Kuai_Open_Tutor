// skills/MarkdownSkillRunner.js
//
// Universal skill executor — reads any SKILL.md file and uses the LLM
// to execute it. This is the ONLY code file needed to run all skills.
//
// Adding a new skill = create skills/your-skill/SKILL.md — no code needed.

'use strict';

const fs   = require('fs');
const path = require('path');

class MarkdownSkillRunner {
  /**
   * @param {object} options
   * @param {object} options.model  — ModelManager instance (must have .chat())
   */
  constructor({ model } = {}) {
    this.model = model;
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  /**
   * Execute a skill defined entirely by a SKILL.md file.
   *
   * @param {string} skillMdPath   — absolute path to the SKILL.md file
   * @param {object} params        — { userInput, ...any other inputs listed in the SKILL.md }
   * @param {object} context       — { studentId, memory, studentModel, model, knowledgeBase }
   * @returns {Promise<{ result: string, visualization: null, syllabusPoint: string|null }>}
   */
  async execute(skillMdPath, params, context) {
    // 1. Load and parse the SKILL.md
    const skillMd  = fs.readFileSync(skillMdPath, 'utf8');
    const skillDef = this._parseSkillMd(skillMd);

    // 2. Build context summary for the LLM from the student model + KB
    const contextSummary = this._buildContextSummary(context);

    // 3. Build the system prompt from the skill definition
    const systemPrompt = this._buildSystemPrompt(skillDef, context.studentModel, context, params);

    // 4. Build the user message — combines the skill instructions + actual student input
    const userMessage = this._buildUserMessage(skillDef, params, contextSummary);

    // 5. Call the model
    const modelInstance = context.model || this.model;
    if (!modelInstance) throw new Error('[MarkdownSkillRunner] No model available in context or constructor');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ];

    const response = await modelInstance.chat(messages, {
      temperature: 0.5,
      maxTokens:   1000,
      skillName:   skillDef.name,
      studentId:   context.studentId,
    });

    // 6. Return in the standard skill output shape
    return {
      result:        response,
      visualization: null,
      syllabusPoint: params.dotPoint || params.syllabusPoint || null,
      skillUsed:     skillDef.name,
      skillVersion:  skillDef.version,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SKILL.md parser
  // ─────────────────────────────────────────────────────────────

  /**
   * Parses a SKILL.md file into a structured object.
   * Extracts: name, description, version, type, triggers, workflow, inputs, outputs, notes, examples.
   *
   * @param {string} markdown
   * @returns {object} skillDef
   */
  _parseSkillMd(markdown) {
    const def = {
      name:        '',
      description: '',
      version:     '1.0.0',
      type:        'active',
      category:    'core',
      triggers:    { keywords: [], intent: '' },
      workflow:    [],
      inputs:      [],
      outputs:     [],
      notes:       '',
      examples:    [],
      rawMd:       markdown,   // keep the full text — used verbatim in the prompt
    };

    const lines   = markdown.split('\n');
    let section   = null;
    let jsonBuffer = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // ── Section headers ──────────────────────────────────────
      if (line.startsWith('## ')) {
        section    = line.replace('## ', '').trim().toLowerCase();
        jsonBuffer = null;
        continue;
      }

      // ── Meta block ────────────────────────────────────────────
      if (section === 'meta') {
        const nameMatch    = line.match(/\*\*Name\*\*:\s*(.+)/);
        const versionMatch = line.match(/\*\*Version\*\*:\s*(.+)/);
        const typeMatch    = line.match(/\*\*Type\*\*:\s*(.+)/);
        const catMatch     = line.match(/\*\*Category\*\*:\s*(.+)/);
        if (nameMatch)    def.name     = nameMatch[1].trim();
        if (versionMatch) def.version  = versionMatch[1].trim();
        if (typeMatch)    def.type     = typeMatch[1].trim();
        if (catMatch)     def.category = catMatch[1].trim();
        continue;
      }

      // ── Description ───────────────────────────────────────────
      if (section === 'description' && line.trim()) {
        def.description += (def.description ? ' ' : '') + line.trim();
        continue;
      }

      // ── Triggers (JSON block) ─────────────────────────────────
      if (section === 'triggers') {
        if (line.trim() === '```json') { jsonBuffer = ''; continue; }
        if (line.trim() === '```' && jsonBuffer !== null) {
          try {
            def.triggers = JSON.parse(jsonBuffer);
          } catch (e) {
            console.warn('[MarkdownSkillRunner] Could not parse triggers JSON:', e.message);
          }
          jsonBuffer = null;
          continue;
        }
        if (jsonBuffer !== null) { jsonBuffer += line + '\n'; continue; }
      }

      // ── Workflow ──────────────────────────────────────────────
      if (section === 'workflow') {
        const step = line.match(/^\d+\.\s+(.+)/);
        if (step) def.workflow.push(step[1].trim());
        continue;
      }

      // ── Inputs ────────────────────────────────────────────────
      if (section === 'inputs') {
        const input = line.match(/^-\s+`(.+?)`[:\s]+(.+)/);
        if (input) def.inputs.push({ name: input[1], description: input[2].trim() });
        continue;
      }

      // ── Outputs ───────────────────────────────────────────────
      if (section === 'outputs') {
        const output = line.match(/^-\s+`(.+?)`[:\s]+(.+)/);
        if (output) def.outputs.push({ name: output[1], description: output[2].trim() });
        continue;
      }

      // ── Notes ─────────────────────────────────────────────────
      if (section === 'notes' && line.trim()) {
        def.notes += (def.notes ? '\n' : '') + line.trim();
        continue;
      }
    }

    // Title fallback: # Skill: adaptive-drill → name
    if (!def.name) {
      const titleMatch = markdown.match(/^#\s+Skill:\s+(.+)/m);
      if (titleMatch) def.name = titleMatch[1].trim();
    }

    return def;
  }

  // ─────────────────────────────────────────────────────────────
  // Prompt builders
  // ─────────────────────────────────────────────────────────────

  /**
   * Builds the system prompt from the parsed skill definition.
   * Injects student personalisation on top of the skill's own instructions.
   */
  _buildSystemPrompt(skillDef, studentModel, context = {}, params = {}) {
    const engagement     = studentModel?.affectiveState?.currentEngagement || 'focused';
    const weeksRemaining = studentModel?.weeksRemaining;

    // Resolve active subject with correct priority:
    // 1. params.activeSubject  — set by coordinator.skillParams (most reliable)
    // 2. context.knowledgeBase.subjectId — from loaded KB
    // 3. studentModel.activeSubject — from student model
    // 4. Fallback to 'general'
    const subject =
      params.activeSubject ||
      context.knowledgeBase?.subjectId ||
      studentModel?.activeSubject ||
      'general';

    // Personalisation block
    const toneMap = {
      frustrated: 'The student is currently frustrated. Be warm and patient — normalise mistakes.',
      confident:  'The student is feeling confident. Keep energy up and provide challenge.',
      fatigued:   'The student is tired. Keep responses short and clear.',
    };
    const tone    = toneMap[engagement] || 'Be encouraging and clear.';
    const urgency = (weeksRemaining !== undefined && weeksRemaining <= 4)
      ? `The HSC exam is only ${weeksRemaining} week(s) away — focus on high-yield topics.`
      : '';

    // The skill's workflow steps become explicit instructions
    const workflowBlock = skillDef.workflow.length > 0
      ? `\nFollow this workflow precisely:\n${skillDef.workflow.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '';

    // Notes become constraints
    const notesBlock = skillDef.notes
      ? `\nImportant constraints:\n${skillDef.notes}`
      : '';

    // Build a readable description of what the response should contain,
    // without asking the LLM to use field labels — that causes it to
    // literally print "result: ..." "module: ..." in the response text.
    const outputDesc = skillDef.outputs.length > 0
      ? skillDef.outputs
          .filter(o => o.name === 'result' || o.name === 'response')
          .map(o => o.description)
          .join(' ')
        || skillDef.outputs.map(o => o.description).join(' ')
      : 'a clear, helpful response.';

    return `You are OpenTutor — an expert ${subject} tutor for Australian students.

SKILL: ${skillDef.name}
PURPOSE: ${skillDef.description}
${workflowBlock}
${notesBlock}

STUDENT STATE: ${tone} ${urgency}

CRITICAL OUTPUT RULE:
Reply with ONLY your tutoring response — plain text or markdown.
Do NOT include any field labels, prefixes, or structured output like "result:", "module:", "text:", "memoryUpdates:", etc.
Your entire reply IS the answer. Nothing else.

Your response should be: ${outputDesc}

Always personalise your response to the student's current level and state. Be concise and direct.`;
  }

  /**
   * Builds the user-turn message combining skill inputs with the actual student input.
   */
  _buildUserMessage(skillDef, params, contextSummary) {
    const lines = [];

    // Always surface the active subject first so skill workflow step 1
    // ("Detect the active subject") resolves correctly from the prompt.
    if (params.activeSubject) {
      lines.push(`Active subject: ${params.activeSubject}`);
    }

    // Inject conversation history BEFORE the student message so the LLM has
    // full context — essential for "quiz me" after a reading passage, etc.
    if (Array.isArray(params.conversationHistory) && params.conversationHistory.length > 0) {
      lines.push('\nRecent conversation history:');
      for (const turn of params.conversationHistory) {
        const speaker = turn.role === 'user' ? '[Student]' : '[Tutor]';
        const text = (turn.content || '').slice(0, 600); // cap each turn to avoid prompt bloat
        lines.push(`${speaker}: ${text}`);
      }
      lines.push(''); // blank line separator before student message
    }

    // Student's actual message
    if (params.userInput) {
      lines.push(`Student message: "${params.userInput}"`);
    }

    // Any extra params explicitly listed in the skill's Inputs section
    for (const input of skillDef.inputs) {
      const key = input.name.replace(/^params\.|^context\./, '').split(/[,\s{]/)[0].trim();
      if (key && key !== 'userInput' && params[key] !== undefined) {
        lines.push(`${input.name}: ${JSON.stringify(params[key])}`);
      }
    }

    // Student context summary (mastery, weak points, etc.)
    if (contextSummary) {
      lines.push(`\nStudent context:\n${contextSummary}`);
    }

    return lines.join('\n');
  }

  /**
   * Builds a concise summary of the student model for the LLM.
   * Keeps it short — only what's relevant for personalisation.
   */
  _buildContextSummary(context) {
    const { studentModel, knowledgeBase } = context;
    if (!studentModel) return '';

    const parts = [];

    if (studentModel.weakDotPoints?.length > 0) {
      parts.push(`Weak areas: ${studentModel.weakDotPoints.slice(0, 3).map(d => d.code).join(', ')}`);
    }

    if (studentModel.affectiveState?.currentEngagement) {
      parts.push(`Engagement: ${studentModel.affectiveState.currentEngagement}`);
    }

    if (studentModel.weeksRemaining !== undefined) {
      parts.push(`Weeks until exam: ${studentModel.weeksRemaining}`);
    }

    if (studentModel.profile?.learningStyle) {
      parts.push(`Learning style: ${studentModel.profile.learningStyle}`);
    }

    return parts.join(' | ');
  }
}

module.exports = MarkdownSkillRunner;