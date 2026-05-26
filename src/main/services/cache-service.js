// services/cache-service.js
// Caches generated content to improve performance
// Uses in-memory storage with TTL (time-to-live)

'use strict';

class CacheService {
  /**
   * @param {object} options - Cache configuration
   * @param {number} options.ttl - Default time-to-live in milliseconds (default: 24 hours)
   * @param {number} options.maxSize - Maximum number of items (default: 1000)
   */
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours default
    this.maxSize = options.maxSize || 1000;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this._cleanup(), 60 * 60 * 1000); // 1 hour
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {Promise<*>} Cached value or null
   */
  async get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access time
    item.lastAccessed = Date.now();
    this.stats.hits++;

    return item.value;
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Optional custom TTL
   * @returns {Promise<boolean>} Success
   */
  async set(key, value, ttl = null) {
    // Enforce max size
    if (this.cache.size >= this.maxSize) {
      this._evictLeastUsed();
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl || this.ttl),
      lastAccessed: Date.now(),
      accessCount: 0
    });

    this.stats.sets++;
    return true;
  }

  /**
   * Check if key exists and not expired
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   * @returns {Promise<void>}
   */
  async clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryEstimate: this._estimateMemoryUsage()
    };
  }

  /**
   * Generate cache key for content
   * @param {string} type - Content type
   * @param {string} topicCode - Topic code
   * @param {object} params - Additional parameters
   * @returns {string} Cache key
   */
  generateKey(type, topicCode, params = {}) {
    const parts = [type, topicCode];

    if (params.difficulty) parts.push(params.difficulty);
    if (params.count) parts.push(`count${params.count}`);
    if (params.studentId) parts.push(`user${params.studentId}`);
    if (params.language) parts.push(params.language);

    return parts.join(':');
  }

  /**
   * Clean up expired items
   * @private
   */
  _cleanup() {
    const now = Date.now();
    let expired = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        expired++;
      }
    }

    if (expired > 0) {
      console.log(`[CacheService] Cleaned up ${expired} expired items`);
    }
  }

  /**
   * Evict least recently used item
   * @private
   */
  _evictLeastUsed() {
    let oldestKey = null;
    let oldestAccess = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestAccess) {
        oldestAccess = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Estimate memory usage (rough approximation)
   * @private
   */
  _estimateMemoryUsage() {
    let total = 0;
    for (const [key, item] of this.cache.entries()) {
      total += key.length * 2; // Approximate string size
      total += JSON.stringify(item.value).length * 2;
    }
    return Math.round(total / 1024); // KB
  }

  /**
   * Stop cleanup interval (call on app shutdown)
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = CacheService;