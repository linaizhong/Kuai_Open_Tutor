// Model Manager — Config
// Reads and writes the active model selection and API keys
// from data/config/user-config.json

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  activeModelId: 'qwen2.5-coder:3b',
  theme: 'cute',
  apiKeys: {
    deepseek: '',
    openai: '',
    claude: '',
    qwen: '',
  },
  ollamaHost: 'localhost',
  ollamaPort: 11434,
  // ── Subject support ──────────────────────────────────────────
  activeSubject:    'maths-advanced',
  enrolledSubjects: ['maths-advanced'],
};

class Config {
  /**
   * @param {string} configPath - Absolute path to user-config.json
   */
  constructor(configPath) {
    if (!configPath) throw new Error('Config: configPath is required');
    this.configPath = configPath;
    this._ensureExists();
  }

  _ensureExists() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
    }
  }

  /**
   * Reads and returns the full config object.
   */
  get() {
    const raw = fs.readFileSync(this.configPath, 'utf8');
    const parsed = JSON.parse(raw);
    // Merge with defaults so new fields are always present
    return { ...DEFAULT_CONFIG, ...parsed, apiKeys: { ...DEFAULT_CONFIG.apiKeys, ...(parsed.apiKeys || {}) } };
  }

  /**
   * Writes a full or partial config update.
   * Deep-merges apiKeys.
   */
  save(updates) {
    const current = this.get();
    const updated = {
      ...current,
      ...updates,
      apiKeys: { ...current.apiKeys, ...(updates.apiKeys || {}) },
    };
    fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }

  /**
   * Returns the currently active model ID.
   */
  getActiveModelId() {
    return this.get().activeModelId;
  }

  /**
   * Sets the active model ID.
   */
  setActiveModelId(modelId) {
    this.save({ activeModelId: modelId });
  }

  /**
   * Returns the API key for a given adapter type.
   * @param {string} adapterType - "deepseek" | "openai" | "claude" | "qwen"
   */
  getApiKey(adapterType) {
    return this.get().apiKeys[adapterType] || '';
  }

  /**
   * Sets the API key for a given adapter type.
   */
  setApiKey(adapterType, apiKey) {
    this.save({ apiKeys: { [adapterType]: apiKey } });
  }

  /**
   * Returns Ollama connection settings.
   */
  getOllamaConfig() {
    const cfg = this.get();
    return { host: cfg.ollamaHost, port: cfg.ollamaPort };
  }

  // ── Subject helpers ─────────────────────────────────────────

  getActiveSubject() {
    return this.get().activeSubject || 'maths-advanced';
  }

  setActiveSubject(subjectId) {
    this.save({ activeSubject: subjectId });
  }

  getEnrolledSubjects() {
    return this.get().enrolledSubjects || ['maths-advanced'];
  }

  setEnrolledSubjects(subjects) {
    const list = Array.from(new Set(['maths-advanced', ...subjects]));
    this.save({ enrolledSubjects: list });
  }
}

module.exports = Config;