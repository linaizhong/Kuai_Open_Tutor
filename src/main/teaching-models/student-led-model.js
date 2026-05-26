/**
 * Student-Led Model
 * Your original design where students ask questions and AI responds.
 * This migrates the existing coordinator logic into the teaching model interface.
 *
 * FIXED: Added proper handling for tool-based skills
 * FIXED: Added debug logging for response content
 * FIXED: Added all required UI fields for consistent streaming
 */

'use strict';

const BaseTeachingModel = require('./base-model');

class StudentLedModel extends BaseTeachingModel {
  constructor(config) {
    super(config);
    this.modelName = 'student-led';
    this.sessionState = {
      messages: [],
      lastSkillUsed: null,
      sessionAttempts: 0,
      recentAccuracy: null
    };

    // Initialize SkillRouter for tool-based skills
    const SkillRouter = require('../agent/skill-router');
    this.skillRouter = new SkillRouter(this.model, this.memory, this.skillManager);
  }

  async startSession() {
    await this._loadStudentModel();

    const subjectMeta = this._getSubjectMeta();

    return {
      type: 'welcome',
      message: `Hi! I'm Tute, your ${subjectMeta.name} study companion. 🦉\n\nI'm here to help you understand concepts, work through problems and prepare for your exams. What would you like to work on today?`,
      suggestions: this._getSuggestions(),
      model: this.modelName,

      // Required UI fields
      phase: 'active',
      teachingModel: this.modelName,
      teachingPhase: 'active',
      teachingSubPhase: null,
      teachingProgress: 0,
      currentStep: 1,
      totalSteps: 1,
      stepName: 'Student-Led',
      proactive: false,
      canResume: false,

      timestamp: Date.now()
    };
  }

  async handleUserInput(userInput, sessionState) {
    console.log('[StudentLedModel] ===== HANDLING USER INPUT =====');
    console.log('[StudentLedModel] userInput:', userInput);

    // Merge incoming session state
    this.sessionState = { ...this.sessionState, ...sessionState };

    // 1. Get fresh student model
    await this._loadStudentModel();

    // 2. Build skill context (matches your coordinator.js)
    const skillContext = {
      studentId: this.studentId,
      memory: this.memory,
      studentModel: this.studentModel,
      model: this.model,
      knowledgeBase: this.knowledgeBase,
      kbManager: this.knowledgeBase?.kbManager || null,
      skillManager: this.skillManager
    };

    // 3. Build skill params — include conversation history so skills
    // that need context (e.g. quiz on a previously shown passage) can use it.
    const sessionHistory = this.sessionState.history || this.sessionState.messages || [];
    const skillParams = {
      userInput,
      activeSubject: this.knowledgeBase?.subjectId || 'maths-advanced',
      sessionAttempts: this.sessionState.sessionAttempts || 0,
      recentAccuracy: this.sessionState.recentAccuracy || null,
      // Last 10 turns (5 user+assistant pairs) for context-aware skills
      conversationHistory: sessionHistory.slice(-10),
    };

    // 4. Match and execute skill.
    console.log('[StudentLedModel] Calling skillManager.matchAndExecute...');
    const matchResult = await this.skillManager.matchAndExecute(
      userInput,
      skillParams,
      skillContext
    );

    const skillName = matchResult.skillName;
    this.sessionState.lastSkillUsed = skillName;

    // matchResult.result is the full skill result object
    const skillResult = (matchResult.result && typeof matchResult.result === 'object')
      ? matchResult.result
      : { result: matchResult.result || '' };

    console.log('[StudentLedModel] skillResult:', {
      skillName,
      hasResult: !!skillResult.result,
      resultType: typeof skillResult.result
    });

    // Extract the text response - always a plain string.
    let rawResponse = (typeof skillResult.result === 'string')
      ? skillResult.result
      : (skillResult.result ? String(skillResult.result) : '');

    // Strip accidental "result: ..." label if the LLM added one
    if (rawResponse.trimStart().toLowerCase().startsWith('result:')) {
      rawResponse = rawResponse.trimStart().replace(/^result:\s*/i, '').trimStart();
    }

    console.log('[StudentLedModel] rawResponse length:', rawResponse.length);
    console.log('[StudentLedModel] rawResponse preview:', rawResponse.substring(0, 100) + '...');

    // 6. Apply adaptive feedback (from your existing AFE)
    const AdaptiveFeedback = require('../adaptive-feedback');
    const { adjustedResponse, adjustmentsApplied } = AdaptiveFeedback.adjustResponse({
      rawResponse,
      studentModel: this.studentModel,
      skillName,
      skillResult
    });

    console.log('[StudentLedModel] adjustedResponse length:', adjustedResponse.length);
    console.log('[StudentLedModel] adjustedResponse preview:', adjustedResponse.substring(0, 100) + '...');

    // 7. Update session history
    this.sessionState.messages.push(
      { role: 'user', content: userInput, timestamp: Date.now() },
      { role: 'assistant', content: adjustedResponse, timestamp: Date.now() }
    );

    // Update session stats
    this.sessionState.sessionAttempts = (this.sessionState.sessionAttempts || 0) + 1;

    if (this.sessionState.messages.length > 40) {
      this.sessionState.messages = this.sessionState.messages.slice(-40);
    }

    // 8. Return response with ALL required fields for UI
    const returnValue = {
      // Core response fields
      message: adjustedResponse,
      response: adjustedResponse,
      skillUsed: skillName,
      syllabusPoint: skillResult.syllabusPoint || null,
      visualization: skillResult.visualization || null,
      marksAwarded: skillResult.marksAwarded ?? null,
      marksTotal: skillResult.marksTotal ?? null,
      adjustmentsApplied,

      // Model identification
      model: this.modelName,
      teachingModel: this.modelName,

      // UI state fields - CRITICAL for frontend
      phase: 'active',
      teachingPhase: 'active',
      teachingSubPhase: null,
      teachingProgress: 0,
      currentStep: 1,
      totalSteps: 1,
      stepName: 'Student-Led',
      proactive: false,
      canResume: false,

      timestamp: Date.now()
    };

    console.log('[StudentLedModel] Return value:', {
      messageLength: returnValue.message.length,
      messagePreview: returnValue.message.substring(0, 50) + '...',
      skillUsed: returnValue.skillUsed,
      teachingPhase: returnValue.teachingPhase
    });

    return returnValue;
  }

  async endSession() {
    return {
      type: 'goodbye',
      message: 'Session ended. See you next time! 👋',
      timestamp: Date.now()
    };
  }

  _getSubjectMeta() {
    const subjectId = this.knowledgeBase?.subjectId || 'maths-advanced';
    const subjectName = {
      'maths-advanced': 'HSC Mathematics Advanced',
      'maths-ext1': 'HSC Mathematics Extension 1',
      'english-advanced': 'HSC English Advanced'
    }[subjectId] || subjectId;

    return { id: subjectId, name: subjectName };
  }

  _getSuggestions() {
    // Return suggestions from knowledge base manifest if available
    const subject = this.knowledgeBase?.kbManager?.getSubject(this.knowledgeBase.subjectId);
    return subject?.suggestions || [
      { icon: '📐', label: 'Worked example', text: 'Show me a worked example of differentiation' },
      { icon: '🎯', label: 'Practice', text: 'Give me a practice question' },
      { icon: '❓', label: 'Explain', text: 'Explain the chain rule' }
    ];
  }

  _getSessionStats() {
    return {
      sessionAttempts: this.sessionState.sessionAttempts || 0,
      recentAccuracy: this.sessionState.recentAccuracy || null
    };
  }

  getTeachingState() {
    return {
      model: this.modelName,
      phase: 'active',
      subPhase: null,
      phaseProgress: 0,
      currentStep: 1,
      totalSteps: 1,
      stepName: 'Student-Led',
      currentTopic: null,
      canResume: false,
      autoAdvance: false
    };
  }

  static getMetadata() {
    return {
      id: 'student-led',
      name: 'Student-Led Mode',
      description: 'You ask questions, Tute answers. Perfect for revision and targeted help.',
      icon: '🎯',
      characteristics: [
        'Flexible Q&A — ask anything',
        'You control the learning direction',
        'Ideal for revision and homework help',
        'Responsive to your immediate needs'
      ],
      configurable: {
        showSuggestions: { type: 'boolean', default: true, label: 'Show suggestion pills' },
        suggestionCount: { type: 'number', min: 2, max: 6, default: 3, label: 'Number of suggestions' }
      }
    };
  }
}

module.exports = StudentLedModel;