/**
 * Renderer IPC Module
 * Maps all ipc.invoke(channel, args) calls from renderer components
 * to the named methods on window.api, which is exposed by preload.js
 * via contextBridge.exposeInMainWorld('api', { ... }).
 *
 * MODIFIED: Added teaching mode IPC methods (v4.0)
 * MODIFIED: Added knowledge base generator IPC methods (v5.0)
 * MODIFIED: Added meta-learning IPC methods (v6.0)
 * MODIFIED: Added test mode IPC methods (v6.5)
 *
 * FIXED: Added proper streaming support for chat:stream with event listeners
 * FIXED: Added lesson:advance channel for auto-advance functionality
 * FIXED: Fixed error handling in chat:stream promise to safely handle undefined data
 * FIXED: Added optional chaining and null checks for error properties
 * FIXED: Added detailed logging for stream events to debug "Stream ended with no data" error
 */

'use strict';

/**
 * Get the window.api object exposed by preload.js
 * @returns {Object} The API object
 * @throws {Error} If window.api is not defined
 */
function getApi() {
  if (!window.api) {
    throw new Error(
      '[IPC] window.api is not defined. ' +
      'Check that preload.js is set in BrowserWindow webPreferences.preload ' +
      'and that contextIsolation is true.'
    );
  }
  return window.api;
}

/**
 * IPC wrapper object
 * Provides invoke, on, off, and onOnce methods for all IPC communication
 */
const ipc = {
  /**
   * Invoke an IPC channel with arguments
   * @param {string} channel - The IPC channel to invoke
   * @param {Object} args - Arguments to pass
   * @returns {Promise<any>} Result from main process
   */
  invoke: (channel, args = {}) => {
    const api = getApi();

    switch (channel) {
      // ─────────────────────────────────────────────────────
      // CHAT & MESSAGING
      // ─────────────────────────────────────────────────────

      case 'chat:send':
        return api.sendMessage(args.message, args.studentId);

      case 'chat:stream':
        // For chat:stream, we need to return a promise that resolves when the stream completes
        // But also set up event listeners for streaming chunks
        return new Promise((resolve, reject) => {
          console.log('[IPC] Setting up chat:stream promise for message:', args.message?.substring(0, 50));

          // Set up one-time listeners for stream end or error
          const onEnd = (event, data) => {
            console.log('[IPC] chat:stream:end received in promise:', {
              hasData: !!data,
              dataType: typeof data,
              dataKeys: data ? Object.keys(data) : [],
              hasError: data?.error,
              hasFullText: data?.fullText ? true : false,
              fullTextLength: data?.fullText?.length || 0
            });

            cleanup();

            // data can be undefined/null when useStreamHandler's persistent listener
            // already consumed the event — that's normal, not an error. Resolve silently.
            if (data === undefined || data === null) {
              resolve({ success: true });
            } else if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve({ success: true, ...data });
            }
          };

          const onError = (event, data) => {
            console.log('[IPC] chat:stream:error received:', data);
            cleanup();
            const errorMessage = data?.error || data?.message || 'Stream error';
            reject(new Error(errorMessage));
          };

          const cleanup = () => {
            try {
              api.off('chat:stream:end', onEnd);
              api.off('chat:stream:error', onError);
            } catch (err) {
              console.warn('[IPC] Error during cleanup:', err);
            }
          };

          // Listen for stream end
          api.on('chat:stream:end', onEnd);
          api.on('chat:stream:error', onError);

          // Call the stream API
          api.streamMessage(args.message, args.studentId, args.isSystem)
            .catch(err => {
              console.error('[IPC] streamMessage failed:', err);
              cleanup();
              reject(err);
            });
        });

      case 'chat:stop':
        return api.stopStream();

      case 'chat:end-session':
        return api.endSession(args.studentId);

      case 'chat:session-state':
        return api.getSessionState(args.studentId);

      case 'chat:follow-ups':
        return api.getFollowUps(args.responseText, args.studentId, args.activeSubject);

      case 'chat:history':
        return api.getChatHistory ?
          api.getChatHistory(args.studentId, args.limit) :
          Promise.resolve([]);

      case 'chat:clear':
        return api.clearChat ?
          api.clearChat(args.studentId) :
          Promise.resolve({ success: true });

      // ─────────────────────────────────────────────────────
      // SUBJECT MANAGEMENT
      // ─────────────────────────────────────────────────────

      case 'subject:switch':
        return api.switchSubject(args.subjectId);

      case 'subject:info':
        return api.getSubjectInfo();

      case 'subject:list':
        return api.getSubjectList ?
          api.getSubjectList() :
          api.invoke('subject:list', args);

      case 'subject:suggestions':
        return api.getSubjectSuggestions ?
          api.getSubjectSuggestions(args.subjectId) :
          api.invoke('subject:suggestions', { subjectId: args.subjectId });

      case 'subject:details':
        return api.getSubjectDetails ?
          api.getSubjectDetails(args.subjectId) :
          api.invoke('subject:details', { subjectId: args.subjectId });

      // ─────────────────────────────────────────────────────
      // MODEL MANAGEMENT
      // ─────────────────────────────────────────────────────

      case 'models:list':
        return api.listModels();

      case 'models:test':
        return api.testModel(args.modelId, args.apiKey);

      case 'models:switch':
        return api.switchModel(args.modelId);

      case 'models:set-api-key':
        return api.setApiKey(args.adapterType, args.apiKey);

      case 'models:get-config':
        return api.getModelConfig ?
          api.getModelConfig() :
          api.invoke('models:get-config');

      case 'models:save-config':
        return api.saveModelConfig ?
          api.saveModelConfig(args.config) :
          api.invoke('models:save-config', { config: args.config });

      // ─────────────────────────────────────────────────────
      // CONFIGURATION
      // ─────────────────────────────────────────────────────

      case 'config:get':
        return api.getConfig();

      case 'config:save':
        return api.saveConfig(args.config);

      case 'config:reset':
        return api.resetConfig ?
          api.resetConfig() :
          api.invoke('config:reset');

      // ─────────────────────────────────────────────────────
      // STATISTICS & PROGRESS
      // ─────────────────────────────────────────────────────

      case 'stats:get':
        return api.getStats();

      case 'stats:session':
        return api.getSessionStats ?
          api.getSessionStats(args.studentId) :
          api.invoke('stats:session', { studentId: args.studentId });

      case 'progress:get':
        return api.getProgress(args.studentId);

      case 'syllabus:mastery':
        return api.getSyllabusMastery(args.studentId);

      case 'syllabus:topics':
        return api.getSyllabusTopics();

      case 'syllabus:dotpoints':
        return api.getSyllabusDotPoints ?
          api.getSyllabusDotPoints(args.topicCode) :
          api.invoke('syllabus:dotpoints', { topicCode: args.topicCode });

      // ─────────────────────────────────────────────────────
      // STUDENT MODEL
      // ─────────────────────────────────────────────────────

      case 'student:model':
        return api.getStudentModel(args.studentId);

      case 'student:profile:save':
        return api.saveStudentProfile(args.studentId, args.profile);

      case 'student:profile:get':
        return api.getStudentProfile ?
          api.getStudentProfile(args.studentId) :
          api.invoke('student:profile:get', { studentId: args.studentId });

      case 'student:mistakes':
        return api.getStudentMistakes ?
          api.getStudentMistakes(args.studentId, args.dotPoint) :
          api.invoke('student:mistakes', { studentId: args.studentId, dotPoint: args.dotPoint });

      // ─────────────────────────────────────────────────────
      // EXAM READINESS
      // ─────────────────────────────────────────────────────

      case 'readiness:forecast':
        return api.getReadinessForecast(args.studentId);

      case 'readiness:topics':
        return api.getReadinessTopics ?
          api.getReadinessTopics(args.studentId) :
          api.invoke('readiness:topics', { studentId: args.studentId });

      case 'readiness:critical':
        return api.getCriticalTopics ?
          api.getCriticalTopics(args.studentId) :
          api.invoke('readiness:critical', { studentId: args.studentId });

      // ─────────────────────────────────────────────────────
      // PAST PAPERS
      // ─────────────────────────────────────────────────────

      case 'pastpaper:list':
        return api.listPastPapers(args.topic, args.year);

      case 'pastpaper:submit':
        return api.submitPastPaper(args.questionId, args.studentAnswer, args.studentId);

      case 'pastpaper:get':
        return api.getPastPaper ?
          api.getPastPaper(args.paperId) :
          api.invoke('pastpaper:get', { paperId: args.paperId });

      case 'pastpaper:mark':
        return api.markPastPaper ?
          api.markPastPaper(args.questionId, args.studentAnswer) :
          api.invoke('pastpaper:mark', { questionId: args.questionId, studentAnswer: args.studentAnswer });

      // ─────────────────────────────────────────────────────
      // TEACHING MODES
      // ─────────────────────────────────────────────────────

      case 'teaching:setModel':
        return api.setTeachingModel(args.modelId, args.studentId);

      case 'teaching:getCurrent':
        return api.getCurrentTeachingModel(args.studentId);

      case 'teaching:getAvailable':
        return api.getAvailableTeachingModels();

      case 'teaching:saveConfig':
        return api.saveTeachingModelConfig(args.modelId, args.config);

      case 'teaching:getConfig':
        return api.getTeachingModelConfig ?
          api.getTeachingModelConfig(args.modelId) :
          api.invoke('teaching:getConfig', { modelId: args.modelId });

      case 'teacher:resumeLesson':
        return api.resumeLesson(args.studentId);

      case 'teacher:getHomework':
        return api.getHomework(args.studentId);

      case 'teacher:lessonState':
        return api.getLessonState ?
          api.getLessonState(args.studentId) :
          api.invoke('teacher:lessonState', { studentId: args.studentId });

      // ─────────────────────────────────────────────────────
      // TEST MODE (v6.5) - NEW
      // ─────────────────────────────────────────────────────

      case 'test:start':
        return api.startTest ?
          api.startTest(args.testType, args.topic, args.studentId) :
          api.invoke('test:start', {
            testType: args.testType,
            topic: args.topic,
            studentId: args.studentId
          });

      case 'test:submit':
        return api.submitTestAnswer(args.answer, args.questionId, args.studentId);
//        return api.submitTestAnswer ?
//          api.submitTestAnswer(args.answer, args.questionId, args.studentId) :
//          api.invoke('test:submit', {
//            answer: args.answer,
//            questionId: args.questionId,
//            studentId: args.studentId
//          });

      case 'test:skip':
        return api.skipTestQuestion ?
          api.skipTestQuestion(args.studentId) :
          api.invoke('test:skip', { studentId: args.studentId });

      case 'test:hint':
        return api.getTestHint ?
          api.getTestHint(args.studentId) :
          api.invoke('test:hint', { studentId: args.studentId });

      case 'test:results':
        return api.getTestResults ?
          api.getTestResults(args.studentId) :
          api.invoke('test:results', { studentId: args.studentId });

      case 'test:remediate':
        return api.startTestRemediation ?
          api.startTestRemediation(args.topic, args.studentId) :
          api.invoke('test:remediate', {
            topic: args.topic,
            studentId: args.studentId
          });

      case 'test:history':
        return api.getTestHistory ?
          api.getTestHistory(args.studentId, args.limit) :
          api.invoke('test:history', {
            studentId: args.studentId,
            limit: args.limit
          });

      // ─────────────────────────────────────────────────────
      // LESSON MANAGEMENT
      // ─────────────────────────────────────────────────────

      case 'lesson:advance':
        return api.advanceLesson(args.studentId);

      case 'lesson:start':
        return api.startLesson ?
          api.startLesson(args.topic, args.studentId) :
          api.invoke('lesson:start', { topic: args.topic, studentId: args.studentId });

      case 'lesson:end':
        return api.endLesson ?
          api.endLesson(args.studentId) :
          api.invoke('lesson:end', { studentId: args.studentId });

      // ─────────────────────────────────────────────────────
      // KNOWLEDGE BASE GENERATOR (v5.0)
      // ─────────────────────────────────────────────────────

      case 'kb:check':
        return api.kbCheck(args.subjectName);

      case 'kb:generate':
        return api.kbGenerate(args.subjectName);

      case 'kb:approve':
        return api.kbApprove(args.subjectId, args.files);

      case 'kb:cancel':
        return api.kbCancel(args.subjectId);

      case 'kb:progress':
        // This is handled via events, not invoke
        return Promise.reject(new Error('kb:progress is an event channel, use ipc.on() instead'));

      case 'kb:list':
        return api.kbList ?
          api.kbList() :
          api.invoke('kb:list');

      case 'kb:delete':
        return api.kbDelete ?
          api.kbDelete(args.subjectId) :
          api.invoke('kb:delete', { subjectId: args.subjectId });

      // ─────────────────────────────────────────────────────
      // META-LEARNING (v6.0)
      // ─────────────────────────────────────────────────────

      case 'meta:stats':
        return api.getMetaStats ?
          api.getMetaStats(args.studentId) :
          api.invoke('meta:stats', { studentId: args.studentId });

      case 'meta:strategies':
        return api.getEvolvedStrategies ?
          api.getEvolvedStrategies() :
          api.invoke('meta:strategies');

      case 'meta:opportunities':
        return api.getLearningOpportunities ?
          api.getLearningOpportunities(args.studentId) :
          api.invoke('meta:opportunities', { studentId: args.studentId });

      case 'meta:evolutions':
        return api.getEvolutionHistory ?
          api.getEvolutionHistory() :
          api.invoke('meta:evolutions');

      case 'meta:evolve':
        return api.triggerEvolution ?
          api.triggerEvolution(args.studentId) :
          api.invoke('meta:evolve', { studentId: args.studentId });

      case 'meta:strategy-details':
        return api.getStrategyDetails ?
          api.getStrategyDetails(args.strategyName) :
          api.invoke('meta:strategy-details', { strategyName: args.strategyName });

      case 'meta:student-patterns':
        return api.getStudentPatterns ?
          api.getStudentPatterns(args.studentId) :
          api.invoke('meta:student-patterns', { studentId: args.studentId });

      case 'meta:effectiveness':
        return api.getStrategyEffectiveness ?
          api.getStrategyEffectiveness(args.strategyType, args.topic) :
          api.invoke('meta:effectiveness', {
            strategyType: args.strategyType,
            topic: args.topic
          });

      // ─────────────────────────────────────────────────────
      // TOOLS & UTILITIES
      // ─────────────────────────────────────────────────────

      case 'devtools:toggle':
        return api.toggleDevTools();

      case 'export:response':
        return api.exportResponse(args.content, args.format, args.filename);

      case 'tools:md-to-html':
        return api.invoke
          ? api.invoke('tools:md-to-html', {})
          : Promise.reject(new Error('tools:md-to-html not available'));

      case 'tools:render-markdown':
        return api.invoke
          ? api.invoke('tools:render-markdown', args)
          : Promise.reject(new Error('tools:render-markdown not available'));

      case 'tools:read-file':
        return api.invoke
          ? api.invoke('tools:read-file', args)
          : Promise.reject(new Error('tools:read-file not available'));

      case 'tools:pdf-to-md':
        return api.invoke
          ? api.invoke('tools:pdf-to-md', {})
          : Promise.reject(new Error('tools:pdf-to-md not available'));

      case 'export:session':
        return api.exportSession ?
          api.exportSession(args.studentId, args.format) :
          api.invoke('export:session', { studentId: args.studentId, format: args.format });

      case 'app:version':
        return api.getAppVersion ?
          api.getAppVersion() :
          Promise.resolve('unknown');

      case 'app:restart':
        return api.restartApp ?
          api.restartApp() :
          Promise.reject(new Error('App restart not available'));

      case 'app:info':
        return api.getAppInfo ?
          api.getAppInfo() :
          api.invoke('app:info');

      case 'log:get':
        return api.getLogs ?
          api.getLogs(args.level, args.limit) :
          api.invoke('log:get', { level: args.level, limit: args.limit });

      // ── Code extraction ──────────────────────────────────
      case 'code:save-files':
        return api.invoke('code:save-files', args);

      default:
        console.warn(`[IPC] Unknown channel: "${channel}"`);
        return Promise.reject(new Error(`[IPC] Unknown channel: "${channel}"`));
    }
  },

  // ─────────────────────────────────────────────────────
  // EVENT LISTENERS (for streaming push events from main)
  // ─────────────────────────────────────────────────────

  /**
   * Register a persistent event listener
   * @param {string} channel - Event channel to listen to
   * @param {Function} callback - Callback function (receives event and data)
   * @returns {Function} Unsubscribe function
   */
  on: (channel, callback) => {
    if (window.api?.on) {
      return window.api.on(channel, callback);
    } else {
      console.warn('[IPC] window.api.on not available — preload may need updating');
      return () => {};
    }
  },

  /**
   * Remove an event listener
   * @param {string} channel - Event channel
   * @param {Function} callback - Callback to remove
   */
  off: (channel, callback) => {
    if (window.api?.off) {
      window.api.off(channel, callback);
    }
  },

  /**
   * Register a one-time event listener
   * @param {string} channel - Event channel
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  once: (channel, callback) => {
    if (window.api?.once) {
      return window.api.once(channel, callback);
    } else {
      // Fallback to manual once implementation
      const wrapper = (event, data) => {
        callback(event, data);
        ipc.off(channel, wrapper);
      };
      return ipc.on(channel, wrapper);
    }
  },

  /**
   * Register a persistent listener exactly once per channel
   * (uses module-level tracking to avoid duplicate registrations)
   */
  onOnce: (() => {
    const registered = new Set();
    const wrappers = {};

    return (channel, callback) => {
      wrappers[channel] = callback;

      if (!registered.has(channel)) {
        registered.add(channel);
        if (window.api?.on) {
          window.api.on(channel, (_event, data) => {
            if (wrappers[channel]) {
              try {
                wrappers[channel](data || {});
              } catch (err) {
                console.error(`[IPC] Error in onOnce callback for ${channel}:`, err);
              }
            }
          });
        } else {
          console.warn('[IPC] window.api.on not available — preload may need updating');
        }
      }
    };
  })(),

  // ─────────────────────────────────────────────────────
  // CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────

  /**
   * Send a message (non-streaming)
   */
  sendMessage: (message, studentId = 'default') => {
    return ipc.invoke('chat:send', { message, studentId });
  },

  /**
   * Stream a message
   */
  streamMessage: (message, studentId = 'default', isSystem = false) => {
    return ipc.invoke('chat:stream', { message, studentId, isSystem });
  },

  /**
   * Stop current stream
   */
  stopStream: () => {
    return ipc.invoke('chat:stop');
  },

  /**
   * Get available teaching models
   */
  getTeachingModels: () => {
    return ipc.invoke('teaching:getAvailable');
  },

  /**
   * Set teaching model
   */
  setTeachingModel: (modelId, studentId = 'default') => {
    return ipc.invoke('teaching:setModel', { modelId, studentId });
  },

  /**
   * Get current teaching model
   */
  getCurrentTeachingModel: (studentId = 'default') => {
    return ipc.invoke('teaching:getCurrent', { studentId });
  },

  /**
   * Resume lesson (Teacher-Led mode)
   */
  resumeLesson: (studentId = 'default') => {
    return ipc.invoke('teacher:resumeLesson', { studentId });
  },

  /**
   * Advance lesson
   */
  advanceLesson: (studentId = 'default') => {
    return ipc.invoke('lesson:advance', { studentId });
  },

  // ─────────────────────────────────────────────────────
  // TEST MODE CONVENIENCE METHODS (v6.5) - NEW
  // ─────────────────────────────────────────────────────

  /**
   * Start a test
   * @param {string} testType - 'diagnostic' | 'topic' | 'mixed' | 'mastery'
   * @param {string} topic - Optional topic for topic test
   * @param {string} studentId - Student ID
   */
  startTest: (testType, topic = null, studentId = 'default') => {
    return ipc.invoke('test:start', { testType, topic, studentId });
  },

  /**
   * Submit a test answer
   * @param {string} answer - Student's answer
   * @param {string} questionId - Question ID (optional)
   * @param {string} studentId - Student ID
   */
  submitTestAnswer: (answer, questionId = null, studentId = 'default') => {
    return ipc.invoke('test:submit', { answer, questionId, studentId });
  },

  /**
   * Skip current test question
   */
  skipTestQuestion: (studentId = 'default') => {
    return ipc.invoke('test:skip', { studentId });
  },

  /**
   * Get hint for current test question
   */
  getTestHint: (studentId = 'default') => {
    return ipc.invoke('test:hint', { studentId });
  },

  /**
   * Get test results
   */
  getTestResults: (studentId = 'default') => {
    return ipc.invoke('test:results', { studentId });
  },

  /**
   * Start remediation for a topic
   * @param {string} topic - Topic to remediate
   */
  startTestRemediation: (topic, studentId = 'default') => {
    return ipc.invoke('test:remediate', { topic, studentId });
  },

  /**
   * Get test history
   * @param {number} limit - Maximum number of tests to return
   */
  getTestHistory: (limit = 10, studentId = 'default') => {
    return ipc.invoke('test:history', { studentId, limit });
  },

  // ─────────────────────────────────────────────────────
  // KNOWLEDGE BASE GENERATOR CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────

  /**
   * Check if subject exists
   */
  checkSubjectExists: (subjectName) => {
    return ipc.invoke('kb:check', { subjectName });
  },

  /**
   * Generate knowledge base
   */
  generateKnowledgeBase: (subjectName) => {
    return ipc.invoke('kb:generate', { subjectName });
  },

  /**
   * Approve and save generated knowledge base
   */
  approveKnowledgeBase: (subjectId, files) => {
    return ipc.invoke('kb:approve', { subjectId, files });
  },

  /**
   * Cancel knowledge base generation
   */
  cancelKnowledgeBase: (subjectId) => {
    return ipc.invoke('kb:cancel', { subjectId });
  },

  /**
   * List all knowledge bases
   */
  listKnowledgeBases: () => {
    return ipc.invoke('kb:list');
  },

  /**
   * Delete knowledge base
   */
  deleteKnowledgeBase: (subjectId) => {
    return ipc.invoke('kb:delete', { subjectId });
  },

  // ─────────────────────────────────────────────────────
  // META-LEARNING CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────

  /**
   * Get meta-learning statistics
   */
  getMetaStats: (studentId = 'default') => {
    return ipc.invoke('meta:stats', { studentId });
  },

  /**
   * Get evolved strategies
   */
  getEvolvedStrategies: () => {
    return ipc.invoke('meta:strategies');
  },

  /**
   * Get learning opportunities
   */
  getLearningOpportunities: (studentId = 'default') => {
    return ipc.invoke('meta:opportunities', { studentId });
  },

  /**
   * Get evolution history
   */
  getEvolutionHistory: () => {
    return ipc.invoke('meta:evolutions');
  },

  /**
   * Trigger evolution manually
   */
  triggerEvolution: (studentId = 'default') => {
    return ipc.invoke('meta:evolve', { studentId });
  },

  /**
   * Get strategy details
   */
  getStrategyDetails: (strategyName) => {
    return ipc.invoke('meta:strategy-details', { strategyName });
  },

  /**
   * Get student learning patterns
   */
  getStudentPatterns: (studentId = 'default') => {
    return ipc.invoke('meta:student-patterns', { studentId });
  },

  /**
   * Get strategy effectiveness
   */
  getStrategyEffectiveness: (strategyType, topic) => {
    return ipc.invoke('meta:effectiveness', { strategyType, topic });
  },

  // ─────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────

  /**
   * Get available subjects
   */
  getSubjects: () => {
    return ipc.invoke('subject:list');
  },

  /**
   * Switch subject
   */
  switchSubject: (subjectId) => {
    return ipc.invoke('subject:switch', { subjectId });
  },

  /**
   * Get student model
   */
  getStudentModel: (studentId = 'default') => {
    return ipc.invoke('student:model', { studentId });
  },

  /**
   * Get syllabus mastery
   */
  getSyllabusMastery: (studentId = 'default') => {
    return ipc.invoke('syllabus:mastery', { studentId });
  },

  /**
   * Check if a specific IPC method is available
   */
  hasMethod: (methodName) => {
    const api = getApi();
    return typeof api[methodName] === 'function';
  },

  /**
   * Get API version/info
   */
  getApiInfo: () => {
    const api = getApi();
    return {
      methods: Object.keys(api).filter(key => typeof api[key] === 'function'),
      properties: Object.keys(api).filter(key => typeof api[key] !== 'function'),
      hasOn: typeof api.on === 'function',
      hasOff: typeof api.off === 'function',
      hasOnce: typeof api.once === 'function'
    };
  }
};

/**
 * Event channel constants for easier reference
 */
ipc.EVENTS = {
  // Stream events
  STREAM_START: 'chat:stream:start',
  STREAM_CHUNK: 'chat:stream:chunk',
  STREAM_END: 'chat:stream:end',
  STREAM_ERROR: 'chat:stream:error',

  // Lesson events
  LESSON_AUTO_ADVANCE: 'lesson:auto-advance',
  LESSON_PHASE_CHANGE: 'lesson:phase-change',
  LESSON_COMPLETE: 'lesson:complete',

  // Teacher events
  TEACHER_PROACTIVE: 'teacher:proactive',
  TEACHER_QUESTION: 'teacher:question',
  TEACHER_FEEDBACK: 'teacher:feedback',

  // Test events (NEW)
  TEST_START: 'test:start',
  TEST_QUESTION: 'test:question',
  TEST_ANSWER: 'test:answer',
  TEST_COMPLETE: 'test:complete',
  TEST_REMEDIATION: 'test:remediation',

  // Generation events
  KB_PROGRESS: 'kb:progress',
  KB_COMPLETE: 'kb:complete',
  KB_ERROR: 'kb:error',

  // Meta-learning events
  META_EVOLUTION_START: 'meta:evolution:start',
  META_EVOLUTION_COMPLETE: 'meta:evolution:complete',
  META_EVOLUTION_ERROR: 'meta:evolution:error',
  META_STRATEGY_CREATED: 'meta:strategy:created',
  META_OPPORTUNITY_DETECTED: 'meta:opportunity:detected',

  // System events
  MODEL_CHANGED: 'system:model-changed',
  SUBJECT_CHANGED: 'system:subject-changed',
  TEACHING_MODE_CHANGED: 'system:teaching-mode-changed',
  CONFIG_CHANGED: 'system:config-changed'
};

export default ipc;