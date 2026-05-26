// Model Manager — Tester
// Tests model connectivity and API key validity.
// Used by the Settings panel "Test Connection" button.

class Tester {
  /**
   * @param {Registry} registry
   * @param {Config} config
   */
  constructor(registry, config) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Tests a specific model by ID.
   * Resolves the correct adapter and API key automatically.
   *
   * @param {string} modelId
   * @param {string} [apiKeyOverride] - optional: test with a key not yet saved
   * @returns {Promise<{ success: boolean, message: string, timeMs: number }>}
   */
  async testModel(modelId, apiKeyOverride = null) {
    const model = this.registry.findModel(modelId);
    if (!model) {
      return { success: false, message: `Unknown model: "${modelId}"`, timeMs: 0 };
    }

    let adapterConfig = {};

    if (model.adapter === 'ollama') {
      adapterConfig = this.config.getOllamaConfig();
    } else {
      const apiKey = apiKeyOverride || this.config.getApiKey(model.adapter);
      adapterConfig = { apiKey };
    }

    const adapter = this.registry.createAdapter(modelId, adapterConfig);
    return adapter.test();
  }

  /**
   * Tests the currently active model.
   * @returns {Promise<{ success: boolean, message: string, timeMs: number }>}
   */
  async testActiveModel() {
    const modelId = this.config.getActiveModelId();
    return this.testModel(modelId);
  }

  /**
   * Tests all local (Ollama) models and returns their availability.
   * @returns {Promise<Array<{ modelId: string, available: boolean }>>}
   */
  async testAllLocalModels() {
    const ollamaConfig = this.config.getOllamaConfig();
    const results = [];
    for (const model of this.registry.getLocalModels()) {
      const adapter = this.registry.createAdapter(model.id, ollamaConfig);
      const available = await adapter.isAvailable();
      results.push({ modelId: model.id, available });
    }
    return results;
  }
}

module.exports = Tester;