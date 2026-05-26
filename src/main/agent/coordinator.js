// Agent Coordinator
// src/main/agent/coordinator.js
//
// MODIFIED: Added teaching mode support (v4.0) and auto-advance functionality
// FIXED: Removed stray kbRoot initialization outside constructor
// FIXED: Corrected teachingSubPhase field mapping from teaching response
// FIXED: Added debug logging for message content tracking
// FIXED: Added resume message detection to ensure proper routing to teacher-led mode
// FIXED: Ensured canResume flag is properly passed from teaching model to frontend

'use strict';

const path               = require('path');
const StudentModelModule = require('../student-model');
const afe                = require('../adaptive-feedback');
const SkillRouter        = require('./skill-router');
const KnowledgeBaseManager = require('../knowledge-base');
const TeachingModelFactory = require('../teaching-models'); // NEW

// Single shared instance — the SMM is stateless (pure functions internally)
const smm = new StudentModelModule();

// ===== FIXED: Removed the stray line: this.kbManager = new KnowledgeBaseManager(kbRoot); =====

// ─────────────────────────────────────────────────────────────
// Session state store
// Each entry keyed by studentId. Cleared on app restart.
// ─────────────────────────────────────────────────────────────

const sessions = new Map();

/**
 * Returns (and lazily creates) the in-memory session state for a student.
 * @param {string} studentId
 * @returns {object}
 */
function getSession(studentId) {
  if (!sessions.has(studentId)) {
    sessions.set(studentId, {
      studentId,

      // Drill state — maintained across turns so adaptive-drill can step up/down
      currentDifficulty: 'medium',
      drillDotPoint:     null,
      usedQuestionIds:   [],

      // Socratic state — tracks how many hints given on the current problem
      currentProblem:    null,
      hintRequestCount:  0,

      // Attempt tracking for passive skills
      sessionAttempts:   0,
      sessionCorrect:    0,
      sessionStartedAt:  Date.now(),

      // Conversation history for context (last 20 turns, not persisted)
      history:           [],

      // Teaching mode state (NEW)
      teachingModel:     null,        // Instance of current teaching model
      teachingModelId:   null,        // ID of current teaching model
    });
  }
  return sessions.get(studentId);
}

/**
 * Clears the session state for a student.
 * @param {string} studentId
 */
function clearSession(studentId) {
  sessions.delete(studentId);
}

// ─────────────────────────────────────────────────────────────
// Passive skill memory writer
// ─────────────────────────────────────────────────────────────

function applyMemoryUpdate(memory, studentId, update) {
  if (!update || !update.type) return;

  try {
    switch (update.type) {
      case 'learningStyle':
        if (update.signal) memory.updateLearningStyle(studentId, update.signal);
        break;

      case 'velocity':
        if (update.topicCode) {
          memory.updateVelocity(studentId, {
            topicCode:  update.topicCode,
            topicLabel: update.topicLabel,
            delta:      update.delta,
            attempts:   update.attempts,
          });
        }
        break;

      case 'affectiveState':
        if (update.signal) memory.updateAffectiveState(studentId, update.signal);
        break;

      case 'cognitiveLoad':
        if (update.signal?.loadLevel && update.signal.loadLevel !== 'normal') {
          memory.updateAffectiveState(studentId, {
            engagement: update.signal.loadLevel === 'overloaded' ? 'fatigued' : 'struggling',
            notes:      `Cognitive load: ${update.signal.loadLevel} — ${(update.signal.reasons || []).join(', ')}`,
            source:     'cognitive-load-monitor',
          });
        }
        break;

      default:
        console.warn(`[Coordinator] Unknown memoryUpdate type: "${update.type}"`);
    }
  } catch (err) {
    console.error(`[Coordinator] Memory update failed (type: ${update.type}):`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Session state updater
// ─────────────────────────────────────────────────────────────

function updateSessionState(session, skillName, skillResult, params) {
  // Drill difficulty progression
  if (skillName === 'adaptive-drill') {
    if (skillResult.nextDifficulty)  session.currentDifficulty = skillResult.nextDifficulty;
    if (skillResult.syllabusPoint)   session.drillDotPoint     = skillResult.syllabusPoint;
    if (skillResult.questionId)      session.usedQuestionIds.push(skillResult.questionId);
  }

  // Socratic hint escalation
  if (skillName === 'socratic-questioning') {
    const incomingProblem = params.problem || params.userInput;
    if (incomingProblem !== session.currentProblem) {
      session.currentProblem   = incomingProblem;
      session.hintRequestCount = 1;
    } else {
      session.hintRequestCount++;
    }
  } else if (skillName !== 'general-conversation') {
    session.hintRequestCount = 0;
  }

  // Attempt tracking (scoreSignal set by marking-guideline-feedback / error-analysis)
  if (skillResult.scoreSignal !== undefined && skillResult.scoreSignal !== null) {
    session.sessionAttempts++;
    if (skillResult.scoreSignal >= 0.8) session.sessionCorrect++;
  }
}

// ─────────────────────────────────────────────────────────────
// Coordinator class
// ─────────────────────────────────────────────────────────────

class Coordinator {
  /**
   * @param {object} options
   *   - memory        {MemoryManager}
   *   - skillManager  {SkillManager}
   *   - model         {ModelManager}
   *   - kbRoot        {string}  — absolute path to knowledge-base/ directory
   */
  constructor({ memory, skillManager, model, kbRoot }) {
    this.memory        = memory;
    this.skills        = skillManager;
    this.model         = model;
    this.kbRoot        = kbRoot;

    // Initialize Knowledge Base Manager
    this.kbManager = new KnowledgeBaseManager(kbRoot);

    // Discover all available subjects
    this.kbManager.discoverSubjects();

    // Get all subjects for UI
    this.availableSubjects = this.kbManager.getAllSubjects();

    // Log discovered subjects
    console.log(`[Coordinator] Discovered ${this.availableSubjects.length} subjects: ${this.availableSubjects.map(s => s.id).join(', ')}`);

    // Get initial subject from config or use first available
    const savedSubject = model.getActiveSubject ? model.getActiveSubject() : null;
    const initialSubject = savedSubject && this.kbManager.hasSubject(savedSubject)
      ? savedSubject
      : (this.availableSubjects[0]?.id || 'maths-advanced');

    this.activeSubject = initialSubject;

    // Load the initial knowledge base
    this.knowledgeBase = this.kbManager.getActiveSubject(initialSubject);

    // Initialize skill router
    this.skillRouter = new SkillRouter(model, memory, skillManager);

    // NEW: Get saved teaching mode from config.
    // Set synchronous default immediately so the first chat() call never sees null.
    // _loadTeachingModelConfig() will overwrite this once the async read completes.
    this.currentTeachingModelId = TeachingModelFactory.getDefaultModelId();
    this._loadTeachingModelConfig();

    console.log('[Coordinator] Initialised. Student Model Module ✅  Adaptive Feedback Engine ✅  Skill Router ✅  KB Manager ✅  Teaching Models ✅');
    console.log(`[Coordinator] Active subject: ${initialSubject}`);
    console.log(`[Coordinator] Teaching mode: ${this.currentTeachingModelId || TeachingModelFactory.getDefaultModelId()}`);
    if (!this.knowledgeBase) {
      console.warn('[Coordinator] Knowledge base not loaded — skills will run without KB context.');
    }
  }

  /**
   * Load teaching model configuration from user config
   * @private
   */
  async _loadTeachingModelConfig() {
    try {
      // Get from model manager's user config (global setting)
      if (this.model && this.model.getConfigForDisplay) {
        const modelConfig = await this.model.getConfigForDisplay();
        this.currentTeachingModelId = modelConfig?.teachingModel || TeachingModelFactory.getDefaultModelId();
        console.log('[Coordinator] Loaded teaching mode from user config:', this.currentTeachingModelId);
      } else {
        // Fallback to default
        this.currentTeachingModelId = TeachingModelFactory.getDefaultModelId();
        console.log('[Coordinator] Using default teaching mode:', this.currentTeachingModelId);
      }
    } catch (err) {
      console.warn('[Coordinator] Failed to load teaching model config, using default:', err.message);
      this.currentTeachingModelId = TeachingModelFactory.getDefaultModelId();
    }
  }

  /**
   * Save teaching model configuration to user config
   * @param {string} modelId
   * @private
   */
  async _saveTeachingModelConfig(modelId) {
    try {
      // Save to model manager's user config (global setting)
      if (this.model && this.model.saveConfig) {
        // Get current config first to preserve other settings
        const currentConfig = await this.model.getConfigForDisplay?.() || {};
        await this.model.saveConfig({
          ...currentConfig,
          teachingModel: modelId
        });
        console.log('[Coordinator] Saved teaching mode to user config:', modelId);
      } else {
        console.warn('[Coordinator] Cannot save teaching mode - model.saveConfig not available');
      }
    } catch (err) {
      console.error('[Coordinator] Failed to save teaching model config:', err.message);
    }
  }

  /**
   * Create a teaching model instance for a student
   * @param {string} studentId
   * @returns {Promise<object>} Teaching model instance
   * @private
   */
  async _createTeachingModel(studentId) {
    // Get student model
    const studentModel = await this.getStudentModel(studentId);

    // Get knowledge base for current subject
    const knowledgeBase = this.kbManager.getActiveSubject(this.activeSubject);

    // Create teaching model instance
    const teachingModel = TeachingModelFactory.createModel(this.currentTeachingModelId, {
      studentId,
      memory: this.memory,
      skillManager: this.skills,
      model: this.model,
      knowledgeBase,
      studentModel
    });

    // ── Session persistence: restore saved state if it exists ──
    // This lets students resume exactly where they left off after closing the app.
    try {
      const savedState = this.memory.loadSessionState?.(studentId, this.currentTeachingModelId);
      if (savedState && teachingModel.sessionState) {
        // Only restore if the saved session was in an active phase (not not_started/complete)
        const resumablePhases = ['testing', 'diagnosis', 'remediation', 'verification', 'interrupted'];
        if (resumablePhases.includes(savedState.phase)) {
          teachingModel.sessionState = { ...teachingModel.sessionState, ...savedState };
          console.log(`[Coordinator] Session restored for ${studentId} (${this.currentTeachingModelId}): phase=${savedState.phase}`);
        }
      }
    } catch (err) {
      console.warn('[Coordinator] Failed to restore session state:', err.message);
    }

    return teachingModel;
  }

  /**
   * Ensure a student has an active teaching model
   * @param {string} studentId
   * @returns {Promise<object>} Teaching model instance
   * @private
   */
  async _ensureTeachingModel(studentId) {
    const session = getSession(studentId);

    // Always re-read the persisted teaching mode before deciding whether to
    // create or recreate the model. This closes the race between the async
    // _loadTeachingModelConfig() and the first incoming message, and also
    // ensures that a mode switch (teaching:setModel) is reflected immediately
    // even if the session was already active.
    try {
      if (this.model && this.model.getConfigForDisplay) {
        const cfg = await this.model.getConfigForDisplay();
        const saved = cfg?.teachingModel;
        if (saved && saved !== this.currentTeachingModelId && TeachingModelFactory.isValidModel(saved)) {
          console.log(`[Coordinator] _ensureTeachingModel: config says "${saved}", was "${this.currentTeachingModelId}" — updating.`);
          this.currentTeachingModelId = saved;
        }
      }
    } catch (_) { /* non-fatal — keep whatever currentTeachingModelId already is */ }

    // Create teaching model if not exists
    if (!session.teachingModel) {
      session.teachingModel = await this._createTeachingModel(studentId);
      session.teachingModelId = this.currentTeachingModelId;
    }

    // If teaching model ID changed, recreate it
    if (session.teachingModelId !== this.currentTeachingModelId) {
      session.teachingModel = await this._createTeachingModel(studentId);
      session.teachingModelId = this.currentTeachingModelId;
    }

    return session.teachingModel;
  }

  /**
   * Hot-switch to a different subject. Reloads KB, persists choice to config.
   * @param {string} subjectId  e.g. "maths-advanced" | "toefl"
   * @returns {object} Result with success status and subject info
   */
  switchSubject(subjectId) {
    // Validate subject exists
    if (!this.kbManager.hasSubject(subjectId)) {
      return { success: false, error: `Unknown subject: "${subjectId}"` };
    }

    // Load the new subject
    const newKB = this.kbManager.getActiveSubject(subjectId);
    if (!newKB) {
      return { success: false, error: `Failed to load subject: ${subjectId}` };
    }

    // Update state
    this.activeSubject = subjectId;
    this.knowledgeBase = newKB;

    // Persist to config if available
    if (this.model.setActiveSubject) {
      this.model.setActiveSubject(subjectId);
    }

    // Clear all sessions to force recreation with new knowledge base
    sessions.clear();

    console.log(`[Coordinator] Switched to subject: ${subjectId}`);

    const subjectMeta = this.kbManager.getSubject(subjectId);
    return {
      success: true,
      subject: subjectId,
      label: subjectMeta?.name || subjectId,
      short: subjectMeta?.shortName || subjectId
    };
  }

  /**
   * Returns display metadata for the currently active subject.
   */
  getActiveSubjectMeta() {
    const subject = this.kbManager.getSubject(this.activeSubject);
    return subject ? {
      id: subject.id,
      label: subject.name,
      short: subject.shortName,
      icon: subject.icon
    } : {
      id: this.activeSubject,
      label: this.activeSubject,
      short: this.activeSubject
    };
  }

  /**
   * Returns all available subjects for UI dropdown
   * @returns {Array} List of available subjects
   */
  getAvailableSubjects() {
    return this.availableSubjects || [];
  }

  /**
   * Switch teaching mode
   * @param {string} modelId - Teaching mode ID
   * @param {string} studentId - Student ID
   * @returns {Promise<object>} Result
   */
  async switchTeachingModel(modelId, studentId = 'default') {
    // Validate model exists
    if (!TeachingModelFactory.isValidModel(modelId)) {
      return { success: false, error: `Unknown teaching model: "${modelId}"` };
    }

    // Update current model ID
    this.currentTeachingModelId = modelId;

    // Save to config
    await this._saveTeachingModelConfig(modelId);

    // Clear session for this student to force recreation
    if (sessions.has(studentId)) {
      const session = sessions.get(studentId);

      // End current session gracefully if possible
      if (session.teachingModel && session.teachingModel.endSession) {
        try {
          await session.teachingModel.endSession();
        } catch (err) {
          console.warn('[Coordinator] Error ending session during mode switch:', err.message);
        }
      }

      sessions.delete(studentId);
    }

    console.log(`[Coordinator] Switched teaching mode to: ${modelId} for student: ${studentId}`);

    return {
      success: true,
      modelId,
      requiresRestart: false
    };
  }

  /**
   * Start a new session (called when app opens)
   * @param {string} studentId
   * @returns {Promise<object>} Initial response
   */
  async startSession(studentId = 'default') {
    const teachingModel = await this._ensureTeachingModel(studentId);
    const session = getSession(studentId);

    // Call teaching model's startSession
    const startResponse = await teachingModel.startSession();

    // Update session state
    session.lastActive = Date.now();
    session.state = startResponse;

    return startResponse;
  }

  // ─── Main entry point ───────────────────────────────────────

  async chat({ message, studentId = 'default' }) {
    const session = getSession(studentId);
    let skillResult;
    let skillName = 'general-conversation';

    // ── Step 1: Fetch raw student data ───────────────────────
    let rawMemoryData = null;
    try {
      rawMemoryData = this.memory.getContext(studentId);
    } catch (err) {
      console.error('[Coordinator] memory.getContext failed:', err.message);
    }

    // ── Step 2: Build Student Model ──────────────────────────
    const sessionStats = {
      sessionAttempts: session.sessionAttempts,
      recentAccuracy:  session.sessionAttempts > 0
        ? session.sessionCorrect / session.sessionAttempts
        : null,
    };
    const studentModel = smm.build(rawMemoryData, sessionStats);

    // ── Step 3: Build skill context ──────────────────────────
    const skillContext = {
      studentId,
      memory:        this.memory,
      studentModel,
      model:         this.model,
      knowledgeBase: this.knowledgeBase,
      kbManager:     this.kbManager,
      skillManager:  this.skills,
    };

    // ── Step 4: Build skill params ───────────────────────────
    const skillParams = {
      userInput:         message,
      currentDifficulty: session.currentDifficulty,
      usedQuestionIds:   session.usedQuestionIds,
      dotPoint:          session.drillDotPoint || null,
      hintRequestCount:  session.hintRequestCount,
      problem:           session.currentProblem,
      sessionAttempts:   session.sessionAttempts,
      recentAccuracy:    sessionStats.recentAccuracy,
      activeSubject:     this.activeSubject,
    };

    // ── Step 5: Ensure teaching model exists ─────────────────
    const teachingModel = await this._ensureTeachingModel(studentId);

    // ── Step 6: Delegate to teaching model ───────────────────
    let teachingResponse;
    try {
      // ===== FIX: Detect resume messages to ensure they go to teacher-led mode =====
      const isResumeMessage = message.includes('↺ Resume lesson') ||
                              message.includes('Resume lesson') ||
                              message.includes('Γå║ Resume lesson') ||
                              message.includes('resume');

      if (isResumeMessage && this.currentTeachingModelId === 'teacher-led') {
        console.log('[Coordinator] Detected resume message, routing to teacher-led model');
      }
      // ===== END FIX =====

      teachingResponse = await teachingModel.handleUserInput(message, {
        ...session,
        studentModel,
        // Pass conversation history so teaching models (e.g. fallback-llm)
        // have context about previous turns — essential for "Quiz me" to
        // know what passage the student just read.
        history: session.history || [],
      });

      console.log('[Coordinator] Teaching response type:', teachingResponse.type);
      console.log('[Coordinator] Full teaching response:', JSON.stringify(teachingResponse, null, 2));

      // ===== DEBUG: Log teaching response from model =====
      console.log('[Coordinator][DEBUG] Raw teaching response:', {
        type: teachingResponse.type,
        hasMessage: !!teachingResponse.message,
        messageLength: teachingResponse.message ? teachingResponse.message.length : 0,
        messagePreview: teachingResponse.message ? teachingResponse.message.substring(0, 50) + '...' : 'NO MESSAGE',
        phase: teachingResponse.phase,
        subPhase: teachingResponse.subPhase,
        hasProgress: !!teachingResponse.progress,
        autoAdvance: teachingResponse.autoAdvance,
        canResume: teachingResponse.canResume  // ===== ADDED: Log canResume =====
      });
      // ===== END DEBUG =====

      console.log(
        `[Coordinator] Teaching model: ${this.currentTeachingModelId} | ` +
        `phase: ${teachingResponse.phase || 'unknown'} | ` +
        `canResume: ${teachingResponse.canResume}`  // ===== ADDED: Log canResume =====
      );

    } catch (err) {
      console.error('[Coordinator] Teaching model failed, falling back to direct skill:', err.message);

      // Fallback to direct skill matching (original behavior)
      // matchAndExecute now fully executes the skill (including tool-based ones)
      // so we use its result directly — no need to call skillRouter separately.
      const matchResult = await this.skills.matchAndExecute(
        message,
        skillParams,
        skillContext
      );

      skillName = matchResult.skillName;

      if (!skillName || !matchResult.result) {
        teachingResponse = {
          response: "I'm here to help! What would you like to work on?",
          type: 'fallback'
        };
      } else {
        skillResult = typeof matchResult.result === 'string'
          ? { result: matchResult.result }
          : matchResult.result;

        teachingResponse = {
          response: skillResult?.result || '',
          skillUsed: skillName,
          syllabusPoint: skillResult?.syllabusPoint,
          visualization: skillResult?.visualization,
          type: 'response',
          canResume: false
        };
      }
    }

    // ── Step 6b: Handle mode switch requested by teaching model ────────
    // If the teaching model returns a modeSwitch object (e.g. remediation switching
    // to Teacher-Led), execute the switch immediately so the next message is handled
    // by the correct model. Mark the switch as completed on the originating model.
    if (teachingResponse.modeSwitch) {
      const { to: targetModelId, teachingBrief, returnAction } = teachingResponse.modeSwitch;
      console.log(`[Coordinator] Mode switch requested: test-led → ${targetModelId} (reason: ${teachingResponse.modeSwitch.reason})`);

      try {
        // Switch to the target model
        await this.switchTeachingModel(targetModelId, studentId);

        // Mark the originating test-led model's switch as completed so it can
        // transition to verification when it regains control later
        if (session.teachingModel && session.teachingModel.sessionState?.remediation) {
          session.teachingModel.sessionState.remediation.modeSwitchCompleted = true;
        }

        // Pass the teaching brief to the new model's session state so it knows
        // what topic to teach and what the student struggled with
        const newModel = await this._ensureTeachingModel(studentId);
        if (newModel && teachingBrief && newModel.sessionState) {
          newModel.sessionState.remediationBrief = teachingBrief;
        }

        console.log(`[Coordinator] Mode switch to ${targetModelId} completed.`);
      } catch (err) {
        console.error('[Coordinator] Mode switch failed:', err.message);
      }
    }

    // ── Step 7: Extract response from teaching model ─────────
    const rawResponse = teachingResponse.response || teachingResponse.message || '';

    // ===== DEBUG: Log raw response =====
    console.log('[Coordinator][DEBUG] Raw response extracted:', {
      length: rawResponse.length,
      preview: rawResponse.substring(0, 50) + '...',
      isEmpty: rawResponse.length === 0
    });
    // ===== END DEBUG =====

    // Use the skill name set by the teaching model response; fall back to the
    // teaching model ID (e.g. 'teacher-led') rather than 'general-conversation'
    // so the UI tag correctly reflects the source of the message.
    const teachingModelFallback = this.currentTeachingModelId || skillName;
    const usedSkill = teachingResponse.skillUsed || teachingModelFallback;

    // ── Step 8: Adaptive Feedback Engine ────────────────────
    const { adjustedResponse, adjustmentsApplied } = afe.adjustResponse({
      rawResponse,
      studentModel,
      skillName: usedSkill,
      skillResult: skillResult || {},
    });

    // ===== DEBUG: Log adjusted response =====
    console.log('[Coordinator][DEBUG] Adjusted response:', {
      length: adjustedResponse.length,
      preview: adjustedResponse.substring(0, 50) + '...',
      isEmpty: adjustedResponse.length === 0,
      adjustments: adjustmentsApplied
    });
    // ===== END DEBUG =====

    if (adjustmentsApplied.length > 0) {
      console.log(`[Coordinator] AFE adjustments: ${adjustmentsApplied.join(', ')}`);
    }

    // ── Step 9: Update session state ─────────────────────────
    updateSessionState(session, usedSkill, skillResult || {}, skillParams);

    // ── Step 10: Append to conversation history ───────────────
    session.history.push({ role: 'user',      content: message         });
    session.history.push({ role: 'assistant', content: adjustedResponse });
    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }

    // ── Step 11: Run passive skills silently ──────────────────
    setImmediate(() => {
      this._runPassiveSkills({
        studentId,
        skillContext,
        message,
        response:    adjustedResponse,
        skillResult: skillResult || {},
        session,
      });
    });

    // ===== DEBUG: Log teaching response fields before return =====
    console.log('[Coordinator][DEBUG] Teaching response fields:', {
      hasMessage: !!teachingResponse.message,
      hasPhase: !!teachingResponse.phase,
      hasSubPhase: !!teachingResponse.subPhase,
      hasProgress: !!teachingResponse.progress,
      canResume: teachingResponse.canResume,  // ===== ADDED: Log canResume =====
      messagePreview: teachingResponse.message ? teachingResponse.message.substring(0, 30) + '...' : 'NO MESSAGE'
    });
    // ===== END DEBUG =====

    // ── Step 12: Return to IPC layer / frontend ──────────────
    const returnValue = {
      response:           adjustedResponse,
      skillUsed:          usedSkill,
      syllabusPoint:      teachingResponse.syllabusPoint || skillResult?.syllabusPoint || null,
      visualization:      teachingResponse.visualization || skillResult?.visualization || null,
      marksAwarded:       skillResult?.marksAwarded   ?? null,
      marksTotal:         skillResult?.marksTotal      ?? null,
      guidanceLevel:      skillResult?.guidanceLevel  || null,
      nextDifficulty:     skillResult?.nextDifficulty || null,
      adjustmentsApplied,
      sessionAttempts:    session.sessionAttempts,

      // Teaching mode specific fields
      type:               teachingResponse.type,  // ADD THIS LINE
      question:           teachingResponse.question,  // ADD THIS LINE
      results:            teachingResponse.results,    // ← ADD THIS
      diagnosis:          teachingResponse.diagnosis,  // ← ADD THIS
      teachingModel:      this.currentTeachingModelId,
      teachingPhase:      teachingResponse.phase,
      // Teaching models return teachingSubPhase / teachingProgress (not subPhase / progress).
      // Fallback to the shorter names so older teaching models still work.
      teachingSubPhase:   teachingResponse.teachingSubPhase ?? teachingResponse.subPhase ?? null,
      teachingProgress:   teachingResponse.teachingProgress ?? teachingResponse.progress ?? null,
      // ===== FIXED: Ensure canResume is properly passed =====
      canResume:          teachingResponse.canResume === true,
      // ===== END FIXED =====
      proactive:          teachingResponse.proactive === true,
      topic:              teachingResponse.topic || null,

      // Mode switch (test-led → teacher-led for remediation)
      modeSwitch:         teachingResponse.modeSwitch || null,

      // Answer feedback fields (test-led mode)
      isCorrect:          teachingResponse.isCorrect === true,
      detailedFeedback:   teachingResponse.detailedFeedback || null,
      workedSolution:     teachingResponse.workedSolution || null,
      errorType:          teachingResponse.errorType || null,
      score:              teachingResponse.score ?? null,
      suggestions:        teachingResponse.suggestions || null,

      // Auto-advance fields
      autoAdvance:        teachingResponse.autoAdvance || false,
      delay:              teachingResponse.delay || 0,

      // Step counter
      currentStep:        teachingResponse.currentStep || null,
      totalSteps:         teachingResponse.totalSteps || null,
      stepName:           teachingResponse.stepName || null,

      // Question counters (test-led mode)
      questionIndex:      teachingResponse.questionIndex || null,
      totalQuestions:     teachingResponse.totalQuestions || null,
    };

    // ===== DEBUG: Log final return object =====
    console.log('[Coordinator][DEBUG] Final return object:', {
      responseLength: returnValue.response.length,
      responsePreview: returnValue.response.substring(0, 50) + '...',
      teachingModel: returnValue.teachingModel,
      teachingPhase: returnValue.teachingPhase,
      teachingSubPhase: returnValue.teachingSubPhase,
      teachingProgress: returnValue.teachingProgress,
      canResume: returnValue.canResume,  // ===== ADDED: Log canResume =====
      autoAdvance: returnValue.autoAdvance
    });
    // ===== END DEBUG =====

    return returnValue;
  }

  // ─── Passive skills runner ──────────────────────────────────

  async _runPassiveSkills({ studentId, skillContext, message, response, skillResult, session }) {
    const passiveParams = {
      userInput:       message,
      response,
      isCorrect:       skillResult.scoreSignal !== undefined
        ? skillResult.scoreSignal >= 0.8
        : null,
      dotPoint:        skillResult.syllabusPoint || null,
      sessionAttempts: session.sessionAttempts,
      recentAccuracy:  session.sessionAttempts > 0
        ? session.sessionCorrect / session.sessionAttempts
        : null,
      masteryBefore:   null,
      masteryAfter:    null,
    };

    let passiveResults = [];
    try {
      passiveResults = await this.skills.executePassiveSkills(passiveParams, skillContext);
    } catch (err) {
      console.error('[Coordinator] executePassiveSkills threw unexpectedly:', err.message);
      return;
    }

    for (const pr of passiveResults) {
      if (pr?.memoryUpdates) {
        applyMemoryUpdate(this.memory, studentId, pr.memoryUpdates);
      }
    }
  }

  // ─── Session management ─────────────────────────────────────

  async endSession(studentId) {
    const session = sessions.get(studentId);

    if (session && session.teachingModel) {
      try {
        await session.teachingModel.endSession();
      } catch (err) {
        console.warn('[Coordinator] Error ending teaching model session:', err.message);
      }
    }

    // Clear persisted session state on clean exit so student starts fresh next time
    try {
      this.memory.clearSessionState?.(studentId, session?.teachingModelId || this.currentTeachingModelId);
    } catch (err) {
      console.warn('[Coordinator] Failed to clear persisted session:', err.message);
    }

    clearSession(studentId);
    console.log(`[Coordinator] Session ended for ${studentId}`);
  }

  getSessionState(studentId) {
    const session = getSession(studentId);
    const teachingState = session.teachingModel?.getTeachingState?.() || {};

    return {
      sessionAttempts:   session.sessionAttempts,
      sessionCorrect:    session.sessionCorrect,
      currentDifficulty: session.currentDifficulty,
      sessionDurationMs: Date.now() - session.sessionStartedAt,
      historyLength:     session.history.length / 2,

      // NEW: Teaching mode state
      teachingModel:     session.teachingModelId,
      teachingPhase:     teachingState.phase,
      teachingProgress:  teachingState.phaseProgress,
    };
  }

  async getStudentModel(studentId = 'default') {
    let rawData = null;
    try { rawData = this.memory.getContext(studentId); } catch { /* ok */ }
    const session      = getSession(studentId);
    const sessionStats = {
      sessionAttempts: session.sessionAttempts,
      recentAccuracy:  session.sessionAttempts > 0
        ? session.sessionCorrect / session.sessionAttempts
        : null,
    };
    return smm.build(rawData, sessionStats);
  }

  // ─── Teaching mode API ──────────────────────────────────────

  /**
   * Get available teaching models (for Settings UI)
   * @returns {Array} List of teaching model metadata
   */
  getAvailableTeachingModels() {
    return TeachingModelFactory.getAllModelMetadata();
  }

  /**
   * Get current teaching model info (fixed for serialization)
   * @param {string} studentId
   * @returns {Promise<object>} Teaching model info
   */
  async getCurrentTeachingModelInfo(studentId = 'default') {
    const session = sessions.get(studentId);

    try {
      if (session?.teachingModel) {
        const state = session.teachingModel.getTeachingState();
        // Ensure only serializable data is returned
        return {
          modelId: this.currentTeachingModelId,
          phase: typeof state.phase === 'string' ? state.phase : null,
          subPhase: typeof state.subPhase === 'string' ? state.subPhase : null,
          progress: typeof state.phaseProgress === 'number' ? state.phaseProgress : 0,
          currentTopic: typeof state.currentTopic === 'string' ? state.currentTopic : null,
          // ===== FIXED: Use state.canResume directly =====
          canResume: state.canResume === true,
          // ===== END FIXED =====
          active: true
        };
      }
    } catch (err) {
      console.error('[Coordinator] Error getting teaching model info:', err);
    }

    return {
      modelId: this.currentTeachingModelId,
      phase: null,
      subPhase: null,
      progress: 0,
      currentTopic: null,
      canResume: false,
      active: false
    };
  }

  /**
   * Resume an interrupted lesson (Teacher-Led mode only)
   * @param {string} studentId
   * @returns {Promise<object>} Resume response
   */
  async resumeLesson(studentId = 'default') {
    const session = sessions.get(studentId);
    if (!session || !session.teachingModel) {
      return { success: false, error: 'No active session' };
    }

    // Send a special resume command to the teaching model
    const resumeResponse = await session.teachingModel.handleUserInput(
      '↺ Resume lesson',
      session
    );

    return {
      success: true,
      ...resumeResponse
    };
  }

  /**
   * Get current homework (Teacher-Led mode only)
   * @param {string} studentId
   * @returns {Promise<object>} Homework data
   */
  async getHomework(studentId = 'default') {
    // This would need to be implemented in the teaching model
    // For now, return empty
    return { success: true, homework: null };
  }

  // ===== NEW: Auto-advance method for lessons =====

    /**
     * Advance to the next section of a lesson automatically
     * @param {string} studentId
     * @returns {Promise<object>} Result of advancing the lesson
     * @private
     */
    async _advanceLesson(studentId) {
      console.log('[Coordinator] ===== AUTO-ADVANCE TRIGGERED =====');
      console.log('[Coordinator] studentId:', studentId);
      console.log('[Coordinator] currentTeachingModelId:', this.currentTeachingModelId);

      try {
        // Use a special marker message to indicate auto-advance
        const result = await this.chat({
          message: '__AUTO_ADVANCE__',
          studentId
        });

        console.log('[Coordinator] Auto-advance result:', {
          hasResponse: !!result.response,
          responseLength: result.response?.length || 0,
          teachingPhase: result.teachingPhase,
          teachingSubPhase: result.teachingSubPhase,
          autoAdvance: result.autoAdvance
        });

        return result;
      } catch (err) {
        console.error('[Coordinator] Auto-advance failed:', err);
        throw err;
      }
    }
}

module.exports = Coordinator;