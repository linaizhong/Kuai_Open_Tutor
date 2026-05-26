// Model Manager — Registry
// Maintains the full list of supported models (local + cloud)
// and resolves which adapter class to use for each model.

const path = require('path');
const OllamaAdapter  = require('./adapters/ollama');
const DeepSeekAdapter = require('./adapters/deepseek');
const OpenAIAdapter  = require('./adapters/openai');
const ClaudeAdapter  = require('./adapters/claude');
const QwenAdapter    = require('./adapters/qwen');

// Maps adapter type string → adapter class
const ADAPTER_MAP = {
  ollama:   OllamaAdapter,
  deepseek: DeepSeekAdapter,
  openai:   OpenAIAdapter,
  claude:   ClaudeAdapter,
  qwen:     QwenAdapter,
};

class Registry {
  constructor() {
    this._local = require('./models/local.json').models;
    this._cloud = require('./models/cloud.json').models;
  }

  /**
   * Returns all local models.
   */
  getLocalModels() {
    return this._local;
  }

  /**
   * Returns all cloud models.
   */
  getCloudModels() {
    return this._cloud;
  }

  /**
   * Returns all models (local + cloud).
   */
  getAllModels() {
    return [
      ...this._local.map(m => ({ ...m, source: 'local' })),
      ...this._cloud.map(m => ({ ...m, source: 'cloud' })),
    ];
  }

  /**
   * Finds a model entry by ID.
   * @param {string} modelId
   * @returns {object|null}
   */
  findModel(modelId) {
    return this.getAllModels().find(m => m.id === modelId) || null;
  }

  /**
   * Instantiates the correct adapter for a given model ID and config.
   * @param {string} modelId
   * @param {object} config - { apiKey, host, port, ... }
   * @returns {BaseAdapter}
   */
  createAdapter(modelId, config = {}) {
    const model = this.findModel(modelId);
    if (!model) {
      throw new Error(`Registry: unknown model ID "${modelId}". Check local.json and cloud.json.`);
    }

    const AdapterClass = ADAPTER_MAP[model.adapter];
    if (!AdapterClass) {
      throw new Error(`Registry: no adapter found for type "${model.adapter}"`);
    }

    return new AdapterClass(modelId, config);
  }

  /**
   * Returns the recommended local model ID.
   */
  getRecommendedLocalModel() {
    return this._local.find(m => m.recommended)?.id || this._local[0]?.id || null;
  }

  /**
   * Returns the recommended cloud model ID.
   */
  getRecommendedCloudModel() {
    return this._cloud.find(m => m.recommended)?.id || null;
  }
}

module.exports = new Registry();