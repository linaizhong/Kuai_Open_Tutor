// teaching-models/base-model.js
// Base class for all teaching models.
// Defines the unified interface that every teaching mode must implement.

'use strict';

class BaseTeachingModel {
  /**
   * @param {object} config
   * @param {string} config.studentId
   * @param {object} config.memory - MemoryManager instance
   * @param {object} config.skillManager - SkillManager instance
   * @param {object} config.model - ModelManager instance
   * @param {object} config.knowledgeBase - Current subject's knowledge base
   * @param {object} config.studentModel - Pre-computed student model (optional)
   */
  constructor(config) {
    if (new.target === BaseTeachingModel) {
      throw new Error('BaseTeachingModel is abstract — instantiate a concrete model instead.');
    }

    this.studentId = config.studentId;
    this.memory = config.memory;
    this.skillManager = config.skillManager;
    this.model = config.model;
    this.knowledgeBase = config.knowledgeBase;
    this.studentModel = config.studentModel || null;

    this.modelName = 'base';  // Override in subclasses
    this.sessionState = null; // Subclasses manage their own session state
  }

  /**
   * Start a new session (called when app opens or user returns after closing)
   * @returns {Promise<object>} Initial response for the frontend
   */
  async startSession() {
    throw new Error(`${this.constructor.name}.startSession() not implemented`);
  }

  /**
   * Handle user input during an active session
   * @param {string} userInput - The user's message
   * @param {object} sessionState - Current session state (from coordinator)
   * @returns {Promise<object>} Response for the frontend
   */
  async handleUserInput(userInput, sessionState) {
    throw new Error(`${this.constructor.name}.handleUserInput() not implemented`);
  }

  /**
   * End the current session (called when user closes app or switches subject)
   * @returns {Promise<object>} Optional summary/farewell message
   */
  async endSession() {
    throw new Error(`${this.constructor.name}.endSession() not implemented`);
  }

  /**
   * Get current teaching state for frontend display
   * @returns {object} { model: string, phase: string, progress: number, ... }
   */
  getTeachingState() {
    return {
      model: this.modelName,
      ...(this.sessionState || {})
    };
  }

  /**
   * Get metadata for this teaching mode (used in Settings UI)
   * @returns {object} { id, name, description, icon, characteristics, configurable }
   */
  static getMetadata() {
    throw new Error(`${this.name}.getMetadata() not implemented`);
  }

  /**
   * Load fresh student model data from memory
   * @returns {Promise<object>}
   */
  async _loadStudentModel() {
    try {
      const rawData = this.memory.getContext(this.studentId);
      const sessionStats = this._getSessionStats();
      const StudentModelModule = require('../student-model');
      const smm = new StudentModelModule();
      this.studentModel = smm.build(rawData, sessionStats);
      return this.studentModel;
    } catch (err) {
      console.error(`[${this.constructor.name}] Failed to load student model:`, err.message);
      return this.studentModel || {};
    }
  }

  /**
   * Get session statistics for student model
   * @returns {object} { sessionAttempts, recentAccuracy }
   */
  _getSessionStats() {
    // To be overridden if needed
    return { sessionAttempts: 0, recentAccuracy: null };
  }
}

module.exports = BaseTeachingModel;