// Model Manager — Ollama Adapter
// Communicates with the local Ollama service.
// Default endpoint: http://localhost:11434
// Primary dev model: qwen2.5-coder:3b

const http = require('http');
const BaseAdapter = require('./base');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;

class OllamaAdapter extends BaseAdapter {
  /**
   * @param {string} modelId  - Ollama model name e.g. "qwen2.5-coder:3b"
   * @param {object} config   - { host, port }
   */
  constructor(modelId, config = {}) {
    super(modelId, config);
    this.host = config.host || OLLAMA_HOST;
    this.port = config.port || OLLAMA_PORT;
  }

  getType() {
    return 'ollama';
  }

  /**
   * Makes a raw HTTP POST request to the Ollama API.
   * Uses Node's built-in http module — no external dependencies needed.
   */
  _post(path, body, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const options = {
        hostname: this.host,
        port: this.port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(new Error(`Ollama: failed to parse response JSON: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Ollama: connection error — is Ollama running? (${err.message})`));
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Ollama: request timed out after ${timeoutMs}ms`));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Makes a GET request to check Ollama availability.
   */
  _get(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path,
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }

  /**
   * Checks if Ollama is running and the model is available.
   */
  async isAvailable() {
    try {
      const res = await this._get('/api/tags');
      if (res.statusCode !== 200) return false;
      const data = JSON.parse(res.body);
      const models = (data.models || []).map(m => m.name);
      return models.some(name => name === this.modelId || name.startsWith(this.modelId.split(':')[0]));
    } catch {
      return false;
    }
  }

  /**
   * Lists all models currently available in Ollama.
   * @returns {Promise<string[]>} list of model names
   */
  async listModels() {
    try {
      const res = await this._get('/api/tags');
      if (res.statusCode !== 200) return [];
      const data = JSON.parse(res.body);
      return (data.models || []).map(m => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Streaming chat — calls onChunk(token) for each token as it arrives,
   * then resolves with the full concatenated response string.
   *
   * @param {Array<{role,content}>} messages
   * @param {object} options - { temperature, maxTokens, onChunk, onDone, onError }
   * @returns {Promise<string>} full response text
   */
  chatStream(messages, options = {}) {
    const { onChunk, onDone, onError, temperature, maxTokens } = options;

    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model:    this.modelId,
        messages,
        stream:   true,
        options: {
          temperature: temperature ?? 0.7,
          num_predict: maxTokens   ?? 2048,
        },
      });

      const reqOptions = {
        hostname: this.host,
        port:     this.port,
        path:     '/api/chat',
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      let fullText = '';
      let buffer   = '';
      let resolved = false;

      const finish = (text) => {
        if (resolved) return;
        resolved = true;
        if (onDone) onDone(text);
        resolve(text);
      };

      const req = http.request(reqOptions, (res) => {
        if (res.statusCode !== 200) {
          const err = new Error(`Ollama stream: HTTP ${res.statusCode}`);
          if (onError) onError(err);
          return reject(err);
        }

        res.on('data', (chunk) => {
          // Ollama streams NDJSON — one JSON object per line
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete trailing line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              const token = parsed?.message?.content ?? '';
              if (token) {
                fullText += token;
                if (onChunk) onChunk(token);
              }
              if (parsed.done) finish(fullText);
            } catch (_) { /* malformed line — skip */ }
          }
        });

        res.on('end', () => {
          // Flush any remaining buffer content
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer);
              const token = parsed?.message?.content ?? '';
              if (token) { fullText += token; if (onChunk) onChunk(token); }
            } catch (_) {}
          }
          finish(fullText);
        });

        res.on('error', (err) => {
          if (onError) onError(err);
          reject(err);
        });
      });

      req.on('error', (err) => {
        const wrapped = new Error(`Ollama stream: connection error (${err.message})`);
        if (onError) onError(wrapped);
        reject(wrapped);
      });

      req.setTimeout(120000, () => {
        req.destroy();
        const err = new Error('Ollama stream: request timed out');
        if (onError) onError(err);
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Sends a chat request to Ollama using the /api/chat endpoint.
   * Uses streaming = false for simplicity.
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @param {object} options - { temperature, maxTokens }
   * @returns {Promise<string>}
   */
  async chat(messages, options = {}) {
    const body = {
      model: this.modelId,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    };

    const res = await this._post('/api/chat', body, 120000);

    if (res.statusCode !== 200) {
      throw new Error(`Ollama: chat request failed (HTTP ${res.statusCode}): ${JSON.stringify(res.body)}`);
    }

    const text = res.body?.message?.content;
    if (!text) {
      throw new Error(`Ollama: unexpected response format — no message.content found`);
    }

    return text.trim();
  }

  /**
   * Tests the adapter by sending a minimal prompt.
   * @returns {Promise<{ success: boolean, message: string, timeMs: number }>}
   */
  async test() {
    const start = Date.now();
    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          success: false,
          message: `Ollama is not running or model "${this.modelId}" is not installed. Run: ollama pull ${this.modelId}`,
          timeMs: Date.now() - start,
        };
      }

      const response = await this.chat([
        { role: 'user', content: 'Reply with the single word: ready' }
      ], { maxTokens: 10 });

      return {
        success: true,
        message: `Ollama model "${this.modelId}" is responding. Test reply: "${response}"`,
        timeMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
        timeMs: Date.now() - start,
      };
    }
  }
}

module.exports = OllamaAdapter;