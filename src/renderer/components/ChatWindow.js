// ChatWindow.js
// MODIFIED: Added teacher mode support with auto-start and dynamic subject suggestions
// MODIFIED: Added dynamic content generation indicators
// MODIFIED: Teacher actively leads the lesson, auto-starts when switched to teacher mode
// MODIFIED: Added support for subPhase field from teacher-led-model
// MODIFIED: Added equation editor with math toolbar and live preview
// MODIFIED: Added test mode support with test header and commands
// FIXED: Teaching mode switching now works properly
// FIXED: Restored follow-ups and Test me functionality
// FIXED: Resume lesson now uses streaming instead of manually creating message
// FIXED: Removed 60-second polling interval (loadTeachingMode no longer needed)
// UPDATED: UI matches design preview with TeacherModeHeader
// FIXED: Added queue for system messages to prevent duplicate streams
// FIXED: Added cleanup for pending timers to prevent memory leaks
// FIXED: Added check for existing streams before sending system messages
// Main chat interface component.

import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import Mascot from './Mascot';
import ipc from '../ipc';
import { MessageBubble, TypingIndicator } from './MessageComponents';
import { useStreamHandler } from './useStreamHandler';
import {
  STUDENT_ID,
  MAX_HISTORY,
  getSubjectLabel,
  detectAffectiveState,
} from './chatUtils';

// Import teacher mode components
import TeacherModeHeader from './TeacherModeHeader';
// Import test mode components - NEW
import TestModeHeader from './TestModeHeader';
import {
  HomeworkIndicator,
  NextTopicSuggestion,
  ContentGenerationIndicator,
  TeachingPhaseTimeline,
  LessonProgress,
} from './TeacherModeIndicators';

// ===== NEW: Import equation editor components =====
import { MathEditorButton, MathEditorDialog } from './equation';
import RichMathText from './FormulaRenderer';
import LessonSectionDialog from './LessonSectionDialog';
import TestQuestionDialog from './TestQuestionDialog';

// ── Helper function for subject-specific teacher mode suggestions ──
const getTeacherModeSuggestions = (subjectId, subjectsList) => {
  // Find the subject in the list
  const subject = subjectsList.find(s => s.id === subjectId);

  // If subject has predefined suggestions in its manifest, use them
  if (subject?.suggestions) {
    return subject.suggestions.map(s => ({
      icon: s.icon || '📚',
      label: s.label,
      text: s.text
    }));
  }

  // Default suggestions based on subject type
  const defaultSuggestions = {
    'maths-advanced': [
      { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' },
      { icon: '📐', label: 'Learn calculus', text: 'teach me differentiation' },
      { icon: '📊', label: 'Learn statistics', text: 'teach me probability' }
    ],
    'maths-ext1': [
      { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' },
      { icon: '📐', label: 'Learn extension topics', text: 'teach me parametric equations' },
      { icon: '🔢', label: 'Learn polynomials', text: 'teach me polynomials' }
    ],
    'maths-ext2': [
      { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' },
      { icon: '🧮', label: 'Learn complex numbers', text: 'teach me complex numbers' },
      { icon: '📐', label: 'Learn conics', text: 'teach me conics' }
    ],
    'english-advanced': [
      { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' },
      { icon: '📝', label: 'Learn about module A', text: 'teach me module A' },
      { icon: '📖', label: 'Learn textual analysis', text: 'teach me textual analysis' }
    ],
    'toefl': [
      { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' },
      { icon: '🎤', label: 'Speaking practice', text: 'teach me speaking' },
      { icon: '📝', label: 'Writing practice', text: 'teach me writing' }
    ],
    'gre': [
      { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' },
      { icon: '📚', label: 'Verbal reasoning', text: 'teach me verbal' },
      { icon: '🧮', label: 'Quantitative reasoning', text: 'teach me quantitative' }
    ]
  };

  return defaultSuggestions[subjectId] || [
    { icon: '👩‍🏫', label: 'Start lesson', text: 'teach me' },
    { icon: '📚', label: 'Learn a topic', text: 'teach me something new' }
  ];
};

// ===== NEW: Helper function for test mode suggestions =====
const getTestModeSuggestions = (subjectId, subjectsList) => {
  return [
    { icon: '📊', label: 'Diagnostic test', text: '__START_DIAGNOSTIC__' },
    { icon: '🎯', label: 'Topic test', text: '__START_TOPIC_TEST__' },
    { icon: '🔄', label: 'Mixed test', text: '__START_MIXED_TEST__' },
    { icon: '✅', label: 'Mastery check', text: '__START_MASTERY_CHECK__' }
  ];
};

// ── Main ChatWindow component ─────────────────────────────────
function ChatWindow({
  studentId = STUDENT_ID,
  activeSubject: activeSubjectProp,
  subjectsList = [],
  autoPlayTTS = true,
  isVisible = true,  // ===== FIXED: tracks whether Chat tab is currently shown =====
}) {
  // Use the prop if provided (from App.js subject switcher)
  const [activeSubject, setActiveSubject] = useState(activeSubjectProp || 'maths-advanced');
  const [suggestions, setSuggestions]     = useState([]);
  const [quickActions, setQuickActions]   = useState([]);
  const [playedMessageIds]                 = useState(() => new Set());

  // Teaching mode state
  const [teachingMode, setTeachingMode]     = useState('student-led');
  const [teachingPhase, setTeachingPhase]   = useState(null);
  const [teachingSubPhase, setTeachingSubPhase] = useState(null);
  const [teachingProgress, setTeachingProgress] = useState(0);
  const [currentTopic, setCurrentTopic]     = useState(null);
  const [homework, setHomework]             = useState(null);
  const [nextTopic, setNextTopic]           = useState(null);
  const [canResume, setCanResume]           = useState(false);
  const [autoAdvance, setAutoAdvance]       = useState(false);
  const [nextPhase, setNextPhase]           = useState(null);

  // ===== NEW: Test mode state =====
  const [testType, setTestType]             = useState(null);
  const [testScore, setTestScore]           = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionIndex, setQuestionIndex]   = useState(0);
  const [timeRemaining, setTimeRemaining]   = useState(null);
  const [timerInterval, setTimerInterval]   = useState(null);

  // ===== Answer feedback toast (shown as overlay, not as a scroll message) =====
  const [feedbackToast, setFeedbackToast] = useState(null); // { isCorrect, detailedFeedback }

  // ===== Lesson section dialog (teacher-led modal) =====
  const [lessonDialog, setLessonDialog] = useState(null);

  // ===== Test question dialog (test-led modal) =====
  const [testQuestionDialog, setTestQuestionDialog] = useState(null);
  const [testQuestionStreamingContent, setTestQuestionStreamingContent] = useState(null);
  const [lessonDialogStreamingContent, setLessonDialogStreamingContent] = useState(null);
  // { question, questionIndex, totalQuestions, messageId }
  const [testFeedback, setTestFeedback] = useState(null);
  // { isCorrect, detailedFeedback } — shown inside the dialog after submit // { phase, content, topic, questionIndex, totalQuestions, isCheckPhase }

  // Lesson progress state
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(5);
  const [stepName, setStepName] = useState('Introduction');

  // Dynamic content generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(null);

  // ===== NEW: Equation editor state =====
  const [mathEditorOpen, setMathEditorOpen] = useState(false);

  // Derive subject-specific content from activeSubject
  const subjectLabel = getSubjectLabel(activeSubject, subjectsList);

  const makeWelcomeMessage = (label) =>
    `Hi! I'm **Tute**, your ${label} study companion. 🦉\n\nI'm here to help you understand concepts, work through problems and prepare for your learning subject. What would you like to work on today?`;

  // Teacher welcome message
  const makeTeacherWelcomeMessage = (label) => {
    return `👩‍🏫 **Teacher Mode Activated**\n\nI'll guide you through today's lesson. Let's begin!`;
  };

  // ===== NEW: Test mode welcome message =====
  const makeTestWelcomeMessage = (label) => {
    return `📝 **Test Mode Activated**\n\nI'll help you learn by testing your knowledge. Choose a test type to begin, or ask me a question.`;
  };

  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: 'Session started',
      timestamp: Date.now(),
    },
    {
      role: 'assistant',
      content: makeWelcomeMessage(subjectLabel),
      timestamp: Date.now(),
      id: `msg-welcome-${Date.now()}`,
    },
  ]);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [isStreaming, setIsStreaming]   = useState(false);
  const [affectiveState, setAffectiveState] = useState('idle');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const textareaRef      = useRef(null);

  // Keep a ref to teachingMode so stable useCallback closures can read the
  // latest value without needing it in their dependency array.
  const teachingModeRef  = useRef(teachingMode);
  useEffect(() => { teachingModeRef.current = teachingMode; }, [teachingMode]);

  // Guard: prevents __START_LESSON__ being sent more than once per session.
  const lessonStartedRef = useRef(false);

  // ===== NEW: Timer cleanup ref =====
  const timerRef = useRef(null);

  // ===== NEW: Track pending timers for cleanup =====
  const pendingTimersRef = useRef([]);

  // ===== NEW: Queue for pending system messages =====
  const pendingSystemMessagesRef = useRef([]);

  // ===== NEW: Check if component is mounted =====
  const isMountedRef = useRef(true);

  // ===== NEW: Cleanup function for all timers =====
  const clearAllTimers = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ===== NEW: Timer management for test mode =====
  const startTimer = useCallback((seconds) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setTimeRemaining(seconds);

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeRemaining(null);
  }, []);

  // ── Load teaching mode on mount ─────────────
  const loadTeachingMode = useCallback(async () => {
    try {
      console.log('[ChatWindow] Loading teaching mode...');
      const info = await ipc.invoke('teaching:getCurrent', { studentId });
      console.log('[ChatWindow] Teaching mode info:', info);

      if (info?.modelId) {
        const oldMode = teachingMode;

        // Update all teaching mode states
        setTeachingMode(info.modelId);
        setTeachingPhase(info.phase || null);
        setTeachingSubPhase(info.subPhase || null);
        setTeachingProgress(info.progress || 0);
        setCurrentTopic(info.currentTopic || null);
        setCanResume(info.canResume || false);
        setAutoAdvance(info.autoAdvance || false);
        setNextPhase(info.nextPhase || null);

        // ===== NEW: Update test mode states =====
        if (info.modelId === 'test-led') {
          setTestType(info.testType || null);
          setTestScore(info.score || null);
          setQuestionIndex(info.questionIndex || 0);
          setTotalQuestions(info.totalQuestions || 0);
          if (info.questionIndex && info.totalQuestions) {
            setCurrentQuestion({
              index: info.questionIndex,
              total: info.totalQuestions
            });
          }
          if (info.timeRemaining) {
            startTimer(info.timeRemaining);
          }
        } else {
          // Clear test mode states when not in test mode
          setTestType(null);
          setTestScore(null);
          setCurrentQuestion(null);
          stopTimer();
        }

        // Update lesson progress if available
        if (info.currentStep) setCurrentStep(info.currentStep);
        if (info.totalSteps) setTotalSteps(info.totalSteps);
        if (info.stepName) setStepName(info.stepName);

        // If mode changed, update UI
        if (info.modelId !== oldMode) {
          console.log(`[ChatWindow] Teaching mode changed from ${oldMode} to ${info.modelId}`);

          // Update welcome message based on mode
          let welcomeMessage;
          if (info.modelId === 'teacher-led') {
            welcomeMessage = makeTeacherWelcomeMessage(subjectLabel);
          } else if (info.modelId === 'test-led') {
            welcomeMessage = makeTestWelcomeMessage(subjectLabel);
          } else {
            welcomeMessage = makeWelcomeMessage(subjectLabel);
          }

          setMessages(prev => {
            const newMessages = [...prev];
            // Check if last message is from assistant and not already a mode message
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg?.role === 'assistant' && !lastMsg.teachingModel) {
              newMessages[newMessages.length - 1] = {
                ...lastMsg,
                content: welcomeMessage,
                teachingModel: info.modelId
              };
            }
            return newMessages;
          });

          // Auto-start for teacher-led mode
          if (info.modelId === 'teacher-led' && !lessonStartedRef.current) {
            lessonStartedRef.current = true;
            console.log('[ChatWindow] Teacher mode activated, queueing lesson start...');
            clearAllTimers();
            queueSystemMessage('__START_LESSON__');
          }

          // Reset for student-led mode
          if (info.modelId === 'student-led') {
            clearAllTimers();
            pendingSystemMessagesRef.current = [];
            lessonStartedRef.current = false;
            setTeachingPhase(null);
            setTeachingSubPhase(null);
            setTeachingProgress(0);
            setCanResume(false);
            setHomework(null);
            setAutoAdvance(false);
            setNextPhase(null);
            setCurrentTopic(null);
            setNextTopic(null);
            setCurrentStep(1);
            setTotalSteps(5);
            setStepName('Introduction');

            // Clear test mode states
            setTestType(null);
            setTestScore(null);
            setCurrentQuestion(null);
            stopTimer();
          }
        }
      }
    } catch (err) {
      console.error('[ChatWindow] Failed to load teaching mode:', err);
    }
  }, [studentId, teachingMode, subjectLabel, clearAllTimers, startTimer, stopTimer]);

  // ===== NEW: Queue system message function =====
  const queueSystemMessage = useCallback((message) => {
    console.log('[ChatWindow] Queueing system message:', message);
    pendingSystemMessagesRef.current.push(message);
    processSystemMessageQueue();
  }, []);

  // ===== NEW: Process system message queue =====
  const processSystemMessageQueue = useCallback(() => {
    if (isStreaming || pendingSystemMessagesRef.current.length === 0) {
      return;
    }

    const nextMessage = pendingSystemMessagesRef.current.shift();
    console.log('[ChatWindow] Processing queued system message:', nextMessage);
    setIsTyping(true);

    ipc.invoke('chat:stream', { message: nextMessage, studentId, isSystem: true })
      .then(result => {
        console.log('[ChatWindow] System message result:', result);
      })
      .catch(err => {
        console.error('[ChatWindow] System message failed:', err);
        setIsTyping(false);
      });
  }, [isStreaming, studentId]);

  // ===== MODIFIED: System message sender with queue =====
  const sendSystemMessage = useCallback(async (message) => {
    if (isStreaming) {
      console.log('[ChatWindow] Already streaming, queueing system message:', message);
      queueSystemMessage(message);
      return;
    }

    console.log('[ChatWindow] Sending system message directly:', message);
    setIsTyping(true);
    try {
      const result = await ipc.invoke('chat:stream', { message, studentId, isSystem: true });
      console.log('[ChatWindow] System message result:', result);
    } catch (err) {
      console.error('[ChatWindow] System message failed:', err);
      setIsTyping(false);
    }
  }, [studentId, isStreaming, queueSystemMessage]);

  // Load on mount
  useEffect(() => {
    loadTeachingMode();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      clearAllTimers();
      stopTimer();
      pendingSystemMessagesRef.current = [];
    };
  }, [loadTeachingMode, clearAllTimers, stopTimer]);

  // ===== FIXED: Re-check teaching mode whenever the Chat tab becomes visible =====
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      console.log('[ChatWindow] Tab became visible, reloading teaching mode...');
      loadTeachingMode();
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible, loadTeachingMode]);

  // Load homework (for teacher mode)
  const loadHomework = useCallback(async () => {
    if (teachingMode !== 'teacher-led') return;

    try {
      const result = await ipc.invoke('teacher:getHomework', { studentId });
      if (result?.success && result.homework) {
        setHomework(result.homework);
      }
    } catch (err) {
      console.error('[ChatWindow] Failed to load homework:', err);
    }
  }, [teachingMode, studentId]);

  // Load suggestions when subject or mode changes
  useEffect(() => {
    if (!activeSubject) return;

    ipc.invoke('subject:suggestions', { subjectId: activeSubject })
      .then(res => {
        if (res?.success) {
          // Use appropriate suggestions based on teaching mode
          if (teachingMode === 'teacher-led') {
            const teacherSuggestions = getTeacherModeSuggestions(activeSubject, subjectsList);
            setSuggestions(teacherSuggestions);
          } else if (teachingMode === 'test-led') {
            // ===== NEW: Test mode suggestions =====
            setSuggestions(getTestModeSuggestions(activeSubject, subjectsList));
          } else {
            setSuggestions(res.suggestions || []);
          }
          setQuickActions(res.quickActions || []);
        }
      })
      .catch(err => console.error('[ChatWindow] Failed to load suggestions:', err));
  }, [activeSubject, teachingMode, subjectsList]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Subject switch: reset chat when parent changes subject
  useEffect(() => {
    if (!activeSubjectProp) return;
    if (activeSubjectProp === activeSubject) return;

    const label = getSubjectLabel(activeSubjectProp, subjectsList);

    setActiveSubject(activeSubjectProp);
    // Reset the lesson-started guard
    lessonStartedRef.current = false;

    // Clear all pending timers and message queue
    clearAllTimers();
    stopTimer();
    pendingSystemMessagesRef.current = [];

    let welcomeMessage;
    if (teachingMode === 'teacher-led') {
      welcomeMessage = makeTeacherWelcomeMessage(label);
    } else if (teachingMode === 'test-led') {
      welcomeMessage = makeTestWelcomeMessage(label);
    } else {
      welcomeMessage = makeWelcomeMessage(label);
    }

    setMessages([
      { role: 'system',    content: `Switched to ${label}`, timestamp: Date.now() },
      {
        role: 'assistant',
        content: welcomeMessage,
        timestamp: Date.now(),
        id: `msg-welcome-${Date.now()}`,
        teachingModel: teachingMode
      },
    ]);
    setShowSuggestions(true);
    setAffectiveState('idle');
    playedMessageIds.clear();

    // Reload teaching mode after subject switch
    const timerId = setTimeout(() => loadTeachingMode(), 100);
    pendingTimersRef.current.push(timerId);
  }, [activeSubjectProp, subjectsList, playedMessageIds, teachingMode, loadTeachingMode, clearAllTimers, stopTimer]);

  // Affective state
  useEffect(() => {
    setAffectiveState(detectAffectiveState(messages));
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, []);

  // Follow-up pills: generate via IPC after each response
  const generateFollowUps = useCallback(async (messageId, responseText) => {
    try {
      const res = await ipc.invoke('chat:follow-ups', {
        responseText,
        studentId,
        activeSubject,
      });
      const pills = res?.followUps;
      if (Array.isArray(pills) && pills.length > 0) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, followUps: pills.slice(0, 3) } : m
        ));
      }
    } catch (err) {
      console.warn('[ChatWindow] Follow-up generation failed:', err);
    }
  }, [studentId, activeSubject]);

  // Resume lesson (teacher mode)
  const handleResumeLesson = useCallback(async () => {
    console.log('[ChatWindow] Resuming lesson via streaming...');

    if (isStreaming) {
      console.log('[ChatWindow] Already streaming, queueing resume lesson');
      queueSystemMessage('↺ Resume lesson');
      return;
    }

    setIsTyping(true);
    try {
      await ipc.invoke('chat:stream', {
        message: '↺ Resume lesson',
        studentId,
        isSystem: false
      });
    } catch (err) {
      console.error('[ChatWindow] Failed to resume lesson:', err);
      setIsTyping(false);
    }
  }, [studentId, isStreaming, queueSystemMessage]);

  // ===== NEW: Resume test (test mode) =====
  const handleResumeTest = useCallback(async () => {
    console.log('[ChatWindow] Resuming test via streaming...');

    if (isStreaming) {
      console.log('[ChatWindow] Already streaming, queueing resume test');
      queueSystemMessage('↺ Resume test');
      return;
    }

    setIsTyping(true);
    try {
      await ipc.invoke('chat:stream', {
        message: '↺ Resume test',
        studentId,
        isSystem: false
      });
    } catch (err) {
      console.error('[ChatWindow] Failed to resume test:', err);
      setIsTyping(false);
    }
  }, [studentId, isStreaming, queueSystemMessage]);

  // ===== NEW: Skip test question =====
  const handleSkipQuestion = useCallback(async () => {
    if (isStreaming) return;

    setIsTyping(true);
    try {
      await ipc.invoke('test:skip', { studentId });
    } catch (err) {
      console.error('[ChatWindow] Failed to skip question:', err);
      setIsTyping(false);
    }
  }, [studentId, isStreaming]);

  // ===== NEW: Get test hint =====
  const handleGetHint = useCallback(async () => {
    if (isStreaming) return;

    setIsTyping(true);
    try {
      await ipc.invoke('test:hint', { studentId });
    } catch (err) {
      console.error('[ChatWindow] Failed to get hint:', err);
      setIsTyping(false);
    }
  }, [studentId, isStreaming]);

  // Start next topic (teacher mode)
  const handleStartNextTopic = useCallback(() => {
    if (nextTopic) {
      setInput(`teach me ${nextTopic}`);
      setNextTopic(null);

      if (isStreaming) {
        console.log('[ChatWindow] Already streaming, will send after delay');
        const timerId = setTimeout(() => sendMessage(), 500);
        pendingTimersRef.current.push(timerId);
      } else {
        setTimeout(() => sendMessage(), 100);
      }
    }
  }, [nextTopic, isStreaming]);

  // View homework
  const handleViewHomework = useCallback(() => {
    if (!homework) return;

    const homeworkMsg = {
      role: 'assistant',
      content: `📋 **Homework for ${homework.topic}**\n\n` +
               homework.exercises.map((ex, i) =>
                 `${i + 1}. ${ex.question}\n   💡 *Hint: ${ex.hint}*`
               ).join('\n\n'),
      timestamp: Date.now(),
      id: `msg-homework-${Date.now()}`,
      teachingModel: 'teacher-led'
    };
    setMessages(prev => [...prev, homeworkMsg]);
  }, [homework]);

  // Handle student response to teacher's question
//  const handleStudentResponse = useCallback(async (response) => {
//    if (!response.trim() || isTyping) return;
//
//    const userMsg = {
//      role: 'user',
//      content: response,
//      timestamp: Date.now(),
//      id: `msg-response-${Date.now()}-${Math.random()}`,
//    };
//
//    setMessages(prev => [...prev, userMsg].slice(-MAX_HISTORY));
//    setIsTyping(true);
//    setAffectiveState('thinking');
//
//    try {
//      await ipc.invoke('chat:stream', { message: response, studentId });
//    } catch (err) {
//      setMessages(prev => [...prev, {
//        role: 'assistant',
//        content: '⚠️ Connection error. Please check that a model is configured in Settings.',
//        timestamp: Date.now(),
//        id: `msg-error-${Date.now()}`,
//      }]);
//      setIsTyping(false);
//    }
//  }, [isTyping, studentId]);

    const handleStudentResponse = useCallback(async (response) => {
      if (!response.trim() || isTyping) return;

      console.log('[ChatWindow] handleStudentResponse called with teachingMode:', teachingMode);
      console.log('[ChatWindow] response:', response.substring(0, 50));

      const userMsg = {
        role: 'user',
        content: response,
        timestamp: Date.now(),
        id: `msg-response-${Date.now()}-${Math.random()}`,
      };

      setMessages(prev => [...prev, userMsg].slice(-MAX_HISTORY));
      setIsTyping(true);
      setAffectiveState('thinking');

      try {
        // If in test mode, use test:submit instead of regular chat
        if (teachingMode === 'test-led') {
          await ipc.invoke('test:submit', {
            answer: response,
            studentId
          });
          console.log('[ChatWindow] test:submit completed successfully');
          // Note: setIsTyping(false) and setIsStreaming(false) are handled
          // by useStreamHandler's stream:end handler — do not call here.
        } else {
          await ipc.invoke('chat:stream', { message: response, studentId });
        }
      } catch (err) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ Connection error. Please check that a model is configured in Settings.',
          timestamp: Date.now(),
          id: `msg-error-${Date.now()}`,
        }]);
        setIsTyping(false);
      }
    }, [isTyping, studentId, teachingMode]);


  // ===== MODIFIED: Handle auto-advance callback =====
  const handleAutoAdvance = useCallback(async (data) => {
    if (data.type === 'next') {
      console.log('[ChatWindow] Auto-advancing...');

      if (isStreaming) {
        console.log('[ChatWindow] Already streaming, delaying auto-advance');
        const timerId = setTimeout(() => {
          ipc.invoke('lesson:advance', { studentId })
            .catch(err => console.error('[ChatWindow] lesson:advance failed:', err));
        }, 1000);
        pendingTimersRef.current.push(timerId);
      } else {
        try {
          await ipc.invoke('lesson:advance', { studentId });
        } catch (err) {
          console.error('[ChatWindow] lesson:advance failed:', err);
        }
      }
    } else if (data.type === 'phase_change') {
      setTeachingPhase(data.phase);
    }
  }, [studentId, isStreaming]);

  // Handle teacher proactive callback
  const handleTeacherProactive = useCallback((data) => {
    setTeachingPhase(data.phase);
    setTeachingSubPhase(data.subPhase);
    if (data.topic) setCurrentTopic(data.topic);
  }, []);

  // ── Test question dialog handlers ──────────────────────────────
  const handleTestQuestionSubmit = useCallback(async (answer) => {
    if (!testQuestionDialog) return;
    setIsTyping(true);  // show "Checking your answer..." while LLM works
    try {
      await ipc.invoke('test:submit', { answer, studentId });
      // feedback will arrive via stream; useStreamHandler clears isTyping via setIsTyping(false)
    } catch (err) {
      console.error('[ChatWindow] test:submit failed:', err);
      setIsTyping(false);
    }
  }, [testQuestionDialog, studentId]);

  const handleTestFeedbackClose = useCallback(async () => {
    if (!testQuestionDialog) return;

    // Clear streaming content state
    setTestQuestionStreamingContent(null);

    // Add compact card to chat history
    const card = {
      role: 'assistant',
      teachingModel: 'test-led',
      proactive: true,
      type: 'test_question_card',
      content: testQuestionDialog.question?.text || '',
      questionIndex: testQuestionDialog.questionIndex,
      totalQuestions: testQuestionDialog.totalQuestions,
      topic: testQuestionDialog.question?.topic,
      isCorrect: testFeedback?.isCorrect ?? null,
      timestamp: Date.now(),
      id: `msg-tq-${Date.now()}-${Math.random()}`,
      streaming: false,
    };
    setMessages(prev => [...prev, card].slice(-MAX_HISTORY));
    setTestFeedback(null);
    setTestQuestionDialog(null);

    // Only advance if still in testing phase — if the test just completed
    // (phase switched to diagnosis/test_complete), do NOT call lesson:advance
    // as it would trigger _handleDiagnosisPhase with a stale command.
    if (teachingPhase === 'testing' || teachingPhase === null) {
      setIsTyping(true);  // show "Generating next question..." while LLM works
      try {
        await ipc.invoke('lesson:advance', { studentId });
      } catch (err) {
        console.error('[ChatWindow] lesson:advance after feedback failed:', err);
        setIsTyping(false);
      }
    }
  }, [testQuestionDialog, testFeedback, teachingPhase, studentId]);

  const handleTestQuestionClose = useCallback(() => {
    setTestFeedback(null);
    setTestQuestionDialog(null);
    setTestQuestionStreamingContent(null);
  }, []);

  // ── Lesson section dialog handlers ─────────────────────────────
  const handleLessonContinue = useCallback(async (answer) => {
    if (!lessonDialog) return;

    // Add compact summary card to chat history
    const summaryCard = {
      role: 'assistant',
      teachingModel: 'teacher-led',
      proactive: true,
      type: 'lesson_summary_card',
      phase: lessonDialog.phase,
      content: lessonDialog.content,
      sectionLabel: lessonDialog.sectionLabel,
      topic: lessonDialog.topic,
      timestamp: Date.now(),
      id: `msg-lesson-summary-${Date.now()}-${Math.random()}`,
      streaming: false,
    };
    setMessages(prev => [...prev, summaryCard].slice(-MAX_HISTORY));
    setLessonDialog(null);
    setLessonDialogStreamingContent(null);

    // If student submitted an answer (check/practice phase), send it
    setIsTyping(true);  // show context-aware message while LLM works
    if (answer) {
      try {
        await ipc.invoke('chat:stream', { message: answer, studentId });
      } catch (err) {
        console.error('[ChatWindow] lesson answer submission failed:', err);
        setIsTyping(false);
      }
    } else {
      // No answer — auto-advance to next section
      try {
        await ipc.invoke('lesson:advance', { studentId });
      } catch (err) {
        console.error('[ChatWindow] lesson:advance failed:', err);
        setIsTyping(false);
      }
    }
  }, [lessonDialog, studentId]);

  const handleLessonClose = useCallback(() => {
    setLessonDialog(null);
    setLessonDialogStreamingContent(null);
  }, []);

  // ── Stream callbacks as stable useCallback refs ─────────────
  const onStreamStart = useCallback((data) => {
    // Handle mode switch (test-led → teacher-led for remediation)
    if (data.modeSwitch?.to) {
      console.log('[ChatWindow] Mode switch detected:', data.modeSwitch.to);
      setTeachingMode(data.modeSwitch.to);
    }
    if (data.teachingModel) {
      setTeachingMode(data.teachingModel);
      setTeachingPhase(data.teachingPhase);
      setTeachingSubPhase(data.teachingSubPhase || null);
      setTeachingProgress(data.teachingProgress || 0);
      setCanResume(false);

      // ===== NEW: Test mode fields =====
      if (data.teachingModel === 'test-led') {
        setTestType(data.testType || null);
        setTestScore(data.score || null);
        // Only update question counter for actual questions, not feedback/results
        // answer_feedback and test_complete don't carry questionIndex — don't clear it
        if (data.type === 'test_question' && data.questionIndex && data.totalQuestions) {
          setQuestionIndex(data.questionIndex);
          setTotalQuestions(data.totalQuestions);
          setCurrentQuestion({
            index: data.questionIndex,
            total: data.totalQuestions
          });
        }
      }
    }
    if (data.currentStep) setCurrentStep(data.currentStep);
    if (data.totalSteps)  setTotalSteps(data.totalSteps);
    if (data.stepName)    setStepName(data.stepName);
    if (data.generationStart) {
      setIsGenerating(true);
      setGenerationProgress({
        stage:   data.generationStage   || 'preparing',
        message: data.generationMessage || 'Preparing content...'
      });
    }
  }, []);

  const onGenerationProgress = useCallback((data) => {
    setGenerationProgress({
      stage:    data.stage,
      progress: data.progress,
      message:  data.message
    });
  }, []);

  const onStreamEnd = useCallback((fullText) => {
    if (teachingModeRef.current === 'teacher-led') {
      loadHomework();
    } else if (teachingModeRef.current === 'test-led') {
      // Only refresh teaching state during active testing, not after test_complete/diagnosis
      // which would cause a spurious typing indicator over the results screen.
      if (teachingPhase === 'testing' || teachingPhase === 'not_started' || !teachingPhase) {
        loadTeachingMode();
      }
    }
    setIsGenerating(false);
    setGenerationProgress(null);
    processSystemMessageQueue();
  }, [loadHomework, loadTeachingMode, teachingPhase, processSystemMessageQueue]);

  // Streaming IPC events
  useStreamHandler({
    setMessages,
    setIsTyping,
    setIsStreaming,
    setFeedbackToast,
    setLessonDialog,
    setTestQuestionDialog,
    setTestFeedback,
    setTestQuestionStreamingContent,
    setLessonDialogStreamingContent,
    autoPlayTTS,
    playedMessageIds,
    activeSubject,
    generateFollowUps,
    onAutoAdvance: handleAutoAdvance,
    onTeacherProactive: handleTeacherProactive,

    // Teaching mode callbacks
    onStreamStart: onStreamStart,
    onGenerationProgress: onGenerationProgress,
    onStreamEnd: onStreamEnd
  });

  // Stop streaming
  const stopStreaming = useCallback(async () => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (!last?.streaming) return prev;
      return [...prev.slice(0, -1), { ...last, streaming: false }];
    });
    setIsStreaming(false);
    setIsTyping(false);
    setIsGenerating(false);
    setGenerationProgress(null);

    clearAllTimers();

    try { await ipc.invoke('chat:stop'); } catch (_) {}
  }, [clearAllTimers]);

  // ===== MODIFIED: Send message with queue check =====
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      id: `msg-user-${Date.now()}-${Math.random()}`,
    };

    setMessages(prev => [...prev, userMsg].slice(-MAX_HISTORY));
    setInput('');
    setIsTyping(true);
    setAffectiveState('thinking');
    setShowSuggestions(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await ipc.invoke('chat:stream', { message: text, studentId });
    } catch (err) {
      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   '⚠️ Connection error. Please check that a model is configured in Settings.',
        timestamp: Date.now(),
        id:        `msg-error-${Date.now()}`,
      }]);
      setIsTyping(false);
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  }, [input, isTyping, studentId]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleSuggestion = useCallback((text) => {
//    setInput(text);
//    inputRef.current?.focus();
    sendMessageWithText(text);
  }, []);

  const sendMessageWithText = useCallback(async (text) => {
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      id: `msg-user-${Date.now()}-${Math.random()}`,
    };
    setMessages(prev => [...prev, userMsg].slice(-MAX_HISTORY));
    setIsTyping(true);
    setAffectiveState('thinking');
    setShowSuggestions(false);

    try {
      await ipc.invoke('chat:stream', { message: text, studentId });
    } catch (err) {
      // Error handling...
    }
  }, [studentId]);

  // ===== MODIFIED: Follow-up pill click with queue check =====
  const handleFollowUp = useCallback((text) => {
    setInput(text);
    setShowSuggestions(false);

    if (isTyping || isStreaming) {
      console.log('[ChatWindow] Already streaming, queueing follow-up');
      const timerId = setTimeout(() => {
        const userMsg = {
          role: 'user',
          content: text,
          timestamp: Date.now(),
          id: `msg-user-${Date.now()}-${Math.random()}`,
        };
        setMessages(prev => [...prev, userMsg].slice(-MAX_HISTORY));
        setInput('');
        setIsTyping(true);
        setAffectiveState('thinking');
        ipc.invoke('chat:stream', { message: text, studentId }).catch(() => {
          setMessages(prev => [...prev, {
            role:      'assistant',
            content:   '⚠️ Connection error. Please check that a model is configured in Settings.',
            timestamp: Date.now(),
            id:        `msg-error-${Date.now()}`,
          }]);
          setIsTyping(false);
          setIsGenerating(false);
          setGenerationProgress(null);
        });
      }, 500);
      pendingTimersRef.current.push(timerId);
    } else {
      setTimeout(() => {
        const userMsg = {
          role: 'user',
          content: text,
          timestamp: Date.now(),
          id: `msg-user-${Date.now()}-${Math.random()}`,
        };
        setMessages(prev => [...prev, userMsg].slice(-MAX_HISTORY));
        setInput('');
        setIsTyping(true);
        setAffectiveState('thinking');
        ipc.invoke('chat:stream', { message: text, studentId }).catch(() => {
          setMessages(prev => [...prev, {
            role:      'assistant',
            content:   '⚠️ Connection error. Please check that a model is configured in Settings.',
            timestamp: Date.now(),
            id:        `msg-error-${Date.now()}`,
          }]);
          setIsTyping(false);
          setIsGenerating(false);
          setGenerationProgress(null);
        });
      }, 0);
    }
  }, [studentId, isTyping, isStreaming]);

  // Clear chat
  const clearChat = useCallback(() => {
    ipc.invoke('chat:end-session', { studentId }).catch(() => {});
    lessonStartedRef.current = false;

    clearAllTimers();
    stopTimer();
    pendingSystemMessagesRef.current = [];

    let welcomeMsg;
    if (teachingMode === 'teacher-led') {
      welcomeMsg = makeTeacherWelcomeMessage(subjectLabel);
    } else if (teachingMode === 'test-led') {
      welcomeMsg = makeTestWelcomeMessage(subjectLabel);
    } else {
      welcomeMsg = `Fresh start! What would you like to work on? 🦉`;
    }

    setMessages([{
      role: 'system',
      content: 'Session cleared',
      timestamp: Date.now(),
    }, {
      role: 'assistant',
      content: welcomeMsg,
      timestamp: Date.now(),
      id: `msg-fresh-${Date.now()}`,
      teachingModel: teachingMode
    }]);
    setShowSuggestions(true);
    setAffectiveState('idle');
    playedMessageIds.clear();
    setTeachingPhase(null);
    setTeachingSubPhase(null);
    setTeachingProgress(0);
    setCanResume(false);
    setHomework(null);
    setNextTopic(null);
    setAutoAdvance(false);
    setNextPhase(null);
    setIsGenerating(false);
    setGenerationProgress(null);

    // ===== NEW: Clear test mode states =====
    setTestType(null);
    setTestScore(null);
    setCurrentQuestion(null);
    setQuestionIndex(0);
    setTotalQuestions(0);
  }, [studentId, playedMessageIds, teachingMode, subjectLabel, clearAllTimers, stopTimer]);

  const latestIndex = useMemo(() =>
    messages.reduce((acc, m, i) => m.role !== 'system' ? i : acc, -1),
    [messages]
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Mascot affectiveState={affectiveState} isTyping={isTyping} compact />
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '1rem',
              color: 'var(--text-primary)',
            }}>
              Tute {teachingMode === 'teacher-led' && '👩‍🏫'}
              {teachingMode === 'test-led' && '📝'}
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              {isTyping ? '✍️ Thinking...' : '● Online'}
              {teachingMode === 'teacher-led' && teachingPhase && teachingPhase !== 'not_started' && (
                <span style={{ marginLeft: '8px' }}>
                  • {teachingSubPhase || teachingPhase}
                </span>
              )}
              {teachingMode === 'test-led' && testType && (
                <span style={{ marginLeft: '8px' }}>
                  • {testType} test
                  {testScore !== null && ` • ${Math.round(testScore)}%`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {teachingMode === 'teacher-led' && homework && (
            <HomeworkIndicator
              homework={homework}
              onView={handleViewHomework}
            />
          )}

          {/* ===== NEW: Test mode action buttons ===== */}
          {teachingMode === 'test-led' && currentQuestion && (
            <>
              <button
                className="btn-icon"
                onClick={handleGetHint}
                data-tooltip="Get hint"
                style={{ fontSize: '1rem' }}
              >
                💡
              </button>
              <button
                className="btn-icon"
                onClick={handleSkipQuestion}
                data-tooltip="Skip question"
                style={{ fontSize: '1rem' }}
              >
                ⏭️
              </button>
            </>
          )}

          <button
            className="btn-icon"
            onClick={clearChat}
            data-tooltip="Clear chat"
            style={{ fontSize: '1rem' }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Teaching Phase Timeline */}
      {teachingMode === 'teacher-led' && teachingPhase && teachingPhase !== 'not_started' && (
        <TeachingPhaseTimeline
          currentPhase={teachingPhase}
          currentSubPhase={teachingSubPhase}
        />
      )}

      {/* Teacher mode header */}
      {teachingMode === 'teacher-led' && teachingPhase && teachingPhase !== 'not_started' && (
        <TeacherModeHeader
          phase={teachingPhase}
          subPhase={teachingSubPhase}
          progress={teachingProgress}
          topic={currentTopic || 'Calculus'}
          duration="45min"
          onResume={handleResumeLesson}
          canResume={canResume}
          autoAdvance={autoAdvance}
          nextPhase={nextPhase}
        />
      )}

      {/* ===== NEW: Test mode header ===== */}
      {teachingMode === 'test-led' && teachingPhase && teachingPhase !== 'not_started' && (
        <TestModeHeader
          phase={teachingPhase}
          subPhase={teachingSubPhase || testType}
          progress={teachingProgress}
          testType={testType}
          score={testScore}
          currentQuestion={currentQuestion}
          timeRemaining={timeRemaining}
          onResume={handleResumeTest}
          canResume={canResume}
          autoAdvance={autoAdvance}
          nextPhase={nextPhase}
        />
      )}

      {/* Lesson Progress */}
      {teachingMode === 'teacher-led' && teachingPhase && teachingPhase !== 'not_started' && (
        <LessonProgress
          currentStep={currentStep}
          totalSteps={totalSteps}
          stepName={stepName}
          progress={teachingProgress}
        />
      )}

      {/* Content generation indicator */}
      {isGenerating && generationProgress && (
        <ContentGenerationIndicator
          stage={generationProgress.stage}
          progress={generationProgress.progress}
          message={generationProgress.message}
        />
      )}

      {/* ── Answer feedback toast — sits inline below the TestModeHeader, above messages ── */}
      {feedbackToast && (
        <div style={{
          flexShrink: 0,
          margin: '0 20px 8px',
          background: feedbackToast.isCorrect
            ? 'var(--success-soft, rgba(34,197,94,0.12))'
            : 'var(--error-soft, rgba(239,68,68,0.12))',
          border: `1px solid ${feedbackToast.isCorrect ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)'}`,
          borderRadius: '12px',
          padding: '12px 16px',
          animation: 'slideDown 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
              {feedbackToast.isCorrect ? '✅' : '❌'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600,
                color: feedbackToast.isCorrect ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)',
                marginBottom: feedbackToast.detailedFeedback ? '4px' : 0,
                fontSize: '0.9rem',
              }}>
                {feedbackToast.isCorrect ? 'Correct!' : 'Not quite right'}
              </div>
              {feedbackToast.detailedFeedback && (
                <div style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  maxHeight: '120px',
                  overflowY: 'auto',
                }}>
                  <RichMathText content={feedbackToast.detailedFeedback} />
                </div>
              )}
            </div>
            {/* Close button — toast stays open until student dismisses it */}
            <button
              onClick={() => setFeedbackToast(null)}
              title="Dismiss"
              style={{
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1rem',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
                opacity: 0.7,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Messages area ── */}
      <div style={{
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,          /* CRITICAL: allows scrolling without expanding beyond container */
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>

        {/* Suggestions panel - only show in appropriate modes */}
        {teachingMode !== 'teacher-led' && showSuggestions && messages.length <= 2 && suggestions.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
            padding: '8px 0',
            animation: 'slideUp 0.4s ease both',
          }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(s.text)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  fontFamily: 'var(--font-body)',
                  lineHeight: 1.4,
                  animationDelay: `${i * 0.06}s`,
                  animation: 'slideUp 0.4s ease both',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            message={msg}
            isLatest={i === latestIndex}
            onFollowUp={handleFollowUp}
            onResponse={handleStudentResponse}
          />
        ))}

        {/* Typing indicator — context-aware message, only shown before stream starts */}
        {isTyping && !isStreaming && (
          <TypingIndicator message={
            teachingMode === 'test-led'
              ? (teachingPhase === 'testing'
                  ? (testQuestionDialog
                      ? 'Checking your answer...'
                      : 'Generating next question...')
                  : teachingPhase === 'diagnosis'
                    ? 'Analysing your results...'
                    : teachingPhase === 'remediation'
                      ? 'Preparing remediation...'
                      : 'Starting test...')
              : teachingMode === 'teacher-led'
                ? (teachingPhase === 'checking' || teachingPhase === 'check'
                    ? 'Checking your answer...'
                    : teachingPhase === 'practicing'
                      ? 'Evaluating your answer...'
                      : teachingPhase === 'introducing' || teachingPhase === 'explaining'
                        ? 'Preparing lesson...'
                        : 'Thinking...')
                : null
          } />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Stop button */}
      {isStreaming && (
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          padding:        '8px 20px 0',
          background:     'var(--bg-surface)',
          borderTop:      '1px solid var(--border)',
          flexShrink:     0,
        }}>
          <button
            onClick={stopStreaming}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          7,
              background:   'var(--bg-elevated)',
              border:       '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-full)',
              color:        'var(--text-secondary)',
              fontSize:     '0.8rem',
              fontWeight:   600,
              padding:      '7px 18px',
              cursor:       'pointer',
              transition:   'all 0.15s ease',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background   = '#ff444422';
              e.currentTarget.style.borderColor  = '#ff4444';
              e.currentTarget.style.color        = '#ff6666';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background   = 'var(--bg-elevated)';
              e.currentTarget.style.borderColor  = 'var(--border-bright)';
              e.currentTarget.style.color        = 'var(--text-secondary)';
            }}
          >
            <span style={{
              width: 9, height: 9,
              background:   'currentColor',
              borderRadius: 2,
              display:      'inline-block',
              flexShrink:   0,
            }} />
            Stop response
          </button>
        </div>
      )}

      {/* Next topic suggestion */}
      {teachingMode === 'teacher-led' && nextTopic && (
        <div style={{ padding: '0 20px 12px' }}>
          <NextTopicSuggestion
            topic={nextTopic}
            onAccept={handleStartNextTopic}
          />
        </div>
      )}

      {/* ── Input area ── */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        {/* Keyboard hint */}
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          marginBottom: '8px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          <span>↵ Send</span>
          <span>⇧↵ New line</span>
          <span>Use $x^2$ for inline maths</span>
          <span>Click ∑ for equation editor</span>
          {teachingMode === 'teacher-led' && teachingPhase === 'interrupted' && (
            <span style={{ color: 'var(--warning)' }}>• Lesson paused — click Resume to continue</span>
          )}
          {teachingMode === 'test-led' && teachingPhase === 'interrupted' && (
            <span style={{ color: 'var(--warning)' }}>• Test paused — click Resume to continue</span>
          )}
          {teachingMode === 'test-led' && teachingPhase === 'testing' && currentQuestion && (
            <span style={{ color: 'var(--accent)' }}>• Question {questionIndex} of {totalQuestions}</span>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={teachingMode === 'teacher-led'
                ? "Follow the lesson..."
                : teachingMode === 'test-led'
                  ? "Type your answer, or ask a question..."
                  : "Ask a question, request a worked example, or paste your working…"}
              disabled={isTyping}
              rows={1}
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
                padding: '12px 16px',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.6,
                minHeight: '46px',
                maxHeight: '140px',
                overflowY: 'auto',
                transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                paddingRight: '50px',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />

            <MathEditorButton
              onClick={() => setMathEditorOpen(true)}
              disabled={isTyping}
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: input.trim() && !isTyping
                ? 'var(--accent)'
                : 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: input.trim() && !isTyping ? 'var(--btn-text)' : 'var(--text-muted)',
              fontSize: '1.1rem',
              cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-fast)',
              flexShrink: 0,
              boxShadow: input.trim() && !isTyping ? 'var(--shadow-accent)' : 'none',
            }}
          >
            {isTyping ? <span className="spinner spinner-sm" /> : '↑'}
          </button>
        </div>
      </div>

      {/* ── Test question dialog (test-led modal) ── */}
      {testQuestionDialog && (
        <TestQuestionDialog
          question={testQuestionDialog.question}
          questionIndex={testQuestionDialog.questionIndex}
          totalQuestions={testQuestionDialog.totalQuestions}
          onSubmit={handleTestQuestionSubmit}
          onClose={handleTestQuestionClose}
          feedback={testFeedback}
          onFeedbackClose={handleTestFeedbackClose}
          streaming={testQuestionDialog.streaming === true}
          streamingContent={testQuestionStreamingContent}
        />
      )}

      {/* ── Lesson section dialog (teacher-led modal) ── */}
      {lessonDialog && (
        <LessonSectionDialog
          section={lessonDialog}
          onContinue={handleLessonContinue}
          onClose={handleLessonClose}
          isCheckPhase={lessonDialog.isCheckPhase}
          streaming={lessonDialog.streaming === true}
          streamingContent={lessonDialogStreamingContent}
        />
      )}

      {/* Math editor dialog */}
      {mathEditorOpen && (
        <MathEditorDialog
          onClose={() => setMathEditorOpen(false)}
          onInsert={(latex) => {
            setInput(prev => {
              const separator = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : '';
              return prev + separator + latex;
            });
          }}
          initialLatex=""
        />
      )}
    </div>
  );
}

export default ChatWindow;