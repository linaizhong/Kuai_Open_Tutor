// Settings/TeachingModelSettings.js
// Teaching mode selection UI
// Matches the style of ModelSettings.js with cards for each mode
//
// MODIFIED: Added Test-Led Mode card and configuration

import React, { useState, useEffect, useCallback } from 'react';
import ipc from '../../ipc';

// ── Mode card component ──────────────────────────────────────
function ModeCard({ mode, isActive, onSelect, onTest }) {
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSelect = useCallback(() => {
    onSelect(mode.id);
    setIsExpanded(true);
  }, [mode.id, onSelect]);

  return (
    <div style={{
      padding: '20px',
      borderRadius: 'var(--radius-lg)',
      background: isActive ? 'linear-gradient(135deg, var(--accent-soft), rgba(245,166,35,0.02))' : 'var(--bg-surface)',
      border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      position: 'relative',
      minHeight: '220px',
      display: 'flex',
      flexDirection: 'column',
    }}
    onClick={handleSelect}
    onMouseEnter={e => {
      if (!isActive) {
        e.currentTarget.style.borderColor = 'var(--border-bright)';
        e.currentTarget.style.background = 'var(--bg-elevated)';
      }
    }}
    onMouseLeave={e => {
      if (!isActive) {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--bg-surface)';
      }
    }}
    >
      {/* Active badge */}
      {isActive && (
        <div style={{
          position: 'absolute',
          top: -10,
          right: 20,
          background: 'var(--accent)',
          color: 'var(--btn-text)',
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '4px 12px',
          borderRadius: 'var(--radius-full)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          boxShadow: 'var(--shadow-accent)',
        }}>
          Active
        </div>
      )}

      {/* Icon and title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontSize: '2rem' }}>{mode.icon}</span>
        <span style={{
          fontSize: '1.2rem',
          fontWeight: 600,
          fontFamily: 'var(--font-display)',
          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
        }}>
          {mode.name}
        </span>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        marginBottom: '16px',
        flex: 1,
      }}>
        {mode.description}
      </p>

      {/* Characteristics list */}
      <ul style={{
        margin: 0,
        paddingLeft: '20px',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
        marginBottom: '20px',
      }}>
        {mode.characteristics.map((c, i) => (
          <li key={i} style={{ marginBottom: '4px' }}>{c}</li>
        ))}
      </ul>

      {/* Select button */}
      {!isActive && (
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 'auto' }}
          onClick={(e) => { e.stopPropagation(); handleSelect(); }}
        >
          Select {mode.name}
        </button>
      )}
    </div>
  );
}

// ── Configuration panel (for Teacher-Led mode) ───────────────
function TeacherLedConfig({ config, onConfigChange }) {
  return (
    <div style={{
      marginTop: '24px',
      padding: '20px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      animation: 'slideDown 0.3s ease',
    }}>
      <h4 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.95rem',
        marginBottom: '16px',
        color: 'var(--accent)',
      }}>
        ⚙️ Teacher-Led Settings
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Teaching Pace */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Teaching Pace
          </label>
          <select
            value={config.teachingPace || 'Standard'}
            onChange={(e) => onConfigChange('teachingPace', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="Slow">Slow — more examples, step-by-step</option>
            <option value="Standard">Standard — balanced pace</option>
            <option value="Fast">Fast — move quickly through material</option>
          </select>
        </div>

        {/* Interaction Level */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Interaction Style
          </label>
          <select
            value={config.interactionLevel || 'Balanced'}
            onChange={(e) => onConfigChange('interactionLevel', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="Encourage questions">Encourage questions — interrupt anytime</option>
            <option value="Balanced">Balanced — ask at natural pauses</option>
            <option value="Focused listening">Focused listening — save questions for end</option>
          </select>
        </div>

        {/* Homework Frequency */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Homework Frequency
          </label>
          <select
            value={config.homeworkFrequency || 'After each session'}
            onChange={(e) => onConfigChange('homeworkFrequency', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="After each session">After each session — daily practice</option>
            <option value="2-3 times weekly">2-3 times weekly — lighter workload</option>
            <option value="No homework">No homework — focus on in-session learning</option>
          </select>
        </div>
      </div>

      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginTop: '16px',
        fontStyle: 'italic',
      }}>
        These settings help Tute adapt to your preferred learning style.
      </p>
    </div>
  );
}

// ===== NEW: Configuration panel for Test-Led mode =====
function TestLedConfig({ config, onConfigChange }) {
  return (
    <div style={{
      marginTop: '24px',
      padding: '20px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      animation: 'slideDown 0.3s ease',
    }}>
      <h4 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.95rem',
        marginBottom: '16px',
        color: 'var(--accent)',
      }}>
        ⚙️ Test-Led Settings
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Default Test Type */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Default Test Type
          </label>
          <select
            value={config.defaultTestType || 'diagnostic'}
            onChange={(e) => onConfigChange('defaultTestType', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="diagnostic">Diagnostic — broad assessment</option>
            <option value="topic">Topic — focused on specific topics</option>
            <option value="mixed">Mixed — combination of weak topics</option>
            <option value="mastery">Mastery — verify understanding</option>
          </select>
        </div>

        {/* Adaptive Difficulty */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Adaptive Difficulty
          </label>
          <select
            value={config.adaptiveDifficulty ? 'true' : 'false'}
            onChange={(e) => onConfigChange('adaptiveDifficulty', e.target.value === 'true')}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="true">Yes — adjust difficulty based on performance</option>
            <option value="false">No — fixed difficulty throughout</option>
          </select>
        </div>

        {/* Time Limit */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Time Limit Per Question (seconds)
          </label>
          <input
            type="number"
            min="30"
            max="300"
            step="10"
            value={config.timeLimitPerQuestion || 120}
            onChange={(e) => onConfigChange('timeLimitPerQuestion', parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Show Hints */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Show Hints During Tests
          </label>
          <select
            value={config.showHints ? 'true' : 'false'}
            onChange={(e) => onConfigChange('showHints', e.target.value === 'true')}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="true">Yes — provide hints when requested</option>
            <option value="false">No — no hints available</option>
          </select>
        </div>

        {/* Mastery Threshold */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Mastery Threshold (%)
          </label>
          <input
            type="number"
            min="60"
            max="95"
            step="5"
            value={config.masteryThreshold || 80}
            onChange={(e) => onConfigChange('masteryThreshold', parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Auto Remediation */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Auto-Remediation
          </label>
          <select
            value={config.autoRemediation ? 'true' : 'false'}
            onChange={(e) => onConfigChange('autoRemediation', e.target.value === 'true')}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="true">Yes — automatically switch to Teacher-Led for weak topics</option>
            <option value="false">No — manual remediation only</option>
          </select>
        </div>

        {/* Verification Questions */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '6px',
          }}>
            Verification Questions
          </label>
          <input
            type="number"
            min="2"
            max="10"
            step="1"
            value={config.verificationQuestions || 5}
            onChange={(e) => onConfigChange('verificationQuestions', parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginTop: '16px',
        fontStyle: 'italic',
      }}>
        These settings control how tests are generated and how remediation works.
      </p>
    </div>
  );
}

// ── Live preview component ───────────────────────────────────
function ModePreview({ modeId, config }) {
  return (
    <div style={{
      marginTop: '24px',
      padding: '20px',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '12px',
      }}>
        Live Preview
      </div>

      {modeId === 'student-led' && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <div style={{ fontSize: '2rem' }}>🎯</div>
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: '18px 18px 18px 4px',
            padding: '14px 18px',
            maxWidth: '300px',
            border: '1px solid var(--border)',
          }}>
            <p style={{ margin: '0 0 8px 0' }}>
              Hi! What would you like to work on today?
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 10px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}>Explain derivatives</span>
              <span style={{
                padding: '4px 10px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}>Practice questions</span>
            </div>
          </div>
        </div>
      )}

      {modeId === 'teacher-led' && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <div style={{ fontSize: '2rem' }}>👩‍🏫</div>
          <div style={{ flex: 1 }}>
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: '18px 18px 4px 18px',
              padding: '14px 18px',
              border: '1px solid var(--border)',
              marginBottom: '8px',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <span style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                }}>
                  Teaching Phase
                </span>
                <span>25% complete</span>
              </div>
              <p style={{ margin: 0 }}>
                Today we're learning about differentiation. The derivative measures how a function changes...
              </p>
            </div>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              display: 'flex',
              gap: '8px',
            }}>
              <span>Pace: {config.teachingPace || 'Standard'}</span>
              <span>•</span>
              <span>Homework: {config.homeworkFrequency || 'After session'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW: Test mode preview ===== */}
      {modeId === 'test-led' && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <div style={{ fontSize: '2rem' }}>📝</div>
          <div style={{ flex: 1 }}>
            <div style={{
              background: 'var(--bg-elevated)',
              borderRadius: '18px 18px 4px 18px',
              padding: '14px 18px',
              border: '1px solid var(--border)',
              marginBottom: '8px',
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                marginBottom: '6px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <span style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                }}>
                  Testing Phase
                </span>
                <span>Q2 of 5</span>
                <span>•</span>
                <span>⏱️ 1:45</span>
              </div>
              <p style={{ margin: 0 }}>
                Find the derivative of f(x) = x³ + 2x² - 5x + 1
              </p>
              <div style={{
                marginTop: '8px',
                display: 'flex',
                gap: '6px',
              }}>
                <span style={{
                  padding: '2px 8px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}>A) 3x² + 4x - 5</span>
                <span style={{
                  padding: '2px 8px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}>B) x³ + 2x² - 5</span>
              </div>
            </div>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              display: 'flex',
              gap: '8px',
            }}>
              <span>Test type: {config.defaultTestType || 'diagnostic'}</span>
              <span>•</span>
              <span>Threshold: {config.masteryThreshold || 80}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
function TeachingModelSettings() {
  const [models, setModels] = useState([]);
  const [currentModelId, setCurrentModelId] = useState(null);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      // Get available teaching modes
      const available = await ipc.invoke('teaching:getAvailable');
      setModels(available?.models || []);

      // Get current mode and config
      const current = await ipc.invoke('teaching:getCurrent');
      setCurrentModelId(current?.modelId || 'student-led');

      // Load saved config
      const configRes = await ipc.invoke('config:get');
      const savedConfig = configRes?.config?.teachingConfig || {};
      setConfig(savedConfig);
    } catch (err) {
      console.error('[TeachingModelSettings] Failed to load:', err);
      setMessage('Error loading teaching modes');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleModeSelect = useCallback(async (modelId) => {
    try {
      const result = await ipc.invoke('teaching:setModel', { modelId });
      if (result?.success) {
        setCurrentModelId(modelId);
        const modeName = modelId === 'student-led' ? 'Student-Led' :
                        modelId === 'teacher-led' ? 'Teacher-Led' :
                        modelId === 'test-led' ? 'Test-Led' : modelId;
        setMessage(`✅ Switched to ${modeName} mode`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage(`❌ Failed to switch: ${err.message}`);
    }
  }, []);

  const handleConfigChange = useCallback((key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);

    // Save config
    ipc.invoke('teaching:saveConfig', {
      modelId: currentModelId,
      config: newConfig
    }).catch(err => {
      console.error('Failed to save config:', err);
    });
  }, [config, currentModelId]);

  if (loading) {
    return (
      <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {[1, 2, 3].map(i => ( // Increased to 3 skeletons for 3 modes
          <div key={i} className="skeleton" style={{ height: '260px', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  // Get mode data from API or use defaults
  const studentLed = models.find(m => m.id === 'student-led') || {
    id: 'student-led',
    name: 'Student-Led Mode',
    description: 'You ask questions, Tute answers. Perfect for revision and targeted help.',
    icon: '🎯',
    characteristics: [
      'Flexible Q&A — ask anything',
      'You control the learning direction',
      'Ideal for revision and homework help'
    ]
  };

  const teacherLed = models.find(m => m.id === 'teacher-led') || {
    id: 'teacher-led',
    name: 'Teacher-Led Mode',
    description: 'Tute leads the learning with structured lessons. Perfect for learning new topics.',
    icon: '👩‍🏫',
    characteristics: [
      'Structured lessons with clear objectives',
      'Teaching → Practice → Assessment phases',
      'Automatic homework generation',
      'You can interrupt to ask questions'
    ]
  };

  // ===== NEW: Test-Led mode data =====
  const testLed = models.find(m => m.id === 'test-led') || {
    id: 'test-led',
    name: 'Test-Led Mode',
    description: 'Learn by testing - identify gaps, get targeted teaching, and verify mastery.',
    icon: '📝',
    characteristics: [
      'Diagnostic tests reveal your weak areas',
      'Questions adapt to your performance',
      'Detailed error analysis for every mistake',
      'Automatic switching to Teacher-Led mode for remediation',
      'Verification tests confirm you\'ve mastered the material'
    ]
  };

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '6px' }}>
          Teaching Mode
        </h3>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          Choose how you want to learn. Each mode offers a different approach to mastering your subjects.
        </p>
      </div>

      {/* Status message */}
      {message && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: message.includes('✅') ? 'var(--success-soft)' : 'var(--error-soft)',
          border: `1px solid ${message.includes('✅') ? 'rgba(82,201,122,0.3)' : 'rgba(255,107,107,0.3)'}`,
          fontSize: '0.85rem',
          color: message.includes('✅') ? 'var(--success)' : 'var(--error)',
          animation: 'slideDown 0.2s ease',
        }}>
          {message}
        </div>
      )}

      {/* Mode cards - now 3 columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
      }}>
        <ModeCard
          mode={studentLed}
          isActive={currentModelId === 'student-led'}
          onSelect={handleModeSelect}
        />
        <ModeCard
          mode={teacherLed}
          isActive={currentModelId === 'teacher-led'}
          onSelect={handleModeSelect}
        />
        {/* ===== NEW: Test-Led card ===== */}
        <ModeCard
          mode={testLed}
          isActive={currentModelId === 'test-led'}
          onSelect={handleModeSelect}
        />
      </div>

      {/* Configuration panels */}
      {currentModelId === 'teacher-led' && (
        <TeacherLedConfig config={config} onConfigChange={handleConfigChange} />
      )}

      {/* ===== NEW: Test-Led config panel ===== */}
      {currentModelId === 'test-led' && (
        <TestLedConfig config={config} onConfigChange={handleConfigChange} />
      )}

      {/* Live preview */}
      <ModePreview modeId={currentModelId} config={config} />

      {/* Info box */}
      <div style={{
        padding: '16px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--accent)' }}>💡 Tip</strong>
        <p style={{ margin: '6px 0 0 0' }}>
          You can switch modes anytime — your progress and student model are shared between modes.
          Use <strong>Student-Led</strong> for revision, <strong>Teacher-Led</strong> for learning new topics,
          and <strong>Test-Led</strong> for exam preparation and identifying weak areas.
        </p>
      </div>
    </div>
  );
}

export default TeachingModelSettings;