// test-led-answer-processor.js
// Handles student answer checking, feedback formatting, and adaptive difficulty.

'use strict';

function applyAnswerProcessor(proto) {

  // ── Testing phase handler ────────────────────────────────────────────────
  proto._handleTestingPhase = async function (userInput) {
    const lower = userInput.toLowerCase().trim();
    if (lower === 'skip' || lower === 'skip question') return this._skipQuestion();
    if (lower === 'hint' || lower === 'give me a hint') return this._provideHint();

    console.log(`[TestLed] Answer received: "${userInput.substring(0, 40)}"`);
    return this._processAnswer(userInput);
  };

  // ── Answer processing ────────────────────────────────────────────────────
  proto._processAnswer = async function (userInput) {
    const currentTest     = this.sessionState.currentTest;
    const currentQuestion = currentTest.questions[currentTest.currentQuestionIndex];

    if (!currentQuestion) return this._generateNextQuestion();

    if (!currentQuestion.startTime) currentQuestion.startTime = Date.now();

    // STEP 1: Check answer
    let isCorrect   = false;
    let scoreSignal = 0;
    let feedback    = '';

    // ── STEP 1a: Numerical pre-checker (deterministic, no LLM needed) ─────
    // For questions with numeric answers, evaluate the student's answer
    // mathematically before calling the LLM. This avoids LLM hallucination
    // for straightforward numerical results (fractions, decimals, integers).
    // If the pre-checker fires, we skip the LLM call entirely.
    let preCheckerFired = false;
    try {
      const mathCheck = this._numericalPreCheck(userInput, currentQuestion);
      if (mathCheck !== null) {
        isCorrect       = mathCheck;
        scoreSignal     = mathCheck ? 1.0 : 0.0;
        preCheckerFired = true;
        console.log(`[TestLed] Numerical pre-check: isCorrect=${isCorrect} for answer="${userInput}"`);
      }
    } catch (err) {
      console.warn('[TestLed] Numerical pre-check failed:', err.message);
    }

    // ── STEP 1b: LLM check-understanding (only if pre-checker didn't fire) ─
    if (!preCheckerFired) {
      try {
        const checkSkill = this.skillManager.getSkill('check-understanding');
        if (checkSkill) {
          const effectiveCorrectAnswer =
            (currentQuestion.correctAnswer === 'Student demonstrates understanding' ||
             !currentQuestion.correctAnswer)
              ? currentQuestion.explanation || 'A complete, accurate answer demonstrating understanding.'
              : currentQuestion.correctAnswer;

          const questionForSkill = {
            question:      currentQuestion.text,
            type:          currentQuestion.type,
            options:       currentQuestion.options,
            correctAnswer: effectiveCorrectAnswer,
            explanation:   currentQuestion.explanation,
            marks:         currentQuestion.marks,
          };

          const checkResult = await checkSkill.module.execute({
            action:        'evaluate',
            question:      questionForSkill,
            studentAnswer: userInput,
            topic:         currentQuestion.topic,
            activeSubject: this.knowledgeBase?.subjectId
          }, {
            studentId:    this.studentId,
            memory:       this.memory,
            studentModel: this.studentModel,
            model:        this.model,
            knowledgeBase: this.knowledgeBase
          });

          const resultText = checkResult.result || '';

          // Parse score
          if (checkResult.score === undefined || checkResult.score === null) {
            const scoreMatch = resultText.match(/score[^:\d]*[:\s]+([01](?:\.\d+)?)/i)
                            || resultText.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*1|out of 1)/i);
            if (scoreMatch) scoreSignal = Math.min(1, parseFloat(scoreMatch[1]));
          }

          // Parse isCorrect — multi-signal approach to avoid false negatives.
          // The LLM grader sometimes says "incorrect" in its preamble while its
          // worked solution confirms the answer is right.
          const hasCorrectly  = /\bcorrectly\b/i.test(resultText);
          const hasUnderstand = /demonstrates?\s+(?:a\s+)?(?:good|strong|clear|solid)?\s*understanding/i.test(resultText);
          const hasPositive   = /\b(correct answer|right answer|well done|great work|good work|good answer|excellent|is correct|answer is correct|solution is correct)\b/i.test(resultText)
                             || /\*{0,2}right\*{0,2}\s*:/i.test(resultText)
                             || /\*{0,2}correct\*{0,2}\s*:/i.test(resultText);

          // Strong negative: LLM explicitly says the answer concept is wrong
          const hasStrongNegative = /\b(wrong answer|answer is incorrect|answer is wrong|answer is not correct|solution is incorrect|solution is wrong)\b/i.test(resultText);
          const hasWeakNegative   = /\b(is incorrect|is wrong|not correct)\b/i.test(resultText);
          // Commentary phrases — present in both correct and incorrect feedback
          const hasCommentary     = /\b(mistake in|failed to|does not simplify|did not|however|but they)\b/i.test(resultText);

          // If student's answer appears in the worked solution — check string AND numerically.
          // Handles cases like student writes "11/12" but solution has "\frac{11}{12}" or "\boxed{\frac{11}{12}}".
          const parseNum = (s) => {
            if (!s) return null;
            const clean = s.replace(/\s/g, '');
            if (clean.includes('/')) {
              const [n, d] = clean.split('/').map(Number);
              return (!isNaN(n) && !isNaN(d) && d !== 0) ? n / d : null;
            }
            const v = parseFloat(clean);
            return isNaN(v) ? null : v;
          };
          const studentVal = parseNum(userInput.trim());
          const studentAnswerInSolution = (() => {
            // String match
            if (resultText.toLowerCase().includes(userInput.trim().toLowerCase())) return true;
            if (studentVal === null) return false;
            // Numerical match against \frac{a}{b} forms in solution
            const fracRe = /\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g;
            let fm;
            while ((fm = fracRe.exec(resultText)) !== null) {
              const v = parseFloat(fm[1]) / parseFloat(fm[2]);
              if (!isNaN(v) && Math.abs(v - studentVal) < 0.001) return true;
            }
            // Numerical match against \boxed{...}
            const boxRe = /\\boxed\{([^}]+)\}/g;
            let bm;
            while ((bm = boxRe.exec(resultText)) !== null) {
              const inner = bm[1].replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, n, d) => n + '/' + d);
              const bv = parseNum(inner);
              if (bv !== null && Math.abs(bv - studentVal) < 0.001) return true;
            }
            return false;
          })();

          // "False." at the very start is a grader artefact, not a real verdict
          const startsWithFalse = /^False\.?\s/i.test(resultText.trim());

          if (studentAnswerInSolution && (checkResult.isCorrect === true || hasPositive || hasCorrectly)) {
            // Answer confirmed in solution AND structured/text says correct → definitely correct
            isCorrect = true;
          } else if (studentAnswerInSolution && hasStrongNegative) {
            // Contradiction: solution confirms answer but text says wrong → trust solution
            isCorrect = true;
          } else if (hasStrongNegative && !studentAnswerInSolution && scoreSignal < 0.5) {
            isCorrect = false;
          } else if (hasWeakNegative && !startsWithFalse && !hasCommentary && scoreSignal < 0.4) {
            // Only fire weak negative if it's not just a "False." preamble artefact
            isCorrect = false;
          } else if (hasCorrectly || hasUnderstand || hasPositive) {
            isCorrect = true;
          } else if (checkResult.isCorrect === true) {
            isCorrect = true;
          } else {
            isCorrect = scoreSignal >= 0.5;
          }

          console.log(`[TestLed] LLM check: isCorrect=${isCorrect} score=${scoreSignal} strongNeg=${hasStrongNegative} weakNeg=${hasWeakNegative} answerInSolution=${studentAnswerInSolution} startsWithFalse=${startsWithFalse} structuredIsCorrect=${checkResult.isCorrect}`);

          feedback = checkResult.feedback || resultText || '';
        }
      } catch (err) {
        console.warn('[TestLed] Check-understanding failed:', err.message);
      }
    }

    // STEP 2: Error analysis + worked solution (if incorrect)
    let errorAnalysis = null;
    let errorType     = null;
    let workedSolution = null;

    if (!isCorrect) {
      try {
        const errorSkill = this.skillManager.getSkill('error-analysis');
        if (errorSkill) {
          const errorResult = await errorSkill.module.execute({
            userInput,
            studentAnswer: userInput,
            correctAnswer: currentQuestion.correctAnswer,
            dotPoint:      currentQuestion.syllabusPoint
          }, {
            studentId: this.studentId, memory: this.memory,
            studentModel: this.studentModel, model: this.model,
            knowledgeBase: this.knowledgeBase
          });
          errorAnalysis = errorResult;
          errorType     = errorResult.errorType;
        }
      } catch (err) {
        console.warn('[TestLed] Error-analysis failed:', err.message);
      }

      // Generate a worked solution so the student can see how to do it correctly.
      // We try the explain-concept skill first (rich, KB-aware), then fall back
      // to the question's own explanation field, then a brief inline prompt.
      try {
        const explainSkill = this.skillManager.getSkill('explain-concept');
        if (explainSkill && currentQuestion.topic) {
          const explainResult = await explainSkill.module.execute({
            userInput:     `Show me the worked solution for: ${currentQuestion.text}`,
            dotPoint:      currentQuestion.syllabusPoint || currentQuestion.topic,
            activeSubject: this.knowledgeBase?.subjectId,
            workedSolution: true,           // hint to skill: focus on solution steps
            correctAnswer:  currentQuestion.correctAnswer,
            studentAnswer:  userInput,
          }, {
            studentId: this.studentId, memory: this.memory,
            studentModel: this.studentModel, model: this.model,
            knowledgeBase: this.knowledgeBase
          });
          workedSolution = explainResult?.result || null;
        }
      } catch (err) {
        console.warn('[TestLed] Worked solution generation failed:', err.message);
      }

      // Fallback: use the question's own explanation if skill didn't produce anything
      if (!workedSolution && currentQuestion.explanation) {
        workedSolution = `**Solution:** ${currentQuestion.explanation}`;
      }
    }

    // STEP 3: Record answer
    const timeSpent = currentQuestion.startTime
      ? (Date.now() - currentQuestion.startTime) / 1000
      : null;

    this.sessionState.answers.push({
      question:      { ...currentQuestion },
      userAnswer:    userInput,
      isCorrect,
      score:         scoreSignal,
      errorType,
      errorAnalysis,
      timeSpent,
      timestamp:     Date.now(),
      questionIndex: currentTest.currentQuestionIndex
    });

    this.sessionState.sessionStats.questionsAnswered++;
    if (isCorrect) this.sessionState.sessionStats.correctAnswers++;

    // STEP 4: Update mastery
    // Derive syllabusPoint from KB dot-points if generate-quiz didn't supply one.
    // This is the common case — backfilling it here ensures the progress dashboard
    // always gets populated even when the question generator omits it.
    const syllabusPoint = currentQuestion.syllabusPoint
      || this._deriveSyllabusPoint(currentQuestion.topic);

    if (syllabusPoint && !currentQuestion.syllabusPoint) {
      currentQuestion.syllabusPoint = syllabusPoint; // backfill for error-analysis etc.
    }

    if (syllabusPoint) {
      try {
        this.memory.updateDotPointMastery(this.studentId, syllabusPoint, scoreSignal, 'test');
      } catch (err) {
        console.warn('[TestLed] Failed to update mastery:', err.message);
      }
    }

    // STEP 4b: Persist session state after each answer so student can resume
    try {
      if (this.memory?.saveSessionState) {
        this.memory.saveSessionState(this.studentId, 'test-led', this.sessionState);
      }
    } catch (err) {
      console.warn('[TestLed] Failed to persist session state:', err.message);
    }

    // STEP 5: Adaptive difficulty
    if (currentTest.adaptive) {
      const topic = currentQuestion.topic;
      if (topic && currentTest.topicCorrectCounts && isCorrect) {
        currentTest.topicCorrectCounts[topic] = (currentTest.topicCorrectCounts[topic] || 0) + 1;
      }
      this._updateTopicDifficulty(currentTest, topic, isCorrect);
    }

    // STEP 6: Next question or test complete
    const nextIndex         = currentTest.currentQuestionIndex + 1;
    const targetCount       = currentTest.targetQuestionCount || currentTest.questions.length;
    const questionsAnswered = this.sessionState.answers.length;

    if (questionsAnswered < targetCount) {
      currentTest.currentQuestionIndex = nextIndex;
      const studentFeedback = this._formatStudentFeedback(feedback, isCorrect, currentQuestion);

      return {
        type: 'answer_feedback',
        message: isCorrect ? '✅ Correct!' : '❌ Not quite right.',
        detailedFeedback: studentFeedback,
        workedSolution:   !isCorrect ? workedSolution : null,
        isCorrect,
        errorType,
        phase: 'testing',
        teachingPhase: 'testing',
        teachingSubPhase: currentTest.type,
        teachingProgress: this._calculateProgress(),
        currentStep: this._getCurrentStep(),
        totalSteps: this._getTotalSteps(),
        stepName: `Question ${nextIndex + 1} of ${targetCount}`,
        autoAdvance: true,
        delay: 1500,
        proactive: true,
        canResume: true,
        timestamp: Date.now()
      };
    } else {
      // Test complete
      currentTest.endTime             = Date.now();
      this.sessionState.phase         = 'diagnosis';
      this.sessionState.subPhase      = 'analyzing';
      this._calculateResults();

      const results               = this.sessionState.results;
      const diagnosisResponse     = this._buildDiagnosisResponse(results, this.sessionState.diagnosis);
      const shouldAutoRemediate   = this.sessionState.diagnosis.needsRemediation &&
                                    this._getConfig()?.autoRemediation !== false;

      return {
        type: 'test_complete',
        message: `📊 Test complete! You answered ${results.correct} of ${results.total} correctly (${Math.round(results.score)}%).\n\n${diagnosisResponse.message}`,
        results:          this.sessionState.results,
        diagnosis:        this.sessionState.diagnosis,
        phase:            'diagnosis',
        teachingPhase:    'diagnosis',
        teachingSubPhase: 'review',
        teachingProgress: this._calculateProgress(),
        currentStep:      this._getCurrentStep(),
        totalSteps:       this._getTotalSteps(),
        stepName:         'Review results',
        autoAdvance:      shouldAutoRemediate,
        delay:            shouldAutoRemediate ? 3000 : 0,
        proactive:        true,
        canResume:        false,
        suggestions:      diagnosisResponse.suggestions,
        timestamp:        Date.now()
      };
    }
  };

  // ── Feedback formatter ───────────────────────────────────────────────────
  // ── Numerical pre-checker ───────────────────────────────────────────────
  // Tries to determine correctness mathematically before calling the LLM.
  // Returns true/false if confident, or null if unable to determine.
  //
  // Strategy:
  //   1. Extract expected numerical answer(s) from the explanation text
  //   2. Parse the student's answer as a number/fraction
  //   3. Compare within a small tolerance
  //
  proto._numericalPreCheck = function (studentAnswer, question) {
    try {
      // ── Strategy ──────────────────────────────────────────────────────────
      // Only fire the pre-checker when we can extract a SPECIFIC expected answer.
      // We look exclusively at:
      //   1. The correctAnswer field (when it's not the generic placeholder)
      //   2. The question text — but only the part AFTER the last "=" sign
      //      (e.g. "Solve 3x-5=14" gives nothing; "Find x if f(x)=3, answer=6" gives 6)
      //
      // We deliberately DO NOT parse the explanation text because it contains
      // method steps with numbers like "subtract 3x", "divide by 2" that look
      // like candidate answers but are not. This caused false negatives.
      //
      // If we can't find an unambiguous expected answer, return null → LLM fallback.

      // Parse a value expression into a float: handles fractions, negatives, decimals
      const parseValue = (str) => {
        if (!str) return null;
        const s = str.replace(/\s/g, '');
        if (s.includes('/')) {
          const [n, d] = s.split('/').map(Number);
          if (!isNaN(n) && !isNaN(d) && d !== 0) return n / d;
          return null;
        }
        const v = parseFloat(s);
        return isNaN(v) ? null : v;
      };

      // Extract ALL candidate values from a string using only explicit "= X" patterns
      // This avoids picking up equation coefficients like the 3 in "3x - 7 = 5x + 1"
      const extractAnswerValues = (str) => {
        if (!str) return [];
        const vals = [];
        // Only match "x = value" or "= value" at the end of solving steps
        // Pattern: [variable =] value, e.g. "x = -4", "= 19/3", "x=-4"
        const re = /(?:^|[,;]|\bor\b)\s*(?:[a-z]\s*=\s*)?(-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)?)/gi;
        let m;
        while ((m = re.exec(str)) !== null) {
          const v = parseValue(m[1]);
          if (v !== null) vals.push(v);
        }
        return [...new Set(vals.map(n => Math.round(n * 1e9) / 1e9))];
      };

      // ── Source 1: explicit correctAnswer ──────────────────────────────────
      let expectedNums = [];
      const ca = question.correctAnswer;
      if (ca && ca !== 'Student demonstrates understanding') {
        expectedNums = extractAnswerValues(ca);
      }

      // ── Source 2: student answer itself used to find expected in question text ──
      // Only use question text if it has the form "... = <answer>" at the very end,
      // like "Evaluate f(3) if f(x)=x²+1" where text ends with a computable value.
      // Skip this for equations like "Solve 3x-5=14" which contain many = signs.
      if (expectedNums.length === 0) {
        const qText = (question.text || '').trim();
        // Count = signs — if more than 1, it's an equation to solve, not a lookup
        const eqCount = (qText.match(/=/g) || []).length;
        if (eqCount === 1) {
          // Single = in question: might be "evaluate f(x) = ?" style
          const afterEq = qText.split('=').pop().replace(/[^0-9./\-]/g, '').trim();
          const v = parseValue(afterEq);
          if (v !== null) expectedNums = [v];
        }
      }

      // ── If still no expected answer found, fall through to LLM ────────────
      if (expectedNums.length === 0) return null;

      // ── Parse student answer ───────────────────────────────────────────────
      // Student may give multiple values: "x = 4/3 or x = 1", "-4", "1 and 2"
      const studentNums = extractAnswerValues(studentAnswer);
      if (studentNums.length === 0) return null; // non-numeric → fall through

      // ── Compare ────────────────────────────────────────────────────────────
      const TOLERANCE = 0.001;
      const allStudentMatch = studentNums.every(sv =>
        expectedNums.some(ev => Math.abs(sv - ev) < TOLERANCE)
      );
      const anyExpectedMatched = expectedNums.some(ev =>
        studentNums.some(sv => Math.abs(sv - ev) < TOLERANCE)
      );

      if (allStudentMatch && anyExpectedMatched) return true;

      // Only return false when we have a CLEAR mismatch:
      // explicit correctAnswer was provided AND student's number doesn't match it
      if (ca && ca !== 'Student demonstrates understanding' && !anyExpectedMatched) {
        return false;
      }

      // Otherwise ambiguous — fall through to LLM
      return null;
    } catch (err) {
      return null; // any error → fall through to LLM
    }
  };

  proto._formatStudentFeedback = function (rawFeedback, isCorrect, question) {
    if (!rawFeedback) return null;

    try {
      // When isCorrect is true, count negative vs positive signals.
      // If the feedback is predominantly negative it's contradictory — discard it.
      if (isCorrect) {
        const lower = rawFeedback.toLowerCase();
        const negativeSignals = [
          /\bfalse\b/, /\bincorrect\b/, /did not attempt/, /did not factori/,
          /does not simplify/, /wrong answer/, /failed to/, /student did not/,
          /not correct/, /not attempt/,
        ].filter(re => re.test(lower)).length;

        const positiveSignals = [
          /\bcorrect\b/, /\bwell done\b/, /\bgreat\b/, /\bgood work\b/,
          /\bperfect\b/, /demonstrates understanding/, /correctly/, /right answer/,
        ].filter(re => re.test(lower)).length;

        if (negativeSignals > positiveSignals) {
          console.log(`[TestLed] Discarding contradictory feedback (isCorrect=true but neg=${negativeSignals} > pos=${positiveSignals})`);
          return null;
        }

        // Filter out individual negative lines
        const filtered = rawFeedback.split('\n').filter(line => {
          const l = line.toLowerCase();
          return !(/\bfalse\b/.test(l) && l.length < 20)
              && !(l.includes('incorrect') && !l.includes('not incorrect'))
              && !l.includes('did not attempt') && !l.includes('student did not')
              && !l.includes('mistake in') && !l.includes('wrong answer')
              && !l.includes('does not simplify') && !l.includes('failed to');
        }).join('\n').trim();

        if (!filtered || filtered.length < 10) return null;

        let text = filtered
          .replace(/\d+\.\s*\*{0,2}[^:\n]{0,60}\*{0,2}:\s*(true|false)\s*\n?/gi, '')
          .replace(/###[^\n]*/g, '')
          .replace(/\*\*Evaluation:\*\*/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (text.length > 350) {
          const sentences = text.match(/[^.!?\n]+[.!?]+/g) || [];
          text = sentences.slice(0, 3).join(' ').trim();
        }
        return text || null;
      }

      // When isCorrect is false — clean up the raw feedback for display
      let text = rawFeedback
        .replace(/\d+\.\s*\*{0,2}[^:\n]{0,60}\*{0,2}:\s*(true|false)\s*\n?/gi, '')
        .replace(/\d+\.\s*\*{0,2}(?:Specific\s+)?Feedback\*{0,2}[:\s]*/gi, '')
        .replace(/\d+\.\s*\*{0,2}(?:Score|Mark)\*{0,2}[^\n]*/gi, '')
        .replace(/###[^\n]*/g, '')
        .replace(/\*\*Evaluation:\*\*/gi, '')
        .replace(/\*{0,2}(right|wrong|correct|incorrect)\*{0,2}\s*:\s*/gi, '')
        .replace(/^\s*\*{1,3}\s*$/gm, '')
        .replace(/^[-•]\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (text.length > 350) {
        const sentences = text.match(/[^.!?\n]+[.!?]+/g) || [];
        text = sentences.slice(0, 3).join(' ').trim();
        if (!text) text = rawFeedback.substring(0, 280).trim();
      }

      return text || null;
    } catch (err) {
      console.warn('[TestLed] _formatStudentFeedback failed:', err.message);
      return null;
    }
  };

  // ── syllabusPoint derivation ─────────────────────────────────────────────
  // When generate-quiz doesn't return a syllabusPoint we derive one from the KB
  // using the question's topic code. Returns the first dot-point code found, or null.
  proto._deriveSyllabusPoint = function (topicCode) {
    if (!topicCode || !this.knowledgeBase) return null;

    try {
      const syllabusMap = this.knowledgeBase.syllabusMap;
      if (!syllabusMap) return null;

      // Flat map: syllabusMap[topicCode] has a dotPoints array
      const topicEntry = syllabusMap[topicCode];
      if (topicEntry?.dotPoints?.length) {
        return topicEntry.dotPoints[0]?.code || null;
      }

      // Nested map: topics → subtopics → dotPoints
      const topics = syllabusMap.topics || [];
      for (const topic of topics) {
        for (const sub of (topic.subtopics || [])) {
          if (sub.code === topicCode) {
            return sub.dotPoints?.[0]?.code || null;
          }
          for (const dp of (sub.dotPoints || [])) {
            if (dp.code === topicCode) return dp.code;
          }
        }
      }
    } catch (err) {
      console.warn('[TestLed] _deriveSyllabusPoint failed:', err.message);
    }

    return null;
  };

  // ── Difficulty tracking ──────────────────────────────────────────────────
  proto._updateDifficulty = function (isCorrect) {
    const currentTest   = this.sessionState.currentTest;
    const recentAnswers = this.sessionState.answers.slice(-3);
    const recentCorrect = recentAnswers.filter(a => a.isCorrect).length;

    if (recentAnswers.length === 3) {
      if (recentCorrect === 3) {
        if (currentTest.currentDifficulty === 'easy')   currentTest.currentDifficulty = 'medium';
        else if (currentTest.currentDifficulty === 'medium') currentTest.currentDifficulty = 'hard';
      } else if (recentCorrect === 0) {
        if (currentTest.currentDifficulty === 'hard')   currentTest.currentDifficulty = 'medium';
        else if (currentTest.currentDifficulty === 'medium') currentTest.currentDifficulty = 'easy';
      }
    }
  };

  proto._updateTopicDifficulty = function (currentTest, topic, isCorrect) {
    if (!currentTest.topicDifficulty) return;

    const current  = currentTest.topicDifficulty[topic] || 'medium';
    const correct  = currentTest.topicCorrectCounts?.[topic] || 0;
    const asked    = currentTest.topicQuestionCounts?.[topic] || 1;
    const accuracy = asked > 0 ? correct / asked : 0;

    let next = current;
    if (accuracy > 0.75 && current !== 'hard') {
      next = current === 'easy' ? 'medium' : 'hard';
    } else if (accuracy < 0.40 && current !== 'easy') {
      next = current === 'hard' ? 'medium' : 'easy';
    }

    if (next !== current) {
      console.log(`[TestLed] Topic ${topic} difficulty: ${current} → ${next} (accuracy: ${Math.round(accuracy * 100)}%)`);
    }
    currentTest.topicDifficulty[topic] = next;

    this._updateDifficulty(isCorrect);
  };

  // ── Skip / hint ──────────────────────────────────────────────────────────
  proto._skipQuestion = async function () {
    const currentTest     = this.sessionState.currentTest;
    const currentQuestion = currentTest.questions[currentTest.currentQuestionIndex];

    this.sessionState.answers.push({
      question:      { ...currentQuestion },
      userAnswer:    '[SKIPPED]',
      isCorrect:     false,
      score:         0,
      errorType:     'skipped',
      timeSpent:     null,
      timestamp:     Date.now(),
      questionIndex: currentTest.currentQuestionIndex,
      skipped:       true
    });

    const nextIndex = currentTest.currentQuestionIndex + 1;

    if (nextIndex < currentTest.questions.length) {
      currentTest.currentQuestionIndex = nextIndex;
      return this._presentCurrentQuestion();
    }

    currentTest.endTime           = Date.now();
    this.sessionState.phase       = 'diagnosis';
    this.sessionState.subPhase    = 'analyzing';
    this._calculateResults();

    const results             = this.sessionState.results;
    const diagnosisResponse   = this._buildDiagnosisResponse(results, this.sessionState.diagnosis);
    const shouldAutoRemediate = this.sessionState.diagnosis.needsRemediation &&
                                this._getConfig()?.autoRemediation !== false;

    return {
      type: 'test_complete',
      message: `📊 Test complete! You answered ${results.correct} of ${results.total} correctly (${Math.round(results.score)}%).\n\n${diagnosisResponse.message}`,
      results:          this.sessionState.results,
      diagnosis:        this.sessionState.diagnosis,
      phase:            'diagnosis',
      teachingPhase:    'diagnosis',
      teachingSubPhase: 'review',
      teachingProgress: this._calculateProgress(),
      currentStep:      this._getCurrentStep(),
      totalSteps:       this._getTotalSteps(),
      stepName:         'Review results',
      autoAdvance:      shouldAutoRemediate,
      delay:            shouldAutoRemediate ? 3000 : 0,
      proactive:        true,
      canResume:        false,
      suggestions:      diagnosisResponse.suggestions,
      timestamp:        Date.now()
    };
  };

  proto._provideHint = async function () {
    const currentTest     = this.sessionState.currentTest;
    const currentQuestion = currentTest.questions[currentTest.currentQuestionIndex];
    const hint = currentQuestion.hint || 'Try breaking the problem down step by step.';

    return {
      type: 'hint',
      message: `💡 **Hint:** ${hint}`,
      phase: 'testing',
      teachingPhase: 'testing',
      teachingSubPhase: currentTest.type,
      teachingProgress: this._calculateProgress(),
      currentStep: this._getCurrentStep(),
      totalSteps: this._getTotalSteps(),
      stepName: `Question ${currentTest.currentQuestionIndex + 1}`,
      autoAdvance: false,
      proactive: true,
      canResume: true,
      timestamp: Date.now()
    };
  };
}

module.exports = { applyAnswerProcessor };