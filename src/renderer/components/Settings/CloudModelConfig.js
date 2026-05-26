// Settings/CloudModelConfig.js
// Manage API keys for cloud model providers.
// Keys are stored locally via electron-store, never sent
// anywhere except the respective provider's API endpoint.

import React, { useState, useEffect, useCallback } from 'react';
import ipc from '../../ipc';


const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '🔵',
    description: 'Excellent maths reasoning at very low cost. Recommended cloud option.',
    docsUrl: 'https://platform.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    recommended: true,
    pricingNote: '~$0.14 per million tokens (input)',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '⚫',
    description: 'GPT-4o and o1-mini. Powerful but more expensive.',
    docsUrl: 'https://platform.openai.com',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
    recommended: false,
    pricingNote: 'From $0.15 per million tokens (gpt-4o-mini)',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    logo: '🟠',
    description: 'Claude Haiku and Sonnet. Strong at explanation and reasoning.',
    docsUrl: 'https://console.anthropic.com',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-5'],
    recommended: false,
    pricingNote: 'From $0.25 per million tokens (Haiku)',
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    logo: '🔴',
    description: 'Qwen models. Strong maths performance, competitive pricing.',
    docsUrl: 'https://dashscope.aliyuncs.com',
    models: ['qwen-plus', 'qwen-turbo'],
    recommended: false,
    pricingNote: 'Competitive rates',
  },
];

function ProviderCard({ provider, savedKey, savedModel, onSave, onTest }) {
  const [apiKey, setApiKey]       = useState(savedKey || '');
  const [selectedModel, setModel] = useState(savedModel || provider.models[0]);
  const [showKey, setShowKey]     = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testResult, setResult]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const hasKey = apiKey.trim().length > 0;

  const handleTest = useCallback(async () => {
    if (!hasKey) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await onTest(`${provider.id}/${selectedModel}`, apiKey);
      setResult(res);
    } finally {
      setTesting(false);
    }
  }, [apiKey, selectedModel, provider.id, onTest, hasKey]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(provider.id, apiKey.trim(), selectedModel);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [apiKey, selectedModel, provider.id, onSave]);

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-surface)',
      border: `1px solid ${provider.recommended ? 'var(--border-accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>{provider.logo}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{provider.name}</span>
              {provider.recommended && (
                <span style={{
                  padding: '1px 7px', borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  fontSize: '0.65rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  border: '1px solid var(--accent-glow)',
                }}>Recommended</span>
              )}
              {hasKey && savedKey && (
                <span style={{
                  padding: '1px 7px', borderRadius: 'var(--radius-full)',
                  background: 'var(--success-soft)', color: 'var(--success)',
                  fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                  border: '1px solid rgba(82,201,122,0.3)',
                }}>Configured</span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {provider.description}
            </div>
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, paddingTop: '2px' }}>
          {provider.pricingNote}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', marginBottom: '10px' }}>
        {/* API Key input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label className="input-label">API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={`Paste your ${provider.name} API key…`}
              style={{ paddingRight: '40px' }}
            />
            <button
              onClick={() => setShowKey(s => !s)}
              className="btn-icon"
              style={{
                position: 'absolute', right: '8px', top: '50%',
                transform: 'translateY(-50%)', fontSize: '0.9rem', padding: '4px',
              }}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {/* Model selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label className="input-label">Model</label>
          <select
            className="input"
            value={selectedModel}
            onChange={e => setModel(e.target.value)}
            style={{ cursor: 'pointer', minWidth: '160px' }}
          >
            {provider.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving || !hasKey}
        >
          {saving ? <span className="spinner spinner-sm" /> : saved ? '✅ Saved' : '💾 Save'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleTest}
          disabled={testing || !hasKey}
        >
          {testing ? <span className="spinner spinner-sm" /> : '🔌 Test connection'}
        </button>
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '0.78rem', color: 'var(--accent)', marginLeft: 'auto', textDecoration: 'none' }}
        >
          Get API key ↗
        </a>
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
          display: 'flex', alignItems: 'center', gap: '6px',
          animation: 'slideDown 0.2s ease',
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

function CloudModelConfig() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ipc.invoke('config:get').then(cfg => {
      setConfig(cfg || {});
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(async (providerId, apiKey, model) => {
    const updated = {
      ...config,
      cloudKeys: { ...(config.cloudKeys || {}), [providerId]: apiKey },
      cloudModels: { ...(config.cloudModels || {}), [providerId]: model },
    };
    await ipc.invoke('config:save', { config: updated });
    setConfig(updated);
  }, [config]);

  const handleTest = useCallback(async (modelId, apiKey) => {
    return await ipc.invoke('models:test', { modelId, apiKey });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1,2].map(i => <div key={i} className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-md)' }} />)}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '6px' }}>Cloud API Keys</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Add API keys to use cloud-hosted models. Your keys are stored locally on your
          computer and are only sent to the respective provider when you chat.
        </p>
      </div>

      <div style={{
        padding: '10px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>🔒</span>
        <span>API keys are stored locally in your OpenTutor config file. They are never uploaded or shared.</span>
      </div>

      {PROVIDERS.map(provider => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          savedKey={config.cloudKeys?.[provider.id] || ''}
          savedModel={config.cloudModels?.[provider.id] || provider.models[0]}
          onSave={handleSave}
          onTest={handleTest}
        />
      ))}
    </div>
  );
}

export default CloudModelConfig;