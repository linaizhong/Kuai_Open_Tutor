// src/main/services/kb-generator.js
// Knowledge Base Generator Service
//
// Auto-generates manifest.json, syllabus-map.json, and dot-points.json
// for any subject using the active ModelManager (works with local Ollama
// or any cloud model — no separate API key required).
//
// Design:
//   - Routes all LLM calls through ModelManager.chat() — same model the
//     tutor uses, no additional configuration needed
//   - Generates dot-points one subtopic at a time to stay within small
//     context windows (3B models have limited output capacity)
//   - JSON repair: attempts to fix truncated/malformed LLM output before
//     giving up — essential for small local models
//   - Skips subjects that already exist on disk
//   - Logs only requests (not responses) per spec
//   - Returns generated JSON to renderer for human review
//   - Only writes to disk after explicit approval via approveAndSave()

'use strict';

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// Utility: slugify subject name to a folder-safe ID
// ─────────────────────────────────────────────────────────────

function toSubjectId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────────────────────
// JSON repair utilities
//
// Small models frequently produce truncated or slightly malformed JSON.
// These helpers attempt to salvage usable output before giving up.
// ─────────────────────────────────────────────────────────────

function cleanRaw(raw) {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
}

/**
 * Attempt to close any unclosed brackets/braces so JSON.parse() can succeed.
 * Handles the most common failure mode: model stops mid-output.
 */
function repairJson(str) {
  let s = str.trim();

  // Remove trailing comma before attempting close
  s = s.replace(/,\s*$/, '');

  let braces   = 0;
  let brackets = 0;
  let inString = false;
  let escape   = false;

  for (const ch of s) {
    if (escape)          { escape = false; continue; }
    if (ch === '\\')     { escape = true;  continue; }
    if (ch === '"')      { inString = !inString; continue; }
    if (inString)        continue;
    if (ch === '{')      braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  while (brackets > 0) { s += ']'; brackets--; }
  while (braces   > 0) { s += '}'; braces--;   }

  return s;
}

/**
 * Extract and parse the first complete JSON object from raw LLM output.
 * Tries four strategies before giving up.
 */
function extractJson(raw) {
  const cleaned = cleanRaw(raw);

  // Strategy 1: direct parse
  try { return JSON.parse(cleaned); } catch (_) {}

  // Strategy 2: find first { ... } block
  const match = cleaned.match(/(\{[\s\S]*\})/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
    // Strategy 3: repair the extracted block
    try { return JSON.parse(repairJson(match[0])); } catch (_) {}
  }

  // Strategy 4: repair the full cleaned string
  try { return JSON.parse(repairJson(cleaned)); } catch (e) {
    throw new Error(
      `Could not parse JSON from model output: ${e.message}\n\n` +
      `Output (first 300 chars):\n${cleaned.slice(0, 300)}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// LLM call via ModelManager
// ─────────────────────────────────────────────────────────────

async function callModel(model, systemPrompt, userPrompt, maxTokens = 3000) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt   },
  ];

  return model.chat(messages, {
    temperature: 0.1,   // low temperature for deterministic structured output
    maxTokens,
    skillName:   'kb-generator',
  });
}

// ─────────────────────────────────────────────────────────────
// Shared system prompt
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are an expert curriculum designer. ' +
  'Generate structured JSON knowledge base content for an AI tutoring system. ' +
  'You MUST respond with ONLY valid JSON — no markdown, no explanation, no text before or after the JSON. ' +
  'Start your response with { and end with }. ' +
  'Every string value must be properly quoted. Every object must be properly closed.';

// ─────────────────────────────────────────────────────────────
// Step 1: Generate manifest.json
// ─────────────────────────────────────────────────────────────

async function generateManifest(model, subjectName, subjectId) {
  const userPrompt =
`Generate a manifest.json for the subject "${subjectName}".

Respond with ONLY this JSON object (no other text):
{
  "id": "${subjectId}",
  "name": "${subjectName}",
  "shortName": "SHORT",
  "icon": "EMOJI",
  "categories": ["cat1", "cat2", "cat3"],
  "enabled": true,
  "suggestions": [
    { "icon": "EMOJI", "label": "LABEL", "text": "A realistic student question about ${subjectName}?" },
    { "icon": "EMOJI", "label": "LABEL", "text": "A realistic student question about ${subjectName}?" },
    { "icon": "EMOJI", "label": "LABEL", "text": "A realistic student question about ${subjectName}?" },
    { "icon": "EMOJI", "label": "LABEL", "text": "A realistic student question about ${subjectName}?" },
    { "icon": "EMOJI", "label": "LABEL", "text": "A realistic student question about ${subjectName}?" },
    { "icon": "EMOJI", "label": "LABEL", "text": "A realistic student question about ${subjectName}?" }
  ],
  "quickActions": [
    { "icon": "EMOJI", "label": "LABEL", "text": "Short action" },
    { "icon": "EMOJI", "label": "LABEL", "text": "Short action" },
    { "icon": "EMOJI", "label": "LABEL", "text": "Short action" },
    { "icon": "EMOJI", "label": "LABEL", "text": "Short action" },
    { "icon": "EMOJI", "label": "LABEL", "text": "Short action" },
    { "icon": "EMOJI", "label": "LABEL", "text": "Short action" }
  ],
  "filenames": {
    "syllabusMap": "syllabus-map.json",
    "dotPoints": "dot-points.json",
    "questionIndex": "index.json",
    "questions": "questions.json",
    "markingGuidelinesIndex": "marking-guidelines-index.json"
  }
}

Replace all EMOJI, LABEL, SHORT placeholders with real values for ${subjectName}.`;

  console.log(`[KBGenerator] Requesting manifest for "${subjectName}"`);
  const raw = await callModel(model, SYSTEM_PROMPT, userPrompt);
  return extractJson(raw);
}

// ─────────────────────────────────────────────────────────────
// Step 2: Generate syllabus-map.json
// ─────────────────────────────────────────────────────────────

async function generateSyllabusMap(model, subjectName, subjectId) {
  const userPrompt =
`Generate a syllabus-map.json for "${subjectName}".

Rules:
- Use a 2-3 letter prefix (CH=Chemistry, PH=Physics, BI=Biology, EN=English, EC=Economics etc.)
- Include 5-7 major topics
- Each topic has 2-3 subtopics
- Each subtopic has 3-5 dot points
- examWeightPercent values must sum to exactly 100

Respond with ONLY this JSON (no other text):
{
  "subject": "${subjectName}",
  "subjectId": "${subjectId}",
  "syllabusVersion": "YEAR",
  "appliesTo": "TARGET STUDENTS",
  "topics": [
    {
      "code": "XX-A",
      "name": "Topic Name",
      "year": "11-12",
      "examWeightPercent": 20,
      "subtopics": [
        {
          "code": "XX-A1",
          "name": "Subtopic Name",
          "year": "11",
          "dotPoints": [
            {
              "code": "XX-A1.1",
              "name": "Dot Point Name",
              "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
              "difficulty": "foundation",
              "prerequisites": []
            }
          ]
        }
      ]
    }
  ]
}

Fill in real curriculum content for ${subjectName}.`;

  console.log(`[KBGenerator] Requesting syllabus-map for "${subjectName}"`);
  const raw = await callModel(model, SYSTEM_PROMPT, userPrompt, 8000);
  return extractJson(raw);
}

// ─────────────────────────────────────────────────────────────
// Step 3: Generate dot-points one SUBTOPIC at a time
//
// Small local models (3B) cannot reliably output 20+ detailed entries
// in one call. We generate one subtopic at a time (3-5 dot-points)
// which stays well within a 3B model's reliable output window.
// ─────────────────────────────────────────────────────────────

async function generateDotPointsForSubtopic(model, subjectName, topic, subtopic) {
  const dpList = (subtopic.dotPoints || [])
    .map(dp => `- ${dp.code}: "${dp.name}" (${dp.difficulty})`)
    .join('\n');

  const firstCode = (subtopic.dotPoints || [])[0]?.code || 'XX-A1.1';

  const userPrompt =
`Generate dot-point detail for ${subjectName}, subtopic "${subtopic.name}" (${subtopic.code}).

Dot-points:
${dpList}

Respond with ONLY a JSON object. Each key is a dot-point code:
{
  "${firstCode}": {
    "code": "${firstCode}",
    "name": "NAME",
    "topic": "${topic.code}",
    "subtopic": "${subtopic.code}",
    "year": "${subtopic.year || '11-12'}",
    "summary": "One sentence summary.",
    "keyConcepts": ["Concept 1", "Concept 2", "Concept 3", "Concept 4", "Concept 5"],
    "commonErrors": ["Error 1", "Error 2", "Error 3"],
    "examTips": ["Tip 1", "Tip 2", "Tip 3"],
    "socraticPrompts": ["Question 1?", "Question 2?", "Question 3?"],
    "workedExampleTemplate": {
      "type": "calculation",
      "steps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]
    },
    "relatedDotPoints": []
  }
}

Generate entries for ALL ${(subtopic.dotPoints || []).length} dot-points listed above using real ${subjectName} content.`;

  console.log(`[KBGenerator] Requesting dot-points for subtopic "${subtopic.name}" (${(subtopic.dotPoints || []).length} entries)`);
  const raw = await callModel(model, SYSTEM_PROMPT, userPrompt, 4000);
  return extractJson(raw);
}

async function generateDotPoints(model, subjectName, syllabusMap, onProgress) {
  const allDotPoints  = {};
  const topics        = syllabusMap.topics || [];
  let   totalSubtopics = 0;
  let   doneSubtopics  = 0;

  topics.forEach(t => { totalSubtopics += (t.subtopics || []).length; });

  for (const topic of topics) {
    for (const subtopic of (topic.subtopics || [])) {
      if ((subtopic.dotPoints || []).length === 0) {
        doneSubtopics++;
        continue;
      }

      try {
        const batch = await generateDotPointsForSubtopic(model, subjectName, topic, subtopic);
        Object.assign(allDotPoints, batch);
      } catch (err) {
        // Non-fatal: insert stub entries so the rest of generation can continue
        console.warn(`[KBGenerator] Subtopic "${subtopic.name}" failed: ${err.message}`);
        for (const dp of (subtopic.dotPoints || [])) {
          allDotPoints[dp.code] = {
            code:     dp.code,
            name:     dp.name,
            topic:    topic.code,
            subtopic: subtopic.code,
            year:     subtopic.year || '11-12',
            summary:  `${dp.name} — generation failed, please edit manually.`,
            keyConcepts:          [],
            commonErrors:         [],
            examTips:             [],
            socraticPrompts:      [],
            workedExampleTemplate: { type: 'stub', steps: [] },
            relatedDotPoints:     [],
          };
        }
      }

      doneSubtopics++;

      if (typeof onProgress === 'function') {
        onProgress({
          step:           'dot-points',
          topicName:      topic.name,
          subtopicName:   subtopic.name,
          topicIndex:     doneSubtopics,
          topicTotal:     totalSubtopics,
          dotPointsSoFar: Object.keys(allDotPoints).length,
          message:        `"${subtopic.name}" complete (${doneSubtopics}/${totalSubtopics} subtopics, ${Object.keys(allDotPoints).length} dot-points so far)`,
        });
      }

      // Brief pause between calls to avoid hammering the local model
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    subject:         subjectName,
    syllabusVersion: syllabusMap.syllabusVersion || '1.0',
    description:     `Dot-point detail for ${subjectName} supporting error analysis, worked examples and marking feedback.`,
    dotPoints:       allDotPoints,
  };
}

// ─────────────────────────────────────────────────────────────
// Main export: KBGeneratorService
// ─────────────────────────────────────────────────────────────

class KBGeneratorService {
  /**
   * @param {string} kbRoot  - absolute path to the knowledge-base/ directory
   * @param {object} model   - ModelManager instance (injected from main.js)
   */
  constructor(kbRoot, model) {
    this.kbRoot = kbRoot;
    this.model  = model;
  }

  /**
   * Check whether a subject already exists on disk.
   */
  checkExists(subjectName) {
    const subjectId   = toSubjectId(subjectName);
    const subjectPath = path.join(this.kbRoot, subjectId);
    const exists      = fs.existsSync(path.join(subjectPath, 'manifest.json'));
    return { exists, subjectId, path: subjectPath };
  }

  /**
   * Generate all three knowledge base files.
   * Does NOT write to disk — returns data for human review.
   *
   * @param {string}   subjectName
   * @param {Function} onProgress
   * @returns {Promise<{ subjectId, manifest, syllabusMap, dotPoints }>}
   */
  async generate(subjectName, onProgress) {
    const subjectId = toSubjectId(subjectName);
    const { model } = this;

    if (!model) throw new Error('ModelManager not available.');

    const notify = (step, message, extra = {}) => {
      console.log(`[KBGenerator] [${step}] ${message}`);
      if (typeof onProgress === 'function') {
        onProgress({ step, message, subjectId, ...extra });
      }
    };

    notify('manifest',     `Generating manifest for "${subjectName}"...`);
    const manifest = await generateManifest(model, subjectName, subjectId);
    notify('manifest',     'Manifest complete.');

    notify('syllabus-map', `Generating syllabus map for "${subjectName}"...`);
    const syllabusMap   = await generateSyllabusMap(model, subjectName, subjectId);
    const totalTopics   = (syllabusMap.topics || []).length;
    const totalSubtopics = (syllabusMap.topics || []).flatMap(t => t.subtopics || []).length;
    notify('syllabus-map', `Syllabus map complete — ${totalTopics} topics, ${totalSubtopics} subtopics.`);

    notify('dot-points',   `Generating dot-points (${totalSubtopics} subtopics one at a time)...`);
    const dotPoints = await generateDotPoints(
      model, subjectName, syllabusMap,
      (progress) => notify('dot-points', progress.message, progress)
    );

    notify('complete', 'Generation complete — ready for review.');
    return { subjectId, manifest, syllabusMap, dotPoints };
  }

  /**
   * Write approved files to disk.
   * knowledge-base/<subjectId>/manifest.json
   * knowledge-base/<subjectId>/syllabus/syllabus-map.json
   * knowledge-base/<subjectId>/syllabus/dot-points.json
   */
  approveAndSave(subjectId, files) {
    try {
      const subjectPath  = path.join(this.kbRoot, subjectId);
      const syllabusPath = path.join(subjectPath, 'syllabus');

      fs.mkdirSync(syllabusPath, { recursive: true });

      fs.writeFileSync(path.join(subjectPath,  'manifest.json'),    JSON.stringify(files.manifest,    null, 2), 'utf8');
      fs.writeFileSync(path.join(syllabusPath, 'syllabus-map.json'), JSON.stringify(files.syllabusMap, null, 2), 'utf8');
      fs.writeFileSync(path.join(syllabusPath, 'dot-points.json'),   JSON.stringify(files.dotPoints,   null, 2), 'utf8');

      console.log(`[KBGenerator] Knowledge base saved to: ${subjectPath}`);
      return { success: true, path: subjectPath };

    } catch (err) {
      console.error(`[KBGenerator] Save failed for "${subjectId}":`, err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = KBGeneratorService;