// MessageComponents.js
// MODIFIED: Added teacher mode message bubble styles
// MODIFIED: Added generation source badges for dynamically generated content
// MODIFIED: Added teacher proactive message component with response area
// MODIFIED: Added test mode message components
// MODIFIED: Added AnswerInput import for test questions
// All components responsible for rendering a single message and its metadata:
//   SkillBadge      — shows which skill handled the response
//   SyllabusTag     — shows the NESA syllabus dot-point code
//   GenerationSourceBadge — shows source of dynamically generated content
//   FollowUpPills   — clickable follow-up question suggestions
//   TypingIndicator — animated dots shown while the model is thinking
//   MessageBubble   — full message bubble (user or assistant), composes all the above
//   TeacherBubble   — teacher mode special bubble
//   TeacherProactiveMessage — teacher proactive message with response area
//   TestQuestionMessage — test mode question message
//   TestResultMessage — test results and diagnosis message
//   TestRemediationMessage — remediation message with mode switch info

import React, { useState, useEffect } from 'react';
import RichMathText, { DisplayFormula } from './FormulaRenderer';
import { CopyButton, TTSButton, ExportButton } from './ActionButtons';
import { topicColour, formatTime } from './chatUtils';
import AnswerInput from './test/AnswerInput'; // ADD THIS IMPORT
import ipc from '../ipc';

// ── Code extraction helpers ──────────────────────────────────

// Maps common language identifiers to file extensions
const LANG_EXT = {
  javascript: 'js',  js: 'js',     typescript: 'ts',  ts: 'ts',
  jsx: 'jsx',        tsx: 'tsx',   python: 'py',      py: 'py',
  java: 'java',      csharp: 'cs', cs: 'cs',          cpp: 'cpp',
  c: 'c',            go: 'go',     rust: 'rs',         ruby: 'rb',
  rb: 'rb',          php: 'php',   swift: 'swift',     kotlin: 'kt',
  html: 'html',      css: 'css',   scss: 'scss',       json: 'json',
  yaml: 'yaml',      yml: 'yml',   xml: 'xml',         sql: 'sql',
  bash: 'sh',        sh: 'sh',     shell: 'sh',        powershell: 'ps1',
  r: 'r',            matlab: 'm',  latex: 'tex',       markdown: 'md',
  md: 'md',          text: 'txt',  txt: 'txt',
};

/**
 * Parse all fenced code blocks from a markdown string.
 * Returns [{ language, code, filename }] — one entry per block.
 */
function extractCodeBlocks(markdown) {
  if (!markdown) return [];
  const results = [];
  // Match ```lang\ncode\n``` blocks (lang is optional)
  const fenceRe = /^[ \t]*```([^\n]*)\n([\s\S]*?)^[ \t]*```/gm;
  let match;
  const langCounts = {};

  while ((match = fenceRe.exec(markdown)) !== null) {
    const rawLang = (match[1] || '').trim().toLowerCase().split(/\s+/)[0];
    const code    = match[2];

    if (!code.trim()) continue; // skip empty blocks

    const ext  = LANG_EXT[rawLang] || (rawLang || 'txt');
    const lang = rawLang || 'code';

    langCounts[lang] = (langCounts[lang] || 0) + 1;
    const idx      = langCounts[lang];
    const filename = langCounts[lang] === 1 && !langCounts[lang + '_seen']
      ? `snippet.${ext}`
      : `snippet_${lang}_${idx}.${ext}`;
    langCounts[lang + '_seen'] = true;

    results.push({ language: lang, code, filename });
  }

  // Re-number filenames now we know the totals
  const byLang = {};
  return results.map(item => {
    byLang[item.language] = (byLang[item.language] || 0) + 1;
    const total = results.filter(r => r.language === item.language).length;
    const ext   = LANG_EXT[item.language] || item.language || 'txt';
    const filename = total === 1
      ? `snippet.${ext}`
      : `snippet_${item.language}_${byLang[item.language]}.${ext}`;
    return { ...item, filename };
  });
}

/**
 * CodeSnippetDialog — modal that previews all code snippets as tabs.
 * User can review each snippet then Save (folder picker) or Cancel.
 */
function CodeSnippetDialog({ blocks, onSave, onClose }) {
  const [activeTab, setActiveTab]   = useState(0);
  const [saving,    setSaving]      = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saved' | 'error'

  // Language → accent colour for tab indicator
  const langColor = (lang) => {
    const map = {
      javascript: '#f7df1e', js: '#f7df1e', typescript: '#3178c6', ts: '#3178c6',
      python: '#3572A5',     py: '#3572A5', java: '#b07219',
      cpp: '#f34b7d',        c: '#555555',  go: '#00ADD8',
      rust: '#dea584',       html: '#e34c26', css: '#563d7c',
      json: '#292929',       sql: '#e38c00', bash: '#89e051',
      sh: '#89e051',         jsx: '#61dafb', tsx: '#3178c6',
    };
    return map[lang] || 'var(--accent)';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await onSave(blocks);
      if (result?.success) {
        setSaveStatus('saved');
        setTimeout(() => onClose(), 1400);
      } else if (result?.canceled) {
        setSaving(false);
      } else {
        setSaveStatus('error');
        setSaving(false);
      }
    } catch {
      setSaveStatus('error');
      setSaving(false);
    }
  };

  const snippet = blocks[activeTab];

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position:   'fixed',
        inset:      0,
        background: 'rgba(0,0,0,0.55)',
        zIndex:     9000,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:    '24px',
        animation:  'fadeIn 0.15s ease',
      }}
    >
      {/* Dialog panel — stop click from closing */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:        '720px',
          maxWidth:     '100%',
          maxHeight:    '80vh',
          display:      'flex',
          flexDirection: 'column',
          background:   'var(--bg-base)',
          border:       '1px solid var(--border-bright)',
          borderRadius: '14px',
          boxShadow:    '0 24px 64px rgba(0,0,0,0.45)',
          overflow:     'hidden',
          animation:    'slideUp 0.2s ease',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          padding:      '14px 18px',
          borderBottom: '1px solid var(--border)',
          flexShrink:   0,
        }}>
          <span style={{ fontSize: '1rem' }}>📦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Code Snippets
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              {blocks.length} snippet{blocks.length !== 1 ? 's' : ''} found — review before saving
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', fontSize: '1.1rem',
              cursor: 'pointer', padding: '2px 6px', borderRadius: '6px',
              lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* ── Tab bar ── */}
        <div style={{
          display:    'flex',
          gap:        '2px',
          padding:    '8px 18px 0',
          borderBottom: '1px solid var(--border)',
          overflowX:  'auto',
          flexShrink: 0,
          background: 'var(--bg-deep)',
        }}>
          {blocks.map((b, i) => {
            const isActive = i === activeTab;
            const dot = langColor(b.language);
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  gap:          '6px',
                  padding:      '6px 14px',
                  border:       'none',
                  borderRadius: '8px 8px 0 0',
                  background:   isActive ? 'var(--bg-base)' : 'transparent',
                  color:        isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize:     '0.78rem',
                  fontWeight:   isActive ? 600 : 400,
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  transition:   'all 0.12s ease',
                  flexShrink:   0,
                }}
              >
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: dot, flexShrink: 0, display: 'inline-block',
                }} />
                {b.filename}
              </button>
            );
          })}
        </div>

        {/* ── Code viewer ── */}
        <div style={{
          flex:       1,
          overflowY:  'auto',
          overflowX:  'auto',
          background: 'var(--bg-deep)',
          padding:    '16px 18px',
          minHeight:  0,
        }}>
          {/* Language badge */}
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize:     '0.7rem',
              fontWeight:   600,
              padding:      '2px 10px',
              borderRadius: '999px',
              background:   `${langColor(snippet.language)}22`,
              color:        langColor(snippet.language),
              border:       `1px solid ${langColor(snippet.language)}55`,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {snippet.language}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {snippet.code.split('\n').length} lines
            </span>
          </div>

          {/* Code block */}
          <pre style={{
            margin:     0,
            padding:    '14px 16px',
            background: 'var(--bg-surface)',
            border:     '1px solid var(--border)',
            borderRadius: '8px',
            fontSize:   '0.82rem',
            lineHeight: 1.65,
            color:      'var(--text-primary)',
            fontFamily: 'var(--font-mono, "Consolas", "Monaco", monospace)',
            overflowX:  'auto',
            whiteSpace: 'pre',
            tabSize:    2,
          }}>
            <code>{snippet.code}</code>
          </pre>
        </div>

        {/* ── Footer: editable filename + Save / Cancel ── */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          padding:      '12px 18px',
          borderTop:    '1px solid var(--border)',
          background:   'var(--bg-elevated)',
          flexShrink:   0,
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Save as:
          </span>
          <input
            type="text"
            value={blocks[activeTab].filename}
            onChange={e => {
              // Allow inline rename before saving
              blocks[activeTab].filename = e.target.value;
              // Force re-render via a local state trick
              setActiveTab(t => t);
            }}
            style={{
              flex:         1,
              padding:      '5px 10px',
              background:   'var(--bg-base)',
              border:       '1px solid var(--border)',
              borderRadius: '6px',
              color:        'var(--text-primary)',
              fontSize:     '0.82rem',
              fontFamily:   'var(--font-mono, monospace)',
              outline:      'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />

          <button
            onClick={onClose}
            style={{
              padding:      '6px 16px',
              background:   'var(--bg-base)',
              border:       '1px solid var(--border)',
              borderRadius: '7px',
              color:        'var(--text-secondary)',
              fontSize:     '0.82rem',
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding:      '6px 20px',
              background:   saveStatus === 'saved'  ? 'var(--success, #22c55e)'
                          : saveStatus === 'error'  ? 'var(--error, #ef4444)'
                          : 'var(--accent)',
              border:       'none',
              borderRadius: '7px',
              color:        'var(--btn-text, #fff)',
              fontSize:     '0.82rem',
              fontWeight:   700,
              cursor:       saving ? 'wait' : 'pointer',
              whiteSpace:   'nowrap',
              minWidth:     '80px',
              transition:   'background 0.2s ease',
            }}
          >
            {saving          ? '…'
           : saveStatus === 'saved' ? '✓ Saved!'
           : saveStatus === 'error' ? '✗ Error'
           : `Save all (${blocks.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ExtractCodeButton — shown on assistant messages that contain code blocks.
 * On click: opens the CodeSnippetDialog to review snippets, then save.
 */
function ExtractCodeButton({ content }) {
  const [showDialog, setShowDialog] = useState(false);
  const [blocks,     setBlocks]     = useState([]);
  const [btnStatus,  setBtnStatus]  = useState('idle'); // idle | saved | error | none

  useEffect(() => {
    const found = extractCodeBlocks(content);
    if (found.length === 0) {
      setBtnStatus('none');
    } else {
      setBlocks(found);
    }
  }, [content]);

  if (btnStatus === 'none') return null;

  const handleButtonClick = () => {
    // Refresh blocks in case content changed
    const found = extractCodeBlocks(content);
    if (found.length === 0) return;
    setBlocks(found);
    setShowDialog(true);
  };

  const handleSave = async (filesToSave) => {
    const result = await ipc.invoke('code:save-files', {
      files: filesToSave.map(b => ({ filename: b.filename, code: b.code }))
    });
    return result;
  };

  const handleClose = () => {
    setShowDialog(false);
  };

  return (
    <>
      <button
        onClick={handleButtonClick}
        title="Preview and save code snippets"
        style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '4px',
          padding:      '3px 8px',
          borderRadius: 'var(--radius-full, 999px)',
          border:       '1px solid var(--border)',
          background:   'var(--bg-elevated)',
          color:        'var(--text-secondary)',
          fontSize:     '0.7rem',
          fontWeight:   600,
          cursor:       'pointer',
          transition:   'all 0.18s ease',
          whiteSpace:   'nowrap',
          lineHeight:   1,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background  = 'var(--accent-soft)';
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color       = 'var(--accent)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background  = 'var(--bg-elevated)';
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color       = 'var(--text-secondary)';
        }}
      >
        ⬇ Code
      </button>

      {showDialog && (
        <CodeSnippetDialog
          blocks={blocks}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// ── Skill badge component ─────────────────────────────────────
export function SkillBadge({ skill }) {
  if (!skill) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: 'var(--bg-elevated)',
      color: 'var(--text-muted)',
      border: '1px solid var(--border)',
    }}>
      ⚡ {skill.replace(/-/g, ' ')}
    </span>
  );
}

// ── Syllabus point badge ──────────────────────────────────────
export function SyllabusTag({ point }) {
  if (!point) return null;
  const colour = topicColour(point);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.7rem',
      fontWeight: 600,
      color: colour,
      background: `${colour}18`,
      border: `1px solid ${colour}44`,
    }}>
      📌 {point}
    </span>
  );
}

// ── Teaching phase badge ──────────────────────────────────────
export function TeachingPhaseBadge({ phase }) {
  const phaseConfig = {
    teaching: { label: 'Teaching', icon: '📚', color: 'var(--accent)' },
    practicing: { label: 'Practice', icon: '✏️', color: 'var(--teal)' },
    assessing: { label: 'Assessment', icon: '📝', color: 'var(--success)' },
    interrupted: { label: 'Interrupted', icon: '⏸️', color: 'var(--warning)' }
  };

  const config = phaseConfig[phase] || phaseConfig.teaching;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: `${config.color}18`,
      color: config.color,
      border: `1px solid ${config.color}44`,
    }}>
      {config.icon} {config.label}
    </span>
  );
}

// ============================================================
// Test Mode Badge Components
// ============================================================

// ── Test phase badge ──────────────────────────────────────
export function TestPhaseBadge({ phase, subPhase }) {
  const phaseConfig = {
    testing: {
      label: 'Testing',
      icon: '📝',
      color: 'var(--accent)',
      subPhases: {
        diagnostic: { icon: '📊', label: 'Diagnostic' },
        topic: { icon: '🎯', label: 'Topic Test' },
        mixed: { icon: '🔄', label: 'Mixed Test' },
        mastery: { icon: '✅', label: 'Mastery Check' }
      }
    },
    diagnosis: {
      label: 'Diagnosis',
      icon: '🔍',
      color: 'var(--teal)',
      subPhases: {
        analyzing: { icon: '📊', label: 'Analyzing' },
        review: { icon: '📋', label: 'Review' }
      }
    },
    remediation: {
      label: 'Remediation',
      icon: '📚',
      color: 'var(--topic-c)',
      subPhases: {
        preparing: { icon: '✨', label: 'Preparing' },
        switching: { icon: '🔄', label: 'Switching Mode' },
        repeat: { icon: '🔄', label: 'Repeat' }
      }
    },
    verification: {
      label: 'Verification',
      icon: '✅',
      color: 'var(--success)',
      subPhases: {
        preparing: { icon: '✨', label: 'Preparing' },
        testing: { icon: '📝', label: 'Testing' }
      }
    },
    complete: {
      label: 'Complete',
      icon: '🏁',
      color: 'var(--text-muted)',
      subPhases: {}
    },
    interrupted: {
      label: 'Interrupted',
      icon: '⏸️',
      color: 'var(--warning)',
      subPhases: {}
    }
  };

  const config = phaseConfig[phase] || phaseConfig.testing;
  const subConfig = subPhase && config.subPhases[subPhase]
    ? config.subPhases[subPhase]
    : { icon: config.icon, label: config.label };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: `${config.color}18`,
      color: config.color,
      border: `1px solid ${config.color}44`,
    }}>
      {subConfig.icon} {subConfig.label}
    </span>
  );
}

// ── Score badge ───────────────────────────────────────────
export function ScoreBadge({ score, total, percentage }) {
  const scoreValue = percentage !== undefined ? percentage :
                    (total && score) ? (score / total) * 100 : null;

  if (scoreValue === null) return null;

  const getColor = (val) => {
    if (val >= 80) return 'var(--success)';
    if (val >= 60) return 'var(--warning)';
    return 'var(--error)';
  };

  const color = getColor(scoreValue);

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.7rem',
      fontWeight: 700,
      background: `${color}18`,
      color: color,
      border: `1px solid ${color}44`,
    }}>
      📊 {Math.round(scoreValue)}%
      {total && <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
        ({score}/{total})
      </span>}
    </span>
  );
}

// ── Question counter badge ────────────────────────────────
export function QuestionCounterBadge({ current, total }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.7rem',
      fontWeight: 600,
      background: 'var(--bg-elevated)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    }}>
      ❓ Q{current} of {total}
    </span>
  );
}

// ============================================================
// Generation Source Badge Component
// ============================================================

/**
 * GenerationSourceBadge - Shows the source of dynamically generated content
 *
 * @param {object} props
 * @param {string} props.source - 'enhanced' | 'knowledge-base' | 'llm' | 'cache'
 * @param {boolean} props.enhanced - Legacy flag for enhanced content
 */
export function GenerationSourceBadge({ source, enhanced }) {
  // Determine source from props
  const actualSource = source || (enhanced ? 'enhanced' : null);
  if (!actualSource) return null;

  // Source-specific configuration
  const sourceConfig = {
    enhanced: {
      label: 'AI Enhanced',
      icon: '✨',
      color: 'var(--accent)',
      background: 'linear-gradient(135deg, var(--accent-soft), transparent)',
      description: 'Content dynamically generated for you'
    },
    'knowledge-base': {
      label: 'From Knowledge Base',
      icon: '📚',
      color: 'var(--teal)',
      background: 'var(--teal-soft)',
      description: 'Prepared content from our knowledge base'
    },
    llm: {
      label: 'Generated',
      icon: '🤖',
      color: 'var(--topic-c)',
      background: 'var(--topic-c-soft)',
      description: 'Generated on-the-fly by AI'
    },
    cache: {
      label: 'Cached',
      icon: '⚡',
      color: 'var(--success)',
      background: 'var(--success-soft)',
      description: 'Retrieved from cache for faster response'
    }
  };

  const config = sourceConfig[actualSource] || sourceConfig.enhanced;

  return (
    <span
      className="generation-source-badge"
      data-source={actualSource}
      title={config.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: '0.7rem',
        fontWeight: 600,
        background: config.background,
        color: config.color,
        border: `1px solid ${config.color}44`,
        cursor: 'help',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = `0 2px 8px ${config.color}44`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span style={{ fontSize: '0.8rem' }}>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// ============================================================
// Teacher Proactive Message Component
// ============================================================

/**
 * TeacherProactiveMessage - Shows teacher's proactive message with response area
 *
 * @param {object} props
 * @param {object} props.message - Message object
 * @param {string} props.phase - Teaching phase
 * @param {string} props.subPhase - Teaching sub-phase
 * @param {boolean} props.isLatest - Whether this is the latest message
 * @param {function} props.onResponse - Callback when student responds
 * @param {function} props.onFollowUp - Callback for follow-up actions
 */
export function TeacherProactiveMessage({
  message,
  phase,
  subPhase,
  isLatest,
  onResponse,
  onFollowUp
}) {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messageId = message.id || `msg-${message.timestamp}-${Math.random()}`;

  const subPhaseConfig = {
    introduction: { label: 'Introduction', icon: '📖', description: 'Introducing the topic' },
    explanation: { label: 'Explaining', icon: '📚', description: 'Explaining key concepts' },
    checking: { label: 'Check Understanding', icon: '❓', description: 'Answer the question' },
    practice: { label: 'Practice', icon: '✏️', description: 'Solve the exercise' },
    feedback: { label: 'Feedback', icon: '💬', description: 'Reviewing your work' }
  };

  const config = subPhaseConfig[subPhase] || { label: 'Teaching', icon: '👩‍🏫' };

  const handleSubmit = async () => {
    if (!response.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onResponse(response);
    setResponse('');
    setIsSubmitting(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isGenerated = message.enhanced || message.generated || false;
  const generationSource = message.generationSource || (message.enhanced ? 'enhanced' : null);

  return (
    <div
      data-message-id={messageId}
      className="teacher-proactive-message"
      style={{
        maxWidth: '80%',
        margin: '16px 0',
        background: 'linear-gradient(135deg, var(--accent-soft), transparent)',
        border: '2px solid var(--border-accent)',
        borderRadius: '18px 18px 18px 4px',
        padding: '16px 20px',
        animation: isLatest ? 'slideUp 0.3s ease' : 'none',
        boxShadow: 'var(--shadow-accent)',
      }}
    >
      {/* Message Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-accent)',
      }}>
        <span style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 0 8px var(--accent-glow))' }}>
          👩‍🏫
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--accent)',
            background: 'var(--accent-soft)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--accent-glow)',
            display: 'inline-block',
          }}>
            {config.icon} {config.label}
          </div>
          {config.description && (
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}>
              {config.description}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!message.streaming && message.content && (
          <div style={{
            display: 'flex',
            gap: '4px',
          }}>
            <CopyButton content={message.content} />
            <TTSButton content={message.content} className="tts-button" />
            <ExportButton content={message.content} />
            <ExtractCodeButton content={message.content} />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="message-content markdown-body selectable" style={{
        fontSize: '1rem',
        lineHeight: 1.7,
        color: 'var(--text-primary)',
        marginBottom: '16px',
      }}>
        {message.streaming ? (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
            <span className="stream-cursor" />
          </span>
        ) : (
          <RichMathText content={message.content} />
        )}
      </div>

      {/* Visualisation */}
      {message.visualization && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--bg-deep)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}>
          {message.visualization.type === 'formula' && (
            <DisplayFormula formula={message.visualization.content} />
          )}
          {message.visualization.type === 'steps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {message.visualization.content.map((step, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    minWidth: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: 'var(--btn-text)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}>{i + 1}</span>
                  <div style={{ flex: 1, fontSize: '0.875rem' }}>
                    <RichMathText content={step} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Response Area for Checking and Practice phases */}
      {(subPhase === 'checking' || subPhase === 'practice') && !message.streaming && (
        <div className="response-area" style={{
          marginTop: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={subPhase === 'checking'
              ? "Type your answer here... (Press Enter to submit)"
              : "Type your solution here... (Press Enter to submit)"}
            disabled={isSubmitting}
            rows={3}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              resize: 'none',
              minHeight: '80px',
              maxHeight: '200px',
              outline: 'none',
              transition: 'all var(--transition-fast)',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--accent)';
              e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)';
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--border)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!response.trim() || isSubmitting}
            style={{
              padding: '12px 24px',
              background: response.trim() && !isSubmitting
                ? 'var(--accent)'
                : 'var(--bg-elevated)',
              color: response.trim() && !isSubmitting ? 'var(--btn-text)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: response.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: response.trim() && !isSubmitting ? 'var(--shadow-accent)' : 'none',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (response.trim() && !isSubmitting) {
                e.currentTarget.style.background = '#fbb543';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,166,35,0.3)';
              }
            }}
            onMouseLeave={e => {
              if (response.trim() && !isSubmitting) {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-accent)';
              }
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      )}

      {/* Exercise area for practice phase with hint */}
      {(subPhase === 'practice' || subPhase === 'practicing') && message.exercise && !message.streaming && (
        <div className="exercise-area" style={{
          marginTop: '16px',
          padding: '16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div className="exercise-question" style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '1px dashed var(--border-bright)',
          }}>
            {message.exercise.question}
          </div>
          {message.exercise.hint && (
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginBottom: '12px',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--accent)',
            }}>
              💡 Hint: {message.exercise.hint}
            </div>
          )}
        </div>
      )}

      {/* Meta tags row */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        paddingLeft: '4px',
        marginTop: '12px',
        alignItems: 'center',
      }}>
        {message.skillsUsed?.length > 0 && message.skillsUsed.map(s => (
          <SkillBadge key={s} skill={s} />
        ))}
        {message.syllabusPoint && <SyllabusTag point={message.syllabusPoint} />}
        {isGenerated && generationSource && (
          <GenerationSourceBadge source={generationSource} enhanced={message.enhanced} />
        )}
      </div>

      {/* Follow-up suggestion pills */}
      {isLatest && !message.streaming && message.followUps?.length > 0 && (
        <FollowUpPills pills={message.followUps} onSelect={onFollowUp} context={message.content} />
      )}

      {/* Timestamp */}
      <span style={{
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        paddingLeft: '4px',
        marginTop: '8px',
        display: 'block',
      }}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

// ============================================================
// Test Mode Message Components
// ============================================================

/**
 * TestQuestionMessage - Shows a test question with enhanced answer input
 *
 * @param {object} props
 * @param {object} props.message - Message object containing question
 * @param {boolean} props.isLatest - Whether this is the latest message
 * @param {function} props.onResponse - Callback when student answers
 */
export function TestQuestionMessage({ message, isLatest, onResponse }) {
  console.log('[TestQuestionMessage] Full message:', JSON.stringify(message, null, 2));
  console.log('[TestQuestionMessage] question prop:', message.question);
  console.log('[TestQuestionMessage] message.type:', message.type);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const messageId = message.id || `msg-${message.timestamp}-${Math.random()}`;

  const question = message.question || {};
  const isMultipleChoice = question.type === 'multiple-choice' ||
                          (question.options && question.options.length > 0);

  const handleSubmit = async (answer) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await onResponse(answer);
    setIsSubmitting(false);
  };

  const handleHint = () => {
    setShowHint(true);
    setTimeout(() => setShowHint(false), 10000);
  };

  return (
    <div
      data-message-id={messageId}
      className="test-question-message"
      style={{
        maxWidth: '80%',
        margin: '16px 0',
        background: 'linear-gradient(135deg, var(--accent-soft), var(--bg-surface))',
        border: '2px solid var(--accent)',
        borderRadius: '18px 18px 18px 4px',
        padding: '16px 20px',
        animation: isLatest ? 'slideUp 0.3s ease' : 'none',
        boxShadow: 'var(--shadow-accent)',
      }}
    >
      {/* Header with test info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-accent)',
      }}>
        <span style={{ fontSize: '1.5rem' }}>📝</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--accent)',
            background: 'var(--accent-soft)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--accent-glow)',
            display: 'inline-block',
          }}>
            Question {message.questionIndex} of {message.totalQuestions}
          </div>
          {message.topic && (
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}>
              Topic: {message.topic} • Difficulty: {message.difficulty}
              {message.marks && <span> • {message.marks} mark{message.marks > 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!message.streaming && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => {/* Copy question */}}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 6,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '0.75rem',
              }}
              title="Copy question"
            >
              📋
            </button>
          </div>
        )}
      </div>

      {/* Question content */}
      <div className="question-content" style={{
        fontSize: '1rem',
        lineHeight: 1.7,
        color: 'var(--text-primary)',
        marginBottom: '20px',
        whiteSpace: 'pre-wrap',
      }}>
        <RichMathText content={message.content} />
      </div>

      {/* Hint display (when requested) */}
      {showHint && question.hint && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '4px solid var(--warning)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
            color: 'var(--warning)',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}>
            <span>💡</span>
            <span>Hint</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {question.hint}
          </div>
        </div>
      )}

      {/* Answer Input Area - Using AnswerInput component */}
      <AnswerInput
        question={question}
        onSubmit={handleSubmit}
        onHint={handleHint}
        showHint={!showHint && question.hint}
        placeholder={isMultipleChoice
          ? "Select an option above"
          : "Type your answer here... (Press Enter to submit, Shift+Enter for new line)"}
        disabled={isSubmitting}
      />

      {/* Meta tags */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        marginTop: '16px',
        alignItems: 'center',
      }}>
        {message.skillsUsed?.length > 0 && message.skillsUsed.map(s => (
          <SkillBadge key={s} skill={s} />
        ))}
        {message.syllabusPoint && <SyllabusTag point={message.syllabusPoint} />}
      </div>

      {/* Timestamp */}
      <span style={{
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        marginTop: '8px',
        display: 'block',
      }}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

/**
 * TestResultMessage - Shows test results and diagnosis
 *
 * @param {object} props
 * @param {object} props.message - Message object containing results
 * @param {boolean} props.isLatest - Whether this is the latest message
 * @param {function} props.onFollowUp - Callback for follow-up actions
 */
export function TestResultMessage({ message, isLatest, onFollowUp }) {
  const messageId = message.id || `msg-${message.timestamp}-${Math.random()}`;
  const results = message.results || {};
  const diagnosis = message.diagnosis || {};

  return (
    <div
      data-message-id={messageId}
      className="test-result-message"
      style={{
        maxWidth: '80%',
        margin: '16px 0',
        background: 'var(--bg-surface)',
        border: '2px solid var(--teal)',
        borderRadius: '18px 18px 18px 4px',
        padding: '16px 20px',
        animation: isLatest ? 'slideUp 0.3s ease' : 'none',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <span style={{ fontSize: '1.5rem' }}>📊</span>
        <div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--teal)',
          }}>
            Test Results
          </div>
          {results.score !== undefined && (
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}>
              Score: <strong>{Math.round(results.score)}%</strong> ({results.correct}/{results.total} correct)
            </div>
          )}
        </div>
      </div>

      {/* Results content */}
      <div className="message-content markdown-body selectable" style={{
        fontSize: '0.95rem',
        lineHeight: 1.6,
        color: 'var(--text-primary)',
      }}>
        <RichMathText content={message.content} />
      </div>

      {/* Topic breakdown */}
      {results.byTopic && Object.keys(results.byTopic).length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '8px',
          }}>
            Topic Breakdown:
          </div>
          {Object.entries(results.byTopic)
            .sort(([, a], [, b]) => a - b)
            .map(([topic, score]) => {
              const color = score >= 80 ? 'var(--success)' :
                           score >= 60 ? 'var(--warning)' : 'var(--error)';
              return (
                <div key={topic} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{topic}:</span>
                  <div style={{
                    flex: 1,
                    height: '6px',
                    background: 'var(--bg-deep)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${score}%`,
                      height: '100%',
                      background: color,
                    }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', color, fontWeight: 600 }}>
                    {Math.round(score)}%
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Error patterns */}
      {diagnosis.errorPatterns && diagnosis.errorPatterns.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '8px',
          }}>
            Error Patterns:
          </div>
          {diagnosis.errorPatterns.slice(0, 3).map((pattern, i) => (
            <div key={i} style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              paddingLeft: '8px',
              borderLeft: '2px solid var(--warning)',
            }}>
              {pattern.description}
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--accent-soft)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--accent-glow)',
        }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--accent)',
            marginBottom: '8px',
          }}>
            Recommendations:
          </div>
          {diagnosis.recommendations.map((rec, i) => (
            <div key={i} style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
              paddingLeft: '8px',
            }}>
              • {rec}
            </div>
          ))}
        </div>
      )}

      {/* Follow-up pills */}
      {isLatest && message.followUps?.length > 0 && (
        <FollowUpPills pills={message.followUps} onSelect={onFollowUp} context={message.content} />
      )}

      {/* Timestamp */}
      <span style={{
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        marginTop: '12px',
        display: 'block',
      }}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

/**
 * TestRemediationMessage - Shows remediation status and mode switch info
 *
 * @param {object} props
 * @param {object} props.message - Message object
 * @param {boolean} props.isLatest - Whether this is the latest message
 */
export function TestRemediationMessage({ message, isLatest }) {
  const messageId = message.id || `msg-${message.timestamp}-${Math.random()}`;
  const modeSwitch = message.modeSwitch || {};

  return (
    <div
      data-message-id={messageId}
      className="test-remediation-message"
      style={{
        maxWidth: '80%',
        margin: '16px 0',
        background: 'linear-gradient(135deg, var(--topic-c-soft), var(--bg-surface))',
        border: '2px solid var(--topic-c)',
        borderRadius: '18px 18px 18px 4px',
        padding: '16px 20px',
        animation: isLatest ? 'slideUp 0.3s ease' : 'none',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <span style={{ fontSize: '1.5rem' }}>📚</span>
        <div>
          <div style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--topic-c)',
          }}>
            Remediation
          </div>
          {modeSwitch.to && (
            <div style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}>
              Switching to {modeSwitch.to === 'teacher-led' ? 'Teacher-Led' : modeSwitch.to} mode
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="message-content markdown-body selectable" style={{
        fontSize: '0.95rem',
        lineHeight: 1.6,
        color: 'var(--text-primary)',
      }}>
        <RichMathText content={message.content} />
      </div>

      {/* Mode switch indicator */}
      {modeSwitch.to && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div className="spinner" style={{
            width: '20px',
            height: '20px',
            border: '2px solid var(--topic-c)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Preparing your personalized lesson...
          </div>
        </div>
      )}

      {/* Timestamp */}
      <span style={{
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        marginTop: '12px',
        display: 'block',
      }}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

// ── Follow-up suggestion pills ────────────────────────────────
export function FollowUpPills({ pills, onSelect, context }) {
  if (!pills || pills.length === 0) return null;
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      paddingLeft: '4px',
      marginTop: '2px',
      animation: 'slideUp 0.3s ease both',
    }}>
      {/* Follow-up question pills */}
      {pills.map((text, i) => (
        <button
          key={i}
          onClick={() => onSelect(text)}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-secondary)',
            fontSize: '0.78rem',
            padding: '5px 12px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.4,
            textAlign: 'left',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--bg-surface)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-elevated)';
          }}
        >
          {text}
        </button>
      ))}

      {/* Divider */}
      <div style={{
        height: '1px',
        background: 'var(--border)',
        margin: '2px 0',
        borderRadius: 1,
      }} />

      {/* Test me button */}
      <button
        onClick={() => {
          onSelect('Quiz me.');
        }}
        style={{
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-full)',
          color: 'var(--accent)',
          fontSize: '0.78rem',
          fontWeight: 600,
          padding: '5px 12px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.4,
          textAlign: 'left',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--accent)';
          e.currentTarget.style.color = 'var(--btn-text)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--accent-soft)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
      >
        🎯 Test me on this
      </button>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────
export function TypingIndicator({ message = null }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      animation: 'slideUp 0.2s ease',
    }}>
      <div style={{
        padding: '12px 18px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '18px 18px 18px 4px',
        display: 'flex',
        gap: '5px',
        alignItems: 'center',
      }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
        {message && (
          <span style={{
            marginLeft: '8px',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            whiteSpace: 'nowrap',
          }}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Teacher bubble ─────────────────────────────────────
export function TeacherBubble({ message, phase, progress, isLatest, onFollowUp }) {
  const messageId = message.id || `msg-${message.timestamp}-${Math.random()}`;
  const isGenerated = message.enhanced || message.generated || false;
  const generationSource = message.generationSource || (message.enhanced ? 'enhanced' : null);

  return (
    <div
      data-message-id={messageId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        animation: isLatest ? 'slideUp 0.25s ease both' : 'none',
        width: '100%',
      }}
    >
      {/* Phase indicator */}
      {phase && (
        <div style={{ paddingLeft: '4px', marginBottom: '2px' }}>
          <TeachingPhaseBadge phase={phase} />
          {progress !== undefined && (
            <span style={{
              marginLeft: '8px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}>
              {Math.round(progress)}% complete
            </span>
          )}
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: '78%',
        padding: '13px 17px',
        borderRadius: '18px 18px 18px 4px',
        background: 'linear-gradient(135deg, var(--accent-soft), rgba(245,166,35,0.02))',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-sm)',
        lineHeight: 1.65,
        fontSize: '0.9rem',
        position: 'relative',
      }}>
        {/* Action buttons */}
        {!message.streaming && message.content && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 10,
            zIndex: 10,
            display: 'flex',
            gap: '4px',
          }}>
            <CopyButton content={message.content} />
            <TTSButton content={message.content} className="tts-button" />
            <ExportButton content={message.content} />
            <ExtractCodeButton content={message.content} />
          </div>
        )}

        <div
          className="message-content markdown-body selectable"
          style={{
            // Push content below the action buttons (Copy/Listen/Export)
            paddingTop: (!message.streaming && message.content) ? '28px' : 0,
          }}
        >
          {message.streaming ? (
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {message.content}
              <span className="stream-cursor" />
            </span>
          ) : (
            <RichMathText content={message.content} />
          )}
        </div>

        {/* Visualisation */}
        {message.visualization && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--bg-deep)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}>
            {message.visualization.type === 'formula' && (
              <DisplayFormula formula={message.visualization.content} />
            )}
            {message.visualization.type === 'steps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {message.visualization.content.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      minWidth: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: 'var(--btn-text)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, fontSize: '0.875rem' }}>
                      <RichMathText content={step} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meta tags row - including generation source */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        paddingLeft: '4px',
        alignItems: 'center',
      }}>
        {message.skillsUsed?.length > 0 && message.skillsUsed.map(s => (
          <SkillBadge key={s} skill={s} />
        ))}
        {message.syllabusPoint && <SyllabusTag point={message.syllabusPoint} />}
        {isGenerated && generationSource && (
          <GenerationSourceBadge source={generationSource} enhanced={message.enhanced} />
        )}
      </div>

      {/* Follow-up suggestion pills */}
      {isLatest && !message.streaming && message.followUps?.length > 0 && (
        <FollowUpPills pills={message.followUps} onSelect={onFollowUp} context={message.content} />
      )}

      {/* Timestamp */}
      <span style={{
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        paddingLeft: '4px',
      }}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

// ── Message bubble (original, modified to support test mode) ──
export function MessageBubble({ message, isLatest, onFollowUp, onResponse }) {
  const isUser   = message.role === 'user';
  const isSystem = message.role === 'system';

  // Check message type
  const isTeacher = message.teachingModel === 'teacher-led' && message.role === 'assistant';
  const isTeacherProactive = isTeacher && message.proactive === true;
  const isTestMode = message.teachingModel === 'test-led' && message.role === 'assistant';
  const isTestQuestion = isTestMode && message.type === 'test_question';
  const isTestResult = isTestMode && (message.type === 'diagnosis' || message.type === 'test_complete');
  const isTestRemediation = isTestMode && message.type === 'remediation_start';
  const isAnswerFeedback = isTestMode && message.type === 'answer_feedback';
  const isLessonSummaryCard = message.teachingModel === 'teacher-led' && message.type === 'lesson_summary_card';
  const isTestQuestionCard = message.teachingModel === 'test-led' && message.type === 'test_question_card';

  // Check if content is generated
  const isGenerated = message.enhanced || message.generated || false;
  const generationSource = message.generationSource || (message.enhanced ? 'enhanced' : null);

  // Generate a stable ID if not present
  const messageId = message.id || `msg-${message.timestamp}-${Math.random()}`;

  if (isSystem) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '6px 0',
        animation: 'fadeIn 0.3s ease',
      }}>
        <span style={{
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          background: 'var(--bg-elevated)',
          padding: '4px 14px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border)',
        }}>
          {message.content}
        </span>
      </div>
    );
  }

  // Test Question Message
  if (isTestQuestion) {
    return (
      <TestQuestionMessage
        message={message}
        isLatest={isLatest}
        onResponse={onResponse}
      />
    );
  }

  // Test Result Message
  if (isTestResult) {
    return (
      <TestResultMessage
        message={message}
        isLatest={isLatest}
        onFollowUp={onFollowUp}
      />
    );
  }

  // Test Question Card — compact record left in chat after dialog is dismissed
  if (isTestQuestionCard) {
    const resultIcon = message.isCorrect === true ? '✅' : message.isCorrect === false ? '❌' : '📝';
    const preview = message.content
      ? message.content.replace(/\\[^\\]*/g, '').replace(/\$[^$]*\$/g, '[math]').substring(0, 100)
      : '';
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        maxWidth: '80%',
        opacity: 0.75,
      }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>{resultIcon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Q{message.questionIndex} of {message.totalQuestions}
            {message.topic && <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>· {message.topic}</span>}
          </div>
          {preview && (
            <div style={{
              fontSize: '0.73rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {preview}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Lesson Summary Card — compact record left in chat after dialog is dismissed
  if (isLessonSummaryCard) {
    const phaseIcons = {
      introducing: ['📋', 'Introduction'],
      explanation: ['📖', 'Explanation'],
      check: ['❓', 'Check Understanding'],
      checking: ['❓', 'Check Understanding'],
      practice: ['✏️', 'Practice'],
      assessment: ['📝', 'Assessment'],
      summary: ['✅', 'Summary'],
      complete: ['🎉', 'Complete'],
    };
    const [icon, label] = phaseIcons[message.phase] || ['📄', message.sectionLabel || 'Lesson'];
    const preview = message.content
      ? message.content.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').substring(0, 120) + (message.content.length > 120 ? '…' : '')
      : '';

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        maxWidth: '80%',
        opacity: 0.8,
        animation: 'fadeIn 0.2s ease',
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {label} completed
          </div>
          {preview && (
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {preview}
            </div>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>✓</span>
      </div>
    );
  }

  // Answer Feedback — compact transient message shown between questions
  if (isAnswerFeedback) {
    const isCorrect = message.isCorrect;
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        margin: '8px 0',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 16px',
          background: isCorrect ? 'var(--success-soft, rgba(34,197,94,0.1))' : 'var(--error-soft, rgba(239,68,68,0.1))',
          border: `1px solid ${isCorrect ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)'}`,
          borderRadius: '12px',
          maxWidth: '80%',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          lineHeight: 1.5,
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{isCorrect ? '✅' : '❌'}</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: isCorrect ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)' }}>
              {isCorrect ? 'Correct!' : 'Not quite right'}
            </div>
            {message.detailedFeedback && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px' }}>
                <RichMathText content={message.detailedFeedback} />
              </div>
            )}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Moving to next question...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Test Remediation Message
  if (isTestRemediation) {
    return (
      <TestRemediationMessage
        message={message}
        isLatest={isLatest}
      />
    );
  }

  // Teacher Proactive Message
  if (isTeacherProactive) {
    return (
      <TeacherProactiveMessage
        message={message}
        phase={message.phase}
        subPhase={message.subPhase}
        isLatest={isLatest}
        onResponse={onResponse}
        onFollowUp={onFollowUp}
      />
    );
  }

  // Regular Teacher Message
  if (isTeacher) {
    return (
      <TeacherBubble
        message={message}
        phase={message.teachingPhase}
        progress={message.teachingProgress}
        isLatest={isLatest}
        onFollowUp={onFollowUp}
      />
    );
  }

  // Original user/assistant bubbles
  return (
    <div
      data-message-id={messageId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: '6px',
        animation: isLatest ? 'slideUp 0.25s ease both' : 'none',
      }}
    >
      {/* Bubble */}
      <div className={isUser ? 'user-bubble' : ''} style={{
        maxWidth: '78%',
        padding: '13px 17px',
        borderRadius: isUser
          ? '18px 18px 4px 18px'
          : '18px 18px 18px 4px',
        background: isUser
          ? 'linear-gradient(135deg, var(--accent), var(--accent-dim))'
          : 'var(--bg-surface)',
        border: isUser
          ? 'none'
          : '1px solid var(--border)',
        color: isUser ? 'var(--btn-text)' : 'var(--text-primary)',
        boxShadow: isUser
          ? 'var(--shadow-accent)'
          : 'var(--shadow-sm)',
        lineHeight: 1.65,
        fontSize: '0.9rem',
        position: 'relative',
      }}>
        {/* Action buttons */}
        {!isUser && !message.streaming && message.content && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 10,
            zIndex: 10,
            display: 'flex',
            gap: '4px',
          }}>
            <CopyButton content={message.content} />
            <TTSButton content={message.content} className="tts-button" />
            <ExportButton content={message.content} />
            <ExtractCodeButton content={message.content} />
          </div>
        )}
        <div
          className="message-content markdown-body selectable"
          style={{
            color: isUser ? 'var(--btn-text)' : 'inherit',
            // Push content below the action buttons (Copy/Listen/Export)
            // only when they are visible — keeps streaming unaffected.
            paddingTop: (!isUser && !message.streaming && message.content) ? '28px' : 0,
          }}
        >
          {message.streaming ? (
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {message.content}
              <span className="stream-cursor" />
            </span>
          ) : (
            <RichMathText content={message.content} />
          )}
        </div>

        {/* Visualisation */}
        {message.visualization && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--bg-deep)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}>
            {message.visualization.type === 'formula' && (
              <DisplayFormula formula={message.visualization.content} />
            )}
            {message.visualization.type === 'steps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {message.visualization.content.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      minWidth: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: 'var(--btn-text)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, fontSize: '0.875rem' }}>
                      <RichMathText content={step} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meta tags row - including generation source for non-teacher messages */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        paddingLeft: isUser ? 0 : '4px',
        paddingRight: isUser ? '4px' : 0,
        alignItems: 'center',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}>
        {!isUser && message.skillsUsed?.length > 0 && message.skillsUsed.map(s => (
          <SkillBadge key={s} skill={s} />
        ))}
        {!isUser && message.syllabusPoint && <SyllabusTag point={message.syllabusPoint} />}
        {!isUser && isGenerated && generationSource && (
          <GenerationSourceBadge source={generationSource} enhanced={message.enhanced} />
        )}
      </div>

      {/* Follow-up suggestion pills */}
      {!isUser && isLatest && !message.streaming && message.followUps?.length > 0 && (
        <FollowUpPills pills={message.followUps} onSelect={onFollowUp} context={message.content} />
      )}

      {/* Timestamp */}
      <span style={{
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        paddingLeft: isUser ? 0 : '4px',
        paddingRight: isUser ? '4px' : 0,
      }}>
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}