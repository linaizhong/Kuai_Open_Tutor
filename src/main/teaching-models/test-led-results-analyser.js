// test-led-results-analyser.js
// Results calculation, diagnosis, error pattern detection, and recommendations.

'use strict';

function applyResultsAnalyser(proto, { ERROR_TYPES, MASTERY_THRESHOLD, CONCERN_THRESHOLD, CRITICAL_THRESHOLD }) {

  // ── Results calculation ──────────────────────────────────────────────────
  proto._calculateResults = function () {
    try {
      const answers = this.sessionState.answers;

      if (!answers || !Array.isArray(answers)) {
        console.error('[TestLed][ERROR] answers is not an array:', answers);
        this._setEmptyResults();
        return;
      }

      const correct = answers.filter(a => a && a.isCorrect).length;
      const total   = answers.length;
      const score   = total > 0 ? (correct / total) * 100 : 0;

      // Group by topic
      const byTopic = {};
      const byErrorType = {
        [ERROR_TYPES.CONCEPTUAL]:    0,
        [ERROR_TYPES.COMPUTATIONAL]: 0,
        [ERROR_TYPES.MISREAD]:       0,
        skipped: 0,
        unknown: 0
      };
      const weakestDotPoints = [];

      answers.forEach((answer, index) => {
        if (!answer || !answer.question) {
          console.warn(`[TestLed][WARN] Answer ${index} missing question:`, answer);
          return;
        }

        const topic = answer.question.topic;
        if (topic) {
          if (!byTopic[topic]) byTopic[topic] = { correct: 0, total: 0 };
          byTopic[topic].total++;
          if (answer.isCorrect) byTopic[topic].correct++;
        }

        if (!answer.isCorrect) {
          const errorType = answer.errorType || 'unknown';
          byErrorType[errorType] = (byErrorType[errorType] || 0) + 1;
          if (answer.question.syllabusPoint) {
            weakestDotPoints.push({
              code:      answer.question.syllabusPoint,
              topic:     answer.question.topic,
              errorType
            });
          }
        }
      });

      const topicScores = {};
      Object.keys(byTopic).forEach(topic => {
        const data = byTopic[topic];
        topicScores[topic] = (data.correct / data.total) * 100;
      });

      const weakestTopics = Object.entries(topicScores)
        .filter(([, s]) => s < MASTERY_THRESHOLD * 100)
        .sort(([, a], [, b]) => a - b)
        .map(([topic, score]) => ({ topic, score }));

      const criticalTopics = Object.entries(topicScores)
        .filter(([, s]) => s < CRITICAL_THRESHOLD * 100)
        .map(([topic]) => topic);

      // Remediation topics: any topic below 60% (CONCERN_THRESHOLD).
      // This is a lower bar than weakestTopics (which uses MASTERY_THRESHOLD 80%)
      // so remediation triggers reliably even when only 1 of 6 questions is wrong.
      const remediationTopics = Object.entries(topicScores)
        .filter(([, s]) => s < CONCERN_THRESHOLD * 100)
        .sort(([, a], [, b]) => a - b)
        .map(([topic, score]) => ({ topic, score }));

      const errorPatterns    = this._detectErrorPatterns(answers);
      // needsRemediation: any topic scored below 60%
      const needsRemediation = remediationTopics.length > 0;

      this.sessionState.results = {
        score, correct, total,
        byTopic: topicScores,
        byErrorType,
        timeSpent: this.sessionState.currentTest.endTime
          ? (this.sessionState.currentTest.endTime - this.sessionState.currentTest.startTime) / 1000
          : 0
      };

      this.sessionState.diagnosis = {
        weakestTopics:       remediationTopics,   // use 60% threshold for remediation list
        weakestDotPoints,
        errorPatterns,
        conceptualGaps:      this._extractConceptualGaps(answers),
        recommendations:     this._generateRecommendations(remediationTopics, errorPatterns),
        needsRemediation,
        criticalTopics,
        masteryWeakTopics:   weakestTopics,        // 80% threshold, kept for display
      };

    } catch (error) {
      console.error('[TestLed][ERROR] Crash in _calculateResults:', error.message);
      this._setEmptyResults();
    }
  };

  proto._setEmptyResults = function () {
    this.sessionState.results = { score: 0, correct: 0, total: 0, byTopic: {}, byErrorType: {}, timeSpent: 0 };
    this.sessionState.diagnosis = {
      weakestTopics: [], weakestDotPoints: [], errorPatterns: [],
      conceptualGaps: [], recommendations: [], needsRemediation: false, criticalTopics: []
    };
  };

  // ── Error pattern detection ──────────────────────────────────────────────
  proto._detectErrorPatterns = function (answers) {
    const patterns        = [];
    const incorrect       = answers.filter(a => !a.isCorrect && !a.skipped);
    if (incorrect.length === 0) return patterns;

    const byTopicAndError = {};
    incorrect.forEach(answer => {
      const topic     = answer.question.topic;
      const errorType = answer.errorType || 'unknown';
      const key       = `${topic}:${errorType}`;

      if (!byTopicAndError[key]) {
        byTopicAndError[key] = { topic, errorType, count: 0, questions: [] };
      }
      byTopicAndError[key].count++;
      byTopicAndError[key].questions.push(answer.question);
    });

    Object.values(byTopicAndError).forEach(pattern => {
      if (pattern.count >= 2) {
        patterns.push({
          topic:       pattern.topic,
          errorType:   pattern.errorType,
          frequency:   pattern.count,
          description: this._getErrorDescription(pattern.errorType, pattern.topic),
          suggestion:  this._getErrorSuggestion(pattern.errorType, pattern.topic)
        });
      }
    });

    return patterns;
  };

  proto._extractConceptualGaps = function (answers) {
    const gaps             = [];
    const conceptualErrors = answers.filter(a => !a.isCorrect && a.errorType === ERROR_TYPES.CONCEPTUAL);
    const byTopic          = {};

    conceptualErrors.forEach(error => {
      const topic = error.question.topic;
      if (!byTopic[topic]) byTopic[topic] = [];
      byTopic[topic].push(error);
    });

    Object.entries(byTopic).forEach(([topic, errors]) => {
      if (errors.length >= 2) {
        gaps.push({
          topic,
          errorCount: errors.length,
          severity:   errors.length >= 3 ? 'high' : 'medium',
          questions:  errors.map(e => e.question)
        });
      }
    });

    return gaps;
  };

  proto._getErrorDescription = function (errorType, topic) {
    const descriptions = {
      [ERROR_TYPES.CONCEPTUAL]:    `Conceptual misunderstanding in ${topic}`,
      [ERROR_TYPES.COMPUTATIONAL]: `Computational errors in ${topic}`,
      [ERROR_TYPES.MISREAD]:       `Misreading questions about ${topic}`
    };
    return descriptions[errorType] || `Errors in ${topic}`;
  };

  proto._getErrorSuggestion = function (errorType, topic) {
    const suggestions = {
      [ERROR_TYPES.CONCEPTUAL]:    `Review the core concepts of ${topic}`,
      [ERROR_TYPES.COMPUTATIONAL]: `Practice calculations step by step`,
      [ERROR_TYPES.MISREAD]:       `Read questions carefully and highlight key terms`
    };
    return suggestions[errorType] || `Focus on ${topic}`;
  };

  proto._generateRecommendations = function (weakestTopics, errorPatterns) {
    const recommendations = [];
    const score = this.sessionState.results?.score ?? 0;

    if (weakestTopics.length > 0) {
      const topics = weakestTopics.slice(0, 3).map(t => t.topic).join(', ');
      recommendations.push(`Focus on: ${topics}`);
    }

    if (errorPatterns.length > 0) {
      const p = errorPatterns[0];
      recommendations.push(`You tend to make ${p.errorType.toLowerCase()} errors in ${p.topic}`);
    }

    if (score < 50) {
      recommendations.push('Revisit core concepts before attempting more questions');
      recommendations.push('Consider starting with a topic test on your weakest area');
    } else if (score < 70) {
      recommendations.push('Practice with targeted topic tests');
      recommendations.push('Review worked solutions for questions you got wrong');
    } else if (score < 100) {
      recommendations.push('Try a mastery check to confirm your understanding');
      recommendations.push('Focus on the topics where you lost marks');
    } else {
      recommendations.push('Excellent work! Try harder difficulty questions');
      recommendations.push('Complete a mastery check to lock in your understanding');
      recommendations.push('Move on to the next topic in your study schedule');
    }

    return recommendations.slice(0, 4);
  };

  // ── Learning plan builder ────────────────────────────────────────────────
  // Builds a structured, personalised learning plan based on test results.
  // Always shown regardless of score — content adapts to four score bands.
  proto._buildLearningPlan = function (results, diagnosis) {
    const score       = Math.round(results.score);
    const topicScores = results.byTopic || {};
    const answers     = this.sessionState.answers || [];

    // ── Score band ────────────────────────────────────────────────────────
    const band = score === 100 ? 'perfect'
               : score >= 80   ? 'strong'
               : score >= 60   ? 'developing'
               : 'needs-work';

    const bandLabel = {
      'perfect':    '🌟 Outstanding — Full Marks!',
      'strong':     '✅ Strong Performance',
      'developing': '📈 Developing — On Track',
      'needs-work': '⚠️ Needs Focused Attention',
    }[band];

    // ── Topic strengths and gaps ──────────────────────────────────────────
    const allTopics   = Object.entries(topicScores).sort(([, a], [, b]) => b - a);
    const strongTopics  = allTopics.filter(([, s]) => s >= MASTERY_THRESHOLD * 100);
    const concernTopics = allTopics.filter(([, s]) => s >= CONCERN_THRESHOLD * 100 && s < MASTERY_THRESHOLD * 100);
    const weakTopics    = allTopics.filter(([, s]) => s < CONCERN_THRESHOLD * 100);

    // ── Dot-point review links ────────────────────────────────────────────
    // Collect unique syllabus dot-points from wrong answers
    const dotPointsToReview = [];
    const seenDp = new Set();
    answers.filter(a => !a.isCorrect && a.question?.syllabusPoint).forEach(a => {
      const dp = a.question.syllabusPoint;
      if (!seenDp.has(dp)) {
        seenDp.add(dp);
        dotPointsToReview.push({
          code:    dp,
          topic:   a.question.topic,
          question: a.question.text?.substring(0, 80) + (a.question.text?.length > 80 ? '...' : ''),
        });
      }
    });

    // ── Suggested study schedule ──────────────────────────────────────────
    let schedule = [];
    if (band === 'perfect') {
      schedule = [
        { day: 'Today',    task: 'Complete a mastery check to lock in your 100% score' },
        { day: 'Tomorrow', task: 'Attempt a harder-difficulty diagnostic test' },
        { day: 'This week', task: 'Start the next topic in your HSC study plan' },
        { day: 'Next week', task: 'Return for a spaced repetition check on these topics' },
      ];
    } else if (band === 'strong') {
      const topWeak = weakTopics.concat(concernTopics).slice(0, 2).map(([t]) => t).join(' & ');
      schedule = [
        { day: 'Today',    task: topWeak ? `Review ${topWeak} — your only gap area${weakTopics.length > 1 ? 's' : ''}` : 'Review any questions you found tricky' },
        { day: 'Tomorrow', task: 'Complete a targeted topic test on your weaker areas' },
        { day: 'This week', task: 'Attempt a mastery check once you feel confident' },
        { day: 'Next week', task: 'Full diagnostic retest to confirm improvement' },
      ];
    } else if (band === 'developing') {
      const top2Weak = weakTopics.concat(concernTopics).slice(0, 2).map(([t]) => t);
      schedule = [
        { day: 'Today',    task: top2Weak.length ? `Study ${top2Weak[0]} in Teacher-Led mode` : 'Review your wrong answers using worked solutions' },
        { day: 'Tomorrow', task: top2Weak.length > 1 ? `Study ${top2Weak[1]} in Teacher-Led mode` : 'Practice more questions on your weak topics' },
        { day: 'This week', task: 'Complete a targeted topic test on each weak area' },
        { day: 'Next week', task: 'Re-run this diagnostic test to measure improvement' },
      ];
    } else {
      const top3Weak = weakTopics.slice(0, 3).map(([t]) => t);
      schedule = [
        { day: 'Today',    task: top3Weak.length ? `Start remediation on ${top3Weak[0]} — your weakest topic` : 'Work through all your wrong answers with worked solutions' },
        { day: 'Tomorrow', task: top3Weak.length > 1 ? `Study ${top3Weak[1]} in Teacher-Led mode` : 'Continue remediation sessions' },
        { day: 'This week', task: top3Weak.length > 2 ? `Cover ${top3Weak[2]}, then attempt a topic test` : 'Attempt targeted topic tests on each weak area' },
        { day: 'Next week', task: 'Re-run this diagnostic test to measure your improvement' },
      ];
    }

    // ── Next steps (action buttons) ───────────────────────────────────────
    let nextSteps = [];
    if (band === 'perfect' || band === 'strong') {
      nextSteps = [
        { icon: '✅', label: 'Mastery Check',    action: 'mastery',   desc: 'Confirm your understanding with a focused test' },
        { icon: '🎯', label: 'Harder Questions', action: 'retest',    desc: 'Challenge yourself with increased difficulty' },
        { icon: '📚', label: 'New Topic',        action: 'new_topic', desc: 'Move on to the next area of your syllabus' },
      ];
    } else if (band === 'developing') {
      nextSteps = [
        { icon: '📖', label: 'Learn Weak Topics', action: 'remediate', desc: 'Get a Teacher-Led lesson on your gap areas' },
        { icon: '🔄', label: 'Retest',            action: 'retest',    desc: 'Try the test again after reviewing' },
        { icon: '✅', label: 'Mastery Check',     action: 'mastery',   desc: 'Verify the topics you scored well on' },
      ];
    } else {
      nextSteps = [
        { icon: '📖', label: 'Start Remediation', action: 'remediate', desc: 'Teacher-Led lessons on your weakest topics' },
        { icon: '🔄', label: 'Retest Later',      action: 'retest',    desc: 'Come back after studying to measure progress' },
        { icon: '💬', label: 'Ask a Question',    action: 'chat',      desc: 'Chat with Tute about anything you found confusing' },
      ];
    }

    return {
      band,
      bandLabel,
      score,
      strongTopics:   strongTopics.map(([t, s]) => ({ topic: t, score: Math.round(s) })),
      concernTopics:  concernTopics.map(([t, s]) => ({ topic: t, score: Math.round(s) })),
      weakTopics:     weakTopics.map(([t, s]) => ({ topic: t, score: Math.round(s) })),
      dotPointsToReview,
      schedule,
      nextSteps,
      timeSpent:      results.timeSpent ? Math.round(results.timeSpent / 60) : null,
      questionsTotal: results.total,
      questionsCorrect: results.correct,
    };
  };

  // ── Diagnosis phase ──────────────────────────────────────────────────────
  proto._handleDiagnosisPhase = async function (userInput) {
    const lower = userInput.toLowerCase().trim();

    if (lower === 'remediate' || lower.includes('learn from mistakes')) return this._startRemediation();
    if (lower === 'retest'    || lower.includes('try again'))           return this._startRetest();
    if (lower === 'mastery'   || lower.includes('verify mastery'))       return this._startMasteryCheck();

    return this._showDiagnosis();
  };

  proto._showDiagnosis = function () {
    const results   = this.sessionState.results;
    const diagnosis = this.sessionState.diagnosis;
    const { message, suggestions, learningPlan } = this._buildDiagnosisResponse(results, diagnosis);
    const shouldAutoRemediate = diagnosis.needsRemediation && this._getConfig()?.autoRemediation !== false;

    return {
      type: 'diagnosis',
      message,
      results,
      diagnosis,
      learningPlan,   // always present — adapts to score band
      phase: 'diagnosis',
      teachingPhase: 'diagnosis',
      teachingSubPhase: 'review',
      teachingProgress: this._calculateProgress(),
      currentStep: this._getCurrentStep(),
      totalSteps: this._getTotalSteps(),
      stepName: 'Review results',
      autoAdvance: shouldAutoRemediate,
      delay: shouldAutoRemediate ? 3000 : 0,
      proactive: true,
      canResume: false,
      suggestions,
      timestamp: Date.now()
    };
  };

  proto._buildDiagnosisResponse = function (results, diagnosis) {
    const plan  = this._buildLearningPlan(results, diagnosis);
    const score = Math.round(results.score);

    // ── Score summary ─────────────────────────────────────────────────────
    let message = `## 📊 Test Results\n\n`;
    message += `**Score:** ${score}% (${results.correct}/${results.total} correct)`;
    if (results.timeSpent) {
      const mins = Math.round(results.timeSpent / 60);
      message += ` · ${mins} min${mins !== 1 ? 's' : ''}`;
    }
    message += `\n\n`;

    // ── By topic ──────────────────────────────────────────────────────────
    if (Object.keys(results.byTopic).length > 0) {
      message += `**By Topic:**\n`;
      Object.entries(results.byTopic)
        .sort(([, a], [, b]) => a - b)
        .forEach(([topic, s]) => {
          const emoji = s >= MASTERY_THRESHOLD * 100 ? '✅' :
                        s >= CONCERN_THRESHOLD * 100 ? '⚠️' : '❌';
          message += `- ${emoji} ${topic}: ${Math.round(s)}%\n`;
        });
      message += '\n';
    }

    // ── Error patterns ────────────────────────────────────────────────────
    if (diagnosis.errorPatterns.length > 0) {
      message += `**Error Patterns:**\n`;
      diagnosis.errorPatterns.slice(0, 3).forEach(p => {
        message += `- ${p.description} (${p.frequency} times)\n`;
      });
      message += '\n';
    }

    // ── Personalised Learning Plan ────────────────────────────────────────
    message += `---\n\n`;
    message += `## 📋 Your Learning Plan\n\n`;
    message += `${plan.bandLabel}\n\n`;

    // Topic strengths and gaps
    if (plan.strongTopics.length > 0) {
      message += `**✅ Strengths:** ${plan.strongTopics.map(t => `${t.topic} (${t.score}%)`).join(', ')}\n`;
    }
    if (plan.concernTopics.length > 0) {
      message += `**⚠️ Review:** ${plan.concernTopics.map(t => `${t.topic} (${t.score}%)`).join(', ')}\n`;
    }
    if (plan.weakTopics.length > 0) {
      message += `**❌ Focus Areas:** ${plan.weakTopics.map(t => `${t.topic} (${t.score}%)`).join(', ')}\n`;
    }
    message += '\n';

    // Dot-point review links
    if (plan.dotPointsToReview.length > 0) {
      message += `**📌 Syllabus Dot-Points to Review:**\n`;
      plan.dotPointsToReview.slice(0, 5).forEach(dp => {
        message += `- **${dp.code}** (${dp.topic}) — ${dp.question}\n`;
      });
      message += '\n';
    }

    // Recommended study schedule
    message += `**📅 Recommended Study Schedule:**\n`;
    plan.schedule.forEach(s => {
      message += `- **${s.day}:** ${s.task}\n`;
    });
    message += '\n';

    // Next steps
    message += `**🎯 Next Steps:**\n`;
    plan.nextSteps.forEach(s => {
      message += `- ${s.icon} **${s.label}** — ${s.desc}\n`;
    });

    const suggestions = [
      { icon: '📚', label: 'Learn from mistakes', text: 'remediate' },
      { icon: '🔄', label: 'Try again',            text: 'retest'    },
      { icon: '✅', label: 'Verify mastery',        text: 'mastery'   }
    ];

    return { message, suggestions, learningPlan: plan };
  };
}

module.exports = { applyResultsAnalyser };