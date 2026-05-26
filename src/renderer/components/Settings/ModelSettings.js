// Settings/ModelSettings.js
// Active model selection — shows all available local and cloud
// models, allows switching, and displays current model status.

import React, { useState, useEffect, useCallback } from 'react';

import ipc from '../../ipc';

function ModelCard({ model, isActive, onSwitch, onTest }) {
  const [testing, setTesting]   = useState(false);
  const [testResult, setResult] = useState(null);
  const [switching, setSwitching] = useState(false);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await onTest(model.id, model.apiKey);
      setResult(res);
    } finally {
      setTesting(false);
    }
  }, [model, onTest]);

  const handleSwitch = useCallback(async () => {
    setSwitching(true);
    try {
      await onSwitch(model.id);
    } finally {
      setSwitching(false);
    }
  }, [model, onSwitch]);

  return (
    <div style={{
      padding: '16px',
      borderRadius: 'var(--radius-md)',
      background: isActive ? 'var(--accent-soft)' : 'var(--bg-surface)',
      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1rem' }}>{model.type === 'local' ? '💻' : '☁️'}</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {model.name}
            </span>
            {isActive && (
              <span style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent)',
                color: 'var(--btn-text)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Active
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {model.id}
          </div>
          {model.description && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {model.description}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleTest}
            disabled={testing}
            style={{ minWidth: '64px' }}
          >
            {testing ? <span className="spinner spinner-sm" /> : '🔌 Test'}
          </button>
          {!isActive && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSwitch}
              disabled={switching}
              style={{ minWidth: '72px' }}
            >
              {switching ? <span className="spinner spinner-sm" /> : 'Use this'}
            </button>
          )}
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: testResult.success ? 'var(--success-soft)' : 'var(--error-soft)',
          border: `1px solid ${testResult.success ? 'rgba(82,201,122,0.3)' : 'rgba(255,107,107,0.3)'}`,
          fontSize: '0.8rem',
          color: testResult.success ? 'var(--success)' : 'var(--error)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>{testResult.success ? '✅' : '❌'}</span>
          <span>{testResult.message}</span>
          {testResult.time && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {testResult.time}ms
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ModelSettings() {
  const [models, setModels]       = useState({ local: [], cloud: [] });
  const [activeModel, setActive]  = useState(null);
  const [loading, setLoading]     = useState(true);
  const [switchMsg, setSwitchMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [modelList, config] = await Promise.all([
        ipc.invoke('models:list'),
        ipc.invoke('config:get'),
      ]);
      setModels(modelList?.models || modelList || { local: [], cloud: [] });
      setActive(modelList?.models?.activeModelId || modelList?.activeModelId || config?.config?.activeModelId || config?.config?.activeModel || null);
    } catch (e) {
      console.error('Failed to load models:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTest = useCallback(async (modelId, apiKey) => {
    return await ipc.invoke('models:test', { modelId, apiKey });
  }, []);

  const handleSwitch = useCallback(async (modelId) => {
    const result = await ipc.invoke('models:switch', { modelId });
    if (result?.success) {
      setActive(modelId);
      setSwitchMsg(result.requireRestart
        ? '⚠️ Please restart OpenTutor for the model change to take effect.'
        : `✅ Switched to ${modelId}`);
      setTimeout(() => setSwitchMsg(null), 4000);
    }
  }, []);

  const allModels = [...(models.local || []), ...(models.cloud || [])];

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '6px' }}>Active Model</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Select the AI model OpenTutor uses to answer your questions. Local models run
          entirely on your computer — no internet required. Cloud models are more powerful
          but require an API key and internet connection.
        </p>
      </div>

      {switchMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: switchMsg.startsWith('⚠️') ? 'var(--warning-soft)' : 'var(--success-soft)',
          border: `1px solid ${switchMsg.startsWith('⚠️') ? 'rgba(245,166,35,0.3)' : 'rgba(82,201,122,0.3)'}`,
          fontSize: '0.85rem',
          color: switchMsg.startsWith('⚠️') ? 'var(--warning)' : 'var(--success)',
          animation: 'slideDown 0.2s ease',
        }}>
          {switchMsg}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      ) : allModels.length === 0 ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🤖</div>
          <div style={{ fontSize: '0.9rem' }}>No models found.</div>
          <div style={{ fontSize: '0.82rem', marginTop: '6px' }}>
            Configure a local model in the <strong style={{ color: 'var(--text-secondary)' }}>Local</strong> tab,
            or add a cloud API key in the <strong style={{ color: 'var(--text-secondary)' }}>Cloud APIs</strong> tab.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {models.local?.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Local Models
              </div>
              {models.local.map(m => (
                <ModelCard
                  key={m.id}
                  model={m}
                  isActive={m.id === activeModel}
                  onSwitch={handleSwitch}
                  onTest={handleTest}
                />
              ))}
            </>
          )}
          {models.cloud?.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: '6px' }}>
                Cloud Models
              </div>
              {models.cloud.map(m => (
                <ModelCard
                  key={m.id}
                  model={m}
                  isActive={m.id === activeModel}
                  onSwitch={handleSwitch}
                  onTest={handleTest}
                />
              ))}
            </>
          )}
        </div>
      )}

      <button className="btn btn-ghost btn-sm" onClick={load} style={{ alignSelf: 'flex-start' }}>
        ↺ Reload model list
      </button>
    </div>
  );
}

export default ModelSettings;