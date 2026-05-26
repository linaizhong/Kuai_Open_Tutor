/**
 * Teaching Model Factory
 * Creates appropriate teaching model instances
 *
 * UPDATED: Added TestLedModel to registry
 * PRESERVED: All existing models, functions, and logic intact
 */

'use strict';

const StudentLedModel = require('./student-led-model');
const TeacherLedModel = require('./teacher-led-model');
const HybridTeachingModel = require('./hybrid-model');
const TestLedModel = require('./test-led-model'); // NEW: Test-Led Mode

// Registry of all available teaching models
// PRESERVED: All existing models remain
const MODELS = {
  'student-led': StudentLedModel,
  'teacher-led': TeacherLedModel,
  'hybrid': HybridTeachingModel,
  'test-led': TestLedModel // NEW: Added test-led mode
};

class TeachingModelFactory {
  /**
   * Create a teaching model instance
   * @param {string} modelId - e.g. 'student-led', 'teacher-led', 'hybrid', or 'test-led'
   * @param {object} config - Configuration object passed to model constructor
   * @returns {BaseTeachingModel}
   */
  static createModel(modelId, config) {
    const ModelClass = MODELS[modelId];
    if (!ModelClass) {
      throw new Error(`Teaching model not found: ${modelId}`);
    }

    console.log(`[TeachingModelFactory] Creating model: ${modelId} for student: ${config.studentId}`);
    return new ModelClass(config);
  }

  /**
   * Get metadata for all available teaching models
   * @returns {Array<object>} Array of model metadata for Settings UI
   */
  static getAllModelMetadata() {
    return Object.keys(MODELS).map(id => MODELS[id].getMetadata());
  }

  /**
   * Get default teaching model ID
   * @returns {string}
   */
  static getDefaultModelId() {
    return 'hybrid'; // PRESERVED: Default unchanged
  }

  /**
   * Check if a model ID is valid
   * @param {string} modelId
   * @returns {boolean}
   */
  static isValidModel(modelId) {
    return !!MODELS[modelId];
  }

  /**
   * Get model by ID
   * @param {string} modelId
   * @returns {object|null} Model class or null
   */
  static getModel(modelId) {
    return MODELS[modelId] || null;
  }

  /**
   * Get model configuration schema
   * @param {string} modelId
   * @returns {object} Configuration schema
   */
  static getModelConfigSchema(modelId) {
    const ModelClass = MODELS[modelId];
    if (!ModelClass || !ModelClass.getConfigSchema) {
      return {};
    }
    return ModelClass.getConfigSchema();
  }

  /**
   * Validate model configuration
   * @param {string} modelId
   * @param {object} config
   * @returns {object} { valid: boolean, errors: string[] }
   */
  static validateConfig(modelId, config) {
    const ModelClass = MODELS[modelId];
    if (!ModelClass || !ModelClass.validateConfig) {
      return { valid: true, errors: [] };
    }
    return ModelClass.validateConfig(config);
  }

  /**
   * Get model description
   * @param {string} modelId
   * @returns {string} Description
   */
  static getModelDescription(modelId) {
    const metadata = this.getModelMetadata(modelId);
    return metadata?.description || '';
  }

  /**
   * Get model metadata by ID
   * @param {string} modelId
   * @returns {object|null}
   */
  static getModelMetadata(modelId) {
    const ModelClass = MODELS[modelId];
    if (!ModelClass) return null;
    return ModelClass.getMetadata();
  }

  /**
   * Get model characteristics for display
   * @param {string} modelId
   * @returns {Array<string>}
   */
  static getModelCharacteristics(modelId) {
    const metadata = this.getModelMetadata(modelId);
    return metadata?.characteristics || [];
  }

  /**
   * Get model icon
   * @param {string} modelId
   * @returns {string}
   */
  static getModelIcon(modelId) {
    const metadata = this.getModelMetadata(modelId);
    return metadata?.icon || '🤖';
  }

  /**
   * Get model display name
   * @param {string} modelId
   * @returns {string}
   */
  static getModelName(modelId) {
    const metadata = this.getModelMetadata(modelId);
    return metadata?.name || modelId;
  }

  /**
   * Get all model IDs
   * @returns {Array<string>}
   */
  static getAllModelIds() {
    return Object.keys(MODELS);
  }

  /**
   * Get models by characteristic
   * @param {string} characteristic - e.g. 'structured', 'adaptive', 'test-based'
   * @returns {Array<string>} Array of model IDs
   */
  static getModelsByCharacteristic(characteristic) {
    const matchingModels = [];

    for (const [id, ModelClass] of Object.entries(MODELS)) {
      const metadata = ModelClass.getMetadata();
      if (metadata.characteristics && metadata.characteristics.some(c =>
        c.toLowerCase().includes(characteristic.toLowerCase())
      )) {
        matchingModels.push(id);
      }
    }

    return matchingModels;
  }

  /**
   * Get model comparison data
   * @returns {Array<object>} Array of model comparison objects
   */
  static getModelComparison() {
    return this.getAllModelMetadata().map(meta => ({
      id: meta.id,
      name: meta.name,
      icon: meta.icon,
      description: meta.description,
      characteristics: meta.characteristics,
      configurable: Object.keys(meta.configurable || {})
    }));
  }

  /**
   * Check if model supports a specific feature
   * @param {string} modelId
   * @param {string} feature - e.g. 'auto-advance', 'interruption', 'remediation'
   * @returns {boolean}
   */
  static supportsFeature(modelId, feature) {
    const ModelClass = MODELS[modelId];
    if (!ModelClass || !ModelClass.getMetadata) return false;

    const metadata = ModelClass.getMetadata();

    // Feature mapping based on model characteristics
    const featureMap = {
      'auto-advance': ['Teacher-Led', 'Test-Led'],
      'interruption': ['Teacher-Led', 'Student-Led', 'Test-Led'],
      'remediation': ['Teacher-Led', 'Test-Led'],
      'testing': ['Test-Led'],
      'diagnosis': ['Test-Led'],
      'verification': ['Test-Led'],
      'structured-lessons': ['Teacher-Led'],
      'q-and-a': ['Student-Led'],
      'adaptive': ['Hybrid', 'Test-Led']
    };

    const featureModels = featureMap[feature] || [];
    return featureModels.some(name => metadata.name.includes(name));
  }
}

module.exports = TeachingModelFactory;