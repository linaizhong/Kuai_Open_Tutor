// Settings/index.js
// Settings panel — tab-based layout covering:
// Model config, Local models, Cloud APIs, Usage stats, Teaching Mode.

import React, { useState, useCallback } from 'react';
import ipc from '../../ipc';
import ModelSettings    from './ModelSettings';
import LocalModelConfig from './LocalModelConfig';
import CloudModelConfig from './CloudModelConfig';
import StatsView        from './StatsView';
import ThemeSettings    from './ThemeSettings';
import ProfileSettings  from './ProfileSettings';
import TeachingModelSettings  from './TeachingModelSettings';  // 新增导入
import KnowledgeBaseSettings from './KnowledgeBaseSettings';   // v5.0

const TABS = [
  { id: 'profile', label: '👤 Profile',      component: ProfileSettings  },
  { id: 'model',   label: '🤖 Model',        component: ModelSettings    },
  { id: 'local',   label: '💻 Local',         component: LocalModelConfig },
  { id: 'cloud',   label: '☁️ Cloud APIs',   component: CloudModelConfig },
  { id: 'stats',   label: '📊 Usage Stats',  component: StatsView        },
  { id: 'teaching', label: '👩‍🏫 Teaching Mode', component: TeachingModelSettings },  // 新增选项卡
  { id: 'kb',       label: '🏗️ Knowledge Base', component: KnowledgeBaseSettings },  // v5.0
  { id: 'theme',   label: '🎨 Theme',         component: ThemeSettings    },
];

function Settings({ subjectsList = [], onSubjectsChange }) {
  const [activeTab, setActiveTab]       = useState('profile');
  const [devToolsOn, setDevToolsOn]     = useState(false);

  const toggleDevTools = useCallback(async () => {
    await ipc.invoke('devtools:toggle');
    setDevToolsOn(prev => !prev);
  }, []);

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || ModelSettings;

  // Prepare props for each tab component
  const getTabProps = () => {
    switch (activeTab) {
      case 'profile':
        return { subjectsList, onSubjectsChange };
      default:
        return {};
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 20px 0',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            margin: 0,
            color: 'var(--text-primary)',
          }}>
            Settings
          </h2>

          {/* Debug console toggle */}
          <button
            onClick={toggleDevTools}
            title={devToolsOn ? 'Close debug console' : 'Open debug console'}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              background:   devToolsOn ? 'var(--accent-soft)' : 'var(--bg-elevated)',
              border:       devToolsOn ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 8,
              color:        devToolsOn ? 'var(--accent)' : 'var(--text-muted)',
              fontSize:     '0.75rem',
              fontWeight:   600,
              padding:      '5px 12px',
              cursor:       'pointer',
              transition:   'all 0.15s ease',
              letterSpacing: '0.03em',
            }}
            onMouseEnter={e => {
              if (!devToolsOn) {
                e.currentTarget.style.borderColor = 'var(--border-bright)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            onMouseLeave={e => {
              if (!devToolsOn) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   '0.9rem',
              lineHeight: 1,
            }}>{'</>'}</span>
            {devToolsOn ? 'Console On' : 'Console'}
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                border: 'none',
                background: activeTab === tab.id
                  ? 'var(--bg-base)'
                  : 'transparent',
                color: activeTab === tab.id
                  ? 'var(--accent)'
                  : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.83rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                borderBottom: activeTab === tab.id
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={e => {
                if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        animation: 'fadeIn 0.2s ease',
      }}>
        <ActiveComponent {...getTabProps()} />
      </div>
    </div>
  );
}

export default Settings;