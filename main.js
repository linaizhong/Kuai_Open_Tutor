// main.js
// OpenTutor v3.0 — Electron Main Process Entry Point
//
// Responsibilities:
//   1. Validate the serial-number licence before anything else is shown
//   2. Bootstrap the data directory on first run (creates skeleton JSON files)
//   3. Initialise all backend modules in dependency order:
//        MemoryManager → ModelManager → SkillManager → Coordinator
//   4. Start embedded Ollama process (if not already running)
//   5. Register all IPC handlers (via agent/index.js) so the renderer can
//      communicate with the backend through the preload bridge
//   6. Create and manage the BrowserWindow lifecycle
//
// Licence flow:
//   On every launch, checkLicence() reads data/config/licence.json.
//   Valid licence  → launchMainApp() runs immediately.
//   Missing/bad    → createLicenceWindow() shows the activation UI.
//   Activation     → activateLicence() validates HMAC + writes licence.json,
//                    then calls launchMainApp().
//
// Serial format:  OT30-XXXX-XXXX-XXXX
//   See the "Serial Number / Licence System" section for generation
//   instructions and the HMAC secret to change before shipping.
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
//         service/
//           ollama/
//             runners/          ← contains ollama.exe
//       renderer/
//         index.html            ← renderer entry point
//     knowledge-base/
//       hsc-maths-advanced/     ← syllabus JSON, past papers, marking guidelines
//     data/                     ← created on first run; never bundled in installer

'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { spawn } = require('child_process');
const http = require('http');

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
const OLLAMA_RUNNER_DIR = path.join(APP_ROOT, 'src', 'service', 'ollama', 'runners');

// ─────────────────────────────────────────────────────────────
// Logger
//
// Intercepts console.log / console.warn / console.error so every
// backend message is written to data/logs/opentutor.log as well as
// the terminal. No other file needs to change — all modules already
// call console.* and are captured transparently.
//
// Rotation policy:
//   • On startup, if the existing log was created on a previous day,
//     it is renamed to opentutor-YYYY-MM-DD.log before a fresh one
//     is opened. This keeps one file per day.
//   • Files older than LOG_KEEP_DAYS are deleted automatically.
//   • Each line is prefixed with an ISO timestamp and level tag.
// ─────────────────────────────────────────────────────────────

const LOG_KEEP_DAYS = 7;

let _logStream   = null;   // fs.WriteStream — null until initLogger() runs
let _logFilePath = null;   // absolute path to today's log file

/**
 * Formats a log line: "2026-03-14T11:56:23.123Z [INFO ] message..."
 */
function _formatLogLine(level, args) {
  const ts  = new Date().toISOString();
  const msg = args.map(a =>
    (a instanceof Error) ? (a.stack || a.message) :
    (typeof a === 'object') ? JSON.stringify(a) :
    String(a)
  ).join(' ');
  return `${ts} [${level.padEnd(5)}] ${msg}\n`;
}

/**
 * Writes one line to the log file stream (fire-and-forget, never throws).
 */
function _writeLog(level, args) {
  if (!_logStream) return;
  try {
    _logStream.write(_formatLogLine(level, args));
  } catch (_) {
    // Never let logging crash the app
  }
}

/**
 * Initialises the log directory, rotates yesterday's file if needed,
 * opens today's WriteStream, and patches console.*.
 *
 * Must be called after DATA_ROOT is known (i.e. right inside
 * app.whenReady, but we call it earlier since DATA_ROOT is set at
 * module load time).
 */
function initLogger() {
  try {
    const logsDir = path.join(DATA_ROOT, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const todayStr    = new Date().toISOString().slice(0, 10); // "2026-03-14"
    _logFilePath      = path.join(logsDir, 'opentutor.log');

    // ── Rotate if the existing log is from a previous day ────────
    if (fs.existsSync(_logFilePath)) {
      try {
        const stat    = fs.statSync(_logFilePath);
        const fileDay = stat.mtime.toISOString().slice(0, 10);
        if (fileDay !== todayStr) {
          const rotated = path.join(logsDir, `opentutor-${fileDay}.log`);
          fs.renameSync(_logFilePath, rotated);
          console.log(`[Logger] Rotated previous log to: ${rotated}`);
        }
      } catch (e) {
        // Rotation failure is non-fatal — just append to existing file
      }
    }

    // ── Open append stream for today ─────────────────────────────
    _logStream = fs.createWriteStream(_logFilePath, { flags: 'a', encoding: 'utf8' });
    _logStream.on('error', (err) => {
      // Revert to terminal-only if the stream breaks
      _logStream = null;
      console.error('[Logger] Log stream error — file logging disabled:', err.message);
    });

    // ── Session separator ─────────────────────────────────────────
    _logStream.write(`\n${'─'.repeat(72)}\n`);
    _logStream.write(`SESSION START  ${new Date().toISOString()}\n`);
    _logStream.write(`${'─'.repeat(72)}\n`);

    // ── Patch console.* ──────────────────────────────────────────
    const _origLog   = console.log.bind(console);
    const _origWarn  = console.warn.bind(console);
    const _origError = console.error.bind(console);

    console.log = (...args) => {
      _origLog(...args);
      _writeLog('INFO', args);
    };
    console.warn = (...args) => {
      _origWarn(...args);
      _writeLog('WARN', args);
    };
    console.error = (...args) => {
      _origError(...args);
      _writeLog('ERROR', args);
    };

    // ── Prune old log files ───────────────────────────────────────
    _pruneOldLogs(logsDir, todayStr);

    console.log(`[Logger] Logging to: ${_logFilePath}`);

  } catch (err) {
    // Logger init failure must never crash the app
    console.error('[Logger] Failed to initialise file logging:', err.message);
  }
}

/**
 * Deletes rotated log files older than LOG_KEEP_DAYS.
 */
function _pruneOldLogs(logsDir, todayStr) {
  try {
    const cutoff = new Date(todayStr);
    cutoff.setDate(cutoff.getDate() - LOG_KEEP_DAYS);

    const files = fs.readdirSync(logsDir);
    for (const file of files) {
      // Only touch rotated files: opentutor-YYYY-MM-DD.log
      const match = file.match(/^opentutor-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!match) continue;
      const fileDate = new Date(match[1]);
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(logsDir, file));
        console.log(`[Logger] Pruned old log: ${file}`);
      }
    }
  } catch (e) {
    // Non-fatal
  }
}

/**
 * Closes the log stream gracefully on app exit.
 * Call this just before app.quit() or in window-all-closed.
 */
function closeLogger() {
  if (_logStream) {
    try {
      _logStream.write(`SESSION END    ${new Date().toISOString()}\n`);
      _logStream.end();
    } catch (_) {}
    _logStream = null;
  }
}

// Initialise logger immediately — DATA_ROOT is already set above.
initLogger();

// ─────────────────────────────────────────────────────────────
// Serial Number / Licence System
//
// Strategy: offline cryptographic validation + machine-ID binding.
//   • Serials are generated offline with a private HMAC key (kept by
//     the developer). The app validates them with the same key, which
//     is embedded here. Because the app is not a security boundary
//     (users can inspect Electron apps), the goal is honest-user
//     licence management, not copy-protection against determined
//     attackers.
//
//   • Each serial encodes:
//       prefix   "OT"       — product identifier
//       version  "30"       — major version (v3.0)
//       segment  XXXX-XXXX  — 8 random hex chars (unique per sale)
//       checksum XXXX       — first 4 chars of HMAC-SHA256(segment, SECRET)
//
//   • On first activation the serial and the machine ID are written to
//     data/config/licence.json.  Subsequent launches re-validate the
//     stored serial without showing the activation window.
//
//   • Machine binding: the stored machine ID is compared against the
//     current machine. A mismatch means the licence was copied to
//     another machine and the user is asked to re-activate.
//
// Serial format (shown to user):  OT30-XXXX-XXXX-XXXX
//   OT30  = product + version
//   XXXX  = segment A  (4 hex chars)
//   XXXX  = segment B  (4 hex chars)
//   XXXX  = checksum   (4 hex chars of HMAC)
//
// To generate a valid serial (run in Node outside the app):
//
//   const crypto = require('crypto');
//   const SECRET = '<same key as below>';
//   const seg    = crypto.randomBytes(4).toString('hex').toUpperCase();
//   const mac    = crypto.createHmac('sha256', SECRET)
//                        .update(seg).digest('hex').slice(0, 4).toUpperCase();
//   console.log(`OT30-${seg.slice(0,4)}-${seg.slice(4,8)}-${mac}`);
//
// ─────────────────────────────────────────────────────────────

const crypto = require('crypto');

// !! Replace this with your own secret before shipping !!
const LICENCE_HMAC_SECRET = 'opentutor-licence-secret-v3';

// Path to the persisted licence file
function getLicenceFilePath() {
  return path.join(DATA_ROOT, 'config', 'licence.json');
}

/**
 * Returns a stable identifier for the current machine.
 * Uses the hostname + platform + a hash of the CPU model as a
 * lightweight machine fingerprint that does not require any native
 * modules.  It is stable across reboots but changes if the user
 * significantly upgrades their hardware.
 */
function getMachineId() {
  const os     = require('os');
  const cpus   = os.cpus();
  const raw    = [
    os.hostname(),
    process.platform,
    process.arch,
    cpus.length,
    cpus[0]?.model || '',
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * Validates the format and HMAC checksum of a serial string.
 *
 * Returns { valid: true } or { valid: false, reason: string }.
 */
function validateSerialFormat(serial) {
  if (typeof serial !== 'string') {
    return { valid: false, reason: 'Serial must be a string.' };
  }

  // Normalise: strip whitespace, uppercase
  const s = serial.trim().toUpperCase();

  // Format check: OT30-XXXX-XXXX-XXXX
  const match = s.match(/^OT30-([0-9A-F]{4})-([0-9A-F]{4})-([0-9A-F]{4})$/);
  if (!match) {
    return {
      valid:  false,
      reason: 'Invalid format. Expected: OT30-XXXX-XXXX-XXXX',
    };
  }

  const [, segA, segB, checksum] = match;
  const segment = segA + segB;                       // 8-char payload

  // HMAC checksum
  const expected = crypto
    .createHmac('sha256', LICENCE_HMAC_SECRET)
    .update(segment)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();

  if (checksum !== expected) {
    return { valid: false, reason: 'Invalid serial number.' };
  }

  return { valid: true, serial: s };
}

/**
 * Reads the persisted licence from disc.
 * Returns the parsed object or null if the file does not exist / is corrupt.
 */
function readLicenceFile() {
  try {
    const filePath = getLicenceFilePath();
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Saves the licence record to disc.
 */
function writeLicenceFile(record) {
  const filePath = getLicenceFilePath();
  // Ensure config dir exists (bootstrap may not have run yet)
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
}

/**
 * Full licence check on startup.
 *
 * Returns:
 *   { status: 'valid',    serial, activatedAt }   — licence OK, proceed
 *   { status: 'invalid',  reason }                — bad serial in file
 *   { status: 'mismatch', reason }                — different machine
 *   { status: 'missing' }                         — no licence on file
 */
function checkLicence() {
  const record    = readLicenceFile();
  const machineId = getMachineId();

  if (!record || !record.serial) {
    return { status: 'missing' };
  }

  // Re-validate the stored serial's checksum
  const formatCheck = validateSerialFormat(record.serial);
  if (!formatCheck.valid) {
    return { status: 'invalid', reason: formatCheck.reason };
  }

  // Machine-binding check
  if (record.machineId && record.machineId !== machineId) {
    return {
      status: 'mismatch',
      reason: 'This licence is activated on a different machine. ' +
              'Please contact support to transfer your licence.',
    };
  }

  return {
    status:      'valid',
    serial:      record.serial,
    activatedAt: record.activatedAt,
  };
}

/**
 * Activates a new serial: validates it then writes the licence file.
 *
 * Returns { success: true, serial } or { success: false, reason }.
 */
function activateLicence(rawSerial) {
  const formatCheck = validateSerialFormat(rawSerial);
  if (!formatCheck.valid) {
    return { success: false, reason: formatCheck.reason };
  }

  const record = {
    serial:      formatCheck.serial,
    machineId:   getMachineId(),
    activatedAt: new Date().toISOString(),
    appVersion:  app.getVersion(),
  };

  try {
    writeLicenceFile(record);
    console.log('[Licence] ✓ Serial activated:', formatCheck.serial);
    return { success: true, serial: formatCheck.serial };
  } catch (err) {
    console.error('[Licence] Failed to write licence file:', err.message);
    return { success: false, reason: 'Could not save licence. Please check file permissions.' };
  }
}

// ─────────────────────────────────────────────────────────────
// Licence activation window
//
// A compact Electron BrowserWindow that renders an inline HTML
// activation form.  No extra file needed — the HTML is generated
// here and loaded via a data: URL so it works even inside an ASAR.
// ─────────────────────────────────────────────────────────────

let licenceWindow = null;

/**
 * Builds the activation window HTML as a string.
 * Kept self-contained so it renders without a server or external files.
 */
function buildLicenceHtml(errorMessage = '') {
  const errorBlock = errorMessage
    ? `<p class="error">${errorMessage}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>OpenTutor — Activate</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1a1a2e;
    color: #e8edf3;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 24px;
    user-select: none;
    -webkit-app-region: drag;
  }
  .card {
    background: #16213e;
    border: 1px solid #2a3550;
    border-radius: 16px;
    padding: 36px 40px;
    width: 100%;
    max-width: 440px;
    -webkit-app-region: no-drag;
  }
  .owl { font-size: 3rem; text-align: center; display: block; margin-bottom: 12px; }
  h1 {
    text-align: center;
    font-size: 1.4rem;
    font-weight: 700;
    color: #f5a623;
    margin-bottom: 4px;
  }
  .subtitle {
    text-align: center;
    font-size: 0.82rem;
    color: #6b7a99;
    margin-bottom: 28px;
  }
  label {
    display: block;
    font-size: 0.78rem;
    color: #b8c5d6;
    margin-bottom: 6px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  input {
    width: 100%;
    background: #1e2a45;
    border: 1px solid #2a3550;
    border-radius: 8px;
    color: #e8edf3;
    font-family: 'Courier New', monospace;
    font-size: 1.05rem;
    letter-spacing: 0.08em;
    padding: 12px 14px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  input:focus {
    border-color: #f5a623;
    box-shadow: 0 0 0 3px rgba(245,166,35,0.15);
  }
  input::placeholder { color: #3a4a6a; text-transform: uppercase; }
  .hint {
    font-size: 0.72rem;
    color: #6b7a99;
    margin-bottom: 20px;
  }
  .error {
    background: rgba(239,68,68,0.12);
    border: 1px solid rgba(239,68,68,0.4);
    border-radius: 8px;
    color: #fc8181;
    font-size: 0.82rem;
    padding: 10px 14px;
    margin-bottom: 16px;
  }
  button {
    width: 100%;
    padding: 13px;
    background: #f5a623;
    border: none;
    border-radius: 10px;
    color: #1a1a2e;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    letter-spacing: 0.02em;
  }
  button:hover  { background: #e8961a; }
  button:active { transform: scale(0.98); }
  .footer {
    margin-top: 20px;
    text-align: center;
    font-size: 0.72rem;
    color: #3a4a6a;
  }
  .footer a {
    color: #6b7a99;
    text-decoration: none;
    cursor: pointer;
  }
  .footer a:hover { color: #f5a623; }
</style>
</head>
<body>
<div class="card">
  <span class="owl">🦉</span>
  <h1>Activate OpenTutor</h1>
  <p class="subtitle">Enter your serial number to unlock the app.</p>

  ${errorBlock}

  <label for="serial">Serial Number</label>
  <input
    id="serial"
    type="text"
    placeholder="OT30-XXXX-XXXX-XXXX"
    maxlength="19"
    autocomplete="off"
    spellcheck="false"
  />
  <p class="hint">Format: OT30-XXXX-XXXX-XXXX — included in your purchase email.</p>

  <button id="activateBtn">Activate</button>

  <div class="footer">
    <a id="quitLink">Quit</a>
    &nbsp;·&nbsp;
    Having trouble? Contact <a href="#">support@opentutor.app</a>
  </div>
</div>

<script>
  // Auto-format input as user types (inserts dashes automatically)
  const input = document.getElementById('serial');
  const btn   = document.getElementById('activateBtn');
  const quit  = document.getElementById('quitLink');

  input.addEventListener('input', () => {
    // Strip all non-hex and non-letters except leading OT prefix
    let raw = input.value.replace(/-/g, '').toUpperCase();
    // Keep only alphanumeric
    raw = raw.replace(/[^A-Z0-9]/g, '');
    // Insert dashes: OT30-XXXX-XXXX-XXXX
    let formatted = '';
    if (raw.length > 0)  formatted  = raw.slice(0, 4);
    if (raw.length > 4)  formatted += '-' + raw.slice(4, 8);
    if (raw.length > 8)  formatted += '-' + raw.slice(8, 12);
    if (raw.length > 12) formatted += '-' + raw.slice(12, 16);
    input.value = formatted;
  });

  btn.addEventListener('click', () => {
    const serial = input.value.trim();
    if (!serial) { input.focus(); return; }
    btn.disabled    = true;
    btn.textContent = 'Activating…';
    window.electronAPI.activateLicence(serial);
  });

  quit.addEventListener('click', () => {
    window.electronAPI.quitApp();
  });

  // Focus the input on load
  window.addEventListener('DOMContentLoaded', () => input.focus());
  input.focus();
<\/script>
</body>
</html>`;
}

/**
 * Opens the licence activation window.
 * If errorMessage is provided, it is shown in red above the input.
 */
function createLicenceWindow(errorMessage = '') {
  if (licenceWindow && !licenceWindow.isDestroyed()) {
    licenceWindow.focus();
    return;
  }

  licenceWindow = new BrowserWindow({
    width:           480,
    height:          420,
    resizable:       false,
    maximizable:     false,
    fullscreenable:  false,
    title:           'OpenTutor — Activate',
    backgroundColor: '#1a1a2e',
    show:            false,
    webPreferences: {
      preload:          path.join(APP_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  // Load the inline HTML via a data URL (works inside ASAR)
  const html    = buildLicenceHtml(errorMessage);
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  licenceWindow.loadURL(dataUrl);

  licenceWindow.once('ready-to-show', () => licenceWindow.show());

  licenceWindow.on('closed', () => { licenceWindow = null; });
}

/**
 * Registers the two IPC handlers needed by the licence window:
 *   licence:activate  — validates and persists the serial
 *   app:quit          — lets the Quit link close the app
 *
 * Safe to call multiple times — handlers are removed before re-adding.
 */
function registerLicenceIpcHandlers() {
  ipcMain.removeHandler('licence:activate');
  ipcMain.removeHandler('app:quit');

  ipcMain.handle('licence:activate', async (_event, serial) => {
    console.log('[Licence] Activation attempt for serial:', serial);
    const result = activateLicence(serial);

    if (result.success) {
      // Close licence window and proceed to launch the main app
      if (licenceWindow && !licenceWindow.isDestroyed()) {
        licenceWindow.close();
      }
      await launchMainApp();
    } else {
      console.warn('[Licence] Activation failed:', result.reason);
      // Rebuild the window with the error message shown
      if (licenceWindow && !licenceWindow.isDestroyed()) {
        licenceWindow.close();
      }
      createLicenceWindow(result.reason);
    }

    return result;
  });

  ipcMain.handle('app:quit', () => {
    closeLogger();
    app.quit();
  });
}

// ─────────────────────────────────────────────────────────────
// Global references
let mainWindow = null;
let ollamaProcess = null;
let ollamaStartTime = null;
let ollamaReady = false;
let ollamaCheckInterval = null;

// ─────────────────────────────────────────────────────────────
// Inference gate
//
// Tracks how many Ollama /api/chat requests are currently in flight.
// stopOllama() drains this counter before killing the process so that
// closing the window mid-inference no longer causes ECONNRESET errors.
//
// agent/index.js increments/decrements via the exported helpers below.
// ─────────────────────────────────────────────────────────────
let activeInferenceCount = 0;

/** Called by registerIpcHandlers before every Ollama request. */
function inferenceStart() {
  activeInferenceCount++;
  // Debug-level only — too noisy for normal use
  // console.log(`[Inference] started — in flight: ${activeInferenceCount}`);
}

/** Called by registerIpcHandlers after every Ollama request (success or error). */
function inferenceEnd() {
  if (activeInferenceCount > 0) activeInferenceCount--;
  // console.log(`[Inference] ended  — in flight: ${activeInferenceCount}`);
}

// ─────────────────────────────────────────────────────────────
// Ollama process management
// ─────────────────────────────────────────────────────────────

// Tracks whether Ollama was started by us (embedded) or was already
// running externally (standalone). This is critical — we must NEVER
// kill or restart an external Ollama the user manages themselves.
let ollamaIsExternal = false;

/**
 * Gets the path to the Ollama executable based on environment
 */
function getOllamaExecutablePath() {
  const platform = process.platform;
  const binaryName = platform === 'win32' ? 'ollama.exe' :
                     platform === 'darwin' ? 'ollama-darwin' : 'ollama-linux';

  const binaryPath = app.isPackaged
    ? path.join(process.resourcesPath, 'ollama', 'runners', binaryName)
    : path.join(OLLAMA_RUNNER_DIR, binaryName);

  return binaryPath;
}

/**
 * Checks if Ollama is already running by attempting to connect to its API.
 * Returns true only when the API responds with valid JSON.
 */
async function isOllamaRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:11434/api/tags', (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            JSON.parse(data);
            resolve(true);
          } catch {
            resolve(false);
          }
        });
      } else {
        // Drain to avoid socket hang
        res.resume();
        resolve(false);
      }
    });

    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/**
 * Waits for Ollama to be ready by polling the API.
 */
async function waitForOllamaReady(maxRetries = 30, retryInterval = 1000) {
  console.log('[Ollama] Waiting for Ollama to become ready...');

  for (let i = 0; i < maxRetries; i++) {
    if (await isOllamaRunning()) {
      console.log(`[Ollama] Ready after ${i + 1} attempt(s)`);
      ollamaReady = true;
      ollamaStartTime = Date.now();
      return true;
    }

    if (i < maxRetries - 1) {
      console.log(`[Ollama] Not ready yet (attempt ${i + 1}/${maxRetries}), retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }

  console.error('[Ollama] Failed to become ready within timeout');
  return false;
}

/**
 * Attaches stdout/stderr/exit listeners to the spawned Ollama process.
 * Kept separate so both the bundled-binary and system-ollama paths reuse it.
 */
function attachOllamaProcessListeners(proc) {
  // Drain stdout — Ollama rarely writes here but the pipe must be consumed
  // or the OS buffer fills and inference stalls (backpressure bug).
  proc.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line && !line.includes('heartbeat')) {
      console.log('[Ollama stdout]:', line);
    }
  });
  proc.stdout.resume(); // ensure drain even if no 'data' listener fires

  // Ollama writes its real logs to stderr
  proc.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      if (line.includes('Listening') || line.includes('ready')) {
        console.log('[Ollama] Ready signal detected on stderr');
      }
      console.log('[Ollama stderr]:', line);
    }
  });
  proc.stderr.resume();

  proc.on('exit', (code, signal) => {
    console.log(`[Ollama] Process exited — code=${code}, signal=${signal}`);
    ollamaProcess = null;
    ollamaReady = false;

    if (mainWindow && !mainWindow.isDestroyed() && app.isPackaged) {
      if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
        dialog.showErrorBox(
          'Ollama Process Error',
          `The Ollama process exited unexpectedly (code ${code}). ` +
          'Some AI features may not work correctly.'
        );
      }
    }
  });

  console.log('[Ollama] Process started, PID:', proc.pid);
}

/**
 * Builds the environment for the spawned Ollama process.
 * Explicitly forwards the variables Ollama needs for GPU and thread
 * detection — without these it may fall back to single-threaded CPU.
 */
function buildOllamaEnv() {
  const os = require('os');

  const modelsDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'models')
    : path.join(DATA_ROOT, 'models');

  // Ensure the models directory exists before Ollama tries to use it
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log('[Ollama] Created models directory:', modelsDir);
  }

  return {
    // Inherit the full parent environment so GPU driver paths survive
    ...process.env,

    // Storage
    OLLAMA_MODELS: modelsDir,

    // Performance — serve one request at a time, use all physical cores
    OLLAMA_NUM_PARALLEL:      '1',
    OLLAMA_MAX_LOADED_MODELS: '1',
    OLLAMA_FLASH_ATTENTION:   '1',
    OLLAMA_NUM_THREADS:       String(os.cpus().length),

    // Context window — 4096 gives headroom for longer prompts without
    // exceeding the RTX 2050's 3.2 GiB available VRAM at this model size.
    // The default of 2048 caused silent hangs when system+user prompts
    // exceeded that limit (Ollama never returns from /api/chat).
    OLLAMA_NUM_CTX:           '4096',

    // Windows-specific: keep system paths intact for GPU drivers
    ...(process.platform === 'win32' ? {
      PATH:       process.env.PATH,
      SystemRoot: process.env.SystemRoot  || 'C:\\Windows',
      SYSTEMROOT: process.env.SYSTEMROOT  || 'C:\\Windows',
    } : {}),
  };
}

/**
 * Main entry point for Ollama startup.
 *
 * Decision tree:
 *   1. If a standalone Ollama is already running → use it, set ollamaIsExternal = true.
 *   2. If the bundled executable exists          → spawn it.
 *   3. If in dev mode and no binary found        → try system `ollama` in PATH.
 *   4. Otherwise                                 → fail gracefully.
 *
 * In cases 1, the process is NEVER killed or restarted by OpenTutor.
 */
async function startOllama() {
  console.log('[Ollama] Checking if a standalone Ollama is already running...');

  if (await isOllamaRunning()) {
    console.log('[Ollama] Standalone Ollama detected — OpenTutor will use it as-is.');
    ollamaIsExternal = true;
    ollamaReady      = true;
    ollamaStartTime  = Date.now();
    // Do NOT touch ollamaProcess — leave it null so stopOllama() is a no-op
    return true;
  }

  // No existing Ollama — we need to start one
  ollamaIsExternal = false;

  const ollamaPath = getOllamaExecutablePath();
  console.log('[Ollama] No standalone instance found. Looking for bundled binary at:', ollamaPath);

  if (fs.existsSync(ollamaPath)) {
    // ── Bundled binary path ──────────────────────────────────────
    if (process.platform !== 'win32') {
      try { fs.chmodSync(ollamaPath, '755'); } catch (e) {
        console.warn('[Ollama] Could not chmod binary:', e.message);
      }
    }

    console.log('[Ollama] Starting bundled Ollama...');
    try {
      ollamaProcess = spawn(ollamaPath, ['serve'], {
        stdio:    ['ignore', 'pipe', 'pipe'],
        detached: false,
        env:      buildOllamaEnv(),
      });
      attachOllamaProcessListeners(ollamaProcess);
    } catch (err) {
      console.error('[Ollama] Failed to spawn bundled Ollama:', err);
      return false;
    }

  } else if (!app.isPackaged) {
    // ── Dev fallback: system ollama in PATH ──────────────────────
    console.warn('[Ollama] Bundled binary not found. Dev mode — trying system `ollama`...');
    try {
      ollamaProcess = spawn('ollama', ['serve'], {
        stdio:    ['ignore', 'pipe', 'pipe'],
        detached: false,
        env:      buildOllamaEnv(),
      });
      attachOllamaProcessListeners(ollamaProcess);
    } catch (err) {
      console.error('[Ollama] Failed to start system Ollama:', err);
      return false;
    }

  } else {
    // ── Packaged app, no binary — give up ───────────────────────
    console.error('[Ollama] No Ollama binary available in packaged app.');
    return false;
  }

  return await waitForOllamaReady();
}

/**
 * Stops the embedded Ollama process — only if OpenTutor started it.
 * If Ollama was external (standalone), this is a deliberate no-op.
 *
 * Drain policy: waits up to INFERENCE_DRAIN_TIMEOUT_MS for any in-flight
 * /api/chat requests to complete before sending the kill signal.
 * This prevents ECONNRESET errors when the user closes the window
 * while a slow inference is still running.
 */
async function stopOllama() {
  if (ollamaIsExternal) {
    console.log('[Ollama] External instance — leaving it running.');
    return;
  }

  if (!ollamaProcess || ollamaProcess.killed) return;

  // ── Drain in-flight inferences ────────────────────────────────
  const INFERENCE_DRAIN_TIMEOUT_MS = 30_000;  // max 30 s wait
  const INFERENCE_DRAIN_POLL_MS    =    500;  // check every 500 ms
  let drained = 0;

  if (activeInferenceCount > 0) {
    console.log(
      `[Ollama] Waiting for ${activeInferenceCount} in-flight inference(s) ` +
      `to finish before shutdown (max ${INFERENCE_DRAIN_TIMEOUT_MS / 1000}s)...`
    );
    while (activeInferenceCount > 0 && drained < INFERENCE_DRAIN_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, INFERENCE_DRAIN_POLL_MS));
      drained += INFERENCE_DRAIN_POLL_MS;
    }
    if (activeInferenceCount > 0) {
      console.warn(
        `[Ollama] Drain timeout after ${drained / 1000}s — ` +
        `${activeInferenceCount} request(s) still in flight. Force-stopping.`
      );
    } else {
      console.log(`[Ollama] All inferences finished after ${drained / 1000}s. Stopping.`);
    }
  }

  console.log('[Ollama] Stopping embedded Ollama process...');

  return new Promise((resolve) => {
    const forceKillTimer = setTimeout(() => {
      if (ollamaProcess && !ollamaProcess.killed) {
        console.warn('[Ollama] Graceful shutdown timed out — force killing.');
        ollamaProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    ollamaProcess.once('exit', () => {
      clearTimeout(forceKillTimer);
      console.log('[Ollama] Process stopped.');
      ollamaProcess = null;
      ollamaReady   = false;
      resolve();
    });

    if (process.platform === 'win32') {
      const { exec } = require('child_process');
      exec(`taskkill /pid ${ollamaProcess.pid} /T /F`, (err) => {
        if (err) {
          console.error('[Ollama] taskkill failed, falling back to SIGKILL:', err.message);
          ollamaProcess.kill('SIGKILL');
        }
      });
    } else {
      ollamaProcess.kill('SIGTERM');
    }
  });
}

/**
 * Periodic health check.
 *
 * For EXTERNAL instances: only monitors readiness, never restarts.
 * For EMBEDDED instances: attempts one restart if the process dies.
 *
 * Interval is 120 s (not 30 s) to avoid hammering Ollama mid-inference.
 */
function startOllamaHealthCheck() {
  if (ollamaCheckInterval) clearInterval(ollamaCheckInterval);

  ollamaCheckInterval = setInterval(async () => {
    const running = await isOllamaRunning();

    if (!running && ollamaReady) {
      console.warn('[Ollama] Health check: Ollama is no longer responding.');
      ollamaReady = false;

      if (ollamaIsExternal) {
        // The user's standalone Ollama went away — just report it, don't interfere
        console.warn('[Ollama] External instance stopped. AI features unavailable until it restarts.');
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        // Our embedded process died — attempt one restart
        console.log('[Ollama] Attempting to restart embedded Ollama...');
        await stopOllama();
        await new Promise(r => setTimeout(r, 2000));
        await startOllama();
      }

    } else if (running && !ollamaReady) {
      console.log('[Ollama] Health check: Ollama is responding again.');
      ollamaReady = true;
    }

  }, 120_000); // Every 2 minutes — safe gap between long inferences
}

// ─────────────────────────────────────────────────────────────
// First-run data directory bootstrap
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
      theme:       null,
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
    registerIpcHandlers(ipcMain, coordinator, { memory, model, skillManager, inferenceStart, inferenceEnd });

    // ── config:save ───────────────────────────────────────────
    // FIXED: Properly merge theme data with existing config
    ipcMain.handle('config:save', async (_event, { config }) => {
      try {
        // Get existing config first
        const existingConfig = model.getConfigForDisplay() || {};

        // Merge the new config with existing (preserving other settings)
        const mergedConfig = {
          ...existingConfig,
          ...config,
          // Ensure nested objects are merged properly
          theme: config.theme ? {
            ...(existingConfig.theme || {}),
            ...config.theme
          } : existingConfig.theme,
        };

        model.saveConfig(mergedConfig);

        console.log('[IPC config:save] ✓ Theme saved:', {
          presetId: config.theme?.presetId,
          hasVars: !!config.theme?.vars
        });

        return { success: true };
      } catch (err) {
        console.error('[IPC config:save] ✗ Error:', err.message);
        return { success: false, error: err.message };
      }
    });

    // ollama:status handler to check Ollama status from renderer
    ipcMain.handle('ollama:status', async () => {
      return {
        running: ollamaReady,
        pid: ollamaProcess ? ollamaProcess.pid : null,
        uptime: ollamaStartTime ? Date.now() - ollamaStartTime : null
      };
    });

    // ollama:models handler to list available models
    ipcMain.handle('ollama:models', async () => {
      if (!ollamaReady) {
        return { success: false, error: 'Ollama not ready', models: [] };
      }

      return new Promise((resolve) => {
        http.get('http://127.0.0.1:11434/api/tags', (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve({ success: true, models: result.models || [] });
            } catch (err) {
              resolve({ success: false, error: err.message, models: [] });
            }
          });
        }).on('error', (err) => {
          resolve({ success: false, error: err.message, models: [] });
        });
      });
    });

    // ollama:pull handler to pull a model
    ipcMain.handle('ollama:pull', async (_event, { modelName }) => {
      if (!ollamaReady) {
        return { success: false, error: 'Ollama not ready' };
      }

      // This is a simplified handler - in production you'd want streaming progress
      return new Promise((resolve) => {
        const req = http.request('http://127.0.0.1:11434/api/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve({ success: true, result });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          });
        });

        req.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });

        req.write(JSON.stringify({ name: modelName }));
        req.end();
      });
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
          // Support both marked v4+ (object arg) and older versions (positional args)
          const codeRenderer = new marked.Renderer();
          codeRenderer.code = function(textOrObj, lang) {
            const text = (typeof textOrObj === 'object' && textOrObj !== null)
              ? (textOrObj.text || '') : (textOrObj || '');
            const language = (typeof textOrObj === 'object' && textOrObj !== null)
              ? (textOrObj.lang || '') : (lang || '');
            const l = language.trim().toLowerCase();
            if (l === 'mermaid' || l === 'flowchart') {
              const i = mermaidStash.length;
              mermaidStash.push(text.trim());
              return 'OTMERM' + i + 'END';
            }
            const esc   = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const label = language ? '<span class="code-lang">' + language + '</span>' : '';
            return '<div class="code-wrap">' + label + '<pre><code>' + esc + '</code></pre></div>';
          };
          marked.setOptions({ renderer: codeRenderer, breaks: true, gfm: true });
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
            'mjx-container{overflow-x:auto;max-width:100%}',
            'mjx-container[display="true"]{display:block;text-align:center;background:#f8fafc;border:1px solid #e8ecf2;border-radius:6px;padding:14px;margin:1.2em 0;overflow-x:auto}',
            'hr{border:none;border-top:1px solid #e8ecf2;margin:2em 0}',
            '.meta{font-size:.78rem;color:#999;margin-bottom:32px;padding-bottom:12px;border-bottom:1px solid #eee}',
            '.meta strong{color:#e8a020}'
          ].join('\n');

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
            '<script>' + mjCfg + '</script>',
            '<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>',
            '<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>',
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
            '</script>',
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

    // ── tools:render-markdown ───────────────────────────────────────────────
    // Receives raw markdown text from the renderer, converts it to HTML using
    // the same marked + math-stash pipeline as export:response, returns HTML.
    ipcMain.handle('tools:render-markdown', async (_event, { markdown }) => {
      try {
        const { marked } = require('marked');

        // Stash math + mermaid before marked parses them
        const mathStash    = [];
        const mermaidStash = [];
        let src = markdown || '';

        src = src.replace(/```(?:mermaid|flowchart)[ \t]*\r?\n([\s\S]*?)```/g, (_, c) => {
          const i = mermaidStash.length; mermaidStash.push(c.trim()); return 'OTMERM' + i + 'END';
        });
        src = src.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
          const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
        });
        src = src.replace(/\\\[([\s\S]+?)\\\]/g, (m) => {
          const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
        });
        src = src.replace(/\\\((.+?)\\\)/g, (m) => {
          const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
        });
        src = src.replace(/(?<!\$)\$(?!\$)([^\n$`]+?)(?<!\$)\$(?!\$)/g, (m, inner) => {
          if (/[\\^_{}\[\]]/.test(inner) || /[a-zA-Z]{2,}/.test(inner)) {
            const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
          }
          return m;
        });

        // Parse markdown
        // Support both marked v4+ (object arg) and older versions (positional args)
        const renderer = new marked.Renderer();
        renderer.code = function(textOrObj, lang) {
          // marked v4+ passes an object; older versions pass (text, lang)
          const text = (typeof textOrObj === 'object' && textOrObj !== null)
            ? (textOrObj.text || '')
            : (textOrObj || '');
          const language = (typeof textOrObj === 'object' && textOrObj !== null)
            ? (textOrObj.lang || '')
            : (lang || '');
          const l = language.trim().toLowerCase();
          if (l === 'mermaid' || l === 'flowchart') {
            const i = mermaidStash.length; mermaidStash.push(text.trim());
            return 'OTMERM' + i + 'END';
          }
          const esc   = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const label = language ? '<span class="ot-code-lang">' + language + '</span>' : '';
          return '<div class="ot-cw">' + label + '<pre><code>' + esc + '</code></pre></div>';
        };
        marked.setOptions({ renderer, breaks: true, gfm: true });
        let html = marked.parse(src);

        // Restore math
        mathStash.forEach((orig, i) => {
          html = html.split('OTMATH' + i + 'END').join(orig);
        });

        // Restore mermaid as a styled div
        mermaidStash.forEach((code, i) => {
          const esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const div = '<div class="ot-mermaid-wrap"><div class="ot-mermaid">' + esc + '</div></div>';
          html = html.split('<p>OTMERM' + i + 'END</p>').join(div);
          html = html.split('OTMERM' + i + 'END').join(div);
        });

        return { success: true, html };
      } catch (err) {
        console.error('[IPC tools:render-markdown]', err.message);
        return { success: false, error: err.message };
      }
    });

    // ── tools:read-file ─────────────────────────────────────────────────────
    // Opens a file picker, reads the selected file and returns its text content
    // to the renderer for in-app display (used by the Markdown Viewer).
    ipcMain.handle('tools:read-file', async (_event, { extensions = ['md', 'markdown'] } = {}) => {
      try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          title:       'Open file',
          buttonLabel: 'Open',
          filters:     [{ name: 'Markdown', extensions }],
          properties:  ['openFile'],
        });

        if (canceled || !filePaths.length) {
          return { success: false, canceled: true };
        }

        const filePath = filePaths[0];
        const content  = fs.readFileSync(filePath, 'utf8');

        return {
          success:  true,
          filePath,
          filename: path.basename(filePath),
          content,
        };
      } catch (err) {
        console.error('[IPC tools:read-file]', err.message);
        return { success: false, error: err.message };
      }
    });

    // ── tools:pdf-to-md ─────────────────────────────────────────────────────
    // Opens a file picker for a .pdf, extracts text with pdf-parse, formats
    // it as clean Markdown, then saves the .md next to the source file.
    ipcMain.handle('tools:pdf-to-md', async (_event) => {
      try {
        // Step 1: Pick source PDF
        const { canceled, filePaths } = await dialog.showOpenDialog({
          title:       'Select PDF file',
          buttonLabel: 'Convert to Markdown',
          filters:     [{ name: 'PDF Files', extensions: ['pdf'] }],
          properties:  ['openFile'],
        });

        if (canceled || !filePaths.length) {
          return { success: false, canceled: true };
        }

        const srcPath   = filePaths[0];
        const pdfBuffer = fs.readFileSync(srcPath);

        // Step 2: Extract text via pdf-parse
        let pdfData;
        try {
          const pdfParse = require('pdf-parse');
          pdfData = await pdfParse(pdfBuffer);
        } catch (e) {
          return { success: false, error: 'pdf-parse is not installed. Run: npm install pdf-parse' };
        }

        const rawText  = pdfData.text || '';
        const numPages = pdfData.numpages || 1;
        const info     = pdfData.info   || {};
        const title    = info.Title || path.basename(srcPath, '.pdf');
        const author   = info.Author || '';
        const created  = info.CreationDate || '';

        // Step 3: Clean and structure the extracted text as Markdown
        const lines = rawText.split(/\r?\n/);
        const mdLines = [];

        // Front-matter block
        mdLines.push('# ' + title);
        mdLines.push('');
        if (author) mdLines.push('**Author:** ' + author);
        mdLines.push('**Pages:** ' + numPages);
        mdLines.push('**Converted:** ' + new Date().toLocaleString());
        mdLines.push('');
        mdLines.push('---');
        mdLines.push('');

        // Process lines
        let blankCount = 0;
        for (let i = 0; i < lines.length; i++) {
          const raw  = lines[i];
          const line = raw.trim();

          // Skip empty lines but collapse multiple blanks into one
          if (!line) {
            blankCount++;
            if (blankCount <= 1) mdLines.push('');
            continue;
          }
          blankCount = 0;

          // Heuristic heading detection:
          // Short line (≤80 chars), ALL CAPS or Title Case, no trailing period
          // and preceded/followed by blank lines → treat as heading
          const prevBlank = i === 0 || !lines[i - 1]?.trim();
          const nextBlank = i >= lines.length - 1 || !lines[i + 1]?.trim();
          const isShort   = line.length <= 80;
          const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
          const noTrailingDot = !line.endsWith('.');

          if (prevBlank && nextBlank && isShort && noTrailingDot && line.length > 2) {
            if (isAllCaps && line.length <= 40) {
              mdLines.push('## ' + line.charAt(0) + line.slice(1).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
            } else if (/^[A-Z][^a-z]{0,3}[A-Z]/.test(line) && line.length <= 60) {
              mdLines.push('### ' + line);
            } else {
              mdLines.push(line);
            }
          } else {
            // Bullet detection: lines starting with •, -, *, ▪, ◦, →
            const bulletMatch = line.match(/^[•\-\*▪◦→➤►]\s+(.+)/);
            if (bulletMatch) {
              mdLines.push('- ' + bulletMatch[1]);
            } else {
              mdLines.push(line);
            }
          }
        }

        const mdContent = mdLines.join('\n')
          // Collapse 3+ blank lines to 2
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        // Step 4: Save .md next to the source .pdf
        const destPath = srcPath.replace(/\.pdf$/i, '.md');
        fs.writeFileSync(destPath, mdContent, 'utf8');

        return {
          success:  true,
          srcPath,
          destPath,
          filename: path.basename(destPath),
          numPages,
          title,
        };
      } catch (err) {
        console.error('[IPC tools:pdf-to-md]', err.message);
        return { success: false, error: err.message };
      }
    });

    // ── tools:md-to-html ────────────────────────────────────────────────────
    // Opens a file picker for a .md file, converts it to HTML with MathJax
    // and Mermaid support, then saves the .html next to the source file.
    ipcMain.handle('tools:md-to-html', async (_event) => {
      try {
        // Step 1: Pick the source .md file
        const { canceled, filePaths } = await dialog.showOpenDialog({
          title:       'Select Markdown file',
          buttonLabel: 'Convert',
          filters:     [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
          properties:  ['openFile'],
        });

        if (canceled || !filePaths.length) {
          return { success: false, canceled: true };
        }

        const srcPath = filePaths[0];
        const mdContent = fs.readFileSync(srcPath, 'utf8');

        // Step 2: Convert MD → HTML (reuse the same pipeline as export:response)
        const { marked } = require('marked');
        const exportDate  = new Date().toLocaleString();

        // Stash math + mermaid before marked touches them
        const mathStash    = [];
        const mermaidStash = [];
        let src = mdContent;

        src = src.replace(/```(?:mermaid|flowchart)[ \t]*\r?\n([\s\S]*?)```/g, (_, c) => {
          const i = mermaidStash.length;
          mermaidStash.push(c.trim());
          return 'OTMERM' + i + 'END';
        });
        src = src.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
          const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
        });
        src = src.replace(/\\\[([\s\S]+?)\\\]/g, (m) => {
          const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
        });
        src = src.replace(/\\\((.+?)\\\)/g, (m) => {
          const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
        });
        src = src.replace(/(?<!\$)\$(?!\$)([^\n$`]+?)(?<!\$)\$(?!\$)/g, (m, inner) => {
          if (/[\\^_{}\[\]]/.test(inner) || /[a-zA-Z]{2,}/.test(inner)) {
            const i = mathStash.length; mathStash.push(m); return 'OTMATH' + i + 'END';
          }
          return m;
        });

        // Support both marked v4+ (object arg) and older versions (positional args)
        const codeRenderer = new marked.Renderer();
        codeRenderer.code = function(textOrObj, lang) {
          const text = (typeof textOrObj === 'object' && textOrObj !== null)
            ? (textOrObj.text || '') : (textOrObj || '');
          const language = (typeof textOrObj === 'object' && textOrObj !== null)
            ? (textOrObj.lang || '') : (lang || '');
          const l = language.trim().toLowerCase();
          if (l === 'mermaid' || l === 'flowchart') {
            const i = mermaidStash.length;
            mermaidStash.push(text.trim());
            return 'OTMERM' + i + 'END';
          }
          const esc   = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const label = language ? '<span class="code-lang">' + language + '</span>' : '';
          return '<div class="code-wrap">' + label + '<pre><code>' + esc + '</code></pre></div>';
        };
        marked.setOptions({ renderer: codeRenderer, breaks: true, gfm: true });
        let bodyHtml = marked.parse(src);

        mathStash.forEach((orig, i) => {
          bodyHtml = bodyHtml.split('OTMATH' + i + 'END').join(orig);
        });
        mermaidStash.forEach((code, i) => {
          const esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const div = '<div class="mermaid-wrap"><div class="mermaid">' + esc + '</div></div>';
          bodyHtml = bodyHtml.split('<p>OTMERM' + i + 'END</p>').join(div);
          bodyHtml = bodyHtml.split('OTMERM' + i + 'END').join(div);
        });

        // Derive title from first H1 or filename
        const h1Match  = mdContent.match(/^#\s+(.+)/m);
        const docTitle = h1Match ? h1Match[1].trim() : path.basename(srcPath, path.extname(srcPath));

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
          'mjx-container{overflow-x:auto;max-width:100%}',
          'mjx-container[display="true"]{display:block;text-align:center;background:#f8fafc;border:1px solid #e8ecf2;border-radius:6px;padding:14px;margin:1.2em 0;overflow-x:auto}',
          'hr{border:none;border-top:1px solid #e8ecf2;margin:2em 0}',
          '.meta{font-size:.78rem;color:#999;margin-bottom:32px;padding-bottom:12px;border-bottom:1px solid #eee}',
          '.meta strong{color:#e8a020}'
        ].join('\n');

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
          '<title>' + docTitle + '</title>',
          '<style>' + css + '</style>',
          '<script>' + mjCfg + '</script>',
          '<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>',
          '<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>',
          '</head>',
          '<body>',
          '<p class="meta">Converted from <strong>' + path.basename(srcPath) + '</strong> &nbsp;&middot;&nbsp; ' + exportDate + '</p>',
          bodyHtml,
          '<script>',
          'if(window.mermaid){',
          '  mermaid.initialize({startOnLoad:false,theme:"default",securityLevel:"loose"});',
          '  document.addEventListener("DOMContentLoaded",function(){mermaid.run({querySelector:".mermaid"});});',
          '  if(document.readyState!=="loading"){mermaid.run({querySelector:".mermaid"});}',
          '}',
          '</script>',
          '</body>',
          '</html>'
        ];

        // Step 3: Save .html next to the source .md file
        const destPath = srcPath.replace(/\.(?:md|markdown)$/i, '.html');
        fs.writeFileSync(destPath, rows.join('\n'), 'utf8');

        return { success: true, srcPath, destPath, filename: path.basename(destPath) };
      } catch (err) {
        console.error('[IPC tools:md-to-html]', err.message);
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

// ─────────────────────────────────────────────────────────────
// Main app launch sequence
//
// Extracted into its own async function so it can be called either
// directly from app.whenReady() (when a valid licence is found) or
// from the licence:activate IPC handler (after successful activation).
// ─────────────────────────────────────────────────────────────

async function launchMainApp() {
  console.log('[App] Launching main application...');

  // Step 1: Bootstrap the data directory (no-op on established installs)
  try {
    bootstrapDataDirectory();
  } catch (err) {
    // Non-fatal — individual modules handle missing files gracefully.
    console.error('[Bootstrap] Data directory setup failed:', err.message);
  }

  // Step 2: Start embedded Ollama process
  console.log('[App] Starting embedded Ollama...');
  try {
    const ollamaStarted = await startOllama();
    if (ollamaStarted) {
      console.log('[App] ✓ Ollama started successfully');
      startOllamaHealthCheck();
    } else {
      console.warn('[App] ⚠ Ollama could not be started. App will continue but AI features may not work.');
      if (app.isPackaged) {
        dialog.showMessageBox({
          type:    'warning',
          title:   'OpenTutor — Ollama Not Available',
          message: 'The Ollama AI service could not be started.',
          detail:  'AI tutoring features will be unavailable. Please ensure Ollama is installed or restart the application.',
          buttons: ['Continue'],
        });
      }
    }
  } catch (err) {
    console.error('[App] Failed to start Ollama:', err);
    // Non-fatal — continue without AI
  }

  // Step 3: Initialise all backend modules
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
        '  • A file is missing from src/main/',
        '  • A skill plugin has a syntax error',
        '',
        'Please fix the issue and restart the application.',
      ].join('\n')
    );

    await stopOllama();
    if (ollamaCheckInterval) clearInterval(ollamaCheckInterval);
    closeLogger();
    app.quit();
    return;
  }

  // Step 4: Create and show the main window
  mainWindow = createWindow();

  // macOS: re-create the window when the dock icon is clicked and all
  // windows have been closed.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
}

// ─────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log(`[App] Electron ready — OpenTutor v${app.getVersion()}`);

  // Always register the licence IPC handlers first so the activation
  // window can communicate with the main process.
  registerLicenceIpcHandlers();

  // ── Licence check ────────────────────────────────────────────
  const licenceStatus = checkLicence();
  console.log('[Licence] Status:', licenceStatus.status);

  if (licenceStatus.status === 'valid') {
    // Happy path — proceed straight to the main app
    console.log('[Licence] ✓ Valid licence found:', licenceStatus.serial);
    await launchMainApp();

  } else if (licenceStatus.status === 'missing') {
    // First run or licence file was deleted — show activation window
    console.log('[Licence] No licence found — showing activation window.');
    createLicenceWindow();

  } else if (licenceStatus.status === 'mismatch') {
    // Licence was activated on a different machine
    console.warn('[Licence] Machine mismatch — showing activation window.');
    createLicenceWindow(licenceStatus.reason);

  } else {
    // Corrupt / tampered licence file
    console.warn('[Licence] Invalid licence on file — showing activation window.');
    createLicenceWindow(licenceStatus.reason || 'Your licence file is invalid. Please re-enter your serial number.');
  }
});

// Windows / Linux: quit when all windows are closed.
// macOS keeps the process running in the dock until the user explicitly quits.
app.on('window-all-closed', async () => {
  console.log('[App] All windows closed, cleaning up...');

  // Stop Ollama process
  await stopOllama();

  if (ollamaCheckInterval) {
    clearInterval(ollamaCheckInterval);
    ollamaCheckInterval = null;
  }

  closeLogger();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─────────────────────────────────────────────────────────────
// preload.js requirements
//
// The licence activation window calls two methods via contextBridge.
// Make sure preload.js exposes these alongside the existing channels:
//
//   contextBridge.exposeInMainWorld('electronAPI', {
//     // ... existing channels ...
//
//     // Licence activation (used by the activation window)
//     activateLicence: (serial) => ipcRenderer.invoke('licence:activate', serial),
//     quitApp:         ()       => ipcRenderer.invoke('app:quit'),
//   });
//
// ─────────────────────────────────────────────────────────────

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