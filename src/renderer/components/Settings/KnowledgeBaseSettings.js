// src/renderer/components/Settings/KnowledgeBaseSettings.js
// Settings tab — Knowledge Base management
//
// Renders inside the Settings panel as the "🏗️ Knowledge Base" tab.
// Contains a button that opens the KnowledgeBaseGenerator modal,
// and a read-only list of currently installed subjects.

import React, { useState, useEffect, useCallback } from 'react';
import ipc from '../../ipc';
import KnowledgeBaseGenerator from '../KnowledgeBaseGenerator';

export default function KnowledgeBaseSettings() {
  const [subjects,        setSubjects]        = useState([]);
  const [showGenerator,   setShowGenerator]   = useState(false);
  const [loading,         setLoading]         = useState(true);

  // ── Load installed subjects ───────────────────────────────────
  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipc.invoke('subject:list');
      // subject:list returns an array of subject metadata objects
      const list = Array.isArray(result) ? result : (result?.subjects || []);
      setSubjects(list);
    } catch (err) {
      console.error('[KBSettings] Failed to load subjects:', err);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  // ── Called by KnowledgeBaseGenerator after successful save ───
  const handleSubjectCreated = useCallback(() => {
    setShowGenerator(false);
    loadSubjects(); // refresh the installed list
  }, [loadSubjects]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>

      {/* ── Section header ── */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          margin:     '0 0 6px',
          fontSize:   '1rem',
          fontWeight: 600,
          color:      'var(--text-primary)',
        }}>
          🏗️ Knowledge Base Generator
        </h3>
        <p style={{
          margin:   0,
          fontSize: '0.85rem',
          color:    'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          Auto-generate a complete knowledge base for any subject using AI.
          Produces <code style={{ color: 'var(--teal)', fontSize: '0.8rem' }}>manifest.json</code>,{' '}
          <code style={{ color: 'var(--teal)', fontSize: '0.8rem' }}>syllabus-map.json</code>, and{' '}
          <code style={{ color: 'var(--teal)', fontSize: '0.8rem' }}>dot-points.json</code>{' '}
          — all content is shown for review before anything is saved to disk.
        </p>
      </div>

      {/* ── Generate button ── */}
      <button
        onClick={() => setShowGenerator(true)}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          background:   'var(--accent)',
          border:       'none',
          borderRadius: '12px',
          color:        'var(--btn-text)',
          cursor:       'pointer',
          fontSize:     '0.9rem',
          fontWeight:   700,
          padding:      '13px 24px',
          marginBottom: '32px',
          transition:   'all 0.2s',
          boxShadow:    '0 2px 12px var(--accent-glow)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px var(--accent-glow)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 2px 12px var(--accent-glow)'; }}
      >
        <span style={{ fontSize: '1.1rem' }}>⚡</span>
        Generate New Subject
      </button>

      {/* ── Divider ── */}
      <div style={{
        borderTop:    '1px solid var(--border)',
        marginBottom: '20px',
      }} />

      {/* ── Installed subjects list ── */}
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{
          margin:     '0 0 14px',
          fontSize:   '0.85rem',
          fontWeight: 600,
          color:      'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Installed Subjects ({loading ? '…' : subjects.length})
        </h4>

        {loading && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 0' }}>
            Loading…
          </div>
        )}

        {!loading && subjects.length === 0 && (
          <div style={{
            padding:      '16px',
            background:   'var(--bg-elevated)',
            borderRadius: '10px',
            fontSize:     '0.85rem',
            color:        'var(--text-muted)',
            textAlign:    'center',
          }}>
            No subjects found in the knowledge base.
          </div>
        )}

        {!loading && subjects.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subjects.map(subject => (
              <div
                key={subject.id}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '12px',
                  padding:      '12px 16px',
                  background:   'var(--bg-elevated)',
                  border:       '1px solid var(--border)',
                  borderRadius: '10px',
                }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>
                  {subject.icon || '📚'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize:   '0.9rem',
                    fontWeight: 600,
                    color:      'var(--text-primary)',
                  }}>
                    {subject.name}
                  </div>
                  <div style={{
                    fontSize:  '0.78rem',
                    color:     'var(--text-muted)',
                    marginTop: '2px',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {subject.id}
                  </div>
                </div>
                <span style={{
                  fontSize:     '0.75rem',
                  color:        'var(--success)',
                  background:   'var(--success-soft)',
                  border:       '1px solid var(--success)',
                  borderRadius: '6px',
                  padding:      '3px 8px',
                  fontWeight:   600,
                  flexShrink:   0,
                }}>
                  ✓ Installed
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Generator modal ── */}
      {showGenerator && (
        <KnowledgeBaseGenerator
          onClose={() => setShowGenerator(false)}
          onSubjectCreated={handleSubjectCreated}
        />
      )}

    </div>
  );
}