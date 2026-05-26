/**
 * Hybrid Teaching Model
 * Blends student-led and teacher-led approaches based on autonomy level
 *
 * @module teaching-models/hybrid-model
 */

'use strict';

const BaseTeachingModel = require('./base-model');
const AutonomySpectrum = require('./autonomy-spectrum');
const StudentLedModel = require('./student-led-model');
const TeacherLedModel = require('./teacher-led-model');

class HybridModelError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'HybridModelError';
    this.cause = cause;
  }
}

/**
 * Hybrid Teaching Model
 * Dynamically adjusts teaching style based on student needs
 */
class HybridTeachingModel extends BaseTeachingModel {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.studentId - Student ID
   * @param {Object} config.memory - MemoryManager instance
   * @param {Object} config.skillManager - SkillManager instance
   * @param {Object} config.model - ModelManager instance
   * @param {Object} config.knowledgeBase - Current subject's knowledge base
   * @param {Object} config.studentModel - Pre-computed student model
   * @param {Object} config.autonomyConfig - Autonomy spectrum configuration
   */
  constructor(config) {
    super(config);

    this.modelName = 'hybrid';
    this.autonomySpectrum = new AutonomySpectrum(config.autonomyConfig || {});

    // Initialize child models
    this.studentLedModel = new StudentLedModel(config);
    this.teacherLedModel = new TeacherLedModel(config);

    // Current autonomy state
    this.currentAutonomy = {
      score: 0.5,
      level: this.autonomySpectrum.getLevels().COLLABORATIVE,
      levelName: 'Collaborative',
      factors: {},
      lastUpdated: null
    };

    // Session history for learning
    this.sessionHistory = [];
    this.maxHistorySize = 100;

    // Mode transition tracking
    this.transitions = [];

    console.log(`[HybridModel] Initialized for student: ${this.studentId}`);
  }

  /**
   * Start a new session
   * @returns {Promise<Object>} Initial response
   */
  async startSession() {
    await this._loadStudentModel();

    // Determine initial autonomy
    await this._updateAutonomy();

    console.log('[HybridModel] Session started with autonomy:', {
      level: this.currentAutonomy.levelName,
      score: this.currentAutonomy.score
    });

    const phaseInfo = this._getPhaseInfo();

    return {
      type: 'welcome',
      message: this._getWelcomeMessage(),
      model: this.modelName,
      autonomyLevel: this.currentAutonomy.levelName,
      autonomyScore: this.currentAutonomy.score,
      phase: phaseInfo.phase,
      teachingPhase: phaseInfo.phase,
      teachingSubPhase: phaseInfo.subPhase,
      teachingProgress: phaseInfo.progress,
      currentStep: 1,
      totalSteps: 4,
      stepName: 'Getting started',
      proactive: true,
      canResume: false,
      suggestions: this._getInitialSuggestions(),
      timestamp: Date.now()
    };
  }

  /**
   * Handle user input
   * @param {string} userInput - User's message
   * @param {Object} sessionState - Current session state
   * @returns {Promise<Object>} Response
   */
  async handleUserInput(userInput, sessionState) {
    const startTime = Date.now();
    const interactionId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    console.log(`[HybridModel:${interactionId}] Handling input:`, {
      userInput: userInput.substring(0, 50),
      currentAutonomy: this.currentAutonomy.levelName
    });

    try {
      // Update autonomy based on current state
      await this._updateAutonomy();

      // Determine which model(s) to use
      const response = await this._routeByAutonomy(userInput, sessionState);

      // Add required fields for UI
      const phaseInfo = this._getPhaseInfo();
      const stepInfo = this._getStepInfo();

      const enrichedResponse = {
        ...response,
        teachingModel: this.modelName,
        teachingPhase: phaseInfo.phase,
        teachingSubPhase: phaseInfo.subPhase,
        teachingProgress: phaseInfo.progress,
        currentStep: stepInfo.currentStep,
        totalSteps: stepInfo.totalSteps,
        stepName: stepInfo.stepName,
        autonomyLevel: this.currentAutonomy.levelName,
        autonomyScore: this.currentAutonomy.score,
        canResume: response.canResume || false,
        proactive: response.proactive || false
      };

      // Record interaction for learning
      this._recordInteraction({
        id: interactionId,
        userInput,
        autonomyLevel: this.currentAutonomy.level,
        autonomyScore: this.currentAutonomy.score,
        responseType: response.type,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return enrichedResponse;

    } catch (err) {
      console.error(`[HybridModel:${interactionId}] Failed:`, err);

      // Fallback to student-led mode
      console.warn('[HybridModel] Falling back to student-led mode');
      const fallback = await this.studentLedModel.handleUserInput(userInput, sessionState);

      return {
        ...fallback,
        teachingModel: 'student-led',
        teachingPhase: 'active',
        teachingSubPhase: null,
        teachingProgress: 0,
        currentStep: 1,
        totalSteps: 1,
        stepName: 'Student-Led',
        canResume: false,
        proactive: false
      };
    }
  }

  /**
   * Route input based on current autonomy level
   * @private
   */
  async _routeByAutonomy(userInput, sessionState) {
    const level = this.currentAutonomy.level;

    // Pure student-led
    if (level === this.autonomySpectrum.getLevels().STUDENT_LED) {
      return this._handleStudentLedMode(userInput, sessionState);
    }

    // Pure teacher-led
    if (level === this.autonomySpectrum.getLevels().TEACHER_LED) {
      return this._handleTeacherLedMode(userInput, sessionState);
    }

    // Guided mode - system suggests, student chooses
    if (level === this.autonomySpectrum.getLevels().GUIDED) {
      return this._handleGuidedMode(userInput, sessionState);
    }

    // Collaborative mode - system and student co-plan
    if (level === this.autonomySpectrum.getLevels().COLLABORATIVE) {
      return this._handleCollaborativeMode(userInput, sessionState);
    }

    // Mentored mode - system guides, student executes
    if (level === this.autonomySpectrum.getLevels().MENTORED) {
      return this._handleMentoredMode(userInput, sessionState);
    }

    // Default to student-led
    return this.studentLedModel.handleUserInput(userInput, sessionState);
  }

  /**
   * Handle guided mode - system suggests, student chooses
   * @private
   */
  async _handleGuidedMode(userInput, sessionState) {
    // Check if this is a response to a suggestion
    if (this._isChoiceResponse(userInput)) {
      const choice = this._extractChoice(userInput);
      if (choice === 'teach') {
        return this.teacherLedModel.handleUserInput('__START_LESSON__', sessionState);
      } else if (choice === 'ask') {
        return this.studentLedModel.handleUserInput(
          this._extractQuestion(userInput),
          sessionState
        );
      } else if (choice === 'practice') {
        return this._generatePracticeSuggestion(userInput);
      }
    }

    // If "quiz me" / "test me" with a recent passage in history —
    // use fallback-llm so the LLM quizzes on THAT specific content
    // rather than a generic skill-generated question.
    if (this._isSkillRequest(userInput) && this._hasRecentPassage(sessionState)) {
      return this._handleFallbackLlm(userInput, sessionState);
    }

    // Recognisable direct English request — route through skill matcher
    if (this._isDirectRequest(userInput) || this._isSkillRequest(userInput)) {
      return this.studentLedModel.handleUserInput(userInput, sessionState);
    }

    // Unrecognised / non-ASCII input — fallback-llm with history
    return this._handleFallbackLlm(userInput, sessionState);
  }

  /**
   * Handle collaborative mode - system and student co-plan
   * @private
   */
  async _handleCollaborativeMode(userInput, sessionState) {
    // Check if we're in planning mode
    if (this._isPlanningMode(userInput)) {
      return this._handlePlanning(userInput);
    }

    // Try both models and blend responses
    const [teacherResponse, studentResponse] = await Promise.all([
      this.teacherLedModel.handleUserInput(userInput, sessionState).catch(() => null),
      this.studentLedModel.handleUserInput(userInput, sessionState).catch(() => null)
    ]);

    // Blend based on student's apparent preference
    const preference = this._detectPreference(userInput);

    if (preference === 'learning') {
      return {
        ...teacherResponse,
        message: teacherResponse.message + '\n\n' +
                 '(You can ask questions anytime. What would you like to explore next?)',
        phase: 'collaborative',
        teachingPhase: 'collaborative',
        teachingSubPhase: 'teaching',
        teachingProgress: 50,
        currentStep: 2,
        totalSteps: 4,
        stepName: 'Learning together',
        autonomyLevel: 'Collaborative',
        proactive: true,
        canResume: false
      };
    } else {
      return {
        ...studentResponse,
        message: studentResponse.message + '\n\n' +
                 'Would you like me to teach you more about this topic?',
        phase: 'collaborative',
        teachingPhase: 'collaborative',
        teachingSubPhase: 'discussing',
        teachingProgress: 50,
        currentStep: 2,
        totalSteps: 4,
        stepName: 'Discussion',
        autonomyLevel: 'Collaborative',
        proactive: false,
        canResume: true
      };
    }
  }

  /**
   * Handle mentored mode - system guides, student executes
   * @private
   */
  async _handleMentoredMode(userInput, sessionState) {
    // Use teacher-led as base, but add more explanation and support
    const response = await this.teacherLedModel.handleUserInput(userInput, sessionState);

    // Add mentoring elements
    return {
      ...response,
      message: response.message + '\n\n' +
               '💡 Remember: You can always ask for clarification or a different explanation.',
      phase: 'mentored',
      teachingPhase: 'mentored',
      teachingSubPhase: 'guiding',
      teachingProgress: 75,
      currentStep: 3,
      totalSteps: 4,
      stepName: 'Guided practice',
      autonomyLevel: 'Mentored',
      proactive: true,
      canResume: true,
      hints: await this._generateHints(userInput)
    };
  }

  /**
   * Handle pure student-led mode
   * @private
   */
  async _handleStudentLedMode(userInput, sessionState) {
    const response = await this.studentLedModel.handleUserInput(userInput, sessionState);
    return {
      ...response,
      teachingPhase: 'active',
      teachingSubPhase: null,
      teachingProgress: 0,
      currentStep: 1,
      totalSteps: 1,
      stepName: 'Student-Led',
      autonomyLevel: 'Student-Led',
      proactive: false,
      canResume: false
    };
  }

  /**
   * Handle pure teacher-led mode
   * @private
   */
  async _handleTeacherLedMode(userInput, sessionState) {
    const response = await this.teacherLedModel.handleUserInput(userInput, sessionState);
    const stepInfo = this.teacherLedModel._getStepInfo?.() || {};

    return {
      ...response,
      teachingPhase: response.phase || 'teaching',
      teachingSubPhase: response.subPhase || null,
      teachingProgress: response.progress || 50,
      currentStep: stepInfo.currentStep || 3,
      totalSteps: stepInfo.totalSteps || 5,
      stepName: stepInfo.stepName || 'Teacher-Led',
      autonomyLevel: 'Teacher-Led',
      proactive: true,
      canResume: response.canResume || false
    };
  }

  /**
   * Update autonomy based on current state
   * @private
   */
  async _updateAutonomy() {
    const sessionContext = {
      studentId: this.studentId,
      sessionDuration: this._getSessionDuration(),
      recentInteractions: this.sessionHistory.slice(-10)
    };

    const decision = await this.autonomySpectrum.determineAutonomy(
      this.studentModel,
      sessionContext
    );

    this.currentAutonomy = {
      score: decision.score,
      level: decision.level,
      levelName: decision.levelName,
      factors: decision.factors,
      lastUpdated: decision.timestamp
    };
  }

  /**
   * Generate practice suggestions
   * @private
   */
  async _generatePracticeSuggestion(userInput) {
    const weakTopics = this.studentModel.weakestTopics || [];
    const topic = weakTopics[0]?.code || 'general';

    const checkSkill = this.skillManager.getSkill('check-understanding');
    if (checkSkill) {
      const result = await checkSkill.module.execute({
        topic,
        action: 'generate',
        difficulty: 'medium'
      }, {
        studentId: this.studentId,
        memory: this.memory,
        studentModel: this.studentModel,
        model: this.model,
        knowledgeBase: this.knowledgeBase
      });

      return {
        type: 'practice',
        message: result.result,
        topic,
        phase: 'practice',
        teachingPhase: 'practice',
        teachingSubPhase: 'exercising',
        teachingProgress: 60,
        currentStep: 3,
        totalSteps: 4,
        stepName: 'Practice',
        proactive: true,
        canResume: true
      };
    }

    return {
      type: 'practice',
      message: "Let's practice. Try this problem: ...",
      phase: 'practice',
      teachingPhase: 'practice',
      teachingSubPhase: 'exercising',
      teachingProgress: 60,
      currentStep: 3,
      totalSteps: 4,
      stepName: 'Practice',
      proactive: true,
      canResume: true
    };
  }

  /**
   * Generate hints for current topic
   * @private
   */
  async _generateHints(userInput) {
    // Simple hint generation - could be enhanced
    return [
      "Break the problem into smaller steps",
      "Check your understanding of the core concept",
      "Try working backwards from the answer"
    ];
  }

  /**
   * Handle planning mode
   * @private
   */
  async _handlePlanning(input) {
    const weakTopics = this.studentModel.weakestTopics || [];
    const atRisk = this.studentModel.atRiskTopics || [];

    const priorities = atRisk.length > 0 ? atRisk :
                      weakTopics.map(t => t.code).slice(0, 3);

    return {
      type: 'plan',
      message: "Here's what I suggest we focus on:",
      suggestions: priorities.map((topic, i) => ({
        icon: i === 0 ? '🔥' : '📚',
        label: `Study ${topic}`,
        text: `teach me ${topic}`
      })),
      phase: 'planning',
      teachingPhase: 'planning',
      teachingSubPhase: 'suggesting',
      teachingProgress: 30,
      currentStep: 2,
      totalSteps: 4,
      stepName: 'Planning',
      proactive: true,
      canResume: false
    };
  }

  /**
   * Detect short skill-matchable commands (quiz me, test me, practice, etc.)
   * @private
   */
  _isSkillRequest(input) {
    const lower = input.toLowerCase().trim();
    const skillKeywords = [
      'quiz me', 'test me', 'quiz', 'test my knowledge',
      'practice', 'practice question', 'practice problem',
      'give me a question', 'give me some problems',
      'harder question', 'easier question', 'similar question',
      'generate a question', 'practice problems',
    ];
    return skillKeywords.some(kw => lower.includes(kw));
  }

  /**
   * Returns true if the recent conversation history contains a passage,
   * explanation, or substantial content that a quiz should be based on.
   * Looks for messages longer than 200 chars in the last 3 assistant turns.
   * @private
   */
  _hasRecentPassage(sessionState) {
    const history = sessionState.history || [];
    // Check last 6 entries (3 turns) for a substantial assistant message
    const recent = history.slice(-6);
    return recent.some(msg =>
      msg.role === 'assistant' &&
      typeof msg.content === 'string' &&
      msg.content.length > 200
    );
  }

  /**
   * Handle unrecognised or context-dependent input via the fallback-llm skill.
   * Passes the full conversation history so the LLM has context about
   * previous turns (e.g. a reading passage the student just received).
   * @private
   */
  async _handleFallbackLlm(userInput, sessionState) {
    const fallbackSkill = this.skillManager
      ? this.skillManager.getSkill('fallback-llm')
      : null;

    if (fallbackSkill) {
      try {
        const history = sessionState.history || [];
        const recentHistory = history.slice(-10);

        const result = await fallbackSkill.module.execute(
          { userInput, conversationHistory: recentHistory },
          {
            studentId:     this.studentId,
            memory:        this.memory,
            studentModel:  this.studentModel,
            model:         this.model,
            knowledgeBase: this.knowledgeBase,
          }
        );

        // Strip any prefix the skill runner may leak
        const rawMessage = result.result || '';
        const message = rawMessage
          .replace(/^LLM response to the query[:\s]*/i, '')
          .replace(/^LL response to the query[:\s]*/i, '')
          .trim();

        return {
          type:             'response',
          message,
          skillUsed:        'fallback-llm',
          phase:            'active',
          teachingPhase:    'active',
          teachingSubPhase: null,
          teachingProgress: 0,
          currentStep:      1,
          totalSteps:       1,
          stepName:         'Answering',
          autonomyLevel:    this.currentAutonomy.levelName,
          autoAdvance:      false,
          proactive:        false,
          canResume:        false,
        };
      } catch (err) {
        console.warn('[HybridModel] fallback-llm skill failed, routing to studentLedModel:', err.message);
      }
    }

    // Final safety fallback
    return this.studentLedModel.handleUserInput(userInput, sessionState);
  }

  /**
   * Check if input is a choice response
   * @private
   */
  _isChoiceResponse(input) {
    const lower = input.toLowerCase();
    const choiceIndicators = [
      'teach me', 'i have a question', 'practice', 'explore',
      'option 1', 'option 2', 'option 3'
    ];
    return choiceIndicators.some(indicator => lower.includes(indicator));
  }

  /**
   * Detect if the user made a direct, specific request that should be
   * answered immediately rather than presenting a menu of options.
   * Catches: questions, worked example requests, explain/show/help phrases.
   * @private
   */
  _isDirectRequest(input) {
    const lower = input.toLowerCase();
    return (
      lower.includes('?') ||
      lower.includes('show me') ||
      lower.includes('worked example') ||
      lower.includes('example of') ||
      lower.includes('explain') ||
      lower.includes('how do') ||
      lower.includes('how does') ||
      lower.includes('what is') ||
      lower.includes('what are') ||
      lower.includes('help me') ||
      lower.includes('can you') ||
      lower.includes('differentiat') ||
      lower.includes('integrat') ||
      lower.includes('solve') ||
      lower.includes('calculate') ||
      lower.includes('find ')
    );
  }

  /**
   * Extract choice from response
   * @private
   */
  _extractChoice(input) {
    const lower = input.toLowerCase();
    if (lower.includes('teach me') || lower.includes('teach')) return 'teach';
    if (lower.includes('question') || lower.includes('ask')) return 'ask';
    if (lower.includes('practice')) return 'practice';
    if (lower.includes('explore')) return 'explore';
    return 'unknown';
  }

  /**
   * Extract question from input
   * @private
   */
  _extractQuestion(input) {
    // Remove choice prefixes
    return input.replace(/^(i have a question|question|ask|tell me)/i, '').trim();
  }

  /**
   * Check if in planning mode
   * @private
   */
  _isPlanningMode(input) {
    const lower = input.toLowerCase();
    return lower.includes('plan') || lower.includes('what should') || lower.includes('suggest');
  }

  /**
   * Detect student preference from input
   * @private
   */
  _detectPreference(input) {
    const lower = input.toLowerCase();

    // Learning indicators
    if (lower.includes('teach') || lower.includes('explain') || lower.includes('what is')) {
      return 'learning';
    }

    // Question indicators
    if (lower.includes('?')) {
      return 'question';
    }

    // Default based on autonomy
    return this.currentAutonomy.score > 0.5 ? 'learning' : 'question';
  }

  /**
   * Get session duration
   * @private
   */
  _getSessionDuration() {
    return this.sessionHistory.length > 0
      ? Date.now() - new Date(this.sessionHistory[0].timestamp).getTime()
      : 0;
  }

  /**
   * Record interaction for learning
   * @private
   */
  _recordInteraction(interaction) {
    this.sessionHistory.push(interaction);

    if (this.sessionHistory.length > this.maxHistorySize) {
      this.sessionHistory = this.sessionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get welcome message based on autonomy
   * @private
   */
  _getWelcomeMessage() {
    const messages = {
      'Student-Led': "I'm here to answer your questions. You're in control of what we learn today.",
      'Guided': "I'll suggest what to learn, but you decide what we focus on.",
      'Collaborative': "Let's learn together. I'll teach, but you guide the direction.",
      'Mentored': "I'll guide you through structured learning, with support when you need it.",
      'Teacher-Led': "I'll lead today's lesson, but you can ask questions anytime."
    };

    return messages[this.currentAutonomy.levelName] ||
           "Let's find the best way to learn together.";
  }

  /**
   * Get initial suggestions based on autonomy
   * @private
   */
  _getInitialSuggestions() {
    if (this.currentAutonomy.levelName === 'Student-Led') {
      return [
        { icon: '❓', label: 'Ask a question', text: 'I have a question about...' },
        { icon: '📝', label: 'Practice', text: 'give me a practice question' }
      ];
    }

    if (this.currentAutonomy.levelName === 'Teacher-Led') {
      return [
        { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' }
      ];
    }

    return [
      { icon: '👩‍🏫', label: 'Teach me', text: 'teach me' },
      { icon: '❓', label: 'I have a question', text: 'I have a question' },
      { icon: '📝', label: 'Practice', text: 'practice' }
    ];
  }

  /**
   * Get step info for UI display
   * @private
   */
  _getStepInfo() {
    // If in teacher-led mode, get from teacher model
    if (this.currentAutonomy.levelName === 'Teacher-Led' && this.teacherLedModel) {
      return this.teacherLedModel._getStepInfo?.() || {};
    }

    // Map autonomy levels to step info
    const stepMap = {
      'Student-Led': { currentStep: 1, totalSteps: 1, stepName: 'Student-Led' },
      'Guided': { currentStep: 1, totalSteps: 4, stepName: 'Choosing direction' },
      'Collaborative': { currentStep: 2, totalSteps: 4, stepName: 'Learning together' },
      'Mentored': { currentStep: 3, totalSteps: 4, stepName: 'Guided practice' },
      'Teacher-Led': { currentStep: 4, totalSteps: 5, stepName: 'Teacher-Led' }
    };

    return stepMap[this.currentAutonomy.levelName] || {
      currentStep: 1,
      totalSteps: 4,
      stepName: this.currentAutonomy.levelName || 'Learning'
    };
  }

  /**
   * Get phase info for UI display
   * @private
   */
  _getPhaseInfo() {
    const level = this.currentAutonomy.levelName;

    const phaseMap = {
      'Student-Led': { phase: 'active', subPhase: null, progress: 0 },
      'Guided': { phase: 'guided', subPhase: 'suggesting', progress: 25 },
      'Collaborative': { phase: 'collaborative', subPhase: 'planning', progress: 50 },
      'Mentored': { phase: 'mentored', subPhase: 'guiding', progress: 75 },
      'Teacher-Led': { phase: 'teaching', subPhase: 'instructing', progress: 100 }
    };

    return phaseMap[level] || {
      phase: 'active',
      subPhase: null,
      progress: 0
    };
  }

  /**
   * End session
   * @returns {Promise<Object>} Farewell message
   */
  async endSession() {
    // Analyze session for meta-learning
    const sessionSummary = {
      duration: this._getSessionDuration(),
      interactions: this.sessionHistory.length,
      autonomyChanges: this.transitions,
      timestamp: new Date().toISOString()
    };

    console.log('[HybridModel] Session ended:', sessionSummary);

    return {
      type: 'goodbye',
      message: 'Great work today! Remember, you can always return to learn more.',
      summary: sessionSummary,
      timestamp: Date.now()
    };
  }

  /**
   * Get current teaching state
   * @returns {Object} Teaching state
   */
  getTeachingState() {
    const phaseInfo = this._getPhaseInfo();
    const stepInfo = this._getStepInfo();

    return {
      model: this.modelName,
      autonomyLevel: this.currentAutonomy.levelName,
      autonomyScore: this.currentAutonomy.score,
      phase: phaseInfo.phase,
      subPhase: phaseInfo.subPhase,
      phaseProgress: phaseInfo.progress,
      currentStep: stepInfo.currentStep,
      totalSteps: stepInfo.totalSteps,
      stepName: stepInfo.stepName,
      canResume: this.sessionState?.canResume || false,
      autoAdvance: this.currentAutonomy.levelName === 'Teacher-Led'
    };
  }

  /**
   * Get session stats for student model
   * @private
   */
  _getSessionStats() {
    return {
      sessionAttempts: this.sessionHistory.length,
      recentAccuracy: this._calculateRecentAccuracy()
    };
  }

  /**
   * Calculate recent accuracy
   * @private
   */
  _calculateRecentAccuracy() {
    const recent = this.sessionHistory.slice(-10);
    if (recent.length === 0) return null;

    // This would need actual correctness data
    return 0.5; // Placeholder
  }

  /**
   * Metadata for Settings UI
   */
  static getMetadata() {
    return {
      id: 'hybrid',
      name: 'Hybrid Mode',
      description: 'Intelligently adapts between student-led and teacher-led based on your needs.',
      icon: '🔄',
      characteristics: [
        'Adapts to your learning state in real-time',
        'Balances guidance and independence',
        'Feels like a tutor who "gets" you',
        'Gradually builds your autonomy'
      ],
      configurable: {
        initialAutonomy: {
          type: 'select',
          options: ['Student-Led', 'Guided', 'Collaborative', 'Mentored', 'Teacher-Led'],
          default: 'Collaborative',
          label: 'Initial teaching style'
        },
        adaptationSpeed: {
          type: 'select',
          options: ['Slow', 'Medium', 'Fast'],
          default: 'Medium',
          label: 'How quickly to adapt'
        }
      }
    };
  }
}

module.exports = HybridTeachingModel;