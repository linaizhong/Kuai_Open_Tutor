// ProgressDashboard.js
// Displays student progress across the HSC Maths Advanced syllabus.
// Shows: mastery heatmap, exam readiness forecast, learning velocity,
// recent mistakes, and session stats.

import React, { useState, useEffect, useCallback } from 'react';
import ipc from '../ipc';


const STUDENT_ID = 'default';

// ── Topic metadata ────────────────────────────────────────────
const TOPICS = [
  { code: 'MA-F', name: 'Functions',            colour: 'var(--topic-f)', weight: 20 },
  { code: 'MA-T', name: 'Trigonometry',          colour: 'var(--topic-t)', weight: 15 },
  { code: 'MA-C', name: 'Calculus',              colour: 'var(--topic-c)', weight: 30 },
  { code: 'MA-E', name: 'Exp & Log',             colour: 'var(--topic-e)', weight: 10 },
  { code: 'MA-S', name: 'Statistics',            colour: 'var(--topic-s)', weight: 15 },
  { code: 'MA-M', name: 'Financial Maths',       colour: 'var(--topic-m)', weight: 10 },
];

const SUBTOPICS = {
  'MA-F': ['MA-F1', 'MA-F2'],
  'MA-T': ['MA-T1', 'MA-T2', 'MA-T3'],
  'MA-C': ['MA-C1', 'MA-C2', 'MA-C3', 'MA-C4'],
  'MA-E': ['MA-E1'],
  'MA-S': ['MA-S1', 'MA-S2', 'MA-S3'],
  'MA-M': ['MA-M1'],
};

const DOT_POINT_COUNTS = {
  'MA-F1': 5, 'MA-F2': 1,
  'MA-T1': 3, 'MA-T2': 2, 'MA-T3': 2,
  'MA-C1': 5, 'MA-C2': 2, 'MA-C3': 3, 'MA-C4': 3,
  'MA-E1': 3,
  'MA-S1': 2, 'MA-S2': 2, 'MA-S3': 2,
  'MA-M1': 2,
};

// ── Mastery colour helper ─────────────────────────────────────
function masteryColour(score) {
  if (score === undefined || score === null) return 'var(--bg-elevated)';
  if (score >= 0.85) return '#52c97a';
  if (score >= 0.65) return '#4ecdc4';
  if (score >= 0.40) return '#f5a623';
  if (score >  0)    return '#ff6b6b';
  return 'var(--bg-elevated)';
}

function masteryLabel(score) {
  if (score === undefined || score === null || score === 0) return 'Not started';
  if (score >= 0.85) return 'Mastered';
  if (score >= 0.65) return 'Proficient';
  if (score >= 0.40) return 'Developing';
  return 'Needs work';
}

// ── Velocity icon ─────────────────────────────────────────────
function VelocityIcon({ trend }) {
  if (trend === 'improving') return <span title="Improving">📈</span>;
  if (trend === 'stalling')  return <span title="Stalling">📉</span>;
  return <span title="Steady">➡️</span>;
}

// ── Radial progress ring ──────────────────────────────────────
function RadialProgress({ value, size = 80, strokeWidth = 7, colour, label, sublabel }) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: size > 70 ? '1.1rem' : '0.85rem',
            fontWeight: 700,
            color: colour,
            fontFamily: 'var(--font-display)',
          }}>
            {Math.round(value)}%
          </span>
        </div>
      </div>
      {label && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 500 }}>{label}</span>}
      {sublabel && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>{sublabel}</span>}
    </div>
  );
}

// ── Topic row ─────────────────────────────────────────────────
function TopicRow({ topic, mastery, velocity, onSelect, isSelected }) {
  const subtopics = SUBTOPICS[topic.code] || [];
  const dotPointCount = subtopics.reduce((sum, s) => sum + (DOT_POINT_COUNTS[s] || 0), 0);
  const masteredCount = Math.round((mastery || 0) * dotPointCount);
  const pct = Math.round((mastery || 0) * 100);

  return (
    <div
      onClick={() => onSelect(topic.code)}
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? `${topic.colour}12` : 'var(--bg-surface)',
        border: `1px solid ${isSelected ? topic.colour + '55' : 'var(--border)'}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.borderColor = topic.colour + '44';
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Top row: name + stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '10px', height: '10px',
            borderRadius: '50%',
            background: topic.colour,
            boxShadow: `0 0 6px ${topic.colour}88`,
            flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {topic.name}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            ({topic.weight}% of exam)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {velocity && <VelocityIcon trend={velocity.trend} />}
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: topic.colour }}>
            {pct}%
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {masteredCount}/{dotPointCount} pts
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${topic.colour}, ${topic.colour}bb)`,
          }}
        />
      </div>
    </div>
  );
}

// ── Dot-point heatmap cell ────────────────────────────────────
function DotPointCell({ code, score, label }) {
  const [hovered, setHovered] = useState(false);
  const colour = masteryColour(score);
  const pct = score != null ? Math.round(score * 100) : null;

  return (
    <div
      data-tooltip={`${code}: ${masteryLabel(score)}${pct != null ? ` (${pct}%)` : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? `${colour}33` : `${colour}18`,
        border: `1px solid ${colour}44`,
        transition: 'all 0.15s ease',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: colour, fontWeight: 600 }}>
          {code}
        </span>
        {pct != null && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{pct}%</span>
        )}
      </div>
      <div style={{ marginTop: '4px' }}>
        <div style={{
          height: '3px',
          background: 'var(--bg-deep)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${pct || 0}%`,
            background: colour,
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.8s ease',
          }} />
        </div>
      </div>
      {label && (
        <div style={{
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          marginTop: '3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, subvalue, colour = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{ fontSize: '1.3rem' }}>{icon}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: colour, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      {subvalue && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subvalue}</div>}
    </div>
  );
}

// ── Main ProgressDashboard component ─────────────────────────
function ProgressDashboard({ studentId = STUDENT_ID }) {
  const [loading, setLoading]             = useState(true);
  const [studentModel, setStudentModel]   = useState(null);
  const [mastery, setMastery]             = useState({});
  const [progress, setProgress]           = useState(null);
  const [forecast, setForecast]           = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [error, setError]                 = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sm, mast, prog, fc] = await Promise.all([
        ipc.invoke('student:model',       { studentId }),
        ipc.invoke('syllabus:mastery',    { studentId }),
        ipc.invoke('progress:get',        { studentId }),
        ipc.invoke('readiness:forecast',  { studentId }),
      ]);
      setStudentModel(sm);
      setMastery(mast?.topics || {});
      setProgress(prog);
      setForecast(fc);
    } catch (e) {
      setError('Could not load progress data. Make sure the app is fully initialised.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: '72px', borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: '16px', padding: '32px',
        color: 'var(--text-secondary)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem' }}>📊</div>
        <div style={{ fontSize: '0.9rem' }}>{error}</div>
        <button className="btn btn-secondary btn-sm" onClick={load}>Try again</button>
      </div>
    );
  }

  // ── Derived values ──
  const overallPct = forecast?.overall != null
    ? Math.round(forecast.overall * 100)
    : 0;

  const weeksRemaining  = studentModel?.weeksRemaining ?? '—';
  const sessionCount    = progress?.sessions?.length ?? 0;
  const totalAttempts   = progress?.totalAttempts ?? 0;
  const weakestTopics   = studentModel?.weakestTopics ?? [];

  // Dot-points for selected topic
  const selectedConfig  = TOPICS.find(t => t.code === selectedTopic);
  const selectedSubs    = selectedTopic ? (SUBTOPICS[selectedTopic] || []) : [];

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '4px' }}>
            Progress Dashboard
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            HSC Mathematics Advanced · Updated this session
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={load}
          style={{ gap: '6px' }}
        >
          ↺ Refresh
        </button>
      </div>

      {/* ── Top stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard
          icon="📅"
          label="Weeks to HSC"
          value={weeksRemaining}
          colour="var(--accent)"
          subvalue={studentModel?.examDate
            ? new Date(studentModel.examDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
            : 'Set exam date in Settings'}
        />
        <StatCard
          icon="📚"
          label="Sessions"
          value={sessionCount}
          colour="var(--teal)"
          subvalue="total study sessions"
        />
        <StatCard
          icon="✏️"
          label="Attempts"
          value={totalAttempts}
          colour="var(--topic-c)"
          subvalue="questions attempted"
        />
        <StatCard
          icon="⚡"
          label="Velocity"
          value={studentModel?.velocity?.['MA-C']?.trend === 'improving' ? '↑' : studentModel?.velocity?.['MA-C']?.trend === 'stalling' ? '↓' : '→'}
          colour={studentModel?.velocity?.['MA-C']?.trend === 'improving' ? 'var(--success)' : studentModel?.velocity?.['MA-C']?.trend === 'stalling' ? 'var(--error)' : 'var(--text-secondary)'}
          subvalue="Calculus momentum"
        />
      </div>

      {/* ── Exam readiness + weak spots ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>

        {/* Overall readiness ring */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Exam Readiness
          </div>
          <RadialProgress
            value={overallPct}
            size={100}
            colour={overallPct >= 70 ? 'var(--success)' : overallPct >= 45 ? 'var(--accent)' : 'var(--error)'}
            label="Overall"
          />
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {TOPICS.slice(0, 4).map(topic => {
              const pct = forecast?.byTopic?.[topic.code] != null
                ? Math.round(forecast.byTopic[topic.code] * 100)
                : 0;
              return (
                <div key={topic.code} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: topic.colour, width: '36px', fontFamily: 'var(--font-mono)' }}>
                    {topic.code.replace('MA-', '')}
                  </span>
                  <div style={{ flex: 1 }} className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${topic.colour}, ${topic.colour}bb)`,
                    }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '28px', textAlign: 'right' }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Topic mastery bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Topic Mastery — click to drill down
          </div>
          {TOPICS.map(topic => (
            <TopicRow
              key={topic.code}
              topic={topic}
              mastery={mastery[topic.code]}
              velocity={studentModel?.velocity?.[topic.code]}
              onSelect={code => setSelectedTopic(code === selectedTopic ? null : code)}
              isSelected={selectedTopic === topic.code}
            />
          ))}
        </div>
      </div>

      {/* ── Dot-point drill-down ── */}
      {selectedTopic && selectedConfig && (
        <div style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${selectedConfig.colour}44`,
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          animation: 'slideDown 0.25s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: selectedConfig.colour,
                boxShadow: `0 0 8px ${selectedConfig.colour}`,
              }} />
              <h3 style={{ fontFamily: 'var(--font-display)', color: selectedConfig.colour }}>
                {selectedConfig.name} — Dot-point Breakdown
              </h3>
            </div>
            <button
              className="btn-icon"
              onClick={() => setSelectedTopic(null)}
              style={{ fontSize: '1rem' }}
            >✕</button>
          </div>

          {selectedSubs.map(sub => {
            const count = DOT_POINT_COUNTS[sub] || 0;
            return (
              <div key={sub} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '0.75rem', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '8px', fontWeight: 600,
                }}>
                  {sub}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '8px',
                }}>
                  {Array.from({ length: count }, (_, idx) => {
                    const dpCode = `${sub}.${idx + 1}`;
                    const score = mastery[dpCode] ?? null;
                    return (
                      <DotPointCell
                        key={dpCode}
                        code={dpCode}
                        score={score}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
            {[
              { colour: '#52c97a', label: 'Mastered (≥85%)' },
              { colour: '#4ecdc4', label: 'Proficient (65–84%)' },
              { colour: '#f5a623', label: 'Developing (40–64%)' },
              { colour: '#ff6b6b', label: 'Needs work (<40%)' },
              { colour: 'var(--bg-elevated)', label: 'Not started' },
            ].map(({ colour, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colour, flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Priority areas ── */}
      {weakestTopics.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px',
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            🎯 Priority areas to focus on
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {weakestTopics.map(t => {
              const topic = TOPICS.find(x => x.code === t || x.code === t.slice(0, 4));
              const colour = topic?.colour || 'var(--text-secondary)';
              return (
                <span key={t} style={{
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: `${colour}18`,
                  border: `1px solid ${colour}44`,
                  color: colour,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}>
                  {t}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProgressDashboard;