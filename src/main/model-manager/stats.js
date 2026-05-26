// Model Manager — Stats Recorder
// Records per-call statistics: success, failure, latency, model used.
// Stored in data/config/model-stats.json

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 500;  // keep last 500 calls to avoid unbounded growth

class Stats {
  /**
   * @param {string} statsPath - Absolute path to model-stats.json
   */
  constructor(statsPath) {
    if (!statsPath) throw new Error('Stats: statsPath is required');
    this.statsPath = statsPath;
    this._ensureExists();
  }

  _ensureExists() {
    const dir = path.dirname(this.statsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.statsPath)) {
      fs.writeFileSync(this.statsPath, JSON.stringify({ calls: [] }, null, 2), 'utf8');
    }
  }

  _load() {
    const raw = fs.readFileSync(this.statsPath, 'utf8');
    return JSON.parse(raw);
  }

  _save(data) {
    fs.writeFileSync(this.statsPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Records a completed model call.
   *
   * @param {object} entry - {
   *   modelId: string,
   *   success: boolean,
   *   timeMs: number,
   *   errorMessage: string|null,
   *   skillName: string|null,   // which skill triggered this call
   *   studentId: string|null,
   * }
   */
  record(entry) {
    const data = this._load();
    data.calls.push({
      timestamp: new Date().toISOString(),
      modelId: entry.modelId,
      success: entry.success,
      timeMs: entry.timeMs,
      errorMessage: entry.errorMessage || null,
      skillName: entry.skillName || null,
      studentId: entry.studentId || null,
    });

    // Trim to last MAX_ENTRIES
    if (data.calls.length > MAX_ENTRIES) {
      data.calls = data.calls.slice(-MAX_ENTRIES);
    }

    this._save(data);
  }

  /**
   * Returns a summary of usage statistics.
   */
  getSummary() {
    const data = this._load();
    const calls = data.calls;

    if (calls.length === 0) {
      return { totalCalls: 0, successRate: null, avgLatencyMs: null, byModel: {} };
    }

    const successful = calls.filter(c => c.success);
    const avgLatency = successful.length > 0
      ? Math.round(successful.reduce((a, c) => a + c.timeMs, 0) / successful.length)
      : null;

    // Group by model
    const byModel = {};
    for (const call of calls) {
      if (!byModel[call.modelId]) byModel[call.modelId] = { total: 0, success: 0, totalMs: 0 };
      byModel[call.modelId].total += 1;
      if (call.success) {
        byModel[call.modelId].success += 1;
        byModel[call.modelId].totalMs += call.timeMs;
      }
    }
    for (const m of Object.values(byModel)) {
      m.avgLatencyMs = m.success > 0 ? Math.round(m.totalMs / m.success) : null;
      m.successRate = parseFloat((m.success / m.total).toFixed(3));
      delete m.totalMs;
    }

    return {
      totalCalls: calls.length,
      successRate: parseFloat((successful.length / calls.length).toFixed(3)),
      avgLatencyMs: avgLatency,
      byModel,
      lastCall: calls[calls.length - 1]?.timestamp || null,
    };
  }

  /**
   * Returns the raw call log.
   */
  getAll() {
    return this._load().calls;
  }

  /**
   * Clears all stats.
   */
  clear() {
    this._save({ calls: [] });
  }
}

module.exports = Stats;