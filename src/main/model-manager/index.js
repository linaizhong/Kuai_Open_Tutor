// Model Manager — Main Entry Point
// This is the ONLY file the rest of the application imports.
// Exposes: chat(), test(), switchModel(), listModels(), getStats()

const path = require('path');
const registry = require('./registry');
const Config   = require('./config');
const Stats    = require('./stats');
const Tester   = require('./tester');

class ModelManager {
  /**
   * @param {string} dataRoot - Absolute path to the data/ directory
   *                            e.g. path.join(__dirname, '../../../data')
   */
  constructor(dataRoot) {
    if (!dataRoot) throw new Error('ModelManager: dataRoot is required');

    this.config = new Config(path.join(dataRoot, 'config', 'user-config.json'));
    this.stats  = new Stats(path.join(dataRoot, 'config', 'model-stats.json'));
    this.tester = new Tester(registry, this.config);

    // Active adapter instance — created on first chat() call or switchModel()
    this._adapter = null;
  }

  /**
   * Lazily initialises the adapter for the currently configured model.
   * Called internally before every chat() call.
   */
  _getAdapter() {
    const modelId = this.config.getActiveModelId();

    // Re-create adapter if the model has changed or adapter not yet created
    if (!this._adapter || this._adapter.modelId !== modelId) {
      const model = registry.findModel(modelId);
      if (!model) throw new Error(`ModelManager: active model "${modelId}" not found in registry`);

      let adapterConfig = {};
      if (model.adapter === 'ollama') {
        adapterConfig = this.config.getOllamaConfig();
      } else {
        adapterConfig = { apiKey: this.config.getApiKey(model.adapter) };
      }

      this._adapter = registry.createAdapter(modelId, adapterConfig);
    }

    return this._adapter;
  }

  // ============================================================
  // CORE: chat()
  // ============================================================

  /**
   * Sends messages to the active model and returns the response text.
   * Records call statistics automatically.
   *
   * @param {Array<{ role: 'system'|'user'|'assistant', content: string }>} messages
   * @param {object} options - { temperature, maxTokens, skillName, studentId }
   * @returns {Promise<string>} model response text
   */
  async chat(messages, options = {}) {
    const adapter = this._getAdapter();
    const start = Date.now();

    try {
      // Verify model is available before calling
      const available = await adapter.isAvailable();
      if (!available) {
        throw new Error(
          `Model "${adapter.modelId}" is not available. ` +
          (adapter.getType() === 'ollama'
            ? `Make sure Ollama is running and the model is installed: ollama pull ${adapter.modelId}`
            : `Check your API key in Settings.`)
        );
      }

      const response = await adapter.chat(messages, options);
      const timeMs = Date.now() - start;

      this.stats.record({
        modelId: adapter.modelId,
        success: true,
        timeMs,
        errorMessage: null,
        skillName: options.skillName || null,
        studentId: options.studentId || null,
      });

      return response;

    } catch (err) {
      this.stats.record({
        modelId: adapter.modelId,
        success: false,
        timeMs: Date.now() - start,
        errorMessage: err.message,
        skillName: options.skillName || null,
        studentId: options.studentId || null,
      });
      throw err;
    }
  }

  /**
   * Streaming chat — streams tokens to onChunk as they arrive from the adapter.
   * Falls back to non-streaming chat() if the adapter doesn't support chatStream.
   *
   * @param {Array<{role,content}>} messages
   * @param {object} options - { temperature, maxTokens, onChunk, onDone, onError, skillName, studentId }
   * @returns {Promise<string>} full response text
   */
  async chatStream(messages, options = {}) {
    const adapter = this._getAdapter();
    const start   = Date.now();

    const available = await adapter.isAvailable();
    if (!available) {
      throw new Error(
        `Model "${adapter.modelId}" is not available. ` +
        (adapter.getType() === 'ollama'
          ? `Make sure Ollama is running: ollama pull ${adapter.modelId}`
          : `Check your API key in Settings.`)
      );
    }

    // Fall back gracefully if adapter doesn't support streaming
    if (typeof adapter.chatStream !== 'function') {
      const response = await adapter.chat(messages, options);
      if (options.onChunk) options.onChunk(response);
      if (options.onDone)  options.onDone(response);
      this.stats.record({ modelId: adapter.modelId, success: true, timeMs: Date.now() - start,
        errorMessage: null, skillName: options.skillName || null, studentId: options.studentId || null });
      return response;
    }

    try {
      const response = await adapter.chatStream(messages, options);
      this.stats.record({ modelId: adapter.modelId, success: true, timeMs: Date.now() - start,
        errorMessage: null, skillName: options.skillName || null, studentId: options.studentId || null });
      return response;
    } catch (err) {
      this.stats.record({ modelId: adapter.modelId, success: false, timeMs: Date.now() - start,
        errorMessage: err.message, skillName: options.skillName || null, studentId: options.studentId || null });
      throw err;
    }
  }

  /**
   * Generates 3 suggested follow-up questions based on an assistant response.
   * Called after each completed stream to populate follow-up pills in the UI.
   *
   * @param {string} responseText   - The assistant's response to generate follow-ups for
   * @param {string} studentId      - Student identifier (for stats recording)
   * @param {string} activeSubject  - e.g. 'maths-advanced' (used to keep questions on-topic)
   * @returns {Promise<{ followUps: string[] }>}
   */
  async generateFollowUps(responseText, studentId, activeSubject) {
    // Sanitise the tutor response before embedding it in the prompt.
    // Maths notation (backslashes, newlines, quotes) causes the LLM to produce
    // invalid JSON. Strip the worst offenders and cap length.
    // NOTE: do NOT strip non-ASCII characters — Chinese/Japanese/Arabic text
    // must be preserved so the LLM can detect the language and reply in kind.
    const sanitised = responseText
      .replace(/\\/g, '/')
      .replace(/[\r\n]+/g, ' ')
      .replace(/"/g, "'")
      .trim()
      .slice(0, 400);

    // Detect whether the response contains non-ASCII characters (e.g. Chinese).
    // Pass this to the prompt so the LLM knows to match the language.
    const hasNonAscii = /[^\x00-\x7F]/.test(sanitised);
    const languageInstruction = hasNonAscii
      ? 'IMPORTANT: The tutor response is not in English. You MUST generate all 3 follow-up questions in the SAME language as the tutor response.'
      : 'Generate the follow-up questions in English.';

    const prompt = [
      {
        role: 'system',
        content:
          'You are a follow-up question generator for a high school tutoring app. ' +
          "Given a tutor's response, produce exactly 3 short, natural follow-up questions " +
          'a student might ask next. Each question must be concise (under 15 words). ' +
          languageInstruction + ' ' +
          'Respond ONLY with a valid JSON object in this exact format, no markdown, no explanation:\n' +
          '{"followUps":["question one","question two","question three"]}',
      },
      {
        role: 'user',
        content: `Subject: ${activeSubject || 'maths'}\n\nTutor response:\n${sanitised}\n\nGenerate 3 follow-up questions in the same language as the tutor response above.`,
      },
    ];

    try {
      const raw = await this.chat(prompt, {
        temperature: 0.7,
        maxTokens:   120,
        skillName:   'follow-ups',
        studentId:   studentId || null,
      });

      // Use regex to extract question strings directly from the raw response.
      // This avoids JSON.parse() failures caused by unescaped characters in
      // LLM output (apostrophes, maths notation, etc.)
      const cleaned    = raw.replace(/```json|```/gi, '').trim();
      const arrayBlock = cleaned.match(/"followUps"\s*:\s*\[([\s\S]*?)\]/);
      const followUps  = [];

      if (arrayBlock) {
        const itemRx = /"((?:[^\\"]|\\.)*)"/g;
        let hit;
        while ((hit = itemRx.exec(arrayBlock[1])) !== null) {
          const q = hit[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
          if (q.length > 0) followUps.push(q);
        }
      }

      if (followUps.length > 0) {
        return { followUps: followUps.slice(0, 3) };
      }

      // Last resort: attempt JSON.parse
      try {
        const jsonBlock = cleaned.match(/\{[\s\S]*\}/);
        if (jsonBlock) {
          const parsed = JSON.parse(jsonBlock[0]);
          if (Array.isArray(parsed.followUps) && parsed.followUps.length > 0) {
            return { followUps: parsed.followUps.slice(0, 3) };
          }
        }
      } catch { /* ignore */ }

      return { followUps: [] };
    } catch (err) {
      console.error('[ModelManager] generateFollowUps failed:', err.message);
      return { followUps: [] };
    }
  }


  // ============================================================
  // MODEL MANAGEMENT
  // ============================================================

  /**
   * Switches to a different model.
   * The change takes effect on the next chat() call.
   *
   * @param {string} modelId
   * @returns {{ success: boolean, requiresRestart: boolean }}
   */
  switchModel(modelId) {
    const model = registry.findModel(modelId);
    if (!model) {
      throw new Error(`ModelManager: unknown model ID "${modelId}"`);
    }
    this.config.setActiveModelId(modelId);
    this._adapter = null;  // force re-creation on next call
    return { success: true, requiresRestart: false };
  }

  /**
   * Returns all available models (local + cloud).
   */
  listModels() {
    return {
      local: registry.getLocalModels(),
      cloud: registry.getCloudModels(),
      activeModelId: this.config.getActiveModelId(),
    };
  }

  /**
   * Returns info about the currently active model.
   */
  getActiveModel() {
    const modelId = this.config.getActiveModelId();
    return registry.findModel(modelId);
  }

  // ============================================================
  // TESTING
  // ============================================================

  /**
   * Tests the currently active model.
   */
  async testActiveModel() {
    return this.tester.testActiveModel();
  }

  /**
   * Tests a specific model by ID.
   * @param {string} modelId
   * @param {string} [apiKeyOverride]
   */
  async testModel(modelId, apiKeyOverride = null) {
    return this.tester.testModel(modelId, apiKeyOverride);
  }

  // ============================================================
  // CONFIGURATION
  // ============================================================

  /**
   * Saves an API key for a cloud adapter.
   * @param {string} adapterType - "deepseek" | "openai" | "claude" | "qwen"
   * @param {string} apiKey
   */
  setApiKey(adapterType, apiKey) {
    this.config.setApiKey(adapterType, apiKey);
    this._adapter = null;  // force adapter re-creation to pick up new key
  }

  /**
   * Returns the full config (for the Settings panel).
   * API keys are masked for display purposes.
   */
  getConfigForDisplay() {
    const cfg = this.config.get();
    const maskedKeys = {};
    for (const [k, v] of Object.entries(cfg.apiKeys)) {
      maskedKeys[k] = v ? `${v.substring(0, 6)}...` : '';
    }
    return {
      ...cfg,
      apiKeys:          maskedKeys,
      activeSubject:    cfg.activeSubject    || 'maths-advanced',
      enrolledSubjects: cfg.enrolledSubjects || ['maths-advanced'],
    };
  }

  /**
   * Saves full config updates from the Settings panel.
   */
  saveConfig(updates) {
    this.config.save(updates);
    this._adapter = null;
  }

  // ── Subject methods ─────────────────────────────────────────

  getActiveSubject() {
    return this.config.getActiveSubject();
  }

  setActiveSubject(subjectId) {
    this.config.setActiveSubject(subjectId);
  }

  getEnrolledSubjects() {
    return this.config.getEnrolledSubjects();
  }

  setEnrolledSubjects(subjects) {
    this.config.setEnrolledSubjects(subjects);
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Returns usage statistics summary.
   */
  getStats() {
    return this.stats.getSummary();
  }

  /**
   * Clears usage statistics.
   */
  clearStats() {
    this.stats.clear();
  }
}

module.exports = ModelManager;