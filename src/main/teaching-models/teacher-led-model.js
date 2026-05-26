// teaching-models/teacher-led-model.js
// Teacher-Led Mode: AI Teacher proactively leads the learning
// All subject knowledge from knowledge-base
// All teaching skills from skill-manager
// No hardcoding of any subject-specific content
//
// MODIFIED: Added support for __START_LESSON__ system message
// FIXED: Improved introduction content to show all dot points
// FIXED: Fixed resume handling to return proper message format with proactive flag
// FIXED: Added proper canResume logic for interrupted states

'use strict';

const BaseTeachingModel = require('./base-model');

class TeacherLedModel extends BaseTeachingModel {
  constructor(config) {
    super(config);
    this.modelName = 'teacher-led';

    // Session state - stores current lesson progress
    this.sessionState = {
      phase: 'not_started',        // not_started | introducing | explaining | checking | practicing | assessing
      subPhase: 'not_started',     // Separate subPhase tracked independently for UI accuracy
      currentLesson: null,          // Current lesson plan
      currentSectionIndex: 0,       // Index of current section in lesson plan
      currentQuestionIndex: 0,      // Index of current question (for checking phase)
      currentExerciseIndex: 0,      // Index of current exercise (for practicing phase)
      sessionStats: {
        questionsAnswered: 0,
        correctAnswers: 0,
        startTime: Date.now()
      },
      // ===== NEW: Track if lesson is interrupted =====
      isInterrupted: false,         // Whether lesson is interrupted by user question
      // ===== END NEW =====
    };
  }

  /**
   * Start a new session - called when user enters teacher-led mode
   */
  async startSession() {
    await this._loadStudentModel();

    return {
      type: 'welcome',
      message: "👩‍🏫 Teacher-Led Mode activated. I'll guide you through your learning journey.",
      suggestions: [],  // Remove 'Start lesson' suggestion - we auto-start
      model: this.modelName,
      phase: 'not_started',
      timestamp: Date.now()
    };
  }

  /**
   * Handle user input during the session
   */
  async handleUserInput(userInput, sessionState) {
    // Merge incoming session state
    if (sessionState) {
      this.sessionState = { ...this.sessionState, ...sessionState };
    }

    console.log('[TeacherLed] handleUserInput received:', userInput);
    console.log('[TeacherLed] Current phase:', this.sessionState.phase);
    console.log('[TeacherLed] Current subPhase:', this.sessionState.subPhase);
    console.log('[TeacherLed] Current section index:', this.sessionState.currentSectionIndex);
    console.log('[TeacherLed] Is interrupted:', this.sessionState.isInterrupted);

    // ===== FIXED: Handle resume command with proper detection =====
    const normalizedInput = userInput.toLowerCase().trim();
    const isResumeCommand = normalizedInput.includes('resume lesson') ||
                            normalizedInput.includes('↺ resume lesson') ||
                            normalizedInput.includes('γå║ resume lesson') ||
                            normalizedInput === 'resume';

    if (isResumeCommand && this.sessionState.phase !== 'not_started' && this.sessionState.currentLesson) {
      console.log('[TeacherLed] Received resume command, resuming lesson...');

      // ===== FIXED: Clear interrupted state when resuming =====
      this.sessionState.isInterrupted = false;
      // ===== END FIXED =====

      const lesson = this.sessionState.currentLesson;
      const section = lesson.sections[this.sessionState.currentSectionIndex];

      console.log('[TeacherLed] Current phase:', this.sessionState.phase);
      console.log('[TeacherLed] Section type:', section.type);

      // Determine the correct message content based on phase
      let messageContent;
      if (section.type === 'check') {
        // For check phase, return the current question
        const questionIndex = this.sessionState.currentQuestionIndex || 0;
        messageContent = section.questions[questionIndex];
        console.log('[TeacherLed] Returning check question:', messageContent);
      } else if (section.type === 'practice') {
        // For practice phase, return the current exercise question
        const exerciseIndex = this.sessionState.currentExerciseIndex || 0;
        messageContent = section.exercises[exerciseIndex].question;
        console.log('[TeacherLed] Returning practice question:', messageContent);
      } else {
        // For other phases, return the section content
        messageContent = section.content;
      }

      // ===== FIXED: Return with proper format including proactive flag =====
      return {
        type: 'section_start',
        skillUsed: 'teacher-led',
        message: messageContent,
        phase: this.sessionState.phase,
        subPhase: this.sessionState.subPhase,
        section: section.name,
        autoAdvance: section.autoAdvance,
        delay: section.duration,
        questionIndex: section.type === 'check' ? (this.sessionState.currentQuestionIndex + 1) : undefined,
        totalQuestions: section.type === 'check' ? section.questions.length : undefined,
        topic: lesson.topic,
        // ===== IMPORTANT: Add proactive flag for teacher messages =====
        proactive: true,
        // ===== FIXED: Include canResume state =====
        canResume: false,  // After resuming, canResume should be false
        // ===== END FIXED =====
        timestamp: Date.now()
      };
    }

    // ===== Handle system messages =====
    if (userInput === '__START_LESSON__') {
      console.log('[TeacherLed] Received __START_LESSON__ message, starting lesson...');
      return this._startNewLesson();
    }

    if (userInput === '__AUTO_ADVANCE__') {
      console.log('[TeacherLed] Received __AUTO_ADVANCE__ message, advancing lesson...');
      const advanceResponse = await this._advanceLesson();
      console.log('[TeacherLed] Advance response:', {
        phase: advanceResponse.phase,
        subPhase: advanceResponse.subPhase,
        autoAdvance: advanceResponse.autoAdvance,
        delay: advanceResponse.delay
      });
      return advanceResponse;
    }

    // Check if user wants to start a lesson (fallback)
    if (this._isStartCommand(userInput)) {
      return this._startNewLesson();
    }

    // ===== FIXED: Check if this is a question during auto-advance phases =====
    // If user asks a question during introducing or explaining phases,
    // we should interrupt the lesson and show resume button
    const isQuestion = userInput.includes('?') || userInput.length > 20;

    if ((this.sessionState.phase === 'introducing' || this.sessionState.phase === 'explaining') && isQuestion) {
      console.log('[TeacherLed] Interrupting lesson for user question');
      this.sessionState.isInterrupted = true;
      return this._routeToSkill(userInput, true); // Pass true to indicate interruption
    }
    // ===== END FIXED =====

    // Route based on current phase
    switch (this.sessionState.phase) {
      case 'introducing':
      case 'explaining':
        // In these phases, we don't expect user input - auto-advance
        console.log('[TeacherLed] Auto-advancing from phase:', this.sessionState.phase);
        return this._advanceLesson();

      case 'checking':
        return this._handleCheckPhase(userInput);

      case 'practicing':
        return this._handlePracticePhase(userInput);

      case 'assessing':
        return this._handleAssessmentPhase(userInput);

      default:
        return this._handleNotStarted(userInput);
    }
  }

  /**
   * Check if user input is a start command
   */
  _isStartCommand(input) {
    const lower = input.toLowerCase().trim();
    const startCommands = ['start', 'begin', 'start lesson', 'begin lesson', 'yes', 'ready'];
    return startCommands.includes(lower) || lower.includes('teach me');
  }

  /**
   * Handle when no lesson is active
   */
  async _handleNotStarted(userInput) {
    // If user asks a question, route to skill system
    if (userInput.length > 10 || userInput.includes('?')) {
      return this._routeToSkill(userInput);
    }

    return {
      type: 'prompt',
      message: "No active lesson. Starting lesson automatically...",
      suggestions: [],
      phase: 'not_started',
      timestamp: Date.now()
    };
  }

  /**
   * Route user input to appropriate skill (for questions during lesson)
   * @param {string} userInput - User's question
   * @param {boolean} isInterruption - Whether this is interrupting an auto-advance phase
   */
  async _routeToSkill(userInput, isInterruption = false) {
    const skillContext = {
      studentId: this.studentId,
      memory: this.memory,
      studentModel: this.studentModel,
      model: this.model,
      knowledgeBase: this.knowledgeBase
    };

    const matchResult = await this.skillManager.matchAndExecute(
      userInput,
      { userInput },
      skillContext
    );

    const response = matchResult.isToolBased
      ? matchResult.result?.result || ''
      : matchResult.result?.result || '';

    // ===== FIXED: Return with proper canResume flag =====
    return {
      type: 'skill_response',
      message: response,
      // If this is an interruption, set canResume to true
      canResume: isInterruption,
      // ===== END FIXED =====
      suggestions: [],
      timestamp: Date.now()
    };
  }

  /**
   * Start a new lesson - determine what to teach based on student model
   */
  async _startNewLesson() {
    await this._loadStudentModel();

    // 1. Determine which topic to teach
    const topicToTeach = await this._selectTopic();

    if (!topicToTeach) {
      console.error('[TeacherLed] No topic selected!');
      return {
        type: 'error',
        message: "I couldn't determine what to teach. Please try again.",
        phase: 'not_started',
        timestamp: Date.now()
      };
    }

    // 2. Get lesson plan from knowledge base or generate dynamically
    const lessonPlan = await this._generateLessonPlan(topicToTeach);

    // 3. Store lesson in session
    this.sessionState.currentLesson = lessonPlan;
    this.sessionState.currentSectionIndex = 0;
    this.sessionState.phase = 'introducing';
    this.sessionState.subPhase = 'introduction';
    // ===== FIXED: Reset interrupted state =====
    this.sessionState.isInterrupted = false;
    // ===== END FIXED =====

    // 4. Get the first section (introduction)
    const firstSection = lessonPlan.sections[0];

    console.log('[TeacherLed] New lesson started:', {
      topic: topicToTeach,
      phase: this.sessionState.phase,
      subPhase: this.sessionState.subPhase,
      sectionName: firstSection.name,
      autoAdvance: firstSection.autoAdvance,
      delay: firstSection.duration
    });

    return {
      type: 'section_start',
      skillUsed: 'teacher-led',
      message: firstSection.content,
      phase: 'introducing',
      subPhase: 'introduction',
      section: firstSection.name,
      autoAdvance: true,
      delay: firstSection.duration || 4000,
      topic: topicToTeach,
      // ===== IMPORTANT: Add proactive flag for teacher messages =====
      proactive: true,
      // ===== FIXED: Include canResume state =====
      canResume: false,
      // ===== END FIXED =====
      timestamp: Date.now()
    };
  }

  /**
   * Build a flat lookup map from the KB's nested topics array.
   * Supports both flat { topicCode: {...} } and nested { topics: [...] } shapes.
   * Returns { "EA-CM1": { name, dotPoints, ... }, ... }
   * @private
   */
  _buildTopicLookup() {
    const kb = this.knowledgeBase || {};

    // Shape A: already a flat map keyed by topic code (maths KB style)
    if (kb.syllabusMap && !Array.isArray(kb.syllabusMap) && !kb.syllabusMap.topics) {
      return kb.syllabusMap;
    }

    // Shape B: { topics: [ { code, subtopics: [ { code, dotPoints } ] } ] }
    const topicsArray = kb.syllabusMap?.topics || kb.topics || [];
    const lookup = {};

    for (const topic of topicsArray) {
      // Register the top-level topic itself
      lookup[topic.code] = {
        name: topic.name,
        code: topic.code,
        examWeightPercent: topic.examWeightPercent,
        paper: topic.paper,
        dotPoints: [],
        subtopics: topic.subtopics || [],
      };

      // Register each subtopic
      for (const sub of (topic.subtopics || [])) {
        lookup[sub.code] = {
          name: sub.name,
          code: sub.code,
          parentTopic: topic.code,
          dotPoints: sub.dotPoints || [],
        };

        // Register individual dot points too
        for (const dp of (sub.dotPoints || [])) {
          lookup[dp.code] = {
            name: dp.name,
            code: dp.code,
            parentSubtopic: sub.code,
            parentTopic: topic.code,
            keywords: dp.keywords || [],
            difficulty: dp.difficulty || 'intermediate',
          };
          // Accumulate dot points up to parent topic
          lookup[topic.code].dotPoints.push(dp);
        }
      }
    }

    return lookup;
  }

  /**
   * Select which topic to teach based on student model.
   * Validates every candidate against the actual KB so subject IDs
   * (e.g. "english-advanced") stored in velocity data are never used as topics.
   */
  async _selectTopic() {
    const topicLookup = this._buildTopicLookup();
    const validTopicCodes = new Set(Object.keys(topicLookup));

    if (validTopicCodes.size === 0) {
      console.warn('[TeacherLed] Knowledge base has no topics — cannot select a topic.');
      return null;
    }

    // Helper: return the first entry from a list that exists in the KB
    const firstValid = (list) => list.find(code => validTopicCodes.has(code)) || null;

    const atRiskTopics    = this.studentModel.examReadinessForecast?.criticalTopics || [];
    const stallingTopics  = this.studentModel.velocity?.needsIntervention || [];
    const weakestTopics   = (this.studentModel.weakestTopics || []).map(t => t.code);

    // Prefer subtopic-level codes (e.g. "EA-CM1") over top-level (e.g. "EA-CM")
    // so the lesson has a focused, teachable scope
    const subtopicCodes = Object.keys(topicLookup).filter(
      code => topicLookup[code].parentTopic
    );
    const fallbackTopic = subtopicCodes[0] || [...validTopicCodes][0];

    let selectedTopic = null;

    if ((selectedTopic = firstValid(atRiskTopics))) {
      console.log('[TeacherLed] Selected at-risk topic:', selectedTopic);
    } else if ((selectedTopic = firstValid(stallingTopics))) {
      console.log('[TeacherLed] Selected stalling topic:', selectedTopic);
    } else if ((selectedTopic = firstValid(weakestTopics))) {
      console.log('[TeacherLed] Selected weakest topic:', selectedTopic);
    } else {
      selectedTopic = fallbackTopic;
      console.log('[TeacherLed] No student-model topic matched KB — using first subtopic:', selectedTopic);
    }

    return selectedTopic;
  }

  /**
   * Generate a lesson plan for a topic
   * Uses knowledge base for content, skills for interactive parts
   */
  async _generateLessonPlan(topicCode) {
    // Use the normalised lookup that handles both flat and nested KB shapes
    const topicLookup = this._buildTopicLookup();
    const topicData   = topicLookup[topicCode] || {};
    const topicName   = topicData.name || topicCode;

    // Diagnostic logging — surface missing KB fields immediately in the console
    console.log(`[TeacherLed] Generating lesson plan for topic: "${topicCode}"`);
    console.log(`[TeacherLed] topicName resolved to: "${topicName}"`);
    console.log(`[TeacherLed] topicData keys: [${Object.keys(topicData).join(', ') || 'NONE — topic not found in KB'}]`);
    if (!topicData.introduction && !topicData.description && !topicData.overview) {
      console.warn(`[TeacherLed] No introduction/description/overview for "${topicCode}" — will use dot-point keywords as fallback.`);
    }

    // Build explanation by calling the explain-concept skill so the AI
    // actually *teaches* the content rather than just listing dot-point names.
    const dotPoints = topicData.dotPoints || [];

    let explanation = topicData.description ||
                      topicData.overview ||
                      topicData.content ||
                      topicData.summary ||
                      null;

    if (!explanation) {
      // Prefer the explain-concept skill so the AI generates a real explanation
      const explainSkill = this.skillManager?.getSkill('explain-concept');
      if (explainSkill) {
        try {
          console.log(`[TeacherLed] Calling explain-concept skill for topic: "${topicCode}"`);
          const skillContext = {
            studentId: this.studentId,
            memory: this.memory,
            studentModel: this.studentModel,
            model: this.model,
            knowledgeBase: this.knowledgeBase
          };
          const skillResult = await explainSkill.module.execute(
            {
              userInput: `Explain ${topicName}`,
              dotPoint: topicCode,
              activeSubject: this.activeSubject || this.knowledgeBase?.subjectId || 'maths-advanced',
              teacherLedMode: true,
              useEnhanced: true
            },
            skillContext
          );
          explanation = skillResult?.result || null;
          console.log(`[TeacherLed] explain-concept skill returned explanation of length: ${explanation?.length || 0}`);
        } catch (err) {
          console.warn('[TeacherLed] explain-concept skill failed, falling back to dot-point summary:', err.message);
        }
      }

      // Fallback: if skill unavailable or failed, build structured summary from dot points
      if (!explanation && dotPoints.length > 0) {
        const dpLines = dotPoints.map(dp => {
          const kwSample = dp.keywords?.slice(0, 4).join(', ');
          return `**${dp.name}**${kwSample ? ` — key terms: *${kwSample}*` : ''}`;
        }).join('\n\n');
        explanation = `Here are the key concepts we need to understand in **${topicName}**:\n\n${dpLines}`;
        console.log(`[TeacherLed] Fallback: explanation built from KB dot points (explain-concept skill unavailable).`);
      } else if (!explanation) {
        explanation = `Let's explore **${topicName}**. This topic contains important concepts that commonly appear in HSC exams. We'll work through each one carefully.`;
      }
    } else {
      console.log(`[TeacherLed] Explanation loaded directly from KB for "${topicCode}".`);
    }

    // Check questions — built from KB dot-point names so they're always subject-relevant
    const checkQuestions = topicData.checkQuestions ||
      (dotPoints.length > 0
        ? dotPoints.slice(0, 3).map(dp => `Can you explain: ${dp.name}?`)
        : [
            `Can you explain in your own words what ${topicName} means?`,
            `Why is ${topicName} important for the HSC exam?`,
            `Can you give an example related to ${topicName}?`
          ]);

    // Get practice exercises from knowledge base
    const practiceExercises = topicData.practiceExercises || [
      {
        question: `Practice applying ${topicName} with this example.`,
        expectedAnswer: '',
        hint: 'Think step by step.'
      }
    ];

    // ===== FIXED: Build introduction content that shows ALL dot points =====
    let introduction;
    if (topicData.introduction || topicData.overview || topicData.summary) {
      introduction = `Today we're going to learn about **${topicName}**.\n\n${
        topicData.introduction || topicData.overview || topicData.summary
      }`;
    } else if (dotPoints.length > 0) {
      // Build a comprehensive introduction listing ALL dot points
      const dotPointNames = dotPoints.map(dp => dp.name).filter(Boolean);

      if (dotPointNames.length === 1) {
        introduction = `Today we're going to learn about **${dotPointNames[0]}**, which is a key concept in **${topicName}**.`;
      } else if (dotPointNames.length === 2) {
        introduction = `Today we're going to explore two important concepts in **${topicName}**:\n\n- ${dotPointNames[0]}\n- ${dotPointNames[1]}`;
      } else {
        const bulletPoints = dotPointNames.map(name => `- ${name}`).join('\n');
        introduction = `Today we're going to explore ${dotPointNames.length} key concepts in **${topicName}**:\n\n${bulletPoints}`;
      }
    } else {
      introduction = `Today we're going to learn about **${topicName}**. This is an important topic in the HSC syllabus. By the end of this lesson you'll understand the key concepts and how to apply them.`;
    }
    // ===== END FIX =====

    // Build lesson plan with sections
    return {
      topic: topicCode,
      name: topicName,
      sections: [
        {
          type: 'introduction',
          name: 'Introduction',
          content: introduction,
          duration: 1000, // ===== TEMP: reduced for testing =====
          autoAdvance: true
        },
        {
          type: 'explanation',
          name: 'Explanation',
          content: explanation,
          duration: 1000, // ===== TEMP: reduced for testing =====
          autoAdvance: true
        },
        {
          type: 'check',
          name: 'Check Understanding',
          questions: checkQuestions,
          duration: 0,
          autoAdvance: false
        },
        {
          type: 'practice',
          name: 'Practice',
          exercises: practiceExercises,
          duration: 0,
          autoAdvance: false
        },
        {
          type: 'assessment',
          name: 'Assessment',
          content: `Great work! Let's do a quick assessment to make sure you've mastered ${topicName}.`,
          duration: 3000,
          autoAdvance: true
        }
      ]
    };
  }

  /**
   * Advance to the next section of the lesson
   */
  async _advanceLesson() {
    console.log('[TeacherLed] ===== ADVANCING LESSON =====');
    console.log('[TeacherLed] Current section index:', this.sessionState.currentSectionIndex);

    const lesson = this.sessionState.currentLesson;
    if (!lesson) {
      console.log('[TeacherLed] No current lesson, starting new lesson...');
      return this._startNewLesson();
    }

    const nextIndex = this.sessionState.currentSectionIndex + 1;
    console.log('[TeacherLed] Next section index:', nextIndex);
    console.log('[TeacherLed] Total sections:', lesson.sections.length);

    // Check if we've completed all sections
    if (nextIndex >= lesson.sections.length) {
      console.log('[TeacherLed] All sections completed, completing lesson...');
      return this._completeLesson();
    }

    // Move to next section
    this.sessionState.currentSectionIndex = nextIndex;
    const section = lesson.sections[nextIndex];
    this.sessionState.phase = section.type;

    console.log('[TeacherLed] Moving to section:', {
      type: section.type,
      name: section.name,
      autoAdvance: section.autoAdvance,
      duration: section.duration
    });

    // Reset indexes for new section
    if (section.type === 'check') {
      this.sessionState.currentQuestionIndex = 0;
      console.log('[TeacherLed] Reset question index for check phase');
    } else if (section.type === 'practice') {
      this.sessionState.currentExerciseIndex = 0;
      console.log('[TeacherLed] Reset exercise index for practice phase');
    }

    // Map section type to subPhase for UI
    const subPhaseMap = {
      'introduction': 'introduction',
      'explanation': 'explanation',
      'check': 'checking',
      'practice': 'practice',
      'assessment': 'assessment'
    };

    // Keep subPhase in sync with the section we just moved to
    this.sessionState.subPhase = subPhaseMap[section.type] || section.type;

    const response = {
      type: 'section_start',
      skillUsed: 'teacher-led',
      message: section.type === 'check'
        ? section.questions[0]
        : (section.type === 'practice' ? section.exercises[0].question : section.content),
      phase: section.type,
      subPhase: this.sessionState.subPhase,
      section: section.name,
      autoAdvance: section.autoAdvance,
      delay: section.duration,
      questionIndex: section.type === 'check' ? 1 : undefined,
      totalQuestions: section.type === 'check' ? section.questions.length : undefined,
      topic: lesson.topic,
      // ===== IMPORTANT: Add proactive flag for teacher messages =====
      proactive: true,
      // ===== FIXED: Include canResume state based on section type =====
      canResume: section.type === 'check' || section.type === 'practice', // Resume available for interactive phases
      // ===== END FIXED =====
      timestamp: Date.now()
    };

    console.log('[TeacherLed] Returning advance response:', {
      phase: response.phase,
      subPhase: response.subPhase,
      autoAdvance: response.autoAdvance,
      delay: response.delay,
      canResume: response.canResume,
      messagePreview: response.message.substring(0, 50) + '...'
    });

    return response;
  }

  /**
   * Handle check phase - student answers questions
   */
  async _handleCheckPhase(userInput) {
    const lesson = this.sessionState.currentLesson;
    const section = lesson.sections[this.sessionState.currentSectionIndex];
    const currentQuestion = section.questions[this.sessionState.currentQuestionIndex];

    // Record that student answered
    this.sessionState.sessionStats.questionsAnswered++;

    // Use feedback skill if available
    const feedbackSkill = this.skillManager.getSkill('provide-feedback');
    let feedback = '';

    if (feedbackSkill) {
      const context = {
        studentId: this.studentId,
        memory: this.memory,
        studentModel: this.studentModel,
        model: this.model,
        knowledgeBase: this.knowledgeBase
      };

      try {
        const result = await feedbackSkill.module.execute(
          {
            question: currentQuestion,
            answer: userInput,
            topic: lesson.topic
          },
          context
        );
        feedback = result.feedback || '';

        if (result.isCorrect) {
          this.sessionState.sessionStats.correctAnswers++;
        }
      } catch (err) {
        console.warn('[TeacherLed] Feedback skill failed:', err);
      }
    }

    // Fallback feedback
    if (!feedback) {
      feedback = "Thanks for your answer. Let's continue.";
    }

    // Move to next question or next section
    const nextQuestionIndex = this.sessionState.currentQuestionIndex + 1;

    if (nextQuestionIndex < section.questions.length) {
      // More questions to ask
      this.sessionState.currentQuestionIndex = nextQuestionIndex;

      return {
        type: 'check_next',
        skillUsed: 'teacher-led',
        message: feedback + '\n\n' + section.questions[nextQuestionIndex],
        phase: 'checking',
        subPhase: 'checking',
        questionIndex: nextQuestionIndex + 1,
        totalQuestions: section.questions.length,
        autoAdvance: false,
        // ===== Add proactive flag for teacher messages =====
        proactive: true,
        // ===== FIXED: Still in check phase, so canResume is true =====
        canResume: true,
        // ===== END FIXED =====
        ...this._getStepInfo(),
        timestamp: Date.now()
      };
    } else {
      // All questions answered, move to next section
      this.sessionState.currentSectionIndex++;
      const nextSection = lesson.sections[this.sessionState.currentSectionIndex];
      this.sessionState.phase = nextSection.type;

      const subPhaseMap = {
        'practice': 'practice',
        'assessment': 'assessment'
      };
      const nextSubPhase = subPhaseMap[nextSection.type] || nextSection.type;
      this.sessionState.subPhase = nextSubPhase;

      return {
        type: 'check_complete',
        skillUsed: 'teacher-led',
        message: feedback + '\n\n' + nextSection.content,
        phase: nextSection.type,
        subPhase: nextSubPhase,
        autoAdvance: nextSection.autoAdvance,
        delay: nextSection.duration,
        // ===== Add proactive flag for teacher messages =====
        proactive: true,
        // ===== FIXED: canResume depends on next section type =====
        canResume: nextSection.type === 'practice', // Practice phase needs resume, assessment auto-advances
        // ===== END FIXED =====
        ...this._getStepInfo(),
        timestamp: Date.now()
      };
    }
  }

  /**
   * Handle practice phase - student does exercises
   */
  async _handlePracticePhase(userInput) {
    const lesson = this.sessionState.currentLesson;
    const section = lesson.sections[this.sessionState.currentSectionIndex];
    const currentExercise = section.exercises[this.sessionState.currentExerciseIndex];

    // Use evaluate-answer skill if available
    const evaluateSkill = this.skillManager.getSkill('evaluate-answer');
    let evaluation = { isCorrect: false, feedback: '' };

    if (evaluateSkill) {
      const context = {
        studentId: this.studentId,
        memory: this.memory,
        studentModel: this.studentModel,
        model: this.model,
        knowledgeBase: this.knowledgeBase
      };

      try {
        evaluation = await evaluateSkill.module.execute(
          {
            exercise: currentExercise,
            answer: userInput
          },
          context
        );
      } catch (err) {
        console.warn('[TeacherLed] Evaluate skill failed:', err);
      }
    }

    // Fallback evaluation
    if (!evaluation.feedback) {
      evaluation.feedback = evaluation.isCorrect
        ? "Correct! Good job."
        : "Not quite right. Try again or ask for a hint.";
    }

    if (evaluation.isCorrect) {
      // Move to next exercise
      const nextExerciseIndex = this.sessionState.currentExerciseIndex + 1;

      if (nextExerciseIndex < section.exercises.length) {
        this.sessionState.currentExerciseIndex = nextExerciseIndex;

        return {
          type: 'practice_next',
          skillUsed: 'teacher-led',
          message: evaluation.feedback + '\n\n' + section.exercises[nextExerciseIndex].question,
          phase: 'practicing',
          subPhase: 'practice',
          exerciseIndex: nextExerciseIndex + 1,
          totalExercises: section.exercises.length,
          autoAdvance: false,
          // ===== Add proactive flag for teacher messages =====
          proactive: true,
          // ===== FIXED: Still in practice phase, so canResume is true =====
          canResume: true,
          // ===== END FIXED =====
          timestamp: Date.now()
        };
      } else {
        // All exercises complete, move to next section
        this.sessionState.currentSectionIndex++;
        const nextSection = lesson.sections[this.sessionState.currentSectionIndex];
        this.sessionState.phase = nextSection.type;
        this.sessionState.subPhase = 'assessment';

        return {
          type: 'practice_complete',
          skillUsed: 'teacher-led',
          message: evaluation.feedback + '\n\n' + nextSection.content,
          phase: nextSection.type,
          subPhase: 'assessment',
          autoAdvance: nextSection.autoAdvance,
          delay: nextSection.duration,
          // ===== Add proactive flag for teacher messages =====
          proactive: true,
          // ===== FIXED: Assessment auto-advances, so canResume is false =====
          canResume: false,
          // ===== END FIXED =====
          timestamp: Date.now()
        };
      }
    } else {
      // Answer incorrect, allow retry
      return {
        type: 'practice_retry',
        skillUsed: 'teacher-led',
        message: evaluation.feedback + '\n\nTry again.',
        phase: 'practicing',
        subPhase: 'practice',
        canRetry: true,
        hint: currentExercise.hint,
        autoAdvance: false,
        // ===== Add proactive flag for teacher messages =====
        proactive: true,
        // ===== FIXED: Still in practice phase, so canResume is true =====
        canResume: true,
        // ===== END FIXED =====
        ...this._getStepInfo(),
        timestamp: Date.now()
      };
    }
  }

  /**
   * Handle assessment phase
   */
  async _handleAssessmentPhase(userInput) {
    // Simple assessment - could be more sophisticated
    const accuracy = this.sessionState.sessionStats.questionsAnswered > 0
      ? Math.round((this.sessionState.sessionStats.correctAnswers / this.sessionState.sessionStats.questionsAnswered) * 100)
      : 0;

    const assessmentResult = accuracy >= 70 ? 'passed' : 'needs_review';

    return {
      type: 'assessment_result',
      skillUsed: 'teacher-led',
      message: assessmentResult === 'passed'
        ? `Great job! You got ${accuracy}% correct. You've mastered this topic!`
        : `You got ${accuracy}% correct. Let's review this topic again next time.`,
      phase: 'assessing',
      subPhase: 'assessment',
      autoAdvance: true,
      delay: 5000,
      // ===== Add proactive flag for teacher messages =====
      proactive: true,
      // ===== FIXED: Assessment auto-advances, so canResume is false =====
      canResume: false,
      // ===== END FIXED =====
      timestamp: Date.now()
    };
  }

  /**
   * Complete the lesson
   */
  async _completeLesson() {
    this.sessionState.phase = 'not_started';
    this.sessionState.subPhase = 'not_started';
    this.sessionState.currentLesson = null;
    this.sessionState.isInterrupted = false;

    return {
      type: 'lesson_complete',
      skillUsed: 'teacher-led',
      message: "🎉 Lesson complete! Great work today.\n\nStarting next lesson automatically...",
      suggestions: [],
      autoAdvance: true,
      delay: 3000,
      // ===== Add proactive flag for teacher messages =====
      proactive: true,
      // ===== FIXED: Lesson complete, canResume is false =====
      canResume: false,
      // ===== END FIXED =====
      timestamp: Date.now()
    };
  }

  /**
   * End the session
   */
  async endSession() {
    return {
      type: 'goodbye',
      message: 'Teacher-Led session ended. Come back when you want to learn more!',
      timestamp: Date.now()
    };
  }

  /**
   * Get current step counter info for inclusion in teaching responses.
   */
  _getStepInfo() {
    const sections = this.sessionState.currentLesson?.sections || [];
    const sectionIndex = this.sessionState.currentSectionIndex;
    const section = sections[sectionIndex];
    return {
      currentStep: Math.min(sectionIndex + 1, sections.length || 1),
      totalSteps: sections.length || 5,
      stepName: section?.name || null,
    };
  }

  getTeachingState() {
    const lesson = this.sessionState.currentLesson;
    const sections = lesson?.sections || [];
    const sectionIndex = this.sessionState.currentSectionIndex;
    const section = sections[sectionIndex];

    // currentStep is 1-based for display
    const totalSteps = sections.length || 5;
    const currentStep = Math.min(sectionIndex + 1, totalSteps);

    // ===== FIXED: Determine canResume based on interruption or interactive phases =====
    let canResume = false;

    if (this.sessionState.isInterrupted) {
      // If interrupted by user question, canResume is true
      canResume = true;
    } else if (section) {
      // For interactive phases (check, practice), canResume is true
      // For auto-advance phases (introduction, explanation, assessment), canResume is false
      canResume = section.type === 'check' || section.type === 'practice';
    }
    // ===== END FIXED =====

    return {
      model: this.modelName,
      phase: this.sessionState.phase,
      subPhase: this.sessionState.subPhase,
      phaseProgress: sectionIndex / (sections.length || 1) * 100,
      currentTopic: lesson?.name || null,
      currentSection: section?.name || null,
      canResume: canResume,  // ===== FIXED: Use dynamic canResume =====
      autoAdvance: true,
      // Step counter fields consumed by ChatWindow loadTeachingMode poll
      currentStep,
      totalSteps,
      stepName: section?.name || null,
    };
  }

  /**
   * Load fresh student model
   */
  _loadStudentModel() {
    return super._loadStudentModel();
  }

  /**
   * Get session stats for student model
   */
  _getSessionStats() {
    return {
      sessionAttempts: this.sessionState.sessionStats.questionsAnswered,
      recentAccuracy: this.sessionState.sessionStats.questionsAnswered > 0
        ? this.sessionState.sessionStats.correctAnswers / this.sessionState.sessionStats.questionsAnswered
        : null
    };
  }

  /**
   * Metadata for Settings UI
   */
  static getMetadata() {
    return {
      id: 'teacher-led',
      name: 'Teacher-Led Mode',
      description: 'I lead the learning with structured lessons. Perfect for learning new topics.',
      icon: '👩‍🏫',
      characteristics: [
        'I choose what to teach based on your progress',
        'I explain concepts first, then check understanding',
        'I provide practice exercises',
        'You can ask questions anytime',
        'I track your progress and adapt'
      ],
      configurable: {
        teachingPace: {
          type: 'select',
          options: ['Slow', 'Standard', 'Fast'],
          default: 'Standard',
          label: 'Teaching pace'
        },
        questionFrequency: {
          type: 'select',
          options: ['Fewer questions', 'Standard', 'More questions'],
          default: 'Standard',
          label: 'Question frequency'
        }
      }
    };
  }
}

module.exports = TeacherLedModel;