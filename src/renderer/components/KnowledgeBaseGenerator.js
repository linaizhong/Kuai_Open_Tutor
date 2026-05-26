// src/renderer/components/KnowledgeBaseGenerator.js
// Knowledge Base Generator — Admin UI component
//
// Allows an admin/developer to auto-generate a complete knowledge base
// (manifest.json, syllabus-map.json, dot-points.json) for any subject
// by entering a subject name and clicking Generate.
//
// Flow:
//   1. User types subject name → Check if it already exists
//   2. Click Generate → LLM pipeline runs (manifest → syllabus-map → dot-points)
//   3. Progress steps shown live as each phase completes
//   4. Review panel shows all three generated files as formatted JSON
//   5. User clicks Approve → files written to disk
//      Or clicks Cancel → nothing saved
//
// Uses the same dark theme tokens as the rest of OpenTutor.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ipc from '../ipc';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'manifest',     label: 'Manifest',     icon: '📋', description: 'Subject metadata, suggestions, quick actions' },
  { id: 'syllabus-map', label: 'Syllabus Map',  icon: '🗺️',  description: 'Topics, subtopics, dot-point codes and keywords' },
  { id: 'dot-points',   label: 'Dot-points',   icon: '📚', description: 'Key concepts, common errors, exam tips, examples' },
  { id: 'complete',     label: 'Complete',      icon: '✅', description: 'Ready for review' },
];

// ─────────────────────────────────────────────────────────────
// Sub-component: Step indicator row
// ─────────────────────────────────────────────────────────────

function StepRow({ step, status, detail }) {
  const iconMap = { idle: '○', active: '⏳', done: '✓', error: '✗' };
  const colorMap = {
    idle:   'var(--text-muted)',
    active: 'var(--accent)',
    done:   'var(--success)',
    error:  'var(--error)',
  };

  return (
    <div style={{
      display:       'flex',
      alignItems:    'flex-start',
      gap:           '12px',
      padding:       '10px 0',
      borderBottom:  '1px solid var(--border)',
      opacity:       status === 'idle' ? 0.4 : 1,
      transition:    'opacity 0.3s',
    }}>
      <span style={{
        fontSize:   '18px',
        minWidth:   '28px',
        color:      colorMap[status],
        fontWeight: 'bold',
        marginTop:  '2px',
      }}>
        {status === 'active'
          ? <span style={{ display: 'inline-block', animation: 'kb-spin 1s linear infinite' }}>⏳</span>
          : iconMap[status]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '8px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colorMap[status] }}>
            {step.icon} {step.label}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {detail || step.description}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: JSON review tab
// ─────────────────────────────────────────────────────────────

function JsonReviewTab({ label, data, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding:         '8px 16px',
        background:      active ? 'var(--accent-soft)' : 'transparent',
        border:          active ? '1px solid var(--accent)' : '1px solid var(--border)',
        borderRadius:    '6px 6px 0 0',
        color:           active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize:        '13px',
        fontWeight:      active ? 600 : 400,
        cursor:          'pointer',
        transition:      'all 0.2s',
        fontFamily:      'var(--font-mono, monospace)',
      }}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function KnowledgeBaseGenerator({ onClose, onSubjectCreated }) {
  const [subjectName,   setSubjectName]   = useState('');
  const [phase,         setPhase]         = useState('idle'); // idle | checking | generating | review | saving | done | error
  const [errorMsg,      setErrorMsg]      = useState('');
  const [stepStatuses,  setStepStatuses]  = useState({ manifest: 'idle', 'syllabus-map': 'idle', 'dot-points': 'idle', complete: 'idle' });
  const [stepDetails,   setStepDetails]   = useState({});
  const [generated,     setGenerated]     = useState(null);  // { subjectId, manifest, syllabusMap, dotPoints }
  const [activeTab,     setActiveTab]     = useState('manifest');
  const [savePath,      setSavePath]      = useState('');

  const progressCleanupRef = useRef(null);

  // ── Register/unregister progress listener ──────────────────
  useEffect(() => {
    const handleProgress = (data) => {
      const { step, message, topicIndex, topicTotal } = data;

      setStepStatuses(prev => {
        const next = { ...prev };
        // Mark current step active
        if (step === 'manifest')     next['manifest']     = 'active';
        if (step === 'syllabus-map') next['syllabus-map'] = 'active';
        if (step === 'dot-points')   next['dot-points']   = 'active';
        if (step === 'complete')     next['complete']     = 'done';

        // Mark previous steps done
        if (step === 'syllabus-map') next['manifest']     = 'done';
        if (step === 'dot-points')   { next['manifest'] = 'done'; next['syllabus-map'] = 'done'; }
        if (step === 'complete')     { next['manifest'] = 'done'; next['syllabus-map'] = 'done'; next['dot-points'] = 'done'; }

        return next;
      });

      setStepDetails(prev => ({
        ...prev,
        [step]: topicIndex
          ? `${message} (${topicIndex}/${topicTotal})`
          : message,
      }));
    };

    ipc.on('kb:progress', handleProgress);
    progressCleanupRef.current = () => ipc.off('kb:progress', handleProgress);

    return () => {
      if (progressCleanupRef.current) progressCleanupRef.current();
    };
  }, []);

  // ── Check if subject exists ─────────────────────────────────
  const handleCheck = useCallback(async () => {
    const name = subjectName.trim();
    if (!name) return;

    setPhase('checking');
    setErrorMsg('');

    try {
      const result = await ipc.invoke('kb:check', { subjectName: name });
      if (result.exists) {
        setErrorMsg(`"${result.subjectId}" already exists in the knowledge base. Choose a different subject name.`);
        setPhase('idle');
      } else {
        setPhase('idle');
      }
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('idle');
    }
  }, [subjectName]);

  // ── Start generation ────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const name = subjectName.trim();
    if (!name) return;

    setPhase('generating');
    setErrorMsg('');
    setGenerated(null);
    setStepStatuses({ manifest: 'active', 'syllabus-map': 'idle', 'dot-points': 'idle', complete: 'idle' });
    setStepDetails({});

    try {
      const result = await ipc.invoke('kb:generate', { subjectName: name });

      if (!result.success) {
        setErrorMsg(result.error || 'Generation failed.');
        setPhase('error');
        setStepStatuses(prev => {
          const active = Object.entries(prev).find(([, v]) => v === 'active');
          if (active) return { ...prev, [active[0]]: 'error' };
          return prev;
        });
        return;
      }

      setGenerated(result);
      setStepStatuses({ manifest: 'done', 'syllabus-map': 'done', 'dot-points': 'done', complete: 'done' });
      setPhase('review');
      setActiveTab('manifest');

    } catch (err) {
      setErrorMsg(err.message || 'Unexpected error during generation.');
      setPhase('error');
    }
  }, [subjectName]);

  // ── Approve and save ────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!generated) return;
    setPhase('saving');

    try {
      const result = await ipc.invoke('kb:approve', {
        subjectId: generated.subjectId,
        files: {
          manifest:    generated.manifest,
          syllabusMap: generated.syllabusMap,
          dotPoints:   generated.dotPoints,
        },
      });

      if (!result.success) {
        setErrorMsg(result.error || 'Failed to save files.');
        setPhase('error');
        return;
      }

      setSavePath(result.path);
      setPhase('done');

      // Notify parent so it can refresh the subject list
      if (typeof onSubjectCreated === 'function') {
        onSubjectCreated(generated.subjectId, generated.manifest);
      }

    } catch (err) {
      setErrorMsg(err.message || 'Unexpected error while saving.');
      setPhase('error');
    }
  }, [generated, onSubjectCreated]);

  // ── Cancel ──────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (generated) {
      ipc.invoke('kb:cancel', { subjectId: generated.subjectId }).catch(() => {});
    }
    setPhase('idle');
    setGenerated(null);
    setStepStatuses({ manifest: 'idle', 'syllabus-map': 'idle', 'dot-points': 'idle', complete: 'idle' });
    setStepDetails({});
    setErrorMsg('');
  }, [generated]);

  // ── Helpers ─────────────────────────────────────────────────
  const dotPointCount = generated
    ? Object.keys(generated.dotPoints?.dotPoints || {}).length
    : 0;

  const topicCount = generated
    ? (generated.syllabusMap?.topics || []).length
    : 0;

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe for spinner */}
      <style>{`
        @keyframes kb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes kb-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Modal backdrop */}
      <div
        onClick={phase === 'generating' || phase === 'saving' ? undefined : onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.6)',
          zIndex:     1000,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding:    '20px',
        }}
      >
        {/* Modal panel */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background:   'var(--bg-surface)',
            border:       '1px solid var(--border-bright)',
            borderRadius: '16px',
            boxShadow:    'var(--shadow-lg, 0 8px 40px rgba(0,0,0,0.6))',
            width:        '100%',
            maxWidth:     phase === 'review' || phase === 'done' ? '900px' : '560px',
            maxHeight:    '90vh',
            display:      'flex',
            flexDirection: 'column',
            animation:    'kb-fadein 0.25s ease',
            transition:   'max-width 0.3s ease',
            overflow:     'hidden',
          }}
        >

          {/* ── Header ─────────────────────────────────────── */}
          <div style={{
            padding:      '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            flexShrink:   0,
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600 }}>
                🏗️ Generate Knowledge Base
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Auto-generate syllabus files for any subject using AI
              </p>
            </div>
            {phase !== 'generating' && phase !== 'saving' && (
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border:     '1px solid var(--border)',
                  borderRadius: '8px',
                  color:      'var(--text-muted)',
                  cursor:     'pointer',
                  padding:    '6px 12px',
                  fontSize:   '13px',
                }}
              >
                ✕ Close
              </button>
            )}
          </div>

          {/* ── Scrollable body ─────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

            {/* ── Input row (shown when idle/error/checking) ── */}
            {(phase === 'idle' || phase === 'error' || phase === 'checking') && (
              <div style={{ animation: 'kb-fadein 0.2s ease' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Subject name
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={e => { setSubjectName(e.target.value); setErrorMsg(''); }}
                    onBlur={subjectName.trim() ? handleCheck : undefined}
                    onKeyDown={e => e.key === 'Enter' && subjectName.trim() && handleGenerate()}
                    placeholder="e.g. HSC Chemistry, VCE Biology Unit 3&4, AP Calculus BC"
                    disabled={phase === 'checking'}
                    style={{
                      flex:         1,
                      background:   'var(--bg-elevated)',
                      border:       `1px solid ${errorMsg ? 'var(--error)' : 'var(--border-bright)'}`,
                      borderRadius: '10px',
                      color:        'var(--text-primary)',
                      fontSize:     '14px',
                      padding:      '12px 16px',
                      outline:      'none',
                    }}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={!subjectName.trim() || phase === 'checking' || !!errorMsg}
                    style={{
                      background:   (!subjectName.trim() || !!errorMsg) ? 'var(--bg-elevated)' : 'var(--accent)',
                      border:       'none',
                      borderRadius: '10px',
                      color:        (!subjectName.trim() || !!errorMsg) ? 'var(--text-muted)' : '#1a1a2e',
                      cursor:       (!subjectName.trim() || !!errorMsg) ? 'not-allowed' : 'pointer',
                      fontSize:     '14px',
                      fontWeight:   600,
                      padding:      '12px 20px',
                      whiteSpace:   'nowrap',
                      transition:   'all 0.2s',
                    }}
                  >
                    {phase === 'checking' ? '⏳ Checking...' : '⚡ Generate'}
                  </button>
                </div>

                {errorMsg && (
                  <div style={{
                    marginTop:    '10px',
                    padding:      '10px 14px',
                    background:   'var(--error-soft)',
                    border:       '1px solid var(--error)',
                    borderRadius: '8px',
                    color:        'var(--error)',
                    fontSize:     '13px',
                  }}>
                    ⚠ {errorMsg}
                  </div>
                )}

                {/* Info box */}
                <div style={{
                  marginTop:    '20px',
                  padding:      '14px 16px',
                  background:   'var(--info-soft)',
                  border:       '1px solid var(--info)',
                  borderRadius: '10px',
                  fontSize:     '13px',
                  color:        'var(--text-secondary)',
                  lineHeight:   1.6,
                }}>
                  <strong style={{ color: 'var(--teal)' }}>ℹ How it works</strong><br />
                  The generator makes a series of API calls to Ollama Local LLM to produce three files:
                  <strong style={{ color: 'var(--text-primary)' }}> manifest.json</strong>,
                  <strong style={{ color: 'var(--text-primary)' }}> syllabus-map.json</strong>, and
                  <strong style={{ color: 'var(--text-primary)' }}> dot-points.json</strong>.
                  You can review all generated content before it is written to disk.
                  Subjects that already exist are automatically skipped.
                  <br /><br />
                  <strong style={{ color: 'var(--warning)' }}>⚠ Requires:</strong> Ollama Local LLM configured in Settings.
                </div>
              </div>
            )}

            {/* ── Generating: progress steps ──────────────── */}
            {(phase === 'generating') && (
              <div style={{ animation: 'kb-fadein 0.2s ease' }}>
                <div style={{
                  padding:      '12px 16px',
                  background:   'var(--accent-soft)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  fontSize:     '14px',
                  color:        'var(--accent)',
                  fontWeight:   500,
                }}>
                  ⚡ Generating knowledge base for <strong>"{subjectName}"</strong>...
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 400 }}>
                    This may take 1–3 minutes. Please wait.
                  </div>
                </div>

                {STEPS.map(step => (
                  <StepRow
                    key={step.id}
                    step={step}
                    status={stepStatuses[step.id]}
                    detail={stepDetails[step.id]}
                  />
                ))}
              </div>
            )}

            {/* ── Review panel ────────────────────────────── */}
            {phase === 'review' && generated && (
              <div style={{ animation: 'kb-fadein 0.2s ease' }}>

                {/* Summary banner */}
                <div style={{
                  padding:      '14px 18px',
                  background:   'var(--success-soft)',
                  border:       '1px solid var(--success)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '12px',
                }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--success)' }}>
                      Generation complete — review before saving
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {topicCount} topics · {dotPointCount} dot-points · subject ID: <code style={{ color: 'var(--teal)' }}>{generated.subjectId}</code>
                    </div>
                  </div>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '-1px', position: 'relative', zIndex: 1 }}>
                  {[
                    { key: 'manifest',    label: '📋 manifest.json' },
                    { key: 'syllabusMap', label: '🗺️ syllabus-map.json' },
                    { key: 'dotPoints',   label: '📚 dot-points.json' },
                  ].map(tab => (
                    <JsonReviewTab
                      key={tab.key}
                      label={tab.label}
                      active={activeTab === tab.key}
                      onClick={() => setActiveTab(tab.key)}
                    />
                  ))}
                </div>

                {/* JSON viewer */}
                <div style={{
                  background:   'var(--bg-deep)',
                  border:       '1px solid var(--border)',
                  borderRadius: '0 8px 8px 8px',
                  padding:      '16px',
                  maxHeight:    '380px',
                  overflowY:    'auto',
                  overflowX:    'auto',
                }}>
                  <pre style={{
                    margin:     0,
                    fontSize:   '12px',
                    lineHeight: 1.6,
                    color:      'var(--text-secondary)',
                    fontFamily: 'var(--font-mono, "DM Mono", monospace)',
                    whiteSpace: 'pre-wrap',
                    wordBreak:  'break-word',
                  }}>
                    {activeTab === 'manifest'    && JSON.stringify(generated.manifest,    null, 2)}
                    {activeTab === 'syllabusMap' && JSON.stringify(generated.syllabusMap, null, 2)}
                    {activeTab === 'dotPoints'   && JSON.stringify(generated.dotPoints,   null, 2)}
                  </pre>
                </div>

                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  💡 Review the content above. Click <strong style={{ color: 'var(--success)' }}>Approve & Save</strong> to write these files to disk, or <strong style={{ color: 'var(--error)' }}>Cancel</strong> to discard.
                </div>
              </div>
            )}

            {/* ── Saving ──────────────────────────────────── */}
            {phase === 'saving' && (
              <div style={{ textAlign: 'center', padding: '40px 20px', animation: 'kb-fadein 0.2s ease' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>💾</div>
                <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  Writing files to disk...
                </div>
              </div>
            )}

            {/* ── Done ────────────────────────────────────── */}
            {phase === 'done' && (
              <div style={{ textAlign: 'center', padding: '32px 20px', animation: 'kb-fadein 0.2s ease' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <div style={{ fontSize: '16px', color: 'var(--success)', fontWeight: 600, marginBottom: '8px' }}>
                  Knowledge base saved!
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  <code style={{ color: 'var(--teal)', fontSize: '12px' }}>{savePath}</code>
                </div>
                <div style={{
                  padding:      '10px 16px',
                  background:   'var(--info-soft)',
                  borderRadius: '8px',
                  fontSize:     '13px',
                  color:        'var(--text-secondary)',
                }}>
                  ℹ Restart OpenTutor or switch subjects to load <strong style={{ color: 'var(--text-primary)' }}>{generated?.manifest?.name}</strong>.
                </div>
              </div>
            )}

          </div>

          {/* ── Footer buttons ──────────────────────────── */}
          <div style={{
            padding:      '16px 24px',
            borderTop:    '1px solid var(--border)',
            display:      'flex',
            justifyContent: 'flex-end',
            gap:          '10px',
            flexShrink:   0,
          }}>

            {phase === 'review' && (
              <>
                <button
                  onClick={handleCancel}
                  style={{
                    background:   'transparent',
                    border:       '1px solid var(--error)',
                    borderRadius: '10px',
                    color:        'var(--error)',
                    cursor:       'pointer',
                    fontSize:     '14px',
                    padding:      '10px 20px',
                  }}
                >
                  ✕ Cancel
                </button>
                <button
                  onClick={handleApprove}
                  style={{
                    background:   'var(--success)',
                    border:       'none',
                    borderRadius: '10px',
                    color:        '#0d1117',
                    cursor:       'pointer',
                    fontSize:     '14px',
                    fontWeight:   700,
                    padding:      '10px 24px',
                  }}
                >
                  ✓ Approve & Save
                </button>
              </>
            )}

            {phase === 'done' && (
              <button
                onClick={onClose}
                style={{
                  background:   'var(--accent)',
                  border:       'none',
                  borderRadius: '10px',
                  color:        '#1a1a2e',
                  cursor:       'pointer',
                  fontSize:     '14px',
                  fontWeight:   700,
                  padding:      '10px 24px',
                }}
              >
                Done
              </button>
            )}

            {(phase === 'generating' || phase === 'saving') && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                {phase === 'generating' ? 'Generation in progress — please wait...' : 'Saving...'}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}