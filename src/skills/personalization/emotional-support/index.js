// Skill: emotional-support
// Type: active
// Phase 3 — Respond to frustration and disengagement with encouragement.
//
// Detects the student's emotional state from their input, builds a
// personalised prompt using the Student Model, calls the LLM, and returns
// a warm, grounded response that validates feelings, normalises struggle,
// and gently guides the student back to study.

'use strict';

// ── Emotional state classification ────────────────────────────
// Maps patterns to one of four states, each with its own response strategy.
const EMOTIONAL_STATES = {
  panic: {
    patterns: [
      /\b(panicking|freaking out|panic|i can't breathe|overwhelmed|i feel like crying|breaking down)\b/i,
      /\b(i('m| am) going to fail|everything is falling apart|i can't do (this|anything))\b/i,
    ],
    tone: 'calm and grounding',
    priority: 4,
  },
  self_doubt: {
    patterns: [
      /\b(i('m| am) (dumb|stupid|terrible|so bad|an idiot)|what('s| is) wrong with me)\b/i,
      /\b(i('ll| will) never (get|understand|learn) (this|it)|i('m| am) hopeless)\b/i,
      /\b(why can('t| not) i (get|understand) (this|it)|i don('t| not) understand anything)\b/i,
      /\b(i('m| am) so bad at (this|maths|math))\b/i,
    ],
    tone: 'affirming and honest',
    priority: 3,
  },
  frustration: {
    patterns: [
      /\b(frustrated|i give up|so frustrated|i hate (maths|math|this)|this is (too hard|pointless|stupid))\b/i,
      /\b(i want to give up|i('ve| have) been staring at this|i can('t| not) concentrate)\b/i,
      /\b(this (makes no sense|is impossible)|i('m| am) so confused|nothing makes sense)\b/i,
    ],
    tone: 'warm and reframing',
    priority: 2,
  },
  anxiety: {
    patterns: [
      /\b(stressed|anxious|worried|anxiety|stress|nervous|scared (about|of)|fear(ful)?)\b/i,
      /\b(worried about (the (hsc|exam|test))|exam (stress|anxiety|nerves))\b/i,
      /\b(i('m| am) (exhausted|so tired|burned? ?out)|i can('t| not) keep (up|going))\b/i,
    ],
    tone: 'reassuring and practical',
    priority: 1,
  },
};

// ── Classify the dominant emotional state ─────────────────────
function classifyEmotionalState(userInput) {
  let best = { state: 'frustration', priority: 0 }; // default

  for (const [state, config] of Object.entries(EMOTIONAL_STATES)) {
    if (config.priority <= best.priority) continue;
    for (const pattern of config.patterns) {
      if (pattern.test(userInput)) {
        best = { state, priority: config.priority, tone: config.tone };
        break;
      }
    }
  }

  return best.state;
}

// ── Extract emotional keywords from input (for prompt context) ─
function extractKeyPhrases(userInput) {
  const phrases = [];
  const patterns = [
    /i (give up|can't do this|hate this|feel like crying|want to give up)/i,
    /(too hard|so confused|overwhelmed|exhausted|stressed|anxious|panicking)/i,
    /i('m| am) (dumb|stupid|terrible|hopeless|going to fail)/i,
    /i('ve| have) been staring at this/i,
    /(this is (pointless|impossible)|i'll never get this)/i,
  ];
  for (const p of patterns) {
    const m = userInput.match(p);
    if (m) phrases.push(m[0].toLowerCase().trim());
  }
  return phrases.slice(0, 3);
}

// ── Build the personalised system prompt ─────────────────────
function buildSystemPrompt(emotionalState, studentModel, keyPhrases) {
  const name         = studentModel?.name         || null;
  const weeksLeft    = studentModel?.weeksRemaining ?? null;
  const weakTopics   = studentModel?.weakestTopics  ?? [];
  const successRate  = studentModel?.affectiveState?.recentSuccessRate ?? null;
  const masteryGains = studentModel?.masteryProfile
    ? Object.entries(studentModel.masteryProfile)
        .filter(([, v]) => v >= 0.75)
        .map(([k]) => k)
        .slice(0, 3)
    : [];
  const motivationStyle = studentModel?.learningStyle?.motivationStyle || null;

  // Build personalisation context for the prompt
  const contextLines = [];

  if (name)         contextLines.push(`The student's name is ${name}.`);
  if (weeksLeft)    contextLines.push(`They have ${weeksLeft} weeks until their HSC exam.`);
  if (successRate !== null) {
    const pct = Math.round(successRate * 100);
    contextLines.push(`Their recent success rate this session is ${pct}%.`);
  }
  if (masteryGains.length > 0) {
    contextLines.push(`They have already achieved solid mastery in: ${masteryGains.join(', ')}.`);
  }
  if (weakTopics.length > 0) {
    contextLines.push(`Their current weak areas are: ${weakTopics.join(', ')}.`);
  }
  if (motivationStyle === 'progress visibility') {
    contextLines.push('This student is particularly motivated by seeing their own progress.');
  }
  if (keyPhrases.length > 0) {
    contextLines.push(`The student just expressed: "${keyPhrases.join('; ')}".`);
  }

  // State-specific instructions
  const stateInstructions = {
    panic: `
The student is panicking. Your first priority is to slow things down.
- Acknowledge that this feeling is real and makes complete sense.
- Use a calm, steady voice — short sentences, no urgency.
- Remind them that one small step is enough right now.
- Do NOT immediately pivot back to content. Let them breathe first.
- End by gently asking if they want to try ONE very small, easy question together.`,

    self_doubt: `
The student is expressing serious self-doubt about their ability.
- Directly and warmly challenge the negative self-belief — be specific, not generic.
- Remind them that confusion means their brain is working on something hard, not that they are bad at maths.
- If mastery data is available, cite a concrete topic they have already learned as evidence.
- Be honest: HSC Maths is genuinely difficult. Everyone struggles with parts of it.
- End with a low-stakes invitation to try one small thing together.`,

    frustration: `
The student is frustrated. Validate this fully before doing anything else.
- Acknowledge the frustration as a completely normal part of learning hard maths.
- Do NOT minimise it ("it's not that hard") — that will make it worse.
- Reframe: frustration often appears just before a breakthrough.
- Offer to approach the problem differently (new angle, simpler example, analogy).
- Keep your response warm but fairly brief — they are not in a state to absorb a lot.`,

    anxiety: `
The student is stressed or anxious, likely about the exam or their preparation.
- Acknowledge the anxiety — it shows they care, which is actually a strength.
- Provide perspective: HSC is important but it does not define them.
- If weeks remaining are known, offer a concrete, calm framing (e.g. "you still have X weeks").
- Suggest one small, concrete action they can take right now.
- Avoid platitudes like "you'll be fine!" — be honest and grounded instead.`,
  };

  const instruction = stateInstructions[emotionalState] || stateInstructions.frustration;

  return `You are Tute, a warm and supportive HSC Mathematics Advanced tutor.
A student has just expressed emotional distress. You must respond as a caring, wise human tutor would — not as a chatbot.

STUDENT CONTEXT:
${contextLines.length > 0 ? contextLines.join('\n') : 'No additional context available.'}

YOUR TASK:
${instruction}

TONE AND STYLE RULES:
- Write in a warm, genuine, human voice. Never sound corporate or scripted.
- Use "you" and speak directly to the student.
- Vary your sentence lengths. Mix short punchy lines with slightly longer ones.
- Use light, natural language — contractions are fine ("you're", "it's", "don't").
- Do NOT use generic phrases like "I understand how you feel", "It's okay!", "Don't worry!".
- Do NOT list dot-points or use headers. This is a human moment, not a lesson.
- Do NOT immediately launch into maths content unless they are ready.
- Keep the response to 3–5 sentences maximum unless the student needs more grounding.
- End with ONE gentle, low-pressure invitation (a question or a soft offer).`;
}

// ── Build the user message for the LLM ───────────────────────
function buildUserMessage(userInput, emotionalState) {
  return `The student just said: "${userInput}"

Their emotional state has been classified as: ${emotionalState}.

Please respond with warm, personalised emotional support.`;
}


// ═════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═════════════════════════════════════════════════════════════
module.exports = {
  meta: {
    name: 'emotional-support',
    version: '1.0.0',
    type: 'active',
  },

  execute: async function (params, context) {
    // ── 1. Extract inputs ──────────────────────────────────
    const { userInput = '' } = params || {};
    const { studentModel, model } = context || {};

    if (!userInput.trim()) {
      return { result: null, visualization: null, syllabusPoint: null };
    }

    // ── 2. Classify the emotional state ───────────────────
    const emotionalState = classifyEmotionalState(userInput);
    const keyPhrases     = extractKeyPhrases(userInput);

    // ── 3. Build personalised prompts ─────────────────────
    const systemPrompt = buildSystemPrompt(emotionalState, studentModel, keyPhrases);
    const userMessage  = buildUserMessage(userInput, emotionalState);

    // ── 4. Call the model ──────────────────────────────────
    let response;
    try {
      response = await model.chat(
        [{ role: 'user', content: userMessage }],
        {
          system:      systemPrompt,
          temperature: 0.85,   // slightly warmer than default for more natural tone
          maxTokens:   350,    // keep response concise — student is not ready for a wall of text
        }
      );
    } catch (err) {
      // Graceful fallback — never leave the student without a response
      response = _buildFallbackResponse(emotionalState, studentModel?.name);
    }

    // ── 5. Record the emotional event in affective history ─
    // This feeds the affective-detector in the Student Model Module.
    const memoryUpdates = {
      type: 'affectiveEvent',
      value: {
        timestamp:      new Date().toISOString(),
        emotionalState,
        trigger:        keyPhrases,
        skillInvoked:   'emotional-support',
      },
    };

    return {
      result:        response,
      visualization: null,
      syllabusPoint: null,
      memoryUpdates,
    };
  },
};


// ── Fallback responses (if model call fails) ──────────────────
// Keyed by emotional state — ensures the student always gets something
// warm and appropriate even if the LLM is unavailable.
function _buildFallbackResponse(emotionalState, name) {
  const nameTag = name ? `${name}, ` : '';

  const fallbacks = {
    panic:
      `${nameTag}take a breath — seriously, just one slow breath. ` +
      `You don't need to solve everything right now. ` +
      `What's the smallest, most concrete thing you can tell me about where you're stuck?`,

    self_doubt:
      `${nameTag}I want to push back on that — you're not dumb. ` +
      `Struggling with HSC Maths doesn't mean you can't do it; it means the material is genuinely hard. ` +
      `Let's just try one small thing together and see what happens.`,

    frustration:
      `${nameTag}that frustration makes complete sense — this stuff is hard. ` +
      `The fact that you're still here trying means something. ` +
      `Want to step back and try a different angle on this?`,

    anxiety:
      `${nameTag}exam stress is real, and it makes sense you're feeling it. ` +
      `You don't have to figure everything out today. ` +
      `Let's pick one small area to make a dent in right now — that's enough.`,
  };

  return fallbacks[emotionalState] || fallbacks.frustration;
}