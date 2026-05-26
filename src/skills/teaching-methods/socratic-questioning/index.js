// Skill: socratic-questioning
// Type: active
// Phase 1 — Guide student to derive answer through questions
//
// Responsibility:
//   Guide the student toward the answer using carefully chosen questions
//   and hints — never revealing the solution directly. Adapts the depth
//   of guidance based on how stuck the student is and their mastery level.
//   Subject-aware: uses analytical/essay prompts for English Advanced,
//   mathematical prompts for Maths subjects.

'use strict';

// ─────────────────────────────────────────────────────────────
// Subject detection
// ─────────────────────────────────────────────────────────────

function isEnglishSubject(activeSubject) {
  return activeSubject === 'english-advanced';
}

// ─────────────────────────────────────────────────────────────
// Knowledge base helpers
// ─────────────────────────────────────────────────────────────

function inferDotPoint(text, knowledgeBase) {
  if (!knowledgeBase?.dotPoints || !text) return null;
  const lower = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const [code, dp] of Object.entries(knowledgeBase.dotPoints)) {
    let score = 0;
    for (const kw of (dp.keywords || [])) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) { bestScore = score; best = code; }
  }
  return bestScore > 0 ? best : null;
}

function getDotPointData(code, knowledgeBase) {
  if (!code || !knowledgeBase?.dotPoints) return null;
  return knowledgeBase.dotPoints[code] || null;
}

// ─────────────────────────────────────────────────────────────
// Guidance level calculator
// ─────────────────────────────────────────────────────────────

/**
 * Determines how much guidance to give based on mastery and session context.
 *
 * Guidance levels:
 *   "light"  — just a nudge; student is close, high mastery
 *   "medium" — a pointed question that surfaces the key concept
 *   "heavy"  — a near-complete scaffold; student is very stuck or low mastery
 *
 * @param {number|null} masteryScore
 * @param {number}      hintRequestCount
 * @param {string}      engagement
 * @returns {"light"|"medium"|"heavy"}
 */
function computeGuidanceLevel(masteryScore, hintRequestCount, engagement) {
  if (engagement === 'frustrated' || hintRequestCount >= 3) return 'heavy';
  if (masteryScore !== null && masteryScore < 0.4) return 'heavy';
  if (hintRequestCount >= 2 || (masteryScore !== null && masteryScore < 0.7)) return 'medium';
  return 'light';
}

// ─────────────────────────────────────────────────────────────
// Prompt builders — MATHS
// ─────────────────────────────────────────────────────────────

function buildMathsSystemPrompt(guidanceLevel, studentModel) {
  const engagement = studentModel?.affectiveState?.currentEngagement || 'focused';
  const style      = studentModel?.learningStyle?.preferredRepresentation || 'balanced';

  let guidanceInstruction = '';
  if (guidanceLevel === 'light') {
    guidanceInstruction = `Give a LIGHT hint only — a single, brief question that points the student in the right direction without giving anything away. Do not explain the concept. Ask one question that makes them think.`;
  } else if (guidanceLevel === 'medium') {
    guidanceInstruction = `Give a MEDIUM hint — name the key concept or rule they need, ask them how it applies here. You may remind them of a related formula or definition. Still do not solve any part of the problem.`;
  } else {
    guidanceInstruction = `Give a HEAVY scaffold — break the first step down into a very concrete sub-question. You may partially set up the working (e.g. "The formula is x = ... — what do you substitute for a, b, c here?"). Still do not complete the solution.`;
  }

  let toneInstruction = 'Be warm and patient. Use a questioning, curious tone — like a Socratic tutor.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Be very warm and reassuring first. Say something brief like "You\'re closer than you think." Then give the hint.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Be slightly playful — challenge them with the question rather than reassuring them.';
  }

  let styleNote = '';
  if (style === 'visual') {
    styleNote = '\nIf helpful, frame your hint around what a sketch or diagram would show.';
  } else if (style === 'numerical') {
    styleNote = '\nIf helpful, suggest they try a specific numerical example first.';
  }

  return `You are OpenTutor — an expert HSC Mathematics Advanced tutor using the Socratic method.

Your role is to GUIDE the student to find the answer themselves. You must NEVER give the answer or complete any solution step.

GUIDANCE LEVEL FOR THIS RESPONSE: ${guidanceInstruction}

STRICT RULES:
- Ask at most ONE question per response.
- Do not say "the answer is" or complete any calculation.
- Do not give a worked example — that is a different skill.
- End your response with your guiding question on its own line.

TONE: ${toneInstruction}${styleNote}`;
}

function buildMathsUserMessage(params, dotPointData, guidanceLevel, hintRequestCount) {
  const { userInput, problem, currentAttempt } = params;

  let msg = '';

  if (problem) {
    msg += `The student is working on this problem:\n"${problem}"\n\n`;
  }
  if (currentAttempt) {
    msg += `Their current attempt / what they have so far:\n"${currentAttempt}"\n\n`;
  }
  if (!problem && !currentAttempt) {
    msg += `Student's message: "${userInput}"\n\n`;
  }

  if (dotPointData) {
    msg += `Syllabus context: ${dotPointData.code} — ${dotPointData.name}\n`;
    if (guidanceLevel !== 'light') {
      msg += `Key concepts for this topic:\n`;
      for (const concept of (dotPointData.keyConcepts || []).slice(0, 3)) {
        msg += `  - ${concept}\n`;
      }
      if (dotPointData.socraticPrompts?.length > 0) {
        msg += `\nSuggested Socratic prompts for this topic (choose or adapt one):\n`;
        for (const prompt of dotPointData.socraticPrompts.slice(0, 2)) {
          msg += `  - ${prompt}\n`;
        }
      }
    }
  }

  if (hintRequestCount > 1) {
    msg += `\nNote: The student has asked for ${hintRequestCount} hints on this problem. They need more direct guidance now.`;
  }

  msg += '\nProvide the appropriate hint — do not solve the problem.';
  return msg;
}

// ─────────────────────────────────────────────────────────────
// Prompt builders — ENGLISH
// ─────────────────────────────────────────────────────────────

function buildEnglishSystemPrompt(guidanceLevel, studentModel) {
  const engagement = studentModel?.affectiveState?.currentEngagement || 'focused';

  let guidanceInstruction = '';
  if (guidanceLevel === 'light') {
    guidanceInstruction = `Give a LIGHT prompt — ask one open question that nudges the student to look more closely at the text or reconsider their argument. Do not suggest an answer or analysis direction.`;
  } else if (guidanceLevel === 'medium') {
    guidanceInstruction = `Give a MEDIUM prompt — identify the specific element they're missing (e.g. "You haven't considered the effect of the technique on the responder") and ask them a question that helps them develop it. Do not write their analysis for them.`;
  } else {
    guidanceInstruction = `Give a HEAVY scaffold — provide a partial sentence or analytical stem they can complete (e.g. "Through the use of [technique], [author] suggests that... — how would you complete this idea with reference to the text?"). Still do not write their response.`;
  }

  let toneInstruction = 'Be warm and encouraging. Use a questioning, exploratory tone — like a Socratic tutor discussing literature.';
  if (engagement === 'frustrated') {
    toneInstruction = 'The student is frustrated. Start with something they have done well, then guide them with your question.';
  } else if (engagement === 'confident') {
    toneInstruction = 'The student is confident. Be direct — challenge them to go deeper with a pointed question.';
  }

  return `You are OpenTutor — an expert HSC English Advanced tutor using the Socratic method.

Your role is to GUIDE the student to develop their own analysis or essay response. You must NEVER write their analysis for them or reveal what the "correct" interpretation is.

GUIDANCE LEVEL FOR THIS RESPONSE: ${guidanceInstruction}

STRICT RULES:
- Ask at most ONE question per response.
- Do not write sentences they should include in their essay.
- Do not say "the answer is" or "you should say that...".
- End your response with your guiding question on its own line.
- For English, focus on: argument development, textual evidence, technique analysis, module concepts.

TONE: ${toneInstruction}`;
}

function buildEnglishUserMessage(params, dotPointData, guidanceLevel, hintRequestCount) {
  const { userInput, problem, currentAttempt } = params;

  let msg = '';

  // What the student is working on
  if (problem) {
    msg += `The student is working on this question/task:\n"${problem}"\n\n`;
  }
  if (currentAttempt) {
    msg += `What they have written so far:\n"${currentAttempt}"\n\n`;
  }
  if (!problem && !currentAttempt) {
    msg += `Student's message: "${userInput}"\n\n`;
  }

  // English dot-point context (module concepts, socratic prompts)
  if (dotPointData) {
    msg += `Syllabus context: ${dotPointData.code} — ${dotPointData.name}\n`;
    if (guidanceLevel !== 'light') {
      if (dotPointData.keyConcepts?.length > 0) {
        msg += `Key concepts for this module/topic:\n`;
        for (const concept of dotPointData.keyConcepts.slice(0, 3)) {
          msg += `  - ${concept}\n`;
        }
      }
      // English KB stores socraticPrompts[] specifically for discussion guidance
      if (dotPointData.socraticPrompts?.length > 0) {
        msg += `\nSuggested Socratic prompts for this topic (choose or adapt one):\n`;
        for (const prompt of dotPointData.socraticPrompts.slice(0, 3)) {
          msg += `  - ${prompt}\n`;
        }
      }
    }
  }

  if (hintRequestCount > 1) {
    msg += `\nNote: The student has asked for ${hintRequestCount} hints. They need more structured guidance now.`;
  }

  msg += '\nProvide the appropriate prompt — do not write their response for them.';
  return msg;
}

// ─────────────────────────────────────────────────────────────
// Skill module export
// ─────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    name: 'socratic-questioning',
    version: '1.1.0',
    type: 'active',
  },

  /**
   * @param {object} params
   *   - userInput        {string}       — raw student message
   *   - activeSubject    {string}       — injected by coordinator
   *   - problem          {string|null}  — the problem/question being attempted
   *   - currentAttempt   {string|null}  — what the student has tried so far
   *   - dotPoint         {string|null}  — NESA dot-point if known
   *   - hintRequestCount {number}       — how many hints asked (default 1)
   *
   * @param {object} context
   *   - studentId, memory, studentModel, model, knowledgeBase
   *
   * @returns {Promise<{
   *   result:        string,
   *   visualization: null,
   *   syllabusPoint: string|null,
   *   guidanceLevel: string,
   * }>}
   */
  execute: async function (params, context) {
    const { studentId, memory, studentModel, model, knowledgeBase } = context;
    const { userInput, problem, hintRequestCount = 1, activeSubject } = params;
    const english = isEnglishSubject(activeSubject);

    // ── 1. Identify dot-point ────────────────────────────────
    const searchText   = problem || userInput || '';
    const dotPointCode = params.dotPoint || inferDotPoint(searchText, knowledgeBase);
    const dotPointData = getDotPointData(dotPointCode, knowledgeBase);

    // ── 2. Get mastery for this dot-point ────────────────────
    let masteryScore = null;
    if (memory && dotPointCode) {
      try {
        masteryScore = memory.getDotPointMastery
          ? memory.getDotPointMastery(studentId, dotPointCode)
          : (studentModel?.masteryProfile?.[dotPointCode] ?? null);
      } catch { /* non-fatal */ }
    }
    if (masteryScore === null && dotPointCode) {
      masteryScore = studentModel?.masteryProfile?.[dotPointCode] ?? null;
    }

    // ── 3. Compute guidance level ────────────────────────────
    const engagement    = studentModel?.affectiveState?.currentEngagement || 'focused';
    const guidanceLevel = computeGuidanceLevel(masteryScore, hintRequestCount, engagement);

    // ── 4. Build prompts — branch on subject ─────────────────
    const systemPrompt = english
      ? buildEnglishSystemPrompt(guidanceLevel, studentModel)
      : buildMathsSystemPrompt(guidanceLevel, studentModel);
    const userMessage  = english
      ? buildEnglishUserMessage(params, dotPointData, guidanceLevel, hintRequestCount)
      : buildMathsUserMessage(params, dotPointData, guidanceLevel, hintRequestCount);

    // ── 5. Call the model ────────────────────────────────────
    const response = await model.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ], {
      temperature: 0.7,
      maxTokens:   300,
      skillName:   'socratic-questioning',
      studentId,
    });

    // ── 6. Return ────────────────────────────────────────────
    return {
      result:        response,
      visualization: null,
      syllabusPoint: dotPointCode,
      guidanceLevel,
    };
  },
};