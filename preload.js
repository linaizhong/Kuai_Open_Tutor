// preload.js
// OpenTutor v3.0 — Electron Preload Script
//
// MODIFIED: Added teaching mode channels (v4.0) - 6 new channels + 6 new methods
// ADDED: Auto-advance channel for teacher-led mode
// ADDED: Test-Led mode channels and methods (v6.5)
// ADDED: Licence activation channels (v3.1) - licence:activate + app:quit
// FIXED: Proper event data passing for stream events
// FIXED: Added error handling for undefined data
// FIXED: Enhanced defensive programming for all IPC callbacks
// FIXED: Added comprehensive data sanitization for all event types
// FIXED: Added error boundary around every callback invocation
//
// This script runs in a privileged Node.js context that sits between the
// main process and the renderer. It bridges the two safely:
//
//   Main process  ←─ ipcMain  ───────── ipcRenderer ─→  Preload  ─→  Renderer
//
// The renderer has NO direct access to Node.js or Electron internals.
// All IPC communication is routed through window.api.*, which this file
// constructs via contextBridge.exposeInMainWorld().
//
// Security model (set in main.js BrowserWindow.webPreferences):
//   contextIsolation: true   — renderer JS runs in a separate V8 context
//   nodeIntegration:  false  — no require() or __dirname in renderer
//   sandbox:          false  — preload needs Node.js (ipcRenderer, contextBridge)
//
// IPC channel allowlist:
//   Only channels listed in INVOKE_CHANNELS may be called by the renderer.
//   Any attempt to invoke an unlisted channel is rejected with an error.
//   This prevents the renderer from accidentally (or maliciously) calling
//   internal IPC channels not intended for frontend use.
//
// Channel reference (architecture spec §7.1):
//
//   CHAT
//     chat:send            — send a message, receive the tutor's personalised response
//     chat:end-session     — end the current session and clear in-memory state
//     chat:session-state   — get live session stats (attempts, accuracy, duration)
//     chat:follow-ups      — generate 3 follow-up question suggestions for a response
//
//   MODELS
//     models:list          — list all available local + cloud models
//     models:test          — test connectivity for a specific model
//     models:switch        — switch the active model
//     models:set-api-key   — save an API key for a cloud adapter
//
//   CONFIG
//     config:get           — retrieve current user configuration
//     config:save          — save updated configuration
//
//   STATISTICS
//     stats:get            — retrieve model usage statistics
//
//   PROGRESS & MASTERY
//     progress:get         — get overall student learning progress
//     syllabus:mastery     — get per-dot-point mastery scores
//     syllabus:topics      — get the HSC syllabus topic structure
//
//   STUDENT MODEL (v3.0)
//     student:model        — get full synthesised Student Model
//     student:profile:save — save updated student profile
//
//   EXAM READINESS (v3.0)
//     readiness:forecast   — get exam readiness forecast by topic
//
//   PAST PAPERS
//     pastpaper:list       — list past paper questions (optional topic/year filter)
//     pastpaper:submit     — submit an answer for marking against official criteria
//
//   SUBJECT SWITCHING
//     subject:switch       — switch the active subject and reload the knowledge base
//     subject:info         — get active subject + enrolled subjects for the title-bar dropdown
//     subject:list         — get all available subjects
//     subject:suggestions  — get subject-specific suggestions and quick actions
//
//   TEACHING MODES (v4.0)
//     teaching:setModel       — switch teaching mode (student-led / teacher-led)
//     teaching:getCurrent     — get current teaching mode info
//     teaching:getAvailable   — get all available teaching modes for Settings UI
//     teaching:saveConfig     — save teaching mode configuration
//     teacher:resumeLesson    — resume interrupted lesson (Teacher-Led mode only)
//     teacher:getHomework     — get current homework (Teacher-Led mode only)
//
//   AUTO-ADVANCE (v4.1)
//     lesson:advance          — advance to the next section of a lesson automatically
//
//   TEST-LED MODE (v6.5)
//     test:submit             — submit an answer to a test question
//     test:start              — start a test (diagnostic, topic, mixed, mastery)
//     test:skip               — skip current test question
//     test:hint               — get hint for current test question
//     test:results            — get test results
//     test:remediate          — start remediation for a topic
//     test:history            — get test history
//
//   KNOWLEDGE BASE GENERATOR (v5.0)
//     kb:check                — check if a subject already exists
//     kb:generate             — start generating a knowledge base
//     kb:approve              — approve the reviewed knowledge base
//     kb:cancel               — cancel an in-progress generation
//
//   LICENCE (v3.1)
//     licence:activate        — validate and persist a serial number
//     app:quit                — quit the application (used by activation window)

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ─────────────────────────────────────────────────────────────
// IPC channel allowlist
//
// Every channel the renderer is permitted to invoke must be
// listed here. The invoke() method below rejects any channel
// not in this set before even forwarding to ipcRenderer.
// ─────────────────────────────────────────────────────────────

const INVOKE_CHANNELS = new Set([
  // Chat
  'chat:send',
  'chat:stream',
  'chat:stop',
  'devtools:toggle',
  'export:response',
  'chat:end-session',
  'chat:session-state',
  'chat:follow-ups',

  // Models
  'models:list',
  'models:test',
  'models:switch',
  'models:set-api-key',

  // Config
  'config:get',
  'config:save',

  // Statistics
  'stats:get',

  // Progress & mastery
  'progress:get',
  'syllabus:mastery',
  'syllabus:topics',

  // Student Model (v3.0)
  'student:model',
  'student:profile:save',

  // Exam readiness (v3.0)
  'readiness:forecast',

  // Past papers
  'pastpaper:list',
  'pastpaper:submit',

  // Subject switching
  'subject:switch',
  'subject:info',
  'subject:list',
  'subject:suggestions',

  // ============================================================
  // Teaching mode channels (v4.0)
  // ============================================================
  'teaching:setModel',
  'teaching:getCurrent',
  'teaching:getAvailable',
  'teaching:saveConfig',
  'teacher:resumeLesson',
  'teacher:getHomework',

  // ============================================================
  // Auto-advance channel
  // ============================================================
  'lesson:advance',

  // ============================================================
  // Test-Led Mode channels (v6.5)
  // ============================================================
  'test:submit',
  'test:start',
  'test:skip',
  'test:hint',
  'test:results',
  'test:remediate',
  'test:history',

  // ============================================================
  // Knowledge Base Generator (v5.0)
  // ============================================================
  'kb:check',
  'kb:generate',
  'kb:approve',
  'kb:cancel',

  // ============================================================
  // Tools (v7.0)
  // ============================================================
  'tools:md-to-html',
  'tools:pdf-to-md',
  'tools:read-file',
  'tools:render-markdown',

  // ============================================================
  // Code extraction (v9.0)
  // ============================================================
  'code:save-files',

  // ============================================================
  // Licence activation (v3.1)
  // ============================================================
  'licence:activate',
  'app:quit',
]);

// ─────────────────────────────────────────────────────────────
// Context bridge — exposes window.api to the renderer
//
// Design principles:
//   • Every method is a thin wrapper — no business logic lives here
//   • Named methods (sendMessage, listModels, etc.) give the renderer
//     a clean, self-documenting interface with full JSDoc signatures
//   • The generic invoke() method is also exposed for any channel not
//     covered by a named wrapper
//   • Read-only constants (version, platform) are injected at startup
//     so the renderer doesn't need an IPC round-trip for them
// ─────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('api', {

  // ── Generic invoke ───────────────────────────────────────────
  // Validates the channel against the allowlist before forwarding.
  // Renderer can call window.api.invoke(channel, args) for any channel.

  /**
   * @param {string} channel  — must be in INVOKE_CHANNELS
   * @param {any}    args     — payload forwarded to the main-process handler
   * @returns {Promise<any>}
   */
  invoke: (channel, args) => {
    if (!INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(
        new Error(`[Preload] Blocked IPC channel: "${channel}"`)
      );
    }
    return ipcRenderer.invoke(channel, args);
  },

  // ──────────────────────────────────────────────────────────────
  // CHAT
  // ──────────────────────────────────────────────────────────────

  /**
   * Send a student message to the tutor and receive a personalised response.
   *
   * @param {string} message    — the student's raw input text
   * @param {string} studentId  — defaults to 'default'
   * @returns {Promise<{
   *   success:            boolean,
   *   response:           string,       — tutor's response (Adaptive Feedback Engine applied)
   *   skillUsed:          string,       — name of the skill that handled this turn
   *   syllabusPoint:      string|null,  — NESA dot-point code, if relevant
   *   visualization:      object|null,  — graph/diagram spec for frontend renderer
   *   marksAwarded:       number|null,  — populated by marking-guideline-feedback
   *   marksTotal:         number|null,
   *   guidanceLevel:      string|null,  — 'light'|'medium'|'heavy' from socratic-questioning
   *   nextDifficulty:     string|null,  — next drill difficulty from adaptive-drill
   *   adjustmentsApplied: string[],     — AFE adjustments applied to this response
   *   sessionAttempts:    number,       — cumulative attempts this session
   * }>}
   */
  sendMessage: (message, studentId = 'default') =>
    ipcRenderer.invoke('chat:send', { message, studentId }),

  /**
   * Invoke the streaming chat pipeline.
   * Response arrives via chat:stream:start / chat:stream:chunk / chat:stream:end events.
   * @param {string} message
   * @param {string} studentId
   * @param {boolean} isSystem - Whether this is a system message (like __START_LESSON__)
   */
  streamMessage: (message, studentId = 'default', isSystem = false) =>
    ipcRenderer.invoke('chat:stream', { message, studentId, isSystem }),

  /** Stop the active streaming response immediately. */
  stopStream: () =>
    ipcRenderer.invoke('chat:stop'),

  /** Toggle the Chromium DevTools panel open/closed. */
  toggleDevTools: () =>
    ipcRenderer.invoke('devtools:toggle'),

  /**
   * Switch the active subject (reloads knowledge base in coordinator).
   * @param {string} subjectId  e.g. "maths-advanced" | "maths-ext1"
   */
  switchSubject: (subjectId) =>
    ipcRenderer.invoke('subject:switch', { subjectId }),

  /**
   * Returns active subject + enrolled subjects for the title-bar dropdown.
   */
  getSubjectInfo: () =>
    ipcRenderer.invoke('subject:info'),

  /**
   * Returns all available subjects for UI dropdown.
   */
  getSubjectList: () =>
    ipcRenderer.invoke('subject:list'),

  /**
   * Returns subject-specific suggestions and quick actions.
   * @param {string} subjectId
   */
  getSubjectSuggestions: (subjectId) =>
    ipcRenderer.invoke('subject:suggestions', { subjectId }),

  /**
   * Export a response to the Downloads folder.
   * @param {string} content   raw markdown text
   * @param {'md'|'html'} format
   * @param {string} filename  base filename (sanitised by main)
   */
  exportResponse: (content, format, filename) =>
    ipcRenderer.invoke('export:response', { content, format, filename }),

  /**
   * End the current session and clear all in-memory session state.
   * Call this when the student clicks "End Session" or closes the chat.
   *
   * @param {string} studentId
   * @returns {Promise<{ success: boolean }>}
   */
  endSession: (studentId = 'default') =>
    ipcRenderer.invoke('chat:end-session', { studentId }),

  /**
   * Get live session statistics — useful for the progress header in the chat UI.
   *
   * @param {string} studentId
   * @returns {Promise<{
   *   success:           boolean,
   *   sessionAttempts:   number,    — total questions attempted this session
   *   sessionCorrect:    number,    — questions scored ≥ 80%
   *   currentDifficulty: string,    — current adaptive drill level
   *   sessionDurationMs: number,    — ms since session started
   *   historyLength:     number,    — number of conversation turns
   * }>}
   */
  getSessionState: (studentId = 'default') =>
    ipcRenderer.invoke('chat:session-state', { studentId }),

  /**
   * Generate 3 suggested follow-up questions after a tutor response.
   * Called automatically after each completed stream — results appear as
   * pill buttons below the latest assistant message bubble.
   *
   * @param {string} responseText   — the tutor's completed response text
   * @param {string} studentId      — defaults to 'default'
   * @param {string} activeSubject  — e.g. 'maths-advanced' (keeps questions on-topic)
   * @returns {Promise<{ followUps: string[] }>}  — array of up to 3 question strings
   */
  getFollowUps: (responseText, studentId = 'default', activeSubject = 'maths-advanced') =>
    ipcRenderer.invoke('chat:follow-ups', { responseText, studentId, activeSubject }),

  // ──────────────────────────────────────────────────────────────
  // MODELS
  // ──────────────────────────────────────────────────────────────

  /**
   * List all available local (Ollama) and cloud models.
   *
   * @returns {Promise<{
   *   success:       boolean,
   *   models: {
   *     local:        object[],   — local Ollama models
   *     cloud:        object[],   — cloud API models
   *     activeModelId: string,
   *   }
   * }>}
   */
  listModels: () =>
    ipcRenderer.invoke('models:list'),

  /**
   * Test connectivity for a specific model.
   * For Ollama models, checks that Ollama is running and the model is installed.
   * For cloud models, validates the API key with a minimal test call.
   *
   * @param {string}      modelId
   * @param {string|null} apiKey   — required for cloud models; omit for Ollama
   * @returns {Promise<{ success: boolean, message: string, time: number }>}
   */
  testModel: (modelId, apiKey = null) =>
    ipcRenderer.invoke('models:test', { modelId, apiKey }),

  /**
   * Switch the active model. Takes effect on the next chat() call.
   *
   * @param {string} modelId
   * @returns {Promise<{ success: boolean }>}
   */
  switchModel: (modelId) =>
    ipcRenderer.invoke('models:switch', { modelId }),

  /**
   * Save an API key for a cloud model adapter.
   * The key is persisted in data/config/user-config.json.
   *
   * @param {string} adapterType  — 'deepseek' | 'openai' | 'claude' | 'qwen'
   * @param {string} apiKey
   * @returns {Promise<{ success: boolean }>}
   */
  setApiKey: (adapterType, apiKey) =>
    ipcRenderer.invoke('models:set-api-key', { adapterType, apiKey }),

  // ──────────────────────────────────────────────────────────────
  // CONFIG
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the current user configuration for display in the Settings panel.
   * API keys are masked (first 6 chars + '...') before being returned.
   *
   * @returns {Promise<{ success: boolean, config: object }>}
   */
  getConfig: () =>
    ipcRenderer.invoke('config:get'),

  /**
   * Save an updated configuration object.
   * Partial updates are accepted — only provided keys are overwritten.
   *
   * @param {object} config  — e.g. { activeModel, ollamaUrl, studentName, theme }
   * @returns {Promise<{ success: boolean }>}
   */
  saveConfig: (config) =>
    ipcRenderer.invoke('config:save', { config }),

  // ──────────────────────────────────────────────────────────────
  // STATISTICS
  // ──────────────────────────────────────────────────────────────

  /**
   * Get model usage statistics (call counts, latency, error rate).
   * Displayed in the Settings → Statistics tab.
   *
   * @returns {Promise<{ success: boolean, stats: object }>}
   */
  getStats: () =>
    ipcRenderer.invoke('stats:get'),

  // ──────────────────────────────────────────────────────────────
  // PROGRESS & MASTERY
  // ──────────────────────────────────────────────────────────────

  /**
   * Get overall learning progress for a student.
   *
   * @param {string} studentId
   * @returns {Promise<{
   *   success:  boolean,
   *   progress: object,   — attempt counts, topic breakdown
   *   mastery:  object,   — per-dot-point mastery scores
   * }>}
   */
  getProgress: (studentId = 'default') =>
    ipcRenderer.invoke('progress:get', { studentId }),

  /**
   * Get per-dot-point syllabus mastery scores.
   * Used by the Progress Dashboard to render the syllabus heatmap.
   *
   * @param {string} studentId
   * @returns {Promise<{ success: boolean, mastery: object }>}
   */
  getSyllabusMastery: (studentId = 'default') =>
    ipcRenderer.invoke('syllabus:mastery', { studentId }),

  /**
   * Get the full HSC syllabus topic structure from the knowledge base.
   * Used by the Progress Dashboard to label the heatmap axes.
   *
   * @returns {Promise<{ success: boolean, topics: object[] }>}
   */
  getSyllabusTopics: () =>
    ipcRenderer.invoke('syllabus:topics'),

  // ──────────────────────────────────────────────────────────────
  // STUDENT MODEL  (v3.0)
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the full synthesised Student Model — mastery profile, learning style,
   * velocity, current affective state, and exam readiness forecast.
   *
   * This is the richest data object in OpenTutor. Every skill uses it
   * internally; this call exposes the same data to the frontend so the
   * UI can reflect the student's personalised state.
   *
   * @param {string} studentId
   * @returns {Promise<{
   *   success:      boolean,
   *   studentModel: {
   *     studentId:             string,
   *     examDate:              string|null,
   *     weeksRemaining:        number|null,
   *     masteryProfile:        object,    — { dotPointCode: 0.0–1.0 }
   *     overallMastery:        number|null,
   *     weakestTopics:         string[],
   *     weakDotPoints:         object[],
   *     learningStyle:         object,
   *     velocity:              object,
   *     affectiveState:        object,
   *     examReadinessForecast: object,
   *   }
   * }>}
   */
  getStudentModel: (studentId = 'default') =>
    ipcRenderer.invoke('student:model', { studentId }),

  /**
   * Save an updated student profile (name, exam date, motivation style, etc.).
   * The profile is persisted to data/students/{studentId}/profile.md.
   *
   * @param {string} studentId
   * @param {object} profile    — partial or full profile object
   * @returns {Promise<{ success: boolean }>}
   */
  saveStudentProfile: (studentId = 'default', profile) =>
    ipcRenderer.invoke('student:profile:save', { studentId, profile }),

  // ──────────────────────────────────────────────────────────────
  // EXAM READINESS  (v3.0)
  // ──────────────────────────────────────────────────────────────

  /**
   * Get the exam readiness forecast — predicted performance by topic
   * given the student's current mastery trajectory and time remaining.
   *
   * @param {string} studentId
   * @returns {Promise<{
   *   success:  boolean,
   *   forecast: {
   *     overall:  number|null,   — 0.0–1.0 predicted overall readiness
   *     byTopic:  object,        — { topicCode: 0.0–1.0 }
   *     lastUpdated: string|null,
   *   }
   * }>}
   */
  getReadinessForecast: (studentId = 'default') =>
    ipcRenderer.invoke('readiness:forecast', { studentId }),

  // ──────────────────────────────────────────────────────────────
  // PAST PAPERS
  // ──────────────────────────────────────────────────────────────

  /**
   * List past paper questions from the knowledge base, optionally filtered
   * by topic code and/or year. Used by the Past Papers browser in the UI.
   *
   * @param {string|null} topic  — e.g. 'MA-C', 'MA-S'
   * @param {number|null} year   — e.g. 2023
   * @returns {Promise<{ success: boolean, questions: object[] }>}
   */
  listPastPapers: (topic = null, year = null) =>
    ipcRenderer.invoke('pastpaper:list', { topic, year }),

  /**
   * Submit a student's answer to a specific past paper question for marking.
   * The response includes marks awarded, marks total, and detailed feedback
   * from the marking-guideline-feedback skill.
   *
   * @param {string} questionId     — KB question ID e.g. '2023-MA-Q11a'
   * @param {string} studentAnswer  — the student's answer text
   * @param {string} studentId
   * @returns {Promise<{
   *   success:      boolean,
   *   response:     string,       — formatted marking feedback
   *   marksAwarded: number|null,
   *   marksTotal:   number,
   * }>}
   */
  submitPastPaper: (questionId, studentAnswer, studentId = 'default') =>
    ipcRenderer.invoke('pastpaper:submit', { questionId, studentAnswer, studentId }),

  // ──────────────────────────────────────────────────────────────
  // APP CONSTANTS
  // Injected at startup — no IPC round-trip required.
  // ──────────────────────────────────────────────────────────────

  /**
   * App version string, read from package.json via APP_VERSION env var.
   * Falls back to '3.0.0' if the env var is not set.
   */
  version: process.env.APP_VERSION || '3.0.0',

  /**
   * OS platform string — used by the renderer for OS-specific UI tweaks.
   * 'darwin' | 'win32' | 'linux'
   */
  platform: process.platform,

  // ── Event listener helpers ─────────────────────────────────
  // Allow renderer to subscribe to push events from main process
  // (used for chat:stream:start / chunk / end).

  /**
   * Subscribe to a main→renderer push event.
   * @param {string} channel
   * @param {Function} callback  receives the data from the event
   */
  on: (channel, callback) => {
    if (typeof callback !== 'function') {
      console.error(`[Preload] Cannot register listener for ${channel}: callback is not a function`);
      return;
    }

    // Store the wrapper so the cleanup function can remove exactly this
    // listener — not all listeners on the channel (which would break
    // concurrent subscriptions from other parts of the app).
    const wrapper = (event, data) => {
      // ===== ENHANCED: Ultra-defensive data sanitization =====
      // Handle absolutely any possible data value from the main process

      // Case 1: Data is completely undefined or null
      if (data === undefined || data === null) {
        console.log(`[Preload] Received ${data === undefined ? 'undefined' : 'null'} data for ${channel}, passing empty object`);

        setTimeout(() => {
          try {
            callback({});
          } catch (err) {
            console.error(`[Preload] Error in ${channel} callback with empty object:`, err);
            console.error(`[Preload] Error stack:`, err.stack);
          }
        }, 0);
        return;
      }

      // Case 2: Data is a primitive (string, number, boolean)
      if (typeof data !== 'object') {
        console.log(`[Preload] Received primitive data for ${channel}:`, typeof data, data);

        // Wrap primitive in an object with a 'value' property
        const safeData = { value: data, type: typeof data };

        setTimeout(() => {
          try {
            callback(safeData);
          } catch (err) {
            console.error(`[Preload] Error in ${channel} callback with wrapped primitive:`, err);
            console.error(`[Preload] Error stack:`, err.stack);
          }
        }, 0);
        return;
      }

      // Case 3: Data is an object (could be array, plain object, etc.)
      // Create a safe copy to prevent mutation issues
      let safeData = {};

      try {
        // Try to create a shallow copy - if it fails, use empty object
        if (data && typeof data === 'object') {
          // Handle arrays specially
          if (Array.isArray(data)) {
            safeData = { items: [...data] };
          } else {
            // Regular object - copy only enumerable own properties
            safeData = { ...data };
          }
        }
      } catch (copyErr) {
        console.error(`[Preload] Error copying data for ${channel}:`, copyErr);
        safeData = {}; // Fallback to empty object
      }

      // Ensure safeData is always an object
      if (typeof safeData !== 'object' || safeData === null) {
        safeData = {};
      }

      // ===== Special handling for common stream channels =====
      // Ensure certain properties exist for known channels to prevent "cannot read property" errors
      if (channel === 'chat:stream:end') {
        // Ensure error property exists (even if undefined) to prevent 'reading error' errors
        if (!safeData.hasOwnProperty('error')) {
          safeData.error = null;
        }
        // Ensure fullText exists
        if (!safeData.hasOwnProperty('fullText')) {
          safeData.fullText = '';
        }
        // Ensure autoAdvance exists
        if (!safeData.hasOwnProperty('autoAdvance')) {
          safeData.autoAdvance = false;
        }
      }

      if (channel === 'chat:stream:chunk') {
        // Ensure token exists
        if (!safeData.hasOwnProperty('token')) {
          safeData.token = '';
        }
      }

      if (channel === 'chat:stream:start') {
        // Ensure proactive exists
        if (!safeData.hasOwnProperty('proactive')) {
          safeData.proactive = false;
        }
      }

      // ===== Execute callback with safe data =====
      setTimeout(() => {
        try {
          if (typeof callback === 'function') {
            callback(safeData);
          } else {
            console.error(`[Preload] callback for ${channel} is not a function:`, callback);
          }
        } catch (err) {
          console.error(`[Preload] Error in ${channel} callback:`, err);
          console.error(`[Preload] Error stack:`, err.stack);
          console.error(`[Preload] Safe data that caused error:`, safeData);

          if (err.message && err.message.includes('reading')) {
            const match = err.message.match(/reading '([^']+)'/);
            if (match) {
              const missingProp = match[1];
              console.error(`[Preload] Callback tried to read '${missingProp}' but it was undefined`);
              console.error(`[Preload] Available properties:`, Object.keys(safeData));
            }
          }
        }
      }, 0);
    };

    ipcRenderer.on(channel, wrapper);

    // Return a cleanup function that removes ONLY this wrapper,
    // not all listeners on the channel.
    return () => {
      try {
        ipcRenderer.removeListener(channel, wrapper);
      } catch (err) {
        console.error(`[Preload] Error removing listener for ${channel}:`, err);
      }
    };
  },

  /**
   * Unsubscribe from a main→renderer push event.
   * @param {string} channel
   * @param {Function} callback  the same reference passed to on()
   */
  off: (channel, callback) => {
    try {
      if (callback && typeof callback === 'function') {
        ipcRenderer.removeListener(channel, callback);
      } else {
        ipcRenderer.removeAllListeners(channel);
      }
    } catch (err) {
      console.error(`[Preload] Error in off for ${channel}:`, err);
    }
  },

  // ============================================================
  // Teaching mode methods (v4.0)
  // ============================================================

  /**
   * Switch teaching mode
   * @param {string} modelId - 'student-led' or 'teacher-led'
   * @param {string} studentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  setTeachingModel: (modelId, studentId = 'default') =>
    ipcRenderer.invoke('teaching:setModel', { modelId, studentId }),

  /**
   * Get current teaching mode info
   * @param {string} studentId
   * @returns {Promise<{modelId: string, phase?: string, progress?: number}>}
   */
  getCurrentTeachingModel: (studentId = 'default') =>
    ipcRenderer.invoke('teaching:getCurrent', { studentId }),

  /**
   * Get all available teaching modes (for Settings UI)
   * @returns {Promise<Array>} List of mode metadata
   */
  getAvailableTeachingModels: () =>
    ipcRenderer.invoke('teaching:getAvailable'),

  /**
   * Save teaching mode configuration
   * @param {string} modelId
   * @param {object} config
   * @returns {Promise<{success: boolean}>}
   */
  saveTeachingModelConfig: (modelId, config) =>
    ipcRenderer.invoke('teaching:saveConfig', { modelId, config }),

  /**
   * Resume interrupted lesson (Teacher-Led mode only)
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  resumeLesson: (studentId = 'default') =>
    ipcRenderer.invoke('teacher:resumeLesson', { studentId }),

  /**
   * Get current homework (Teacher-Led mode only)
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  getHomework: (studentId = 'default') =>
    ipcRenderer.invoke('teacher:getHomework', { studentId }),

  // ============================================================
  // Auto-advance method
  // ============================================================

  /**
   * Advance to the next section of a lesson automatically
   * Used by the teacher-led mode for auto-progression
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  advanceLesson: (studentId = 'default') =>
    ipcRenderer.invoke('lesson:advance', { studentId }),

  // ============================================================
  // Test-Led Mode methods (v6.5)
  // ============================================================

  /**
   * Submit an answer for a test-led mode question
   * @param {string} answer - The student's answer
   * @param {string} questionId - ID of the question being answered
   * @param {string} studentId - Student identifier
   * @returns {Promise<{
   *   success: boolean,
   *   feedback: string,
   *   isCorrect: boolean,
   *   marksAwarded?: number,
   *   marksTotal?: number,
   *   explanation?: string,
   *   error?: string
   * }>}
   */
  submitTestAnswer: (answer, questionId, studentId = 'default') =>
    ipcRenderer.invoke('test:submit', { answer, questionId, studentId }),

  /**
   * Start a test
   * @param {string} testType - 'diagnostic' | 'topic' | 'mixed' | 'mastery'
   * @param {string} topic - Optional topic for topic test
   * @param {string} studentId - Student identifier
   * @returns {Promise<object>}
   */
  startTest: (testType, topic = null, studentId = 'default') =>
    ipcRenderer.invoke('test:start', { testType, topic, studentId }),

  /**
   * Skip current test question
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  skipTestQuestion: (studentId = 'default') =>
    ipcRenderer.invoke('test:skip', { studentId }),

  /**
   * Get hint for current test question
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  getTestHint: (studentId = 'default') =>
    ipcRenderer.invoke('test:hint', { studentId }),

  /**
   * Get test results
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  getTestResults: (studentId = 'default') =>
    ipcRenderer.invoke('test:results', { studentId }),

  /**
   * Start test remediation for a topic
   * @param {string} topic
   * @param {string} studentId
   * @returns {Promise<object>}
   */
  startTestRemediation: (topic, studentId = 'default') =>
    ipcRenderer.invoke('test:remediate', { topic, studentId }),

  /**
   * Get test history
   * @param {string} studentId
   * @param {number} limit
   * @returns {Promise<object>}
   */
  getTestHistory: (studentId = 'default', limit = 10) =>
    ipcRenderer.invoke('test:history', { studentId, limit }),

  // ============================================================
  // Knowledge Base Generator (v5.0)
  // ============================================================

  /**
   * Check if a subject already exists in the knowledge base.
   * @param {string} subjectName - e.g. "HSC Chemistry"
   * @returns {Promise<{ exists: boolean, subjectId: string }>}
   */
  kbCheck: (subjectName) =>
    ipcRenderer.invoke('kb:check', { subjectName }),

  /**
   * Start generating a knowledge base for a subject.
   * Long-running — progress events arrive via window.api.on('kb:progress', cb).
   * @param {string} subjectName - e.g. "HSC Chemistry"
   * @returns {Promise<{ success: boolean, subjectId: string, manifest: object, syllabusMap: object, dotPoints: object, error?: string }>}
   */
  kbGenerate: (subjectName) =>
    ipcRenderer.invoke('kb:generate', { subjectName }),

  /**
   * Approve the reviewed knowledge base and write it to disk.
   * @param {string} subjectId
   * @param {{ manifest: object, syllabusMap: object, dotPoints: object }} files
   * @returns {Promise<{ success: boolean, path: string, error?: string }>}
   */
  kbApprove: (subjectId, files) =>
    ipcRenderer.invoke('kb:approve', { subjectId, files }),

  /**
   * Cancel an in-progress generation (no-op if not generating).
   * @param {string} subjectId
   * @returns {Promise<{ success: boolean }>}
   */
  kbCancel: (subjectId) =>
    ipcRenderer.invoke('kb:cancel', { subjectId }),

  // ============================================================
  // Licence activation (v3.1)
  // ============================================================

  /**
   * Validate and persist a serial number.
   * Called by the activation window before the main app is shown.
   *
   * @param {string} serial  — e.g. "OT30-AB12-CD34-EF56"
   * @returns {Promise<{ success: boolean, serial?: string, reason?: string }>}
   */
  activateLicence: (serial) =>
    ipcRenderer.invoke('licence:activate', serial),

  /**
   * Quit the application.
   * Used by the "Quit" link in the activation window.
   *
   * @returns {Promise<void>}
   */
  quitApp: () =>
    ipcRenderer.invoke('app:quit'),
});

// ─────────────────────────────────────────────────────────────
// window.electronAPI  — secondary bridge for the licence window
//
// The activation window is a standalone BrowserWindow whose HTML is
// generated inline in main.js (no React build step). It calls
// window.electronAPI.activateLicence() and window.electronAPI.quitApp()
// directly. We expose those two methods here under the electronAPI
// namespace so the plain HTML page can reach them without depending on
// the full window.api surface.
//
// This bridge intentionally has the smallest possible surface area —
// only the two methods the activation window actually needs.
// ─────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {

  /**
   * Validate and persist a serial number.
   * @param {string} serial
   * @returns {Promise<{ success: boolean, serial?: string, reason?: string }>}
   */
  activateLicence: (serial) =>
    ipcRenderer.invoke('licence:activate', serial),

  /**
   * Quit the application.
   * @returns {Promise<void>}
   */
  quitApp: () =>
    ipcRenderer.invoke('app:quit'),
});