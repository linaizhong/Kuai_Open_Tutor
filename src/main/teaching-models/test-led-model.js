/**
 * Test-Led Teaching Model
 * Independent teaching mode where students learn through testing.
 *
 * Phases:
 *   not_started → testing → diagnosis → remediation → verification → complete
 *
 * Split into focused modules:
 *   test-led-utils.js            — constants, helpers, KB utilities
 *   test-led-initialiser.js      — _start* methods, interruption, resume
 *   test-led-answer-processor.js — answer checking, feedback, difficulty
 *   test-led-question-generator.js — topic rotation, question generation
 *   test-led-results-analyser.js — diagnosis, results, recommendations
 *   test-led-remediation.js      — remediation, verification, complete, advance
 *
 * @module teaching-models/test-led-model
 */

'use strict';

const BaseTeachingModel = require('./base-model');

const { ERROR_TYPES, MASTERY_THRESHOLD, CONCERN_THRESHOLD, CRITICAL_THRESHOLD, applyUtils }
  = require('./test-led-utils');
const { applyInitialiser }       = require('./test-led-initialiser');
const { applyAnswerProcessor }   = require('./test-led-answer-processor');
const { applyQuestionGenerator } = require('./test-led-question-generator');
const { applyResultsAnalyser }   = require('./test-led-results-analyser');
const { applyRemediation }       = require('./test-led-remediation');

// ─────────────────────────────────────────────────────────────────────────────

class TestLedModel extends BaseTeachingModel {
  constructor(config) {
    super(config);
    this.modelName = 'test-led';

    this.sessionState = {
      phase:    'not_started',
      subPhase: 'not_started',

      currentTest: {
        id: null, type: null, name: null,
        questions: [], currentQuestionIndex: 0, totalQuestions: 0,
        targetQuestionCount: 0,
        startTime: null, endTime: null, timeLimit: null,
        adaptive: true, currentDifficulty: 'medium',
        targetTopics: [], usedQuestionIds: []
      },

      answers: [],

      results: {
        score: 0, correct: 0, total: 0,
        byTopic: {}, byErrorType: {}, timeSpent: 0
      },

      diagnosis: {
        weakestTopics: [], weakestDotPoints: [], errorPatterns: [],
        conceptualGaps: [], recommendations: [],
        needsRemediation: false, criticalTopics: []
      },

      remediation: {
        active: false, currentTopic: null, currentDotPoint: null,
        lessonsCompleted: [], practiceQuestions: [],
        modeSwitchRequested: false, modeSwitchCompleted: false,
        returnAction: 'retest_topic', teachingBrief: null
      },

      verification: {
        active: false, questions: [], currentIndex: 0, answers: [], passed: false
      },

      testHistory: [],

      sessionStats: {
        testsCompleted: 0, questionsAnswered: 0, correctAnswers: 0,
        startTime: Date.now(), lastActive: Date.now()
      },

      isInterrupted: false, interruptedState: null,
      pendingModeSwitch: null, modeSwitchInProgress: false
    };
  }

  // ── Metadata ────────────────────────────────────────────────────────────
  static getMetadata() {
    return {
      id: 'test-led',
      name: 'Test-Led Mode',
      description: 'Learn by testing — identify gaps, get targeted teaching, and verify mastery.',
      icon: '📝',
      characteristics: [
        'Diagnostic tests reveal your weak areas',
        'Questions adapt to your performance',
        'Detailed error analysis for every mistake',
        'Automatic switching to Teacher-Led mode for remediation',
        'Verification tests confirm you\'ve mastered the material',
        'Complete loop until all weaknesses addressed'
      ],
      configurable: {
        defaultTestType:        { type: 'select',  options: ['diagnostic', 'topic', 'mixed'], default: 'diagnostic', label: 'Default test type' },
        adaptiveDifficulty:     { type: 'boolean', default: true,  label: 'Adapt difficulty based on performance' },
        timeLimitPerQuestion:   { type: 'number',  min: 30, max: 300, default: 120, label: 'Seconds per question' },
        showHints:              { type: 'boolean', default: true,  label: 'Show hints during tests' },
        masteryThreshold:       { type: 'number',  min: 60, max: 95, default: 80,  label: 'Mastery threshold (%)' },
        autoRemediation:        { type: 'boolean', default: true,  label: 'Automatically switch to Teacher-Led for weak topics' },
        verificationQuestions:  { type: 'number',  min: 2,  max: 10, default: 5,   label: 'Number of verification questions' }
      }
    };
  }

  // ── Session lifecycle ────────────────────────────────────────────────────
  async startSession() {
    await this._loadStudentModel();

    return {
      type: 'welcome',
      message: "📝 **Test-Led Mode activated.**\n\nI'll help you learn by testing your knowledge. We'll identify your weak areas, teach you what you need to know, and verify you've mastered it.\n\nWhat kind of test would you like to start?",
      model: this.modelName,
      phase: 'not_started',
      teachingModel: this.modelName,
      teachingPhase: 'not_started',
      teachingSubPhase: null,
      teachingProgress: 0,
      currentStep: 1,
      totalSteps: 4,
      stepName: 'Choose test type',
      proactive: true,
      canResume: false,
      suggestions: [
        { icon: '📊', label: 'Diagnostic test', text: '__START_DIAGNOSTIC__'     },
        { icon: '🎯', label: 'Topic test',       text: '__START_TOPIC_TEST__'    },
        { icon: '🔄', label: 'Mixed test',        text: '__START_MIXED_TEST__'   },
        { icon: '✅', label: 'Mastery check',     text: '__START_MASTERY_CHECK__' }
      ],
      timestamp: Date.now()
    };
  }

  async endSession() {
    return {
      type: 'goodbye',
      message: 'Test-Led session ended. Come back when you want to test your knowledge!',
      timestamp: Date.now()
    };
  }

  // ── Main input router ────────────────────────────────────────────────────
  async handleUserInput(userInput, sessionState) {
    if (sessionState) {
      this.sessionState = { ...this.sessionState, ...sessionState };
    }

    console.log(`[TestLed] Input: "${userInput.substring(0,40)}" | phase: ${this.sessionState.phase}/${this.sessionState.subPhase}`);

    // System commands
    if (userInput === '__START_DIAGNOSTIC__')    return this._startDiagnosticTest();
    if (userInput === '__START_TOPIC_TEST__')    return this._startTopicTest();
    if (userInput === '__START_MIXED_TEST__')    return this._startMixedTest();
    if (userInput === '__START_MASTERY_CHECK__') return this._startMasteryCheck();
    if (userInput === '__START_TEST__')          return this._startDefaultTest();
    if (userInput === '__AUTO_ADVANCE__')        return this._advancePhase();

    // Resume command
    const lower = userInput.toLowerCase().trim();
    const isResumeCommand = lower.includes('resume test') || lower.includes('↺ resume test') || lower === 'resume';
    if (isResumeCommand && this.sessionState.isInterrupted) return this._resumeTest();

    // Interruption check (not during testing)
    if (this.sessionState.phase !== 'testing' && this._isInterruption(userInput)) {
      console.log('[TestLed] Interruption detected');
      return this._handleInterruption(userInput);
    }

    // Phase routing
    switch (this.sessionState.phase) {
      case 'testing':      return this._handleTestingPhase(userInput);
      case 'diagnosis':    return this._handleDiagnosisPhase(userInput);
      case 'remediation':  return this._handleRemediationPhase(userInput);
      case 'verification': return this._handleVerificationPhase(userInput);
      case 'complete':     return this._handleCompletePhase(userInput);
      case 'not_started':
      default:             return this._handleNotStartedPhase(userInput);
    }
  }

  // ── Delegates that need super (cannot live in mixin functions) ──────────
  _loadStudentModel() {
    return super._loadStudentModel();
  }

  _getSessionStats() {
    return {
      sessionAttempts: this.sessionState.sessionStats.questionsAnswered,
      recentAccuracy:  this.sessionState.sessionStats.questionsAnswered > 0
        ? this.sessionState.sessionStats.correctAnswers /
          this.sessionState.sessionStats.questionsAnswered
        : null
    };
  }

  // ── Not started handler ──────────────────────────────────────────────────
  async _handleNotStartedPhase(userInput) {
    const lower = userInput.toLowerCase();
    if (lower.includes('diagnostic') || lower.includes('test me') || lower.includes('quiz me')) {
      return this._startDiagnosticTest();
    }
    return this.startSession();
  }

  // ── UI state query ───────────────────────────────────────────────────────
  getTeachingState() {
    return {
      model:            this.modelName,
      phase:            this.sessionState.phase,
      subPhase:         this.sessionState.subPhase,
      phaseProgress:    this._calculateProgress(),
      currentTopic:     this.sessionState.currentTest?.targetTopics?.[0] || null,
      currentStep:      this._getCurrentStep(),
      totalSteps:       this._getTotalSteps(),
      stepName:         this._getStepName(),
      canResume:        this.sessionState.isInterrupted,
      autoAdvance:      this.sessionState.phase === 'diagnosis' && this.sessionState.diagnosis?.needsRemediation,
      testType:         this.sessionState.currentTest?.type || null,
      questionIndex:    (this.sessionState.currentTest?.currentQuestionIndex || 0) + 1,
      totalQuestions:   this.sessionState.currentTest?.totalQuestions || 0,
      score:            this.sessionState.results?.score || null,
      weakestDotPoints: this.sessionState.diagnosis?.weakestDotPoints || []
    };
  }
}

// ── Apply all modules to prototype ──────────────────────────────────────────
const constants = { ERROR_TYPES, MASTERY_THRESHOLD, CONCERN_THRESHOLD, CRITICAL_THRESHOLD };

applyUtils(TestLedModel.prototype);
applyInitialiser(TestLedModel.prototype);
applyAnswerProcessor(TestLedModel.prototype);
applyQuestionGenerator(TestLedModel.prototype);
applyResultsAnalyser(TestLedModel.prototype, constants);
applyRemediation(TestLedModel.prototype);

module.exports = TestLedModel;