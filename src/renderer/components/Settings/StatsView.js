// Settings/StatsView.js
// Usage statistics panel — shows per-model call counts,
// token usage, success/failure rates, and latency trends.

import React, { useState, useEffect, useCallback } from 'react';
import ipc from '../../ipc';


// ── Mini bar chart ────────────────────────────────────────────
function MiniBarChart({ data, colour = 'var(--accent)', height = 40 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '3px',
      height,
    }}>
      {data.map((d, i) => (
        <div
          key={i}
          data-tooltip={`${d.label}: ${d.value}`}
          style={{
            flex: 1,
            height: `${Math.max((d.value / max) * 100, 4)}%`,
            background: colour,
            borderRadius: '3px 3px 0 0',
            opacity: i === data.length - 1 ? 1 : 0.5 + (i / data.length) * 0.5,
            transition: 'height 0.6s ease',
            cursor: 'default',
          }}
        />
      ))}
    </div>
  );
}

// ── Stat number ───────────────────────────────────────────────
function BigStat({ value, label, sub, colour = 'var(--accent)', icon }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <div style={{ fontSize: '1.3rem' }}>{icon}</div>
      <div style={{
        fontSize: '1.6rem',
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: colour,
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Model row ─────────────────────────────────────────────────
function ModelStatRow({ stat }) {
  const successRate = stat.total > 0
    ? Math.round((stat.success / stat.total) * 100)
    : 0;
  const colour = successRate >= 90 ? 'var(--success)'
               : successRate >= 70 ? 'var(--warning)'
               : 'var(--error)';

  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto auto',
      alignItems: 'center',
      gap: '16px',
    }}>
      {/* Model name */}
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{stat.modelName || stat.modelId}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {stat.modelId}
        </div>
      </div>

      {/* Total calls */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{stat.total}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>calls</div>
      </div>

      {/* Success rate */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: colour }}>{successRate}%</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>success</div>
      </div>

      {/* Avg latency */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--teal)' }}>
          {stat.avgLatency ? `${stat.avgLatency}ms` : '—'}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>avg latency</div>
      </div>

      {/* Tokens */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {stat.totalTokens ? formatNumber(stat.totalTokens) : '—'}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>tokens</div>
      </div>
    </div>
  );
}

// ── Skill usage row ───────────────────────────────────────────
function SkillRow({ name, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        width: '170px',
        flexShrink: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-mono)',
      }}>
        {name}
      </span>
      <div style={{ flex: 1 }} className="progress-bar">
        <div className="progress-fill teal" style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '30px', textAlign: 'right' }}>
        {count}
      </span>
    </div>
  );
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Empty state ───────────────────────────────────────────────
function EmptyStats() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      color: 'var(--text-muted)',
      gap: '12px',
    }}>
      <div style={{ fontSize: '3rem', opacity: 0.5 }}>📊</div>
      <div style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
        No usage data yet
      </div>
      <div style={{ fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.6 }}>
        Start a conversation and statistics will appear here as you use OpenTutor.
      </div>
    </div>
  );
}

// ── Main StatsView ────────────────────────────────────────────
function StatsView() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoad(true);
    setError(null);
    try {
      const data = await ipc.invoke('stats:get');
      setStats(data);
    } catch (e) {
      setError('Could not load statistics.');
    } finally {
      setLoad(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '680px' }}>
        {[80, 120, 200].map((h, i) => (
          <div key={i} className="skeleton" style={{ height: h, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }

  const isEmpty = !stats || (
    !stats.totalCalls &&
    !stats.modelStats?.length &&
    !stats.skillStats?.length
  );

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Usage Statistics</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            All-time usage across sessions
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-md)',
          background: 'var(--error-soft)', border: '1px solid rgba(255,107,107,0.3)',
          fontSize: '0.85rem', color: 'var(--error)',
        }}>
          {error}
        </div>
      )}

      {isEmpty ? (
        <EmptyStats />
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <BigStat
              icon="💬"
              value={formatNumber(stats.totalCalls || 0)}
              label="Total calls"
              colour="var(--accent)"
            />
            <BigStat
              icon="✅"
              value={`${stats.overallSuccessRate || 0}%`}
              label="Success rate"
              colour={stats.overallSuccessRate >= 90 ? 'var(--success)' : 'var(--warning)'}
            />
            <BigStat
              icon="⚡"
              value={stats.avgLatency ? `${stats.avgLatency}ms` : '—'}
              label="Avg latency"
              colour="var(--teal)"
            />
            <BigStat
              icon="🔤"
              value={formatNumber(stats.totalTokens || 0)}
              label="Tokens used"
              colour="var(--topic-c)"
            />
          </div>

          {/* ── Daily call chart ── */}
          {stats.dailyCalls?.length > 0 && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
            }}>
              <div style={{
                fontSize: '0.78rem', color: 'var(--text-secondary)',
                fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '14px',
              }}>
                Daily Activity (last 14 days)
              </div>
              <MiniBarChart
                data={stats.dailyCalls.slice(-14).map(d => ({
                  label: d.date,
                  value: d.count,
                }))}
                colour="var(--accent)"
                height={56}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '6px',
              }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {stats.dailyCalls.slice(-14)[0]?.date || ''}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Today</span>
              </div>
            </div>
          )}

          {/* ── Per-model stats ── */}
          {stats.modelStats?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                fontSize: '0.78rem', color: 'var(--text-secondary)',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Per-model Breakdown
              </div>
              {stats.modelStats.map(s => (
                <ModelStatRow key={s.modelId} stat={s} />
              ))}
            </div>
          )}

          {/* ── Skill usage ── */}
          {stats.skillStats?.length > 0 && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px',
            }}>
              <div style={{
                fontSize: '0.78rem', color: 'var(--text-secondary)',
                fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: '14px',
              }}>
                Skill Usage
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.skillStats
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 12)
                  .map(s => (
                    <SkillRow
                      key={s.name}
                      name={s.name}
                      count={s.count}
                      total={stats.totalCalls || 1}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* ── Session summary ── */}
          {stats.sessionCount > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
            }}>
              <div style={{
                padding: '14px 16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Sessions</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {stats.sessionCount}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {stats.avgSessionLength ? `Avg ${stats.avgSessionLength} min/session` : ''}
                </div>
              </div>
              <div style={{
                padding: '14px 16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>First used</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stats.firstUsed
                    ? new Date(stats.firstUsed).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {stats.lastUsed
                    ? `Last: ${new Date(stats.lastUsed).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
                    : ''}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default StatsView;