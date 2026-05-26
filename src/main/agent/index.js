/**
 * Agent entry point
 * src/main/agent/index.js
 *
 * MODIFIED: Added teaching mode IPC handlers (v4.0) and auto-advance IPC channel
 * MODIFIED: Added knowledge base generator IPC handlers (v5.0)
 * MODIFIED: Added meta-learning IPC handlers (v6.0)
 * MODIFIED: Added test mode IPC handlers (v6.5)
 *
 * FIXED: Added proper error handling and debug logging for stream events
 * FIXED: Ensured proactive flag and phase data are sent correctly
 * FIXED: Added autoAdvance and delay to stream:start and stream:end events
 * FIXED: Consistent data structure for chat:stream:end events to prevent undefined errors
 * FIXED: Added all properties to error case and stop handler
 *
 * Exports:
 *   createCoordinator(options)  — factory function, returns a Coordinator instance
 *   registerIpcHandlers(ipcMain, coordinator) — wires all IPC channels for the frontend
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Coordinator = require('./coordinator');

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

/**
 * Creates and returns a fully wired Coordinator instance.
 *
 * Call this once from main.js after all managers are initialised.
 *
 * @param {object} options
 *   - memory        {MemoryManager}
 *   - skillManager  {SkillManager}
 *   - model         {ModelManager}
 *   - kbRoot        {string}  — absolute path to knowledge-base/hsc-maths-advanced/
 * @returns {Coordinator}
 */
function createCoordinator({ memory, skillManager, model, kbRoot }) {
  return new Coordinator({ memory, skillManager, model, kbRoot });
}

// ─────────────────────────────────────────────────────────────
// IPC handler registration
// ─────────────────────────────────────────────────────────────

/**
 * Registers all IPC channels defined in the architecture spec (Section 7.1).
 * Call this from main.js after app is ready and coordinator is created.
 *
 * Each handler follows the same pattern:
 *   - Validate inputs
 *   - Delegate to coordinator or manager
 *   - Return { success: true, ...data } or { success: false, error: string }
 *
 * @param {object} ipcMain      — Electron ipcMain
 * @param {object} coordinator  — Coordinator instance
 * @param {object} managers     — { memory, model, skillManager }
 */
function registerIpcHandlers(ipcMain, coordinator, managers) {
  const { memory, model } = managers;

  // ── chat:send ────────────────────────────────────────────
  // Primary conversation channel. Called every time the student sends a message.
  ipcMain.handle('chat:send', async (_event, { message, studentId = 'default' }) => {
    try {
      if (!message || typeof message !== 'string' || message.trim() === '') {
        return { success: false, error: 'Empty message' };
      }
      const result = await coordinator.chat({ message: message.trim(), studentId });
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC chat:send]', err);
      return {
        success:  false,
        error:    err.message,
        response: 'Sorry, something went wrong. Please try again.',
      };
    }
  });

  // ── chat:end-session ─────────────────────────────────────
  // Called when the student clicks "End Session" in the UI.
  ipcMain.handle('chat:end-session', async (_event, { studentId = 'default' }) => {
    try {
      await coordinator.endSession(studentId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── chat:session-state ───────────────────────────────────
  // Returns current session stats (attempts, accuracy, duration).
  ipcMain.handle('chat:session-state', async (_event, { studentId = 'default' }) => {
    try {
      return { success: true, ...coordinator.getSessionState(studentId) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── chat:stop ─────────────────────────────────────────────
  // Sets a flag that the active chat:stream loop checks every chunk.
  // Also stores a sender reference so we can push the :end event immediately.
  let _streamStop = false;
  let _streamSender = null;

  ipcMain.handle('chat:stop', (_event) => {
    _streamStop = true;
    // Push stream:end immediately so the renderer finalises the bubble now
    try {
      if (_streamSender && !_streamSender.isDestroyed()) {
        _streamSender.send('chat:stream:end', {
          fullText: null,
          stopped: true,
          error: null,
          autoAdvance: false,
          autoAdvanceDelay: 4000,
          messageId: null,
          proactiveComplete: false
        });
      }
    } catch (_) {}
    return { success: true };
  });

  // ── chat:stream ────────────────────────────────────────────
  // Runs the full coordinator pipeline, then streams the response
  // back word-by-word via 'chat:stream:chunk' events.
  // Sends 'chat:stream:start' with metadata, then chunks, then 'chat:stream:end'.
  ipcMain.handle('chat:stream', async (event, { message, studentId = 'default', isSystem = false }) => {
    try {
      console.log('[IPC][DEBUG] ===== CHAT STREAM STARTED =====');
      console.log('[IPC][DEBUG] message:', message);
      console.log('[IPC][DEBUG] studentId:', studentId);
      console.log('[IPC][DEBUG] isSystem:', isSystem);

      if (!message || typeof message !== 'string' || message.trim() === '') {
        console.error('[IPC][DEBUG] Empty message received');
        return { success: false, error: 'Empty message' };
      }

      // Run the full pipeline — skill matching, AFE, session state
      console.log('[IPC][DEBUG] Calling coordinator.chat...');
      const result = await coordinator.chat({ message: message.trim(), studentId, isSystem });
      console.log('[IPC][DEBUG] coordinator.chat result:', {
        hasResponse: !!result.response,
        responseLength: result.response?.length || 0,
        teachingModel: result.teachingModel,
        teachingPhase: result.teachingPhase,
        teachingSubPhase: result.teachingSubPhase,
        autoAdvance: result.autoAdvance,
        delay: result.delay
      });

      const sender = event.sender;
      _streamSender = sender;
      _streamStop   = false;

        // Signal start — send metadata the renderer needs immediately
        const startEventData = {
          // Core response fields
          skillUsed:        result.skillUsed,
          syllabusPoint:    result.syllabusPoint,
          visualization:    result.visualization,
          adjustmentsApplied: result.adjustmentsApplied || [],

          // Teaching mode metadata - with robust defaults
          teachingModel:    result.teachingModel || result.model || 'unknown',
          teachingPhase:    result.teachingPhase || result.phase || 'active',
          teachingSubPhase: result.teachingSubPhase || result.subPhase || null,
          teachingProgress: typeof result.teachingProgress === 'number' ? result.teachingProgress :
                           (typeof result.progress === 'number' ? result.progress : 0),

          // Test mode specific fields
          type:             result.type,
          testType:         result.testType || null,
          questionIndex:    result.questionIndex || null,
          totalQuestions:   result.totalQuestions || null,
          score:            result.score || null,
          diagnosis:        result.diagnosis || null,

          question:         result.question,

          // Auto-advance fields
          autoAdvance:      result.autoAdvance || false,
          delay:            result.delay || 0,

          // Flags
          proactive:        result.proactive === true,
          canResume:        result.canResume === true,

          // Phase info (backwards compatibility)
          phase:            result.phase || result.teachingPhase || 'active',
          subPhase:         result.subPhase || result.teachingSubPhase || null,
          topic:            result.topic || null,

          // Step counter fields - CRITICAL for UI
          currentStep:      typeof result.currentStep === 'number' ? result.currentStep :
                           (result.currentStep !== undefined ? result.currentStep : 1),
          totalSteps:       typeof result.totalSteps === 'number' ? result.totalSteps :
                           (result.totalSteps !== undefined ? result.totalSteps : 5),
          stepName:         result.stepName || result.teachingPhase || 'Learning',

          // Message ID for tracking
          messageId:        result.messageId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        };

        // Debug log to verify all fields are present
        console.log('[IPC][DEBUG] FINAL startEventData:', {
          type: startEventData.type,  // ADD THIS LINE
          teachingPhase: startEventData.teachingPhase,
          teachingSubPhase: startEventData.teachingSubPhase,
          teachingProgress: startEventData.teachingProgress,
          testType: startEventData.testType,
          questionIndex: startEventData.questionIndex,
          totalQuestions: startEventData.totalQuestions,
          currentStep: startEventData.currentStep,
          totalSteps: startEventData.totalSteps,
          stepName: startEventData.stepName,
          proactive: startEventData.proactive,
          canResume: startEventData.canResume
        });

      console.log('[IPC][DEBUG] Sending chat:stream:start with data:', startEventData);
      sender.send('chat:stream:start', startEventData);

      // Stream the response text chunk-by-chunk.
      const responseText = result.response || result.message || '';
      const fullText = responseText;
      console.log('[IPC][DEBUG] Response text length:', fullText.length);
      console.log('[IPC][DEBUG] Response preview:', fullText.substring(0, 100) + '...');

      const chunks = fullText.match(/\S+\s*/g) || [];
      console.log('[IPC][DEBUG] Number of chunks:', chunks.length);

      // If no chunks but we have text, send the whole thing as one chunk
      if (chunks.length === 0 && fullText) {
        console.log('[IPC][DEBUG] Single chunk mode - sending full text');
        if (!sender.isDestroyed() && !_streamStop) {
          sender.send('chat:stream:chunk', { token: fullText, messageId: result.messageId });
        }
      } else {
        // Normal streaming
        for (let i = 0; i < chunks.length; i++) {
          if (sender.isDestroyed() || _streamStop) {
            console.log('[IPC][DEBUG] Stream stopped or destroyed at chunk', i);
            break;
          }
          const chunk = chunks[i];
          sender.send('chat:stream:chunk', { token: chunk, messageId: result.messageId });
          await new Promise(r => setTimeout(r, 20));
        }
      }

      // Only send :end if not already sent by chat:stop handler
      if (!sender.isDestroyed() && !_streamStop) {
        console.log('[IPC][DEBUG] Sending chat:stream:end with fullText length:', fullText.length);
        console.log('[IPC][DEBUG] Also sending autoAdvance:', result.autoAdvance, 'delay:', result.delay);

        sender.send('chat:stream:end', {
          fullText: fullText || '',
          error: null,
          autoAdvance: result.autoAdvance || false,
          autoAdvanceDelay: result.delay || 0,
          messageId: startEventData.messageId,
          proactiveComplete: result.proactiveComplete || false,
          teachingPhase: result.teachingPhase,
          teachingSubPhase: result.teachingSubPhase,
          teachingProgress: result.teachingProgress,
          canResume: result.canResume === true,
        });
      } else {
        console.log('[IPC][DEBUG] Stream end not sent - destroyed:', sender.isDestroyed(), 'stopped:', _streamStop);
      }

      _streamSender = null;
      console.log('[IPC][DEBUG] ===== CHAT STREAM COMPLETED =====');

      return { success: true };

    } catch (err) {
      console.error('[IPC][DEBUG] ===== CHAT STREAM ERROR =====');
      console.error('[IPC][DEBUG] Error:', err);
      console.error('[IPC][DEBUG] Stack:', err.stack);

      try {
        event.sender.send('chat:stream:end', {
          fullText: '',
          error: err.message,
          autoAdvance: false,
          autoAdvanceDelay: 4000,
          messageId: null,
          proactiveComplete: false,
          teachingPhase: null,
          teachingSubPhase: null,
          teachingProgress: 0
        });
      } catch (sendErr) {
        console.error('[IPC][DEBUG] Failed to send error end event:', sendErr);
      }

      return { success: false, error: err.message };
    }
  });

  // ── chat:follow-ups ────────────────────────────────────────
  // Generate follow-up questions after a response.
  // In Teacher-Led mode: suppressed during auto-advance phases (introducing/explaining)
  // to avoid off-topic suggestions while the lesson is running on its own rhythm.
  // During interactive phases (checking/practicing/assessing) the current lesson
  // topic and phase are passed to the generator so suggestions stay on-topic.
  // In Test-Led mode: suppressed during testing phase, enabled during diagnosis.
  ipcMain.handle('chat:follow-ups', async (_event, { responseText, studentId, activeSubject }) => {
    try {
      // Get current teaching state so we can make context-aware decisions
      const teachingInfo = await coordinator.getCurrentTeachingModelInfo(studentId);
      const isTeacherLed = teachingInfo?.modelId === 'teacher-led';
      const isTestLed = teachingInfo?.modelId === 'test-led';
      const currentPhase = teachingInfo?.phase;

      // Suppress follow-ups during auto-advance phases in teacher-led mode
      const autoAdvancePhases = ['introducing', 'explaining', 'not_started'];
      if (isTeacherLed && autoAdvancePhases.includes(currentPhase)) {
        return { success: true, followUps: [] };
      }

      // Suppress follow-ups during testing phase in test-led mode
      if (isTestLed && currentPhase === 'testing') {
        return { success: true, followUps: [] };
      }

      // For interactive teacher-led phases, enrich the generator with lesson context
      // so suggestions relate to the current topic rather than the whole subject
      const teachingContext = isTeacherLed ? {
        teachingPhase: currentPhase,
        currentTopic: teachingInfo?.currentTopic || null,
      } : null;

      // For test-led diagnosis phase, add test context
      const testContext = isTestLed && currentPhase === 'diagnosis' ? {
        testType: teachingInfo?.testType,
        score: teachingInfo?.score
      } : null;

      const result = await model.generateFollowUps(responseText, studentId, activeSubject, teachingContext, testContext);
      return { success: true, followUps: result.followUps };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── models:list ──────────────────────────────────────────
  ipcMain.handle('models:list', async () => {
    try {
      return { success: true, models: model.listModels() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── models:test ──────────────────────────────────────────
  ipcMain.handle('models:test', async (_event, { modelId, apiKey }) => {
    try {
      const result = await model.testModel(modelId, apiKey);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── models:switch ────────────────────────────────────────
  ipcMain.handle('models:switch', async (_event, { modelId }) => {
    try {
      await model.switchModel(modelId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── models:set-api-key ───────────────────────────────────
  ipcMain.handle('models:set-api-key', async (_event, { adapterType, apiKey }) => {
    try {
      model.setApiKey(adapterType, apiKey);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── config:get ───────────────────────────────────────────
  ipcMain.handle('config:get', async () => {
    try {
      const config = model.getConfigForDisplay();

      // NEW: Add teaching model to config
      const teachingModelId = coordinator.currentTeachingModelId ||
                              (coordinator.teachingModelFactory ?
                               coordinator.teachingModelFactory.getDefaultModelId() :
                               'student-led');

      return {
        success: true,
        config: {
          ...config,
          teachingModel: teachingModelId
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── config:save ───────────────────────────────────────────
  // (Defined in main.js but kept here for completeness)

  // ── subject:switch ────────────────────────────────────────
  ipcMain.handle('subject:switch', async (_event, { subjectId }) => {
    try {
      console.log(`[IPC] subject:switch called with: ${subjectId}`);
      const result = coordinator.switchSubject(subjectId);
      console.log('[IPC] subject:switch result:', result);
      return result;
    } catch (err) {
      console.error('[IPC subject:switch]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── subject:info ──────────────────────────────────────────
  ipcMain.handle('subject:info', async () => {
    try {
      const config = model.getConfigForDisplay?.() || {};
      return {
        success:          true,
        activeSubject:    coordinator.activeSubject,
        subjectMeta:      coordinator.getActiveSubjectMeta(),
        enrolledSubjects: config.enrolledSubjects || ['maths-advanced'],
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── subject:list ─────────────────────────────────────────
  ipcMain.handle('subject:list', async () => {
    try {
      const subjects = coordinator.getAvailableSubjects();
      return { success: true, subjects };
    } catch (err) {
      console.error('[IPC] subject:list error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── subject:suggestions ─────────────────────────────────
  ipcMain.handle('subject:suggestions', async (_event, { subjectId }) => {
    try {
      const subject = coordinator.kbManager?.getSubject(subjectId);
      return {
        success: true,
        suggestions: subject?.suggestions || [],
        quickActions: subject?.quickActions || [],
      };
    } catch (err) {
      console.error('[IPC] subject:suggestions error:', err);
      return { success: false, error: err.message, suggestions: [], quickActions: [] };
    }
  });

  // ── stats:get ────────────────────────────────────────────
  ipcMain.handle('stats:get', async () => {
    try {
      return { success: true, stats: model.getStats() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── progress:get ─────────────────────────────────────────
  ipcMain.handle('progress:get', async (_event, { studentId = 'default' }) => {
    try {
      const context = memory.getContext(studentId);
      return {
        success:  true,
        progress: context.progress || null,
        mastery:  context.syllabusMastery || null,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── syllabus:mastery ─────────────────────────────────────
  ipcMain.handle('syllabus:mastery', async (_event, { studentId = 'default' }) => {
    try {
      const context = memory.getContext(studentId);
      return {
        success: true,
        mastery: context.syllabusMastery?.dotPoints || {},
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── syllabus:topics ──────────────────────────────────────
  ipcMain.handle('syllabus:topics', async () => {
    try {
      const kb = coordinator.knowledgeBase;
      return {
        success: true,
        topics:  kb?.syllabusMap?.topics || [],
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── student:model ────────────────────────────────────────
  ipcMain.handle('student:model', async (_event, { studentId = 'default' }) => {
    try {
      const studentModel = await coordinator.getStudentModel(studentId);
      return { success: true, studentModel };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── student:profile:save ─────────────────────────────────
  ipcMain.handle('student:profile:save', async (_event, { studentId = 'default', profile }) => {
    try {
      await memory.saveProfile(studentId, profile);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── readiness:forecast ───────────────────────────────────
  ipcMain.handle('readiness:forecast', async (_event, { studentId = 'default' }) => {
    try {
      const context = memory.getContext(studentId);
      return {
        success:  true,
        forecast: context.examReadiness || null,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── pastpaper:list ───────────────────────────────────────
  ipcMain.handle('pastpaper:list', async (_event, { topic, year } = {}) => {
    try {
      const kb = coordinator.knowledgeBase;
      let questions = kb?.questionIndex || [];
      if (topic) questions = questions.filter(q => q.topic === topic);
      if (year)  questions = questions.filter(q => q.year  === year);
      return { success: true, questions };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── pastpaper:submit ─────────────────────────────────────
  ipcMain.handle('pastpaper:submit', async (_event, { questionId, studentAnswer, studentId = 'default' }) => {
    try {
      const result = await coordinator.chat({
        message:   `Mark my answer: ${studentAnswer}`,
        studentId,
      });
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ============================================================
  // Teaching Mode IPC Handlers (v4.0)
  // ============================================================

  // ── teaching:setModel ─────────────────────────────────────
  // Switch teaching mode
  ipcMain.handle('teaching:setModel', async (_event, { modelId, studentId = 'default' }) => {
    try {
      const result = await coordinator.switchTeachingModel(modelId, studentId);
      return result;
    } catch (err) {
      console.error('[IPC teaching:setModel]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── teaching:getCurrent ───────────────────────────────────
  // Get current teaching mode info
  ipcMain.handle('teaching:getCurrent', async (_event, { studentId = 'default' }) => {
    try {
      const info = await coordinator.getCurrentTeachingModelInfo(studentId);
      return { success: true, ...info };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── teaching:getAvailable ─────────────────────────────────
  // Get all available teaching modes (for Settings UI)
  ipcMain.handle('teaching:getAvailable', async () => {
    try {
      const models = coordinator.getAvailableTeachingModels();
      return { success: true, models };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── teaching:saveConfig ───────────────────────────────────
  // Save teaching mode configuration
  ipcMain.handle('teaching:saveConfig', async (_event, { modelId, config }) => {
    try {
      // Store in memory manager if available
      if (memory && memory.saveTeachingConfig) {
        await memory.saveTeachingConfig(modelId, config);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── teacher:resumeLesson ──────────────────────────────────
  // Resume interrupted lesson (Teacher-Led mode only)
  ipcMain.handle('teacher:resumeLesson', async (_event, { studentId = 'default' }) => {
    try {
      const result = await coordinator.resumeLesson(studentId);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── teacher:getHomework ───────────────────────────────────
  // Get current homework (Teacher-Led mode only)
  ipcMain.handle('teacher:getHomework', async (_event, { studentId = 'default' }) => {
    try {
      const result = await coordinator.getHomework(studentId);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ============================================================
  // Test Mode IPC Handlers (v6.5) - NEW
  // ============================================================

  // ── test:start ────────────────────────────────────────────
  // Start a test in Test-Led mode
  ipcMain.handle('test:start', async (_event, { testType, topic, studentId = 'default' }) => {
    try {
      // This will be handled by the test-led model via chat with system message
      let message;
      if (testType === 'diagnostic') {
        message = '__START_DIAGNOSTIC__';
      } else if (testType === 'topic') {
        message = '__START_TOPIC_TEST__';
      } else if (testType === 'mixed') {
        message = '__START_MIXED_TEST__';
      } else if (testType === 'mastery') {
        message = '__START_MASTERY_CHECK__';
      } else {
        message = '__START_TEST__';
      }

      const result = await coordinator.chat({ message, studentId });
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC test:start]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── test:submit ───────────────────────────────────────────
  // Submit an answer to a test question.
  // IMPORTANT: Must use the full chat:stream:start/chunk/end pipeline so
  // the frontend stream handler receives the response (e.g. test_complete).
  // Previously this just returned data via ipcMain.handle return value, which
  // the frontend's onResponse callback discarded — causing the blank screen bug.
  ipcMain.handle('test:submit', async (event, { answer, questionId, studentId = 'default' }) => {
    console.log('[IPC test:submit] called with answer:', answer?.substring(0, 50));
    try {
      const result = await coordinator.chat({ message: answer, studentId });

      const sender = event.sender;
      _streamSender = sender;
      _streamStop   = false;

      // Build start event data — same structure as chat:stream
      const startEventData = {
        skillUsed:          result.skillUsed,
        syllabusPoint:      result.syllabusPoint,
        visualization:      result.visualization,
        adjustmentsApplied: result.adjustmentsApplied || [],
        teachingModel:      result.teachingModel || 'test-led',
        teachingPhase:      result.teachingPhase || result.phase || 'testing',
        teachingSubPhase:   result.teachingSubPhase || result.subPhase || null,
        teachingProgress:   typeof result.teachingProgress === 'number' ? result.teachingProgress :
                            (typeof result.progress === 'number' ? result.progress : 0),
        type:               result.type,
        testType:           result.testType || null,
        questionIndex:      result.questionIndex || null,
        totalQuestions:     result.totalQuestions || null,
        score:              result.score || null,
        diagnosis:          result.diagnosis || null,
        results:            result.results || null,
        question:           result.question || null,
        suggestions:        result.suggestions || null,
        detailedFeedback:   result.detailedFeedback || null,
        workedSolution:     result.workedSolution || null,
        isCorrect:          result.isCorrect === true,
        autoAdvance:        result.autoAdvance || false,
        delay:              result.delay || 0,
        proactive:          result.proactive === true,
        canResume:          result.canResume === true,
        phase:              result.phase || result.teachingPhase || 'testing',
        subPhase:           result.subPhase || result.teachingSubPhase || null,
        topic:              result.topic || null,
        currentStep:        result.currentStep ?? 1,
        totalSteps:         result.totalSteps ?? 5,
        stepName:           result.stepName || '',
        messageId:          result.messageId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };

      console.log('[IPC test:submit] Sending chat:stream:start, type:', startEventData.type, 'isCorrect:', startEventData.isCorrect);
      sender.send('chat:stream:start', startEventData);

      // Stream response text chunk-by-chunk
      const fullText = result.response || result.message || '';
      const chunks = fullText.match(/\S+\s*/g) || [];

      if (chunks.length === 0 && fullText) {
        if (!sender.isDestroyed() && !_streamStop) {
          sender.send('chat:stream:chunk', { token: fullText, messageId: startEventData.messageId });
        }
      } else {
        for (let i = 0; i < chunks.length; i++) {
          if (sender.isDestroyed() || _streamStop) break;
          sender.send('chat:stream:chunk', { token: chunks[i], messageId: startEventData.messageId });
          await new Promise(r => setTimeout(r, 20));
        }
      }

      if (!sender.isDestroyed() && !_streamStop) {
        sender.send('chat:stream:end', {
          fullText:          fullText || '',
          error:             null,
          autoAdvance:       result.autoAdvance || false,
          autoAdvanceDelay:  result.delay || 0,
          messageId:         startEventData.messageId,
          proactiveComplete: false,
          teachingPhase:     result.teachingPhase,
          teachingSubPhase:  result.teachingSubPhase,
          teachingProgress:  result.teachingProgress,
          canResume:         result.canResume === true,
        });
      }

      _streamSender = null;
      console.log('[IPC test:submit] Stream completed, type:', result.type);
      return { success: true };

    } catch (err) {
      console.error('[IPC test:submit]', err.message);
      try {
        event.sender.send('chat:stream:end', {
          fullText: '', error: err.message,
          autoAdvance: false, autoAdvanceDelay: 0,
          messageId: null, proactiveComplete: false,
          teachingPhase: null, teachingSubPhase: null,
          teachingProgress: 0, canResume: false,
        });
      } catch (_) {}
      return { success: false, error: err.message };
    }
  });

  // ── test:skip ─────────────────────────────────────────────
  // Skip current test question
  ipcMain.handle('test:skip', async (_event, { studentId = 'default' }) => {
    try {
      const result = await coordinator.chat({ message: 'skip', studentId });
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC test:skip]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── test:hint ─────────────────────────────────────────────
  // Get hint for current test question
  ipcMain.handle('test:hint', async (_event, { studentId = 'default' }) => {
    try {
      const result = await coordinator.chat({ message: 'hint', studentId });
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC test:hint]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── test:results ──────────────────────────────────────────
  // Get current test results
  ipcMain.handle('test:results', async (_event, { studentId = 'default' }) => {
    try {
      const result = await coordinator.chat({ message: 'results', studentId });
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC test:results]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── test:remediate ────────────────────────────────────────
  // Start remediation for a topic
  ipcMain.handle('test:remediate', async (_event, { topic, studentId = 'default' }) => {
    try {
      const result = await coordinator.chat({ message: `remediate ${topic}`, studentId });
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC test:remediate]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── test:history ──────────────────────────────────────────
  // Get test history for a student
  ipcMain.handle('test:history', async (_event, { studentId = 'default', limit = 10 }) => {
    try {
      // This would need to be implemented in the test-led model
      // For now, return empty array
      return { success: true, history: [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ============================================================
  // Auto-advance IPC Handler
  // ============================================================

  // ── lesson:advance ────────────────────────────────────────
  // Advance to the next section of a lesson automatically.
  // Reuses the full chat:stream pipeline so the next section
  // is properly streamed to the renderer.
  ipcMain.handle('lesson:advance', async (event, { studentId = 'default' }) => {
    try {
      console.log('[IPC][DEBUG] ===== LESSON ADVANCE STARTED =====');
      console.log('[IPC][DEBUG] studentId:', studentId);

      const result = await coordinator.chat({ message: '__AUTO_ADVANCE__', studentId });
      console.log('[IPC][DEBUG] lesson:advance coordinator result:', {
        hasResponse: !!result.response,
        responseLength: result.response?.length || 0,
        teachingPhase: result.teachingPhase,
        autoAdvance: result.autoAdvance,
        canResume: result.canResume,
        delay: result.delay
      });

      const sender = event.sender;
      _streamSender = sender;
      _streamStop   = false;

      // Send stream:start with full metadata including canResume
      const startEventData = {
        skillUsed:        result.skillUsed,
        syllabusPoint:    result.syllabusPoint,
        visualization:    result.visualization,
        adjustmentsApplied: result.adjustmentsApplied || [],
        teachingModel:    result.teachingModel,
        teachingPhase:    result.teachingPhase,
        teachingSubPhase: result.teachingSubPhase,
        teachingProgress: result.teachingProgress,

        question:         result.question,

        // Test mode fields
        type:             result.type,
        testType:         result.testType || null,
        questionIndex:    result.questionIndex ?? null,
        totalQuestions:   result.totalQuestions ?? null,
        score:            result.score || null,
        diagnosis:        result.diagnosis || null,
        results:          result.results || null,
        suggestions:      result.suggestions || null,
        // Auto-advance fields
        autoAdvance:      result.autoAdvance || false,
        delay:            result.delay || 0,
        proactive:        result.proactive === true,
        canResume:        result.canResume === true,
        phase:            result.teachingPhase,
        subPhase:         result.teachingSubPhase,
        topic:            result.topic,
        currentStep:      result.currentStep,
        totalSteps:       result.totalSteps,
        stepName:         result.stepName,
        messageId:        result.messageId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };

      console.log('[IPC] startEventData.type:', result.type);
      console.log('[IPC] Full startEventData:', JSON.stringify(startEventData, null, 2));

      sender.send('chat:stream:start', startEventData);

      // Stream response chunk-by-chunk
      const fullText = result.response || result.message || '';
      const chunks = fullText.match(/\S+\s*/g) || [];

      if (chunks.length === 0 && fullText) {
        if (!sender.isDestroyed() && !_streamStop) {
          sender.send('chat:stream:chunk', { token: fullText, messageId: result.messageId });
        }
      } else {
        for (let i = 0; i < chunks.length; i++) {
          if (sender.isDestroyed() || _streamStop) break;
          sender.send('chat:stream:chunk', { token: chunks[i], messageId: result.messageId });
          await new Promise(r => setTimeout(r, 20));
        }
      }

      // Send stream:end with canResume
      if (!sender.isDestroyed() && !_streamStop) {
        sender.send('chat:stream:end', {
          fullText: fullText || '',
          error: null,
          autoAdvance: result.autoAdvance || false,
          autoAdvanceDelay: result.delay || 4000,
          messageId: result.messageId || null,
          proactiveComplete: result.proactiveComplete || false,
          teachingPhase: result.teachingPhase,
          teachingSubPhase: result.teachingSubPhase,
          teachingProgress: result.teachingProgress,
          canResume: result.canResume === true,
        });
      }

      _streamSender = null;
      console.log('[IPC][DEBUG] ===== LESSON ADVANCE COMPLETED =====');
      return { success: true };

    } catch (err) {
      console.error('[IPC lesson:advance]', err.message);
      try {
        event.sender.send('chat:stream:end', {
          fullText: '', error: err.message,
          autoAdvance: false, autoAdvanceDelay: 4000,
          messageId: null, proactiveComplete: false,
          teachingPhase: null, teachingSubPhase: null,
          teachingProgress: 0, canResume: false,
        });
      } catch (_) {}
      return { success: false, error: err.message };
    }
  });

  // ============================================================
  // Knowledge Base Generator handlers (v5.0)
  // ============================================================

  let kbGenerator = null;
  try {
    const KBGeneratorService = require(path.join(__dirname, '../services', 'kb-generator.js'));
    const kbRoot = coordinator.kbManager?.kbRoot || managers.kbRoot;
    kbGenerator = new KBGeneratorService(kbRoot, model);
    console.log('[IPC] KB Generator service initialised');
  } catch (err) {
    console.warn('[IPC] KB Generator service failed to load:', err.message);
  }

  // kb:check — check if subject already exists (instant, no model call)
  // ── code:save-files ───────────────────────────────────────
  // Receives an array of { filename, code } objects, prompts the user
  // to choose a save folder via the native OS dialog, then writes
  // each file to that folder.
  ipcMain.handle('code:save-files', async (event, { files }) => {
    try {
      const { dialog, BrowserWindow } = require('electron');
      const fs   = require('fs');
      const path = require('path');

      const win = BrowserWindow.fromWebContents(event.sender);

      const result = await dialog.showOpenDialog(win, {
        title:       'Choose folder to save code files',
        properties:  ['openDirectory', 'createDirectory'],
        buttonLabel: 'Save here',
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }

      const folder = result.filePaths[0];
      const saved  = [];

      for (const { filename, code } of files) {
        const filePath = path.join(folder, filename);
        fs.writeFileSync(filePath, code, 'utf8');
        saved.push(filePath);
      }

      console.log(`[IPC code:save-files] Saved ${saved.length} file(s) to ${folder}`);
      return { success: true, folder, saved };
    } catch (err) {
      console.error('[IPC code:save-files]', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('kb:check', async (_event, { subjectName }) => {
    if (!kbGenerator) return { success: false, error: 'KB Generator not available' };
    try {
      const result = kbGenerator.checkExists(subjectName);
      console.log(`[IPC kb:check] subject="${subjectName}" exists=${result.exists} id=${result.subjectId}`);
      return { success: true, ...result };
    } catch (err) {
      console.error('[IPC kb:check]', err.message);
      return { success: false, error: err.message };
    }
  });

  // kb:generate — run the full generation pipeline via ModelManager
  ipcMain.handle('kb:generate', async (event, { subjectName }) => {
    if (!kbGenerator) return { success: false, error: 'KB Generator not available' };
    console.log(`[IPC kb:generate] Starting generation for "${subjectName}" using active model`);

    const { exists, subjectId } = kbGenerator.checkExists(subjectName);
    if (exists) {
      return {
        success:   false,
        error:     `Subject "${subjectName}" already exists in the knowledge base. Skipping.`,
        exists:    true,
        subjectId,
      };
    }

    try {
      const { BrowserWindow } = require('electron');
      const onProgress = (progress) => {
        // Send progress to the window that made the request
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
          win.webContents.send('kb:progress', progress);
        }
      };

      const result = await kbGenerator.generate(subjectName, onProgress);
      console.log(`[IPC kb:generate] Generation complete for "${subjectName}"`);
      return { success: true, ...result };

    } catch (err) {
      console.error(`[IPC kb:generate] Failed for "${subjectName}":`, err.message);
      return { success: false, error: err.message };
    }
  });

  // kb:approve — write reviewed files to disk
  ipcMain.handle('kb:approve', async (_event, { subjectId, files }) => {
    if (!kbGenerator) return { success: false, error: 'KB Generator not available' };
    console.log(`[IPC kb:approve] Saving knowledge base for "${subjectId}"`);
    try {
      const result = kbGenerator.approveAndSave(subjectId, files);
      if (result.success) console.log(`[IPC kb:approve] Saved to: ${result.path}`);
      return result;
    } catch (err) {
      console.error('[IPC kb:approve]', err.message);
      return { success: false, error: err.message };
    }
  });

  // kb:cancel — no-op placeholder
  ipcMain.handle('kb:cancel', async (_event, { subjectId }) => {
    console.log(`[IPC kb:cancel] Cancel requested for "${subjectId}"`);
    return { success: true };
  });

  // ============================================================
  // META-LEARNING IPC HANDLERS (v6.0)
  // ============================================================

  // meta:stats — Get meta-learning statistics
  ipcMain.handle('meta:stats', async (_event, { studentId = 'default' }) => {
    try {
      // Check if meta-learning is enabled
      if (!memory.enableMetaLearning) {
        return { success: true, stats: { enabled: false } };
      }

      const stats = await memory.getMetaLearningStats(studentId);
      return { success: true, stats };
    } catch (err) {
      console.error('[IPC meta:stats]', err.message);
      return { success: false, error: err.message };
    }
  });

  // meta:strategies — Get list of evolved strategies
  ipcMain.handle('meta:strategies', async () => {
    try {
      const evolutionPath = path.join(memory.dataRoot, 'meta', 'evolved-strategies.json');
      let strategies = [];

      if (fs.existsSync(evolutionPath)) {
        strategies = JSON.parse(fs.readFileSync(evolutionPath, 'utf8'));
      }

      return { success: true, strategies };
    } catch (err) {
      console.error('[IPC meta:strategies]', err.message);
      return { success: false, error: err.message };
    }
  });

  // meta:opportunities — Get learning opportunities for a student
  ipcMain.handle('meta:opportunities', async (_event, { studentId = 'default' }) => {
    try {
      const oppPath = path.join(memory.dataRoot, 'meta', `${studentId}-opportunities.json`);
      let opportunities = [];

      if (fs.existsSync(oppPath)) {
        opportunities = JSON.parse(fs.readFileSync(oppPath, 'utf8'));
      }

      return { success: true, opportunities };
    } catch (err) {
      console.error('[IPC meta:opportunities]', err.message);
      return { success: false, error: err.message };
    }
  });

  // meta:evolutions — Get evolution history
  ipcMain.handle('meta:evolutions', async () => {
    try {
      const evoPath = path.join(memory.dataRoot, 'meta', 'evolutions.json');
      let evolutions = [];

      if (fs.existsSync(evoPath)) {
        evolutions = JSON.parse(fs.readFileSync(evoPath, 'utf8'));
      }

      return { success: true, evolutions };
    } catch (err) {
      console.error('[IPC meta:evolutions]', err.message);
      return { success: false, error: err.message };
    }
  });

  // meta:evolve — Manually trigger evolution (admin only)
  ipcMain.handle('meta:evolve', async (_event, { studentId = 'default' }) => {
    try {
      // Import evolution components
      const MetaLearningDB = require('./memory/meta-learning-db');
      const StrategyEvolution = require('./memory/strategy-evolution');

      const metaDB = new MetaLearningDB({
        dataRoot: path.join(memory.dataRoot, 'meta'),
        logger: console
      });

      const evolution = new StrategyEvolution({
        metaDB,
        modelManager: model,
        skillsRoot: path.join(process.cwd(), 'src', 'skills'),
        logger: console
      });

      const context = {
        studentId,
        recentTopics: await _getRecentTopics(studentId),
        recentSkills: await _getRecentSkills(studentId)
      };

      // Run evolution in background (don't await - let it run async)
      setImmediate(async () => {
        try {
          const result = await evolution.evolveStrategies(context);
          console.log('[IPC meta:evolve] Evolution completed:', result);

          // Notify frontend if needed
          const windows = require('electron').BrowserWindow.getAllWindows();
          for (const win of windows) {
            win.webContents.send('meta:evolution:complete', result);
          }
        } catch (err) {
          console.error('[IPC meta:evolve] Background evolution failed:', err);
        }
      });

      return { success: true, message: 'Evolution started in background' };

    } catch (err) {
      console.error('[IPC meta:evolve]', err.message);
      return { success: false, error: err.message };
    }
  });

  // Helper functions for meta:evolve
  async function _getRecentTopics(studentId) {
    try {
      const progress = memory.getProgress(studentId);
      const recentSessions = progress.sessions?.slice(-5) || [];
      const topics = new Set();

      for (const session of recentSessions) {
        for (const attempt of session.attempts || []) {
          if (attempt.dotPoint) {
            topics.add(attempt.dotPoint.split('.')[0]); // Get topic code
          }
        }
      }

      return Array.from(topics).slice(0, 10);
    } catch (err) {
      return [];
    }
  }

  async function _getRecentSkills(studentId) {
    try {
      const progress = memory.getProgress(studentId);
      const recentSessions = progress.sessions?.slice(-5) || [];
      const skills = new Set();

      for (const session of recentSessions) {
        for (const attempt of session.attempts || []) {
          if (attempt.skillUsed) {
            skills.add(attempt.skillUsed);
          }
        }
      }

      return Array.from(skills);
    } catch (err) {
      return [];
    }
  }

  // meta:strategy-details — Get details of a specific evolved strategy
  ipcMain.handle('meta:strategy-details', async (_event, { strategyName }) => {
    try {
      const strategyPath = path.join(process.cwd(), 'src', 'skills', `evolved-${strategyName}`, 'SKILL.md');

      if (!fs.existsSync(strategyPath)) {
        return { success: false, error: 'Strategy not found' };
      }

      const content = fs.readFileSync(strategyPath, 'utf8');

      // Parse basic info from SKILL.md
      const nameMatch = content.match(/\*\*Name\*\*:\s*(.+)/);
      const descMatch = content.match(/## Description\s*\n+(.+)/);

      return {
        success: true,
        strategy: {
          name: nameMatch ? nameMatch[1].trim() : strategyName,
          description: descMatch ? descMatch[1].trim() : '',
          markdown: content
        }
      };
    } catch (err) {
      console.error('[IPC meta:strategy-details]', err.message);
      return { success: false, error: err.message };
    }
  });

  // meta:student-patterns — Get learning patterns for a student
  ipcMain.handle('meta:student-patterns', async (_event, { studentId = 'default' }) => {
    try {
      const patternsPath = path.join(memory.dataRoot, 'meta', `${studentId}-patterns.json`);

      if (!fs.existsSync(patternsPath)) {
        return { success: true, patterns: null };
      }

      const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
      return { success: true, patterns };
    } catch (err) {
      console.error('[IPC meta:student-patterns]', err.message);
      return { success: false, error: err.message };
    }
  });

  // meta:effectiveness — Get strategy effectiveness metrics
  ipcMain.handle('meta:effectiveness', async (_event, { strategyType, topic }) => {
    try {
      const metaPath = path.join(memory.dataRoot, 'meta', 'effectiveness.json');

      if (!fs.existsSync(metaPath)) {
        return { success: true, effectiveness: null };
      }

      const allEffectiveness = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const key = `${strategyType}:${topic || 'general'}`;

      return {
        success: true,
        effectiveness: allEffectiveness[key] || null
      };
    } catch (err) {
      console.error('[IPC meta:effectiveness]', err.message);
      return { success: false, error: err.message };
    }
  });

  console.log('[IPC] All handlers registered (including teaching modes, auto-advance, KB generator, meta-learning, and test modes).');
}

module.exports = { createCoordinator, registerIpcHandlers };