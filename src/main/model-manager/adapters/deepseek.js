// Model Manager — DeepSeek Cloud Adapter
// Calls the DeepSeek API (OpenAI-compatible endpoint)
// Docs: https://platform.deepseek.com/api-docs

const https = require('https');
const BaseAdapter = require('./base');

const DEEPSEEK_HOST = 'api.deepseek.com';
const DEEPSEEK_CHAT_PATH = '/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';

class DeepSeekAdapter extends BaseAdapter {
  /**
   * @param {string} modelId  - e.g. "deepseek-chat" or "deepseek-reasoner"
   * @param {object} config   - { apiKey }
   */
  constructor(modelId, config = {}) {
    super(modelId || DEFAULT_MODEL, config);
    this.apiKey = config.apiKey || '';
  }

  getType() {
    return 'deepseek';
  }

  _post(body, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const options = {
        hostname: DEEPSEEK_HOST,
        path: DEEPSEEK_CHAT_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(new Error(`DeepSeek: failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', err => reject(new Error(`DeepSeek: network error — ${err.message}`)));
      req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('DeepSeek: request timed out')); });
      req.write(payload);
      req.end();
    });
  }

  async isAvailable() {
    if (!this.apiKey) return false;
    try {
      const res = await this._post({
        model: this.modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }, 10000);
      return res.statusCode === 200;
    } catch {
      return false;
    }
  }

  async chat(messages, options = {}) {
    if (!this.apiKey) throw new Error('DeepSeek: no API key configured');

    const res = await this._post({
      model: this.modelId,
      messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
    });

    if (res.statusCode === 401) throw new Error('DeepSeek: invalid API key');
    if (res.statusCode === 429) throw new Error('DeepSeek: rate limit exceeded — please wait and retry');
    if (res.statusCode !== 200) throw new Error(`DeepSeek: API error (HTTP ${res.statusCode}): ${JSON.stringify(res.body)}`);

    const text = res.body?.choices?.[0]?.message?.content;
    if (!text) throw new Error('DeepSeek: unexpected response format');
    return text.trim();
  }

  async test() {
    const start = Date.now();
    if (!this.apiKey) {
      return { success: false, message: 'DeepSeek: no API key configured', timeMs: 0 };
    }
    try {
      const response = await this.chat([
        { role: 'user', content: 'Reply with the single word: ready' }
      ], { maxTokens: 10 });
      return {
        success: true,
        message: `DeepSeek model "${this.modelId}" is responding. Test reply: "${response}"`,
        timeMs: Date.now() - start,
      };
    } catch (err) {
      return { success: false, message: err.message, timeMs: Date.now() - start };
    }
  }
}

module.exports = DeepSeekAdapter;