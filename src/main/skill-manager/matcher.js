// Skill Manager — Matcher
// Matches user input to the most appropriate registered skill.
//
// Matching strategy (in priority order):
//   1. Keyword match  — user input contains one or more of the skill's trigger keywords
//   2. Intent match   — user input closely matches the skill's intent description
//   3. Category context — if provided, boost scores for skills in the current context
//   4. Subject filtering — only consider skills relevant to the current subject
//   5. Fallback       — return the default "fallback-llm" skill (or null)
//
// When multiple skills match, the one with the highest match score wins.
// Score = (matched keyword count) + (intent bonus if intent phrase found)

/**
 * Normalises text for comparison — lowercase, collapse whitespace.
 */
function normalise(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Scores a single skill against the user input.
 * Returns a numeric score — higher = better match.
 *
 * @param {object} skill   - skill registration object from loader
 * @param {string} input   - normalised user input
 * @param {string} [contextCategory] - optional category context for boosting
 * @returns {number}
 */
function scoreSkill(skill, input, contextCategory = null) {
  let score = 0;

  // Clean input - remove quotes and extra punctuation for better matching
  const cleanInput = input.replace(/["'“”]/g, '').replace(/[^\w\s]/g, ' ');

  // Keyword matching — each matched keyword adds 1 point
  // Multi-word keywords score higher (more specific match)
  for (const keyword of skill.triggers.keywords) {
    const kw = normalise(keyword);
    // Check both original input and cleaned input
    if (input.includes(kw) || cleanInput.includes(kw)) {
      // Longer keywords are more specific — reward them more
      const keywordScore = 1 + (kw.split(' ').length - 1) * 0.5;
      score += keywordScore;
    }
  }

  // Intent matching — if the intent phrase is present, add a bonus
  if (skill.triggers.intent) {
    const intent = normalise(skill.triggers.intent);
    if (intent && (input.includes(intent) || cleanInput.includes(intent))) {
      score += 2;
    }
    // Partial intent: check if most intent words appear in input
    const intentWords = intent.split(' ').filter(w => w.length > 3);
    if (intentWords.length > 0) {
      const matchedWords = intentWords.filter(w =>
        input.includes(w) || cleanInput.includes(w)
      );
      if (matchedWords.length >= Math.ceil(intentWords.length * 0.6)) {
        score += 1;
      }
    }
  }

  // Category context boost — if we're in a specific category, boost skills in that category
  if (contextCategory && skill.category === contextCategory) {
    score += 0.5;  // Small boost for staying in same category context
  }

  return score;
}

/**
 * Checks if a skill is relevant to the current subject
 * @param {object} skill
 * @param {string} activeSubject
 * @param {object} kbManager - Knowledge Base Manager instance
 * @returns {boolean}
 */
function isSkillRelevantForSubject(skill, activeSubject, kbManager) {
  // ===== FIX: Always allow general and core skills =====
  // These skills work for any subject
  if (!skill.category ||
      skill.category === 'general' ||
      skill.category === 'core' ||
      skill.category === 'uncategorized') {
    return true;
  }

  // If no kbManager, assume relevant (fallback for backward compatibility)
  if (!kbManager) {
    return true;
  }

  // Ask the KB Manager if this category is relevant for this subject
  // If kbManager doesn't have this method, assume relevant
  if (typeof kbManager.isCategoryRelevantForSubject !== 'function') {
    return true;
  }

  return kbManager.isCategoryRelevantForSubject(activeSubject, skill.category);
}

/**
 * Finds the best matching active skill for the given user input,
 * filtered by the current subject.
 *
 * @param {string}   userInput      - raw user message
 * @param {object[]} skills         - array of skill registration objects
 * @param {string}   activeSubject  - current subject (e.g. "english-advanced")
 * @param {object}   kbManager      - Knowledge Base Manager instance
 * @param {string}   [fallback]     - name of fallback skill (default: "fallback-llm")
 * @returns {{ skill: object|null, score: number, matchedBy: string }}
 */
function findBestSkillForSubject(userInput, skills, activeSubject, kbManager, fallback = 'fallback-llm') {
  const input = normalise(userInput);
  const activeSkills = skills.filter(s => s.type === 'active');

  console.log(`[Matcher] Finding best skill for subject: ${activeSubject}`);
  console.log(`[Matcher] User input: "${userInput}"`);
  console.log(`[Matcher] Total active skills: ${activeSkills.length}`);

  // Derive a context category from the active subject so subject-specific
  // skills get the category-boost that was already wired into scoreSkill().
  // e.g. "english-advanced" → "english-advanced", "maths-advanced" → "maths-advanced"
  const contextCategory = activeSubject || null;

  let bestSkill = null;
  let bestScore = 0;
  let matchedBy = 'none';

  for (const skill of activeSkills) {
    if (!isSkillRelevantForSubject(skill, activeSubject, kbManager)) {
      console.log(`[Matcher] Skipping ${skill.name} (category: ${skill.category}) - not relevant for ${activeSubject}`);
      continue;
    }

    console.log(`[Matcher] Considering skill: ${skill.name} (category: ${skill.category})`);
    const score = scoreSkill(skill, input, contextCategory);  // ← fixed: pass contextCategory
    console.log(`[Matcher]   Score for ${skill.name}: ${score}`);

    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
      matchedBy = score > 1 ? 'keyword' : 'weak-keyword';
      console.log(`[Matcher]   New best: ${skill.name} with score ${score}`);
    }
  }

  // If nothing matched, use the fallback skill
  if (!bestSkill || bestScore === 0) {
    console.log(`[Matcher] No skill matched for subject ${activeSubject}. Looking for fallback: ${fallback}`);
    const fallbackSkill = activeSkills.find(s => s.name === fallback) || null;

    if (fallbackSkill) {
      console.log(`[Matcher] Using fallback: ${fallbackSkill.name} (category: ${fallbackSkill.category})`);
    } else {
      console.log(`[Matcher] No skill matched and fallback "${fallback}" not found!`);
      // Try to find any skill as last resort
      const anySkill = activeSkills.find(s => s.name) || null;
      if (anySkill) {
        console.log(`[Matcher] Using any available skill as last resort: ${anySkill.name}`);
        return {
          skill: anySkill,
          score: 0,
          matchedBy: 'emergency-fallback',
        };
      }
    }

    return {
      skill: fallbackSkill,
      score: 0,
      matchedBy: 'fallback',
    };
  }

  console.log(`[Matcher] Best skill: ${bestSkill.name} with score ${bestScore}`);
  return {
    skill: bestSkill,
    score: bestScore,
    matchedBy: matchedBy,
  };
}

/**
 * Finds the best matching active skill for the given user input (legacy).
 * Only considers active skills (passive skills run unconditionally).
 *
 * @param {string}   userInput  - raw user message
 * @param {object[]} skills     - array of skill registration objects
 * @param {string}   [fallback] - name of fallback skill (default: "fallback-llm")
 * @param {string}   [contextCategory] - current category context (optional)
 * @returns {{ skill: object|null, score: number, matchedBy: string }}
 */
function findBestSkill(userInput, skills, fallback = 'fallback-llm', contextCategory = null) {
  const input = normalise(userInput);
  const activeSkills = skills.filter(s => s.type === 'active');

  let bestSkill = null;
  let bestScore = 0;

  for (const skill of activeSkills) {
    const score = scoreSkill(skill, input, contextCategory);
    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
    }
  }

  // If nothing matched, use the fallback skill
  if (!bestSkill || bestScore === 0) {
    const fallbackSkill = activeSkills.find(s => s.name === fallback) || null;
    if (fallbackSkill) {
      console.log(`[Matcher] No skill matched. Using fallback: ${fallback}`);
    } else {
      console.log(`[Matcher] No skill matched and fallback "${fallback}" not found!`);
    }
    return {
      skill: fallbackSkill,
      score: 0,
      matchedBy: 'fallback',
    };
  }

  return {
    skill: bestSkill,
    score: bestScore,
    matchedBy: bestScore > 1 ? 'keyword' : 'weak-keyword',
  };
}

/**
 * Returns all passive skills.
 * These run after every interaction regardless of user input.
 *
 * @param {object[]} skills
 * @returns {object[]}
 */
function getPassiveSkills(skills) {
  return skills.filter(s => s.type === 'passive');
}

/**
 * Returns all active skills.
 *
 * @param {object[]} skills
 * @returns {object[]}
 */
function getActiveSkills(skills) {
  return skills.filter(s => s.type === 'active');
}

/**
 * Returns the top N matching skills with their scores.
 * Useful for debugging and logging.
 *
 * @param {string}   userInput
 * @param {object[]} skills
 * @param {number}   [n=3]
 * @param {object}   [kbManager] - Optional KB Manager for subject filtering
 * @param {string}   [activeSubject] - Optional subject for filtering
 * @returns {Array<{ name: string, score: number, category: string }>}
 */
function getTopMatches(userInput, skills, n = 3, kbManager = null, activeSubject = null) {
  const input = normalise(userInput);

  let filteredSkills = skills.filter(s => s.type === 'active');

  // Apply subject filtering if kbManager and activeSubject provided
  if (kbManager && activeSubject) {
    filteredSkills = filteredSkills.filter(s =>
      isSkillRelevantForSubject(s, activeSubject, kbManager)
    );
  }

  const matches = filteredSkills
    .map(s => ({
      name: s.name,
      category: s.category,
      score: scoreSkill(s, input)
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);

  // If no matches, include fallback
  if (matches.length === 0) {
    const fallback = skills.find(s => s.name === 'fallback-llm');
    if (fallback) {
      matches.push({
        name: fallback.name,
        category: fallback.category,
        score: 0
      });
    }
  }

  return matches;
}

module.exports = {
  findBestSkill,
  findBestSkillForSubject,
  getPassiveSkills,
  getActiveSkills,
  getTopMatches,
  scoreSkill,
  normalise,
  isSkillRelevantForSubject,
};