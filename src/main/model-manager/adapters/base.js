// Model Manager — Base Adapter
// All model adapters extend this class.
// Defines the interface that every adapter must implement.

class BaseAdapter {
  constructor(modelId, config = {}) {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter is abstract — instantiate a concrete adapter instead.');
    }
    this.modelId = modelId;
    this.config = config;
  }

  /**
   * Test connectivity and API key validity.
   * @returns {Promise<{ success: boolean, message: string, timeMs: number }>}
   */
  async test() {
    throw new Error(`${this.constructor.name}.test() not implemented`);
  }

  /**
   * Send a chat message array and return the response text.
   * @param {Array<{ role: 'system'|'user'|'assistant', content: string }>} messages
   * @param {object} options - { temperature, maxTokens }
   * @returns {Promise<string>} response text
   */
  async chat(messages, options = {}) {
    throw new Error(`${this.constructor.name}.chat() not implemented`);
  }

  /**
   * Check whether this model/service is currently reachable.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error(`${this.constructor.name}.isAvailable() not implemented`);
  }

  /**
   * Returns the adapter type string for identification.
   * @returns {string}  e.g. "ollama" | "deepseek" | "openai" | "claude" | "qwen"
   */
  getType() {
    throw new Error(`${this.constructor.name}.getType() not implemented`);
  }
}

module.exports = BaseAdapter;