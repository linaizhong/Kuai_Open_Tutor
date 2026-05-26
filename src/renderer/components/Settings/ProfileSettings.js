// Settings/ProfileSettings.js
// Student profile configuration — name and HSC exam date.
// Saves via student:profile:save → memory.saveProfile().
// Shows a live animated countdown preview so the student can see
// exactly what the sidebar will display before they hit Save.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ipc from '../../ipc';  // Fixed import path (was '../../../ipc')

// ── Countdown calculator ──────────────────────────────────────
function calcCountdown(examDate) {
  if (!examDate) return null;
  const now    = new Date();
  const exam   = new Date(examDate);
  const diffMs = exam - now;
  if (diffMs <= 0) return { expired: true };
  const totalDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks      = Math.floor(totalDays / 7);
  const days       = totalDays % 7;
  const totalWeeks = Math.floor(totalDays / 7);
  const urgency    = totalDays < 14 ? 'error'
                   : totalDays < 42 ? 'warning'
                   : 'success';
  return { totalDays, weeks: totalWeeks, days, urgency, exam };
}

// ── Colour helpers ────────────────────────────────────────────
const URGENCY_COLOR = {
  error:   'var(--error,   #e05050)',
  warning: 'var(--warning, #f5a623)',
  success: 'var(--success, #4caf87)',
};

// ── Live countdown preview card ───────────────────────────────
function CountdownPreview({ examDate, studentName }) {
  const cd = calcCountdown(examDate);

  if (!examDate) {
    return (
      <div style={previewShell('#1a2332', 'var(--border, #2a3a4a)')}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #5a6a7a)', textAlign: 'center', padding: '12px 0' }}>
          Set an exam date to see your countdown
        </div>
      </div>
    );
  }

  if (cd.expired) {
    return (
      <div style={previewShell('#1a2332', 'var(--border, #2a3a4a)')}>
        <div style={{ fontSize: '0.75rem', color: 'var(--error, #e05050)', textAlign: 'center', padding: '12px 0' }}>
          ✓ Exam date has passed
        </div>
      </div>
    );
  }

  const color = URGENCY_COLOR[cd.urgency];
  const examStr = cd.exam.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div style={previewShell(`${color}08`, `${color}25`)}>
      {/* Label */}
      <div style={{
        fontSize: '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: color,
        marginBottom: '10px',
        opacity: 0.85,
      }}>
        Sidebar Preview
      </div>

      {/* Big number */}
      <div style={{
        fontFamily: 'var(--font-display, Georgia)',
        fontSize: '3rem',
        fontWeight: 800,
        color: color,
        lineHeight: 1,
        textAlign: 'center',
        letterSpacing: '-0.02em',
      }}>
        {cd.weeks > 0 ? cd.weeks : cd.totalDays}
        <span style={{ fontSize: '1.2rem', marginLeft: '4px', fontWeight: 500 }}>
          {cd.weeks > 0 ? 'w' : 'd'}
        </span>
      </div>

      {/* Sub-label */}
      <div style={{
        fontSize: '0.7rem',
        color: 'var(--text-muted, #5a6a7a)',
        textAlign: 'center',
        marginTop: '4px',
      }}>
        until HSC
      </div>

      {/* Breakdown */}
      {cd.weeks > 0 && cd.days > 0 && (
        <div style={{
          fontSize: '0.68rem',
          color: 'var(--text-muted, #5a6a7a)',
          textAlign: 'center',
          marginTop: '2px',
        }}>
          ({cd.weeks * 7 + cd.days} days total · {cd.days}d remaining this week)
        </div>
      )}

      {/* Exam date line */}
      <div style={{
        marginTop: '12px',
        padding: '7px 10px',
        borderRadius: 6,
        background: `${color}10`,
        border: `1px solid ${color}20`,
        fontSize: '0.72rem',
        color: 'var(--text-secondary, #8a9ab0)',
        textAlign: 'center',
      }}>
        📅 {examStr}
      </div>

      {/* Urgency message */}
      {cd.urgency === 'error' && (
        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: URGENCY_COLOR.error, textAlign: 'center', fontWeight: 600 }}>
          ⚡ Less than 2 weeks — focus mode!
        </div>
      )}
      {cd.urgency === 'warning' && (
        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: URGENCY_COLOR.warning, textAlign: 'center' }}>
          📚 Under 6 weeks — time to accelerate.
        </div>
      )}
      {cd.urgency === 'success' && (
        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: URGENCY_COLOR.success, textAlign: 'center' }}>
          🌱 Good runway — build solid foundations.
        </div>
      )}

      {/* Student name */}
      {studentName && (
        <div style={{
          marginTop: '10px',
          padding: '6px 10px',
          borderRadius: 6,
          background: 'var(--bg-elevated, #1a2332)',
          border: '1px solid var(--border, #2a3a4a)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary, #8a9ab0)',
          textAlign: 'center',
        }}>
          👤 {studentName}
        </div>
      )}
    </div>
  );
}

function previewShell(bg, border) {
  return {
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: '16px',
    transition: 'all 0.3s ease',
  };
}

// ── Field wrapper ─────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{
        display: 'block',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--text-secondary, #8a9ab0)',
        marginBottom: '6px',
        letterSpacing: '0.02em',
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted, #5a6a7a)',
          marginTop: '5px',
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ── Shared input style ────────────────────────────────────────
function inputStyle(focused) {
  return {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: `1px solid ${focused ? 'var(--accent, #f5a623)' : 'var(--border, #2a3a4a)'}`,
    background: 'var(--bg-elevated, #1a2332)',
    color: 'var(--text-primary, #e8edf3)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body, inherit)',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box',
    boxShadow: focused ? '0 0 0 3px rgba(245,166,35,0.1)' : 'none',
  };
}

// ── Quick-pick HSC dates ──────────────────────────────────────
// HSC written exams typically start mid-October each year.
function getQuickDates() {
  const year  = new Date().getFullYear();
  const dates = [];
  for (let y = year; y <= year + 2; y++) {
    dates.push({ label: `HSC ${y} (Oct 14)`, value: `${y}-10-14` });
    dates.push({ label: `HSC ${y} (Oct 15)`, value: `${y}-10-15` });
  }
  // Only show future dates
  const now = Date.now();
  return dates.filter(d => new Date(d.value) > now).slice(0, 4);
}

// ── Main component ────────────────────────────────────────────
export default function ProfileSettings({ subjectsList = [], onSubjectsChange }) {
  const [name,             setName]             = useState('');
  const [examDate,         setExamDate]         = useState('');
  const [enrolledSubjects, setEnrolledSubjects] = useState(['maths-advanced']);
  const [status,           setStatus]           = useState('idle'); // idle | saving | saved | error
  const [errMsg,           setErrMsg]           = useState('');
  const [focusName,        setFocusName]        = useState(false);
  const [focusDate,        setFocusDate]        = useState(false);
  const [loaded,           setLoaded]           = useState(false);
  const timerRef = useRef(null);

  // Load existing profile + enrolled subjects on mount
  useEffect(() => {
    Promise.all([
      ipc.invoke('student:model', { studentId: 'default' }).catch(() => null),
      ipc.invoke('subject:info').catch(() => null),
    ]).then(([modelRes, subjectRes]) => {
      const p = modelRes?.studentModel?.profile || modelRes?.profile || {};
      if (p.name && p.name !== 'Student') setName(p.name);
      if (p.examDate) setExamDate(p.examDate);
      if (subjectRes?.enrolledSubjects) setEnrolledSubjects(subjectRes.enrolledSubjects);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const toggleSubject = useCallback((subjectId) => {
    // Find the subject in the list - if it's the default maths-advanced, it's always enrolled
    const subject = subjectsList.find(s => s.id === subjectId);
    if (!subject) return;

    // If this is the only subject or it's required, don't allow removal
    if (subjectId === 'maths-advanced' && enrolledSubjects.length === 1) return;

    setEnrolledSubjects(prev =>
      prev.includes(subjectId) ? prev.filter(s => s !== subjectId) : [...prev, subjectId]
    );

    // Notify parent of change
    if (onSubjectsChange) {
      onSubjectsChange(prev =>
        prev.includes(subjectId) ? prev.filter(s => s !== subjectId) : [...prev, subjectId]
      );
    }
  }, [subjectsList, enrolledSubjects, onSubjectsChange]);

  const handleSave = useCallback(async () => {
    if (status === 'saving') return;
    setStatus('saving');
    setErrMsg('');
    try {
      const profile = {
        name:     name.trim() || 'Student',
        examDate: examDate || null,
      };
      // Save profile and enrolled subjects in parallel
      const enrolled = Array.from(new Set(['maths-advanced', ...enrolledSubjects]));
      const [profileRes, configRes] = await Promise.all([
        ipc.invoke('student:profile:save', { studentId: 'default', profile }),
        ipc.invoke('config:save', { config: { enrolledSubjects: enrolled } }),
      ]);
      if (profileRes?.success === false) throw new Error(profileRes.error || 'Profile save failed');
      if (configRes?.success  === false) throw new Error(configRes.error  || 'Config save failed');
      setStatus('saved');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), 2500);
    } catch (e) {
      setErrMsg(e.message || 'Could not save profile.');
      setStatus('error');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), 3500);
    }
  }, [name, examDate, enrolledSubjects, status]);

  // Cleanup
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const quickDates = getQuickDates();
  const hasChanges = loaded && (name.trim() || examDate);

  return (
    <div style={{
      padding: '20px 24px',
      maxWidth: '1100px',
      opacity: loaded ? 1 : 0,
      transition: 'opacity 0.2s ease',
    }}>

      {/* ── Section header ── */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          fontFamily: 'var(--font-display, Georgia)',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary, #e8edf3)',
          margin: '0 0 6px',
        }}>
          Student Profile
        </h3>
        <p style={{
          fontSize: '0.78rem',
          color: 'var(--text-muted, #5a6a7a)',
          margin: 0,
          lineHeight: 1.5,
        }}>
          Your name and exam date personalise OpenTutor's feedback and power the
          sidebar countdown.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>

        {/* ── Left column: form ── */}
        <div>

          {/* Name field */}
          <Field
            label="Your Name"
            hint="Used in feedback messages and progress reports."
          >
            <input
              type="text"
              value={name}
              placeholder="e.g. Alex"
              maxLength={40}
              onChange={e => setName(e.target.value)}
              onFocus={() => setFocusName(true)}
              onBlur={() => setFocusName(false)}
              style={inputStyle(focusName)}
            />
          </Field>

          {/* Exam date field */}
          <Field
            label="HSC Exam Date"
            hint="The first day of your HSC written exams."
          >
            <input
              type="date"
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              onFocus={() => setFocusDate(true)}
              onBlur={() => setFocusDate(false)}
              style={{
                ...inputStyle(focusDate),
                colorScheme: 'dark',
              }}
            />

            {/* Quick-pick chips */}
            {quickDates.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {quickDates.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setExamDate(d.value)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: 20,
                      border: `1px solid ${examDate === d.value ? 'var(--accent, #f5a623)' : 'var(--border, #2a3a4a)'}`,
                      background: examDate === d.value ? 'var(--accent-soft, rgba(245,166,35,0.1))' : 'var(--bg-elevated, #1a2332)',
                      color: examDate === d.value ? 'var(--accent, #f5a623)' : 'var(--text-muted, #5a6a7a)',
                      fontSize: '0.68rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontFamily: 'var(--font-body, inherit)',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </Field>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: status === 'saved'  ? 'var(--success, #4caf87)'
                        : status === 'error'  ? 'var(--error, #e05050)'
                        : status === 'saving' ? 'var(--bg-elevated, #1a2332)'
                        : 'var(--accent, #f5a623)',
              color: status === 'saving' ? 'var(--text-muted)' : 'var(--btn-text)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: status === 'saving' ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-body, inherit)',
              letterSpacing: '0.02em',
            }}
          >
            {status === 'saving' ? '⏳ Saving…'
           : status === 'saved'  ? '✓ Saved!'
           : status === 'error'  ? '✗ Error'
           : 'Save Profile'}
          </button>

          {status === 'error' && errMsg && (
            <div style={{
              marginTop: '8px',
              fontSize: '0.72rem',
              color: 'var(--error, #e05050)',
            }}>
              {errMsg}
            </div>
          )}

          {/* ── Subject Enrolment — in left column ── */}
          {subjectsList.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontSize: '0.78rem', fontWeight: 600,
                color: 'var(--text-secondary, #8a9ab0)',
                marginBottom: '8px', letterSpacing: '0.02em',
              }}>
                Enrolled Subjects
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #5a6a7a)', marginBottom: '12px' }}>
                Tick the subjects you're studying. Controls the title-bar switcher.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {subjectsList.map(subj => {
                  const checked = enrolledSubjects.includes(subj.id);
                  const isRequired = subj.id === 'maths-advanced' && enrolledSubjects.length === 1;
                  return (
                    <label key={subj.id} onClick={() => toggleSubject(subj.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', borderRadius: 8,
                      border: `1px solid ${checked ? 'var(--accent, #f5a623)' : 'var(--border, #2a3a4a)'}`,
                      background: checked ? 'var(--accent-soft, rgba(245,166,35,0.07))' : 'var(--bg-elevated, #1a2332)',
                      cursor: isRequired ? 'default' : 'pointer',
                      transition: 'all 0.15s ease', userSelect: 'none',
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${checked ? 'var(--accent, #f5a623)' : 'var(--border, #2a3a4a)'}`,
                        background: checked ? 'var(--accent, #f5a623)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}>
                        {checked && <span style={{ fontSize: '11px', color: 'var(--btn-text)', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.82rem', fontWeight: 600,
                          color: checked ? 'var(--accent, #f5a623)' : 'var(--text-primary, #e8edf3)',
                        }}>
                          {subj.icon} {subj.name}
                          {isRequired && <span style={{ fontSize: '0.65rem', marginLeft: 6, color: 'var(--text-muted, #5a6a7a)', fontWeight: 400 }}>(required)</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: live preview + tips ── */}
        <div>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--text-muted, #5a6a7a)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}>
            Live Preview
          </div>
          <CountdownPreview examDate={examDate} studentName={name.trim()} />

          {/* ── Tips — in right column ── */}
          <div style={{
            marginTop: '20px',
            padding: '14px 16px',
            borderRadius: 8,
            background: 'var(--bg-elevated, #1a2332)',
            border: '1px solid var(--border, #2a3a4a)',
            fontSize: '0.73rem',
            color: 'var(--text-muted, #5a6a7a)',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--accent, #f5a623)', fontWeight: 700 }}>Tips</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '16px' }}>
              <li>The countdown turns <span style={{ color: URGENCY_COLOR.warning }}>amber</span> under 6 weeks and <span style={{ color: URGENCY_COLOR.error }}>red</span> under 2 weeks.</li>
              <li>HSC written exams typically start on 14–15 October. Check your personal timetable at NESA.</li>
              <li>Your name appears in tutor feedback to make it feel less generic.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}