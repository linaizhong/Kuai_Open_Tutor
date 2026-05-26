// Skill Manager — Loader
// Scans the skills/ directory recursively, reads each SKILL.md, and registers all skill plugins.
// Supports THREE patterns:
//   1. Traditional: SKILL.md + index.js (OpenTutor style)
//   2. Single-file: SKILL.md with embedded JavaScript code block (OpenClaw style)
//   3. Tool-based: SKILL.md with workflow and tool references (NEW)

const fs   = require('fs');
const path = require('path');

/**
 * Parses a SKILL.md file and extracts skill metadata and optionally embedded code.
 *
 * Expected SKILL.md format with embedded code:
 *
 *   # Skill: skill-name
 *   ## Meta
 *   - **Name**: skill-name
 *   - **Type**: active|passive
 *   - **Category**: math|exam-prep|toefl|gre (optional)
 *   ## Triggers
 *   ```json
 *   { "keywords": [...], "intent": "..." }
 *   ```
 *   ## Workflow (optional for tool-based skills)
 *   1. Step one
 *   2. Step two
 *   ## Tools Used (optional for tool-based skills)
 *   - `tool-name`
 */
function parseSkillMd(markdown, skillDir) {
  const meta = {
    name: null,
    type: 'active',
    category: null,
    description: null,
    triggers: { keywords: [], intent: '' },
    code: null,           // extracted JavaScript code if present
    workflow: [],         // extracted workflow steps if present
    tools: [],            // extracted tool references if present
    isToolBased: false,   // flag for tool-based skills
  };

  // Extract name
  const nameMatch = markdown.match(/\*\*Name\*\*:\s*(.+)/);
  if (nameMatch) meta.name = nameMatch[1].trim();

  // Extract type
  const typeMatch = markdown.match(/\*\*Type\*\*:\s*(active|passive)/i);
  if (typeMatch) meta.type = typeMatch[1].toLowerCase().trim();

  // Extract category (optional)
  const categoryMatch = markdown.match(/\*\*Category\*\*:\s*(.+)/);
  if (categoryMatch) meta.category = categoryMatch[1].trim().toLowerCase();

  // Extract description (the line after ## Description)
  const descMatch = markdown.match(/## Description\s*\n+(.+)/);
  if (descMatch) meta.description = descMatch[1].trim();

  // Extract triggers JSON block
  const triggersMatch = markdown.match(/```json\s*([\s\S]*?)```/);
  if (triggersMatch) {
    try {
      const triggers = JSON.parse(triggersMatch[1].trim());
      meta.triggers = {
        keywords: Array.isArray(triggers.keywords) ? triggers.keywords : [],
        intent: triggers.intent || '',
      };
    } catch {
      // JSON invalid — use empty defaults
    }
  }

  // Extract JavaScript code block (if present)
  const codeMatch = markdown.match(/```javascript\s*([\s\S]*?)```/);
  if (codeMatch) {
    meta.code = codeMatch[1].trim();
  }

  // Extract workflow steps (if present)
  const workflowMatch = markdown.match(/## Workflow\s*\n([\s\S]*?)(?=\n##|$)/);
  if (workflowMatch) {
    const workflowText = workflowMatch[1];
    const stepMatches = workflowText.match(/(?:\d+\.|\*)\s*(.+)/g) || [];
    meta.workflow = stepMatches.map(line => line.replace(/^\d+\.\s*|\*\s*/, '').trim());
  }

  // Extract tool references (if present)
  const toolsMatch = markdown.match(/## Tools Used\s*\n([\s\S]*?)(?=\n##|$)/);
  if (toolsMatch) {
    const toolsText = toolsMatch[1];
    const toolMatches = toolsText.match(/`([^`]+)`/g) || [];
    meta.tools = toolMatches.map(t => t.replace(/`/g, ''));
    meta.isToolBased = meta.tools.length > 0;
  }

  return meta;
}

/**
 * Creates an executable module from extracted code string.
 * Wraps the code in a function that returns an object with execute method.
 */
function createModuleFromCode(codeString, skillName) {
  try {
    // Use Function constructor so embedded code runs in the host Node context
    // and can access require, process etc — just like a real module would.
    // The code block must return an object with an execute() function, e.g.:
    //   return { execute: async function(params, context) { ... } };
    // eslint-disable-next-line no-new-func
    const factory = new Function('require', codeString);
    const exported = factory(require);

    if (!exported || typeof exported.execute !== 'function') {
      console.error(`[Loader] Embedded code in "${skillName}" must return { execute() }. Got: ${typeof exported}`);
      return null;
    }

    return { meta: { name: skillName }, ...exported };
  } catch (err) {
    console.error(`[Loader] Failed to create module from embedded code for "${skillName}": ${err.message}`);
    return null;
  }
}

/**
 * Creates a tool-based skill module backed by MarkdownSkillRunner.
 * The mdPath is captured in a closure so the runner can load the SKILL.md at execution time.
 */
function createToolBasedModule(skillMeta, mdPath) {
  const MarkdownSkillRunner = require('./MarkdownSkillRunner');

  return {
    meta: {
      name:        skillMeta.name,
      type:        skillMeta.type,
      category:    skillMeta.category,
      isToolBased: true,
      workflow:    skillMeta.workflow,
      tools:       skillMeta.tools,
    },
    execute: async function(params, context) {
      // Use the model from context (injected by Coordinator) so no separate
      // runner instance needs to be constructed here.
      const runner = new MarkdownSkillRunner({ model: context.model });
      return runner.execute(mdPath, params, context);
    },
  };
}

/**
 * Recursively scans a directory for skill folders.
 * A folder is considered a skill if it contains SKILL.md.
 *
 * @param {string} currentPath - Absolute path to scan
 * @param {string} relativePath - Relative path from skills root
 * @returns {Array} Array of skill objects
 */
function scanDirectoryRecursively(currentPath, relativePath = '') {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const entryRelativePath = relativePath
      ? path.join(relativePath, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      // Check if this directory contains SKILL.md
      const mdPath = path.join(fullPath, 'SKILL.md');

      if (fs.existsSync(mdPath)) {
        // This is a skill directory - load it
        const skill = loadSkillFromDirectory(fullPath, entry.name, entryRelativePath);
        if (skill) skills.push(skill);
      } else {
        // This might be a category folder - recurse into it
        const subSkills = scanDirectoryRecursively(fullPath, entryRelativePath);
        skills.push(...subSkills);
      }
    }
  }

  return skills;
}

/**
 * Loads a single skill from a directory that contains SKILL.md.
 * Tries three patterns:
 *   1. Look for index.js (traditional OpenTutor)
 *   2. If no index.js, look for embedded code in SKILL.md (OpenClaw style)
 *   3. If no code, check if it's a tool-based skill (has workflow and tools)
 *
 * @param {string} skillDir - Absolute path to the skill directory
 * @param {string} dirName - Name of the skill directory
 * @param {string} relativePath - Relative path from skills root
 * @returns {object|null} Skill registration object or null if loading fails
 */
function loadSkillFromDirectory(skillDir, dirName, relativePath) {
  const mdPath = path.join(skillDir, 'SKILL.md');
  const indexPath = path.join(skillDir, 'index.js');

  // Parse SKILL.md for metadata
  let markdown, mdMeta;
  try {
    markdown = fs.readFileSync(mdPath, 'utf8');
    mdMeta = parseSkillMd(markdown, skillDir);
  } catch (err) {
    console.error(`[Loader] Failed to read SKILL.md for "${dirName}": ${err.message}`);
    return null;
  }

  // Try to load the executable module
  let skillModule = null;
  let source = null;

  // Pattern 1: Traditional - look for index.js
  if (fs.existsSync(indexPath)) {
    try {
      skillModule = require(indexPath);
      source = 'index.js';
      console.log(`[Loader] Loaded "${dirName}" from index.js (traditional)`);
    } catch (err) {
      console.error(`[Loader] Failed to load "${dirName}/index.js": ${err.message}`);
    }
  }

  // Pattern 2: Single-file - look for embedded code in SKILL.md
  if (!skillModule && mdMeta.code) {
    skillModule = createModuleFromCode(mdMeta.code, dirName);
    if (skillModule) {
      source = 'embedded-code';
      console.log(`[Loader] Loaded "${dirName}" from SKILL.md code block (single-file)`);
    }
  }

  // Pattern 3: Tool-based — has workflow and tools, execute via MarkdownSkillRunner
  if (!skillModule && mdMeta.isToolBased) {
    skillModule = createToolBasedModule(mdMeta, mdPath);  // pass mdPath so runner can load the SKILL.md
    source = 'tool-based';
    console.log(`[Loader] Loaded "${dirName}" as tool-based skill (workflow + tools)`);
  }

  // Pattern 4: SKILL.md-only — no index.js, no embedded code, no tools section.
  // Treat as a pure markdown skill and execute via MarkdownSkillRunner directly.
  // This means ANY folder with just a SKILL.md is a valid skill — no code needed.
  if (!skillModule) {
    skillModule = createToolBasedModule(mdMeta, mdPath);
    source = 'tool-based';
    console.log(`[Loader] Loaded "${dirName}" as markdown-only skill (SKILL.md, no code)`);
  }

  // Validate the module implements the required interface
  if (typeof skillModule.execute !== 'function') {
    console.error(`[Loader] Skipping "${dirName}" — module must export an execute() function`);
    return null;
  }

  // Use module meta if available, fall back to SKILL.md parsed meta
  const moduleMeta = skillModule.meta || {};

  // Infer category from folder structure if not specified
  let category = mdMeta.category;
  if (!category) {
    const pathParts = relativePath.split(path.sep);
    if (pathParts.length > 1) {
      category = pathParts[0];
    } else {
      category = 'uncategorized';
    }
  }

  return {
    name:        dirName,
    type:        moduleMeta.type || mdMeta.type,
    category:    category,
    description: mdMeta.description || moduleMeta.name || dirName,
    triggers:    mdMeta.triggers,
    dirPath:     skillDir,
    mdPath:      mdPath,          // ← stored so MarkdownSkillRunner can always find the SKILL.md
    relativePath: relativePath,
    module:      skillModule,
    source:      source || 'unknown',
    isToolBased: mdMeta.isToolBased || false,
    workflow:    mdMeta.workflow || [],
    tools:       mdMeta.tools || [],
  };
}

/**
 * Loads all skills from the given skills root directory.
 * Supports both flat and nested folder structures.
 *
 * @param {string} skillsRoot - Absolute path to the src/skills/ directory
 * @returns {object[]}
 */
function loadSkills(skillsRoot) {
  if (!fs.existsSync(skillsRoot)) {
    console.warn(`[Loader] Skills directory not found: ${skillsRoot}`);
    return [];
  }

  console.log(`[Loader] Scanning for skills in: ${skillsRoot}`);
  const skills = scanDirectoryRecursively(skillsRoot, '');

  // Log summary
  const traditional = skills.filter(s => s.source === 'index.js').length;
  const singleFile = skills.filter(s => s.source === 'embedded-code').length;
  const toolBased = skills.filter(s => s.source === 'tool-based').length;
  const categoryCount = {};

  for (const skill of skills) {
    categoryCount[skill.category] = (categoryCount[skill.category] || 0) + 1;
  }

  console.log(`[Loader] Loaded ${skills.length} skills (${traditional} traditional, ${singleFile} single-file, ${toolBased} tool-based):`);
  for (const [cat, count] of Object.entries(categoryCount)) {
    console.log(`[Loader]   ${cat}: ${count} skill(s)`);
  }

  return skills;
}

module.exports = { loadSkills, parseSkillMd, scanDirectoryRecursively, createModuleFromCode, createToolBasedModule };