// main.js
// OpenTutor v3.0 — Electron Main Process Entry Point
//
// Responsibilities:
//   1. Bootstrap the data directory on first run (creates skeleton JSON files)
//   2. Initialise all backend modules in dependency order:
//        MemoryManager → ModelManager → SkillManager → Coordinator
//   3. Register all IPC handlers (via agent/index.js) so the renderer can
//      communicate with the backend through the preload bridge
//   4. Create and manage the BrowserWindow lifecycle
//
// Module wiring order (dependency-safe):
//   MemoryManager  — no dependencies; reads/writes data/students/
//   ModelManager   — reads data/config/user-config.json
//   SkillManager   — scans src/skills/ at startup
//   Coordinator    — receives all three managers + kbRoot path
//
// Security model:
//   contextIsolation: true   — renderer cannot touch Node APIs directly
//   nodeIntegration:  false  — renderer has no raw require()
//   sandbox:          false  — preload.js needs Node (ipcRenderer, contextBridge)
//
// Directory layout expected at runtime:
//
//   <appRoot>/
//     main.js
//     preload.js
//     src/
//       main/
//         memory/index.js
//         model-manager/index.js
//         skill-manager/index.js
//         agent/index.js        ← createCoordinator + registerIpcHandlers
//       renderer/
//         index.html            ← renderer entry point
//     knowledge-base/
//       hsc-maths-advanced/     ← syllabus JSON, past papers, marking guidelines
//     data/                     ← created on first run; never bundled in installer

'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

// ─────────────────────────────────────────────────────────────
// Path constants
// All paths are absolute, derived from __dirname (= app root).
// Note: DATA_ROOT is declared as 'let' so it can be reassigned
// for packaged apps that run from read-only ASAR archives.
// ─────────────────────────────────────────────────────────────

const APP_ROOT    = __dirname;
let DATA_ROOT     = path.join(APP_ROOT, 'data');
const KB_ROOT     = path.join(APP_ROOT, 'knowledge-base');
const SRC_MAIN    = path.join(APP_ROOT, 'src', 'main');
const SKILLS_ROOT = path.join(APP_ROOT, 'src', 'skills');

// Global reference to main window
let mainWindow = null;

// ─────────────────────────────────────────────────────────────
// First-run data directory bootstrap
//
// Creates the full data/ skeleton if any part of it is missing.
// This means the app works on a fresh install without a separate
// installer step — no manual directory creation needed.
//
// All writes are guarded with existsSync() so re-running on an
// established install never overwrites the student's existing data.
// ─────────────────────────────────────────────────────────────

function bootstrapDataDirectory() {
  // First, ensure the base data directory exists and is a directory
  if (fs.existsSync(DATA_ROOT)) {
    const stat = fs.statSync(DATA_ROOT);
    if (!stat.isDirectory()) {
      // If it's a file, move it out of the way
      const backupPath = DATA_ROOT + '.backup.' + Date.now();
      console.log(`[Bootstrap] Moving conflicting file to: ${backupPath}`);
      fs.renameSync(DATA_ROOT, backupPath);
    }
  }

  const dirs = [
    DATA_ROOT,
    path.join(DATA_ROOT, 'config'),
    path.join(DATA_ROOT, 'students'),
    path.join(DATA_ROOT, 'students', 'default'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Bootstrap] Created: ${dir}`);
    }
  }

  // ── Default user-config.json ─────────────────────────────────
  const configPath = path.join(DATA_ROOT, 'config', 'user-config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      activeModel: 'ollama:qwen2.5-coder:3b',
      ollamaUrl:   'http://localhost:11434',
      apiKeys:     {},
      studentName: '',
      theme:       'default',
      createdAt:   new Date().toISOString(),
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log('[Bootstrap] Created user-config.json');
  }

  // ── Default student data files ────────────────────────────────
  // Written once on first run. All files match the Memory Manager's
  // expected schema exactly so it has valid data to work with.
  const studentDir = path.join(DATA_ROOT, 'students', 'default');

  const defaultStudentFiles = {
    'profile.md': [
      '## Student Profile',
      '',
      '- Name: ',
      '- HSC Exam Date: ',
      '- Weekly Study Hours: ',
      '- Subject Confidence: ',
      '- Motivation Style: ',
      '- Year 11 Background: ',
      '- Extension 1 Experience: ',
    ].join('\n'),

    'mistakes.md': '## Mistake Record\n',

    'progress.json': JSON.stringify({
      attempts:    0,
      correct:     0,
      topics:      {},
      lastUpdated: null,
    }, null, 2),

    'syllabus-mastery.json': JSON.stringify({
      dotPoints:   {},
      lastUpdated: null,
    }, null, 2),

    'exam-readiness.json': JSON.stringify({
      overall:     null,
      byTopic:     {},
      lastUpdated: null,
    }, null, 2),

    // v3.0 personalisation files
    'learning-style.json': JSON.stringify({
      preferredRepresentation: null,
      respondsWellTo:          [],
      strugglesWith:           [],
      observationCount:        0,
      lastUpdated:             null,
    }, null, 2),

    'velocity.json': JSON.stringify({
      topics:      {},
      lastUpdated: null,
    }, null, 2),

    'affective-history.json': JSON.stringify({
      history:     [],
      lastUpdated: null,
    }, null, 2),
  };

  for (const [filename, content] of Object.entries(defaultStudentFiles)) {
    const filePath = path.join(studentDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[Bootstrap] Created ${filename}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Module initialisation
//
// Modules are initialised in strict dependency order:
//   MemoryManager → ModelManager → SkillManager → Coordinator
//
// Constructors are synchronous. Only SkillManager.loadAll() is async
// (it scans the disk and parses SKILL.md files for each skill plugin).
//
// Modules are required inside this function (not at top level) so
// that a syntax error in any module is caught here and reported
// as a proper startup error rather than an uncaught crash.
//
// Any failure is re-thrown so the caller can show a native dialog
// and quit rather than presenting a broken, half-initialised UI.
// ─────────────────────────────────────────────────────────────

async function initialiseModules() {
  // ── EXTENSIVE PATH DEBUGGING ─────────────────────────────────────
  console.log('[DEBUG] ========== MODULE INITIALISATION DEBUG ==========');
  console.log('[DEBUG] App is packaged?', app.isPackaged);
  console.log('[DEBUG] __dirname:', __dirname);
  console.log('[DEBUG] APP_ROOT:', APP_ROOT);
  console.log('[DEBUG] DATA_ROOT:', DATA_ROOT);
  console.log('[DEBUG] process.resourcesPath:', process.resourcesPath);
  console.log('[DEBUG] app.getPath("userData"):', app.getPath('userData'));
  console.log('[DEBUG] Running from inside ASAR?', __dirname.includes('app.asar'));
  console.log('[DEBUG] ========== END DEBUGGING ==========\n');

  // ── REQUIRE MODULES ─────────────────────────────────────────────
  console.log('[Init] Loading modules...');
  
  let MemoryManager, ModelManager, SkillManager, agent;
  
  try {
    MemoryManager = require(path.join(SRC_MAIN, 'memory', 'index.js'));
    console.log('[Init] ✓ MemoryManager module loaded');
  } catch (err) {
    console.error('[Init] ✗ Failed to load MemoryManager:', err);
    throw new Error(`Failed to load MemoryManager: ${err.message}`);
  }
  
  try {
    ModelManager = require(path.join(SRC_MAIN, 'model-manager', 'index.js'));
    console.log('[Init] ✓ ModelManager module loaded');
  } catch (err) {
    console.error('[Init] ✗ Failed to load ModelManager:', err);
    throw new Error(`Failed to load ModelManager: ${err.message}`);
  }
  
  try {
    SkillManager = require(path.join(SRC_MAIN, 'skill-manager', 'index.js'));
    console.log('[Init] ✓ SkillManager module loaded');
  } catch (err) {
    console.error('[Init] ✗ Failed to load SkillManager:', err);
    throw new Error(`Failed to load SkillManager: ${err.message}`);
  }
  
  try {
    agent = require(path.join(SRC_MAIN, 'agent', 'index.js'));
    console.log('[Init] ✓ Agent module loaded');
  } catch (err) {
    console.error('[Init] ✗ Failed to load Agent:', err);
    throw new Error(`Failed to load Agent: ${err.message}`);
  }
  
  const { createCoordinator, registerIpcHandlers } = agent;

  // ── FIX: Ensure DATA_ROOT is writable and is a directory ─────────
  // If we're in a packaged app and DATA_ROOT points inside ASAR, fix it
  if (app.isPackaged && DATA_ROOT.includes('app.asar')) {
    console.warn('[Init] WARNING: DATA_ROOT points inside ASAR! This will cause write errors.');
    console.warn('[Init] Using app.getPath("userData") instead for data storage.');
    
    // Reassign DATA_ROOT to a writable location
    DATA_ROOT = path.join(app.getPath('userData'), 'data');
    console.log('[Init] New DATA_ROOT:', DATA_ROOT);
  }
  
  // Ensure DATA_ROOT exists and is a directory
  try {
    if (!fs.existsSync(DATA_ROOT)) {
      console.log('[Init] Creating DATA_ROOT directory...');
      fs.mkdirSync(DATA_ROOT, { recursive: true });
      console.log('[Init] ✓ DATA_ROOT created');
    } else {
      const stat = fs.statSync(DATA_ROOT);
      if (!stat.isDirectory()) {
        // If it's a file, move it out of the way
        const backupPath = DATA_ROOT + '.backup.' + Date.now();
        console.warn(`[Init] DATA_ROOT is a file! Moving to: ${backupPath}`);
        fs.renameSync(DATA_ROOT, backupPath);
        fs.mkdirSync(DATA_ROOT, { recursive: true });
        console.log('[Init] ✓ Created fresh DATA_ROOT directory');
      }
    }
    
    // Verify we can write to DATA_ROOT
    const testFile = path.join(DATA_ROOT, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('[Init] ✓ DATA_ROOT is writable');
    
  } catch (err) {
    console.error('[Init] ✗ Cannot access/create DATA_ROOT:', err);
    throw new Error(`Data directory is not accessible: ${err.message}`);
  }

  // ── 1. Memory Manager ────────────────────────────────────────
  console.log('[Init] Creating Memory Manager...');
  let memory;
  try {
    memory = new MemoryManager(DATA_ROOT);
    console.log('[Init] ✓ Memory Manager created');
  } catch (err) {
    console.error('[Init] ✗ Failed to create Memory Manager:', err);
    throw new Error(`Memory Manager initialisation failed: ${err.message}`);
  }

  // ── 2. Model Manager ─────────────────────────────────────────
  console.log('[Init] Creating Model Manager...');
  let model;
  try {
    model = new ModelManager(DATA_ROOT);
    console.log('[Init] ✓ Model Manager created');
  } catch (err) {
    console.error('[Init] ✗ Failed to create Model Manager:', err);
    throw new Error(`Model Manager initialisation failed: ${err.message}`);
  }

  // ── 3. Skill Manager ─────────────────────────────────────────
  console.log('[Init] Creating Skill Manager...');
  let skillManager;
  try {
    skillManager = new SkillManager(SKILLS_ROOT);
    
    // Check if skills directory exists
    if (!fs.existsSync(SKILLS_ROOT)) {
      console.warn(`[Init] Skills directory not found: ${SKILLS_ROOT}`);
      console.log('[Init] Creating empty skills list (no skills will be loaded)');
      // Create a minimal skill manager
      skillManager = {
        listSkills: () => [],
        getSkill: () => null,
        load: () => {}
      };
    } else {
      skillManager.load();
      const loaded = skillManager.listSkills ? skillManager.listSkills() : [];
      const activeCount = loaded.filter(s => s && s.type === 'active').length;
      const passiveCount = loaded.filter(s => s && s.type === 'passive').length;
      
      console.log(
        `[Init] ✓ Skill Manager created — ${loaded.length} skill(s) ` +
        `(${activeCount} active, ${passiveCount} passive)`
      );
    }
  } catch (err) {
    console.error('[Init] ✗ Failed to create Skill Manager:', err);
    // Don't throw - skills are optional
    console.log('[Init] Continuing with empty skill manager');
    // Create a minimal skill manager
    skillManager = {
      listSkills: () => [],
      getSkill: () => null,
      load: () => {}
    };
  }

  // ── 4. Agent Coordinator ──────────────────────────────────────
  console.log('[Init] Creating Agent Coordinator...');
  let coordinator;
  try {
    // Check if KB_ROOT exists
    if (!fs.existsSync(KB_ROOT)) {
      console.warn(`[Init] Knowledge base not found: ${KB_ROOT}`);
    }
    
    coordinator = createCoordinator({ 
      memory, 
      skillManager, 
      model, 
      kbRoot: KB_ROOT 
    });
    console.log('[Init] ✓ Agent Coordinator created');
  } catch (err) {
    console.error('[Init] ✗ Failed to create Agent Coordinator:', err);
    throw new Error(`Agent Coordinator initialisation failed: ${err.message}`);
  }

  // ── 5. IPC Handlers ──────────────────────────────────────────
  console.log('[Init] Registering IPC handlers...');
  try {
    registerIpcHandlers(ipcMain, coordinator, { memory, model, skillManager });
    
    // config:save is registered here rather than in agent/index.js because it
    // calls model.saveConfig() directly — a method the coordinator does not expose.
    ipcMain.handle('config:save', async (_event, { config }) => {
      try {
        model.saveConfig(config);
        return { success: true };
      } catch (err) {
        console.error('[IPC config:save]', err.message);
        return { success: false, error: err.message };
      }
    });
    
    // devtools:toggle handler
    ipcMain.handle('devtools:toggle', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.toggleDevTools();
      }
      return { success: true };
    });
    
    // export:response handler
    ipcMain.handle('export:response', async (_event, { content, format, filename }) => {
      try {
        const downloadsDir = app.getPath('downloads');
        const safeName = (filename || 'opentutor-response')
          .replace(/[^a-z0-9_\-\s]/gi, '').trim()
          .replace(/\s+/g, '-').toLowerCase().slice(0, 80) || 'opentutor-response';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const ext  = format === 'html' ? 'html' : 'md';
        const file = safeName + '-' + timestamp + '.' + ext;
        const dest = path.join(downloadsDir, file);
  
        let output = content;
  
        if (format === 'html') {
          const { marked } = require('marked');
          const exportDate  = new Date().toLocaleString();
  
          // ── Step 1 & 2: stash math + mermaid before marked sees them ──────
          const mathStash    = [];
          const mermaidStash = [];
          let src = content;
  
          // Mermaid fenced blocks
          src = src.replace(/```(?:mermaid|flowchart)[ \t]*\r?\n([\s\S]*?)```/g, (_, c) => {
            const i = mermaidStash.length;
            mermaidStash.push(c.trim());
            return 'OTMERM' + i + 'END';
          });
          // Display math $$...$$
          src = src.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
            const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
          });
          // Display math \[...\]
          src = src.replace(/\\\[([\s\S]+?)\\\]/g, (m) => {
            const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
          });
          // Inline math \(...\)
          src = src.replace(/\\\((.+?)\\\)/g, (m) => {
            const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
          });
          // Inline math $...$  (only if LaTeX-like)
          src = src.replace(/(?<!\$)\$(?!\$)([^\n$`]+?)(?<!\$)\$(?!\$)/g, (m, inner) => {
            if (/[\\^_{}\[\]]/.test(inner) || /[a-zA-Z]{2,}/.test(inner)) {
              const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
            }
            return m;
          });
  
          // ── Step 3: parse markdown ─────────────────────────────────────────
          const codeRenderer = {
            code({ text, lang }) {
              const l = (lang || '').trim().toLowerCase();
              if (l === 'mermaid' || l === 'flowchart') {
                // Shouldn't reach here after stash, but guard anyway
                const i = mermaidStash.length;
                mermaidStash.push(text.trim());
                return 'OTMERM' + i + 'END';
              }
              const esc   = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
              const label = lang ? '<span class="code-lang">' + lang + '</span>' : '';
              return '<div class="code-wrap">' + label + '<pre><code>' + esc + '</code></pre></div>';
            }
          };
          marked.use({ renderer: codeRenderer, breaks: true, gfm: true });
          let bodyHtml = marked.parse(src);
  
          // ── Step 4: restore math verbatim ────────────────────────────────
          mathStash.forEach((orig, i) => {
            bodyHtml = bodyHtml.split('OTMATH' + i + 'END').join(orig);
          });
  
          // ── Step 5: restore mermaid as static <div class="mermaid"> ──────
          mermaidStash.forEach((code, i) => {
            const esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const div = '<div class="mermaid-wrap"><div class="mermaid">' + esc + '</div></div>';
            bodyHtml = bodyHtml.split('<p>OTMERM' + i + 'END</p>').join(div);
            bodyHtml = bodyHtml.split('OTMERM' + i + 'END').join(div);
          });
  
          // ── Step 6: build final HTML ─────────────────────────────────────
          const css = [
            '*,*::before,*::after{box-sizing:border-box}',
            'body{font-family:Georgia,serif;max-width:800px;margin:48px auto;padding:0 24px 64px;line-height:1.85;color:#1a1a2e;background:#fff}',
            'h1,h2,h3{color:#0f3460;margin-top:1.6em;margin-bottom:.4em}',
            'h1{font-size:1.5rem}h2{font-size:1.2rem}h3{font-size:1.05rem}',
            'p{margin:.8em 0}ul,ol{margin:.5em 0 .8em 1.5em}li{margin-bottom:.3em}',
            'strong{font-weight:700}em{font-style:italic}',
            'blockquote{border-left:4px solid #e8a020;margin:1em 0;padding:6px 16px;background:#fffbf2;border-radius:0 6px 6px 0;color:#555}',
            'table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.9rem}',
            'th,td{border:1px solid #d0d7e2;padding:8px 12px;text-align:left}',
            'th{background:#f0f4fa;font-weight:600}tr:nth-child(even) td{background:#f8fafc}',
            '.code-wrap{position:relative;margin:10px 0}',
            '.code-lang{position:absolute;top:8px;right:10px;font-family:monospace;font-size:11px;color:#aaa;background:#1e1e2e;padding:2px 6px;border-radius:4px}',
            'pre{background:#1e1e2e;color:#c9d1d9;padding:16px;border-radius:8px;overflow-x:auto;margin:0;font-size:.88rem;line-height:1.6}',
            'code{background:#f0f0f5;padding:2px 5px;border-radius:3px;font-family:monospace;font-size:.88em;color:#d63384}',
            'pre code{background:none;color:#c9d1d9;padding:0}',
            '.mermaid-wrap{background:#f8fafc;border:1px solid #e0e4ec;border-radius:8px;padding:16px;margin:1.5em 0;text-align:center;overflow-x:auto}',
            '.mermaid-wrap svg{max-width:100%;height:auto}',
            'mjx-container{overflow-x:auto;max-width:100%}',
            'mjx-container[display="true"]{display:block;text-align:center;background:#f8fafc;border:1px solid #e8ecf2;border-radius:6px;padding:14px;margin:1.2em 0;overflow-x:auto}',
            'hr{border:none;border-top:1px solid #e8ecf2;margin:2em 0}',
            '.meta{font-size:.78rem;color:#999;margin-bottom:32px;padding-bottom:12px;border-bottom:1px solid #eee}',
            '.meta strong{color:#e8a020}'
          ].join('\n');
  
          // MathJax config
          const mjCfg = [
            'window.MathJax={',
            '  tex:{',
            '    inlineMath:[["$","$"],["\\\\(","\\\\)"]],',
            '    displayMath:[["$$","$$"],["\\\\[","\\\\]"]],',
            '    processEscapes:true',
            '  },',
            '  options:{skipHtmlTags:["script","style","pre","code"]},',
            '  startup:{typeset:true}',
            '};'
          ].join('\n');
  
          const rows = [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width,initial-scale=1.0">',
            '<title>OpenTutor — ' + exportDate + '</title>',
            '<style>' + css + '</style>',
            '<script>' + mjCfg + '<\/script>',
            '<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"><\/script>',
            '<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>',
            '</head>',
            '<body>',
            '<p class="meta">Exported from <strong>OpenTutor</strong> &nbsp;&middot;&nbsp; HSC Mathematics Advanced &nbsp;&middot;&nbsp; ' + exportDate + '</p>',
            bodyHtml,
            '<script>',
            'if(window.mermaid){',
            '  mermaid.initialize({startOnLoad:false,theme:"default",securityLevel:"loose"});',
            '  document.addEventListener("DOMContentLoaded",function(){mermaid.run({querySelector:".mermaid"});});',
            '  if(document.readyState!=="loading"){mermaid.run({querySelector:".mermaid"});}',
            '}',
            '<\/script>',
            '</body>',
            '</html>'
          ];
  
          output = rows.join('\n');
        }
  
        fs.writeFileSync(dest, output, 'utf8');
        return { success: true, path: dest, filename: file };
      } catch (err) {
        console.error('[IPC export:response]', err.message);
        return { success: false, error: err.message };
      }
    });
    
    console.log('[Init] ✓ IPC handlers registered');
  } catch (err) {
    console.error('[Init] ✗ Failed to register IPC handlers:', err);
    throw new Error(`IPC handler registration failed: ${err.message}`);
  }

  console.log('[Init] ✓ All modules initialised successfully');
  return { memory, model, skillManager, coordinator };
}

// ─────────────────────────────────────────────────────────────
// BrowserWindow factory
//
// The window is created only after all backend modules are ready,
// which guarantees every IPC handler is registered before the
// renderer process makes its first call.
// ─────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width:           1200,
    height:          800,
    minWidth:        900,
    minHeight:       600,
    title:           'OpenTutor',
    backgroundColor: '#1a1a2e',   // dark base; eliminates white flash before content loads
    show:            false,        // revealed only after first frame is painted
    webPreferences: {
      preload:          path.join(APP_ROOT, 'preload.js'),
      contextIsolation: true,      // renderer cannot access Node.js directly
      nodeIntegration:  false,     // no require() available in renderer
      sandbox:          false,     // preload.js needs Node (ipcRenderer + contextBridge)
    },
  });

  win.loadFile(path.join(APP_ROOT, 'src', 'renderer', 'index.html'));

  // Show the window once the renderer has painted its first frame.
  // Without this, a blank/white window appears briefly on launch.
  win.once('ready-to-show', () => {
    win.show();
    console.log('[Window] Main window shown.');
  });

  // DevTools are OFF by default.
  // The renderer can toggle them via the 'devtools:toggle' IPC channel.

  win.on('closed', () => {
    console.log('[Window] Main window closed.');
  });

  return win;
}

// ─────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log(`[App] Electron ready — OpenTutor v${app.getVersion()}`);

  // Step 1: Bootstrap the data directory (no-op on established installs)
  try {
    bootstrapDataDirectory();
  } catch (err) {
    // Non-fatal — individual modules handle missing files gracefully.
    console.error('[Bootstrap] Data directory setup failed:', err.message);
  }

  // Step 2: Initialise all backend modules
  try {
    await initialiseModules();
  } catch (err) {
    console.error('[Init] Fatal — module initialisation failed:', err);
    await dialog.showErrorBox(
      'OpenTutor — Startup Error',
      [
        'OpenTutor failed to start because a required module could not be initialised.',
        '',
        `Error: ${err.message}`,
        '',
        'Common causes:',
        '  • Ollama is not running  →  start it with: ollama serve',
        '  • A file is missing from src/main/',
        '  • A skill plugin has a syntax error',
        '',
        'Please fix the issue and restart the application.',
      ].join('\n')
    );
    app.quit();
    return;
  }

  // Step 3: Create and show the main window
  mainWindow = createWindow();

  // macOS: re-create the window when the dock icon is clicked and all
  // windows have been closed (standard macOS application behaviour).
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

// Windows / Linux: quit when all windows are closed.
// macOS keeps the process running in the dock until the user explicitly quits.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─────────────────────────────────────────────────────────────
// Global error handlers
//
// Catches unhandled promise rejections and uncaught exceptions in the
// main process — ensures they appear in terminal logs and Electron's
// crash reporter rather than failing silently.
// ─────────────────────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Main] Uncaught exception:', err);
});