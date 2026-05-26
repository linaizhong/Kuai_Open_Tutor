// Model Manager — Anthropic Claude Adapter
// Docs: https://docs.anthropic.com/en/api/messages

const https = require('https');
const BaseAdapter = require('./base');

const CLAUDE_HOST = 'api.anthropic.com';
const CLAUDE_CHAT_PATH = '/v1/messages';
const CLAUDE_API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

class ClaudeAdapter extends BaseAdapter {
  constructor(modelId, config = {}) {
    super(modelId || DEFAULT_MODEL, config);
    this.apiKey = config.apiKey || '';
  }

  getType() { return 'claude'; }

  _post(body, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const options = {
        hostname: CLAUDE_HOST,
        path: CLAUDE_CHAT_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CLAUDE_API_VERSION,
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
          catch (e) { reject(new Error(`Claude: failed to parse response: ${data}`)); }
        });
      });
      req.on('error', err => reject(new Error(`Claude: network error — ${err.message}`)));
      req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Claude: request timed out')); });
      req.write(payload);
      req.end();
    });
  }

  /**
   * Claude uses a different message format — system prompt is separate.
   * We extract the system message from the messages array if present.
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) throw new Error('Claude: no API key configured');

    // Separate system message from conversation messages
    let systemPrompt = undefined;
    let chatMessages = messages;
    if (messages.length > 0 && messages[0].role === 'system') {
      systemPrompt = messages[0].content;
      chatMessages = messages.slice(1);
    }

    const body = {
      model: this.modelId,
      max_tokens: options.maxTokens ?? 2048,
      messages: chatMessages,
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await this._post(body);

    if (res.statusCode === 401) throw new Error('Claude: invalid API key');
    if (res.statusCode === 429) throw new Error('Claude: rate limit exceeded');
    if (res.statusCode !== 200) throw new Error(`Claude: API error (HTTP ${res.statusCode}): ${JSON.stringify(res.body)}`);

    const text = res.body?.content?.[0]?.text;
    if (!text) throw new Error('Claude: unexpected response format');
    return text.trim();
  }

  async isAvailable() {
    if (!this.apiKey) return false;
    try {
      const res = await this._post({ model: this.modelId, max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }, 10000);
      return res.statusCode === 200;
    } catch { return false; }
  }

  async test() {
    const start = Date.now();
    if (!this.apiKey) return { success: false, message: 'Claude: no API key configured', timeMs: 0 };
    try {
      const response = await this.chat([{ role: 'user', content: 'Reply with the single word: ready' }], { maxTokens: 10 });
      return { success: true, message: `Claude model "${this.modelId}" responding. Reply: "${response}"`, timeMs: Date.now() - start };
    } catch (err) {
      return { success: false, message: err.message, timeMs: Date.now() - start };
    }
  }
}

module.exports = ClaudeAdapter;