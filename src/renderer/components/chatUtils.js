// chatUtils.js
// Pure helpers, constants, and utility functions for the ChatWindow.
// No React imports — safe to use anywhere.

// ── Constants ─────────────────────────────────────────────────
export const STUDENT_ID  = 'default';
export const MAX_HISTORY = 200;

// ── Topic colours ─────────────────────────────────────────────
export function topicColour(code) {
  const map = {
    'MA-F': 'var(--topic-f)',
    'MA-T': 'var(--topic-t)',
    'MA-C': 'var(--topic-c)',
    'MA-E': 'var(--topic-e)',
    'MA-S': 'var(--topic-s)',
    'MA-M': 'var(--topic-m)',
  };
  const prefix = code ? code.slice(0, 4) : '';
  return map[prefix] || 'var(--text-muted)';
}

// ── Subject label helper (dynamic) ────────────────────────────
export function getSubjectLabel(subjectId, subjectsList) {
  const subject = subjectsList.find(s => s.id === subjectId);
  return subject?.name || subjectId;
}

// ── Time formatter ────────────────────────────────────────────
export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}

// ── Affective state detector ──────────────────────────────────
export function detectAffectiveState(messages) {
  const recent = messages.slice(-6).filter(m => m.role === 'user');
  if (recent.length === 0) return 'idle';
  const lastUser = recent[recent.length - 1]?.content?.toLowerCase() || '';
  if (/i don't understand|i'm confused|this is hard|i give up|why/.test(lastUser)) return 'frustrated';
  const assistantMsgs = messages.slice(-4).filter(m => m.role === 'assistant');
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
  if (lastAssistant?.content?.includes('correct') || lastAssistant?.content?.includes('exactly right')) return 'correct';
  return 'idle';
}