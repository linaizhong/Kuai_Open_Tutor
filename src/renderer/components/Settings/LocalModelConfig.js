// Settings/LocalModelConfig.js
// Configure local models via Ollama.
// Shows Ollama connection status, lists installed models,
// and provides setup instructions.

import React, { useState, useEffect, useCallback } from 'react';

import ipc from '../../ipc';

const RECOMMENDED_MODELS = [
  {
    id: 'deepseek-r1:7b',
    name: 'DeepSeek R1 7B',
    description: 'Strong reasoning and maths. Best balance of speed and quality for HSC tutoring.',
    size: '4.7 GB',
    recommended: true,
    pullCommand: 'ollama pull deepseek-r1:7b',
  },
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B',
    description: 'Excellent at mathematical problems and step-by-step working.',
    size: '4.7 GB',
    recommended: true,
    pullCommand: 'ollama pull qwen2.5:7b',
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    description: 'Fast and lightweight. Good for older computers.',
    size: '2.0 GB',
    recommended: false,
    pullCommand: 'ollama pull llama3.2:3b',
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B',
    description: 'Well-rounded model with good instruction following.',
    size: '4.1 GB',
    recommended: false,
    pullCommand: 'ollama pull mistral:7b',
  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={copy}
      className="btn-icon"
      style={{ fontSize: '0.85rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}
      title="Copy to clipboard"
    >
      {copied ? '✅' : '📋'}
    </button>
  );
}

function LocalModelConfig() {
  const [ollamaStatus, setStatus]   = useState('checking');  // checking | online | offline
  const [installedModels, setInstalled] = useState([]);
  const [ollamaUrl, setOllamaUrl]   = useState('http://localhost:11434');
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState(null);

  const checkOllama = useCallback(async () => {
    setStatus('checking');
    try {
      // Use a real model ID — models:test hits /api/tags to verify Ollama is running
      const result = await ipc.invoke('models:test', {
        modelId: 'qwen2.5-coder:3b',
        apiKey: null,
      });
      // success=true  → Ollama running + model installed → green
      // success=false but message doesn't mention connection failure
      //   → Ollama is running but model not yet pulled → still show green
      // success=false and message mentions cannot reach / connection → red
      if (result?.success) {
        setStatus('online');
      } else {
        const msg = (result?.message || '').toLowerCase();
        const unreachable = msg.includes('cannot reach') || msg.includes('connection') || msg.includes('timed out') || msg.includes('econnrefused');
        setStatus(unreachable ? 'offline' : 'online');
      }
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkOllama();
    ipc.invoke('config:get').then(res => {
      const cfg = res?.config || res;
      if (cfg?.ollamaHost) {
        setOllamaUrl('http://' + cfg.ollamaHost + ':' + (cfg.ollamaPort || 11434));
      } else if (cfg?.ollamaUrl) {
        setOllamaUrl(cfg.ollamaUrl);
      }
    });
  }, [checkOllama]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const cfg = await ipc.invoke('config:get');
      await ipc.invoke('config:save', { config: { ...cfg, ollamaUrl } });
      setSaveMsg('✅ Saved');
    } catch {
      setSaveMsg('❌ Failed to save');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [ollamaUrl]);

  const statusColour = ollamaStatus === 'online' ? 'var(--success)' : ollamaStatus === 'offline' ? 'var(--error)' : 'var(--text-muted)';
  const statusLabel  = ollamaStatus === 'online' ? 'Connected' : ollamaStatus === 'offline' ? 'Not found' : 'Checking…';

  return (
    <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '6px' }}>Local Models (Ollama)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Run AI models entirely on your computer — no internet required, completely private.
          Download <a href="https://ollama.com" style={{ color: 'var(--accent)' }}>Ollama</a> first,
          then pull a model using the terminal commands below.
        </p>
      </div>

      {/* Ollama status */}
      <div style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        border: `1px solid ${statusColour}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: statusColour,
            boxShadow: `0 0 6px ${statusColour}`,
            animation: ollamaStatus === 'checking' ? 'pulse 1s infinite' : 'none',
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Ollama — {statusLabel}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ollamaUrl}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={checkOllama}>
          ↺ Check
        </button>
      </div>

      {/* Ollama URL config */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="input-label">Ollama Server URL</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="input"
            value={ollamaUrl}
            onChange={e => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
            style={{ flexShrink: 0 }}
          >
            {saving ? <span className="spinner spinner-sm" /> : 'Save'}
          </button>
        </div>
        {saveMsg && (
          <div style={{ fontSize: '0.8rem', color: saveMsg.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>
            {saveMsg}
          </div>
        )}
      </div>

      {/* Installed models */}
      {installedModels.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '8px' }}>
            Installed Models
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {installedModels.map(m => (
              <div key={m.name || m} style={{
                padding: '10px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.875rem',
              }}>
                <span style={{ color: 'var(--success)' }}>●</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {m.name || m}
                </span>
                {m.size && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {m.size}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended models */}
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '10px' }}>
          Recommended Models for HSC Tutoring
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {RECOMMENDED_MODELS.map(m => (
            <div key={m.id} style={{
              padding: '14px 16px',
              background: 'var(--bg-surface)',
              border: `1px solid ${m.recommended ? 'var(--border-accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.name}</span>
                    {m.recommended && (
                      <span style={{
                        padding: '1px 7px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        border: '1px solid var(--accent-glow)',
                      }}>
                        Recommended
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {m.description}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{m.size}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
              }}>
                <code style={{ flex: 1, fontSize: '0.82rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                  {m.pullCommand}
                </code>
                <CopyButton text={m.pullCommand} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Setup instructions */}
      <div style={{
        padding: '16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '10px', color: 'var(--text-secondary)' }}>
          📋 Quick Setup Guide
        </div>
        {[
          '1. Download and install Ollama from ollama.com',
          '2. Open Terminal (or Command Prompt on Windows)',
          '3. Run: ollama pull deepseek-r1:7b',
          '4. Wait for the download to complete (~5 GB)',
          '5. Click "↺ Check" above — status should turn green',
          '6. Go to the Model tab and select your model',
        ].map((step, i) => (
          <div key={i} style={{
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            padding: '4px 0',
            borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
          }}>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LocalModelConfig;