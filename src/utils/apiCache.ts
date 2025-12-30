// API Response Caching Utility
// Provides intelligent caching for API responses to improve performance

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'api_cache_';
const CACHE_EXPIRY_PREFIX = 'api_cache_expiry_';

// Cache TTL in milliseconds
export const CACHE_TTL = {
  // Short cache for frequently changing data
  SHORT: 5 * 60 * 1000,    // 5 minutes
  MEDIUM: 15 * 60 * 1000,  // 15 minutes
  LONG: 60 * 60 * 1000,    // 1 hour
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;

export interface CacheConfig {
  ttl: number;
  key: string;
}

export class APICache {
  /**
   * Generate cache key from endpoint and parameters
   */
  static generateKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${endpoint}_${paramString}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Store data in cache with expiry
   */
  static async set<T>(key: string, data: T, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const expiryKey = CACHE_EXPIRY_PREFIX + key;

      const expiryTime = Date.now() + ttl;

      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)),
        AsyncStorage.setItem(expiryKey, expiryTime.toString())
      ]);

      if (__DEV__) {
        console.log(`📦 [Cache] Stored: ${key} (expires in ${Math.round(ttl / 1000 / 60)}min)`);
      }
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  /**
   * Retrieve data from cache if not expired
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const expiryKey = CACHE_EXPIRY_PREFIX + key;

      const [data, expiry] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(expiryKey)
      ]);

      if (!data || !expiry) {
        return null;
      }

      const expiryTime = parseInt(expiry);
      const now = Date.now();

      if (now > expiryTime) {
        // Cache expired, clean up
        await this.delete(key);
        if (__DEV__) {
          console.log(`⏰ [Cache] Expired: ${key}`);
        }
        return null;
      }

      if (__DEV__) {
        const remaining = Math.round((expiryTime - now) / 1000 / 60);
        console.log(`📦 [Cache] Hit: ${key} (${remaining}min remaining)`);
      }

      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to retrieve cached data:', error);
      return null;
    }
  }

  /**
   * Delete cached data
   */
  static async delete(key: string): Promise<void> {
    try {
      const cacheKey = CACHE_PREFIX + key;
      const expiryKey = CACHE_EXPIRY_PREFIX + key;

      await Promise.all([
        AsyncStorage.removeItem(cacheKey),
        AsyncStorage.removeItem(expiryKey)
      ]);

      if (__DEV__) {
        console.log(`🗑️ [Cache] Deleted: ${key}`);
      }
    } catch (error) {
      console.warn('Failed to delete cached data:', error);
    }
  }

  /**
   * Invalidate specific cache patterns
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith(CACHE_PREFIX) && key.includes(pattern)
      );

      if (cacheKeys.length > 0) {
        // Also remove expiry keys
        const expiryKeys = cacheKeys.map(key =>
          key.replace(CACHE_PREFIX, CACHE_EXPIRY_PREFIX)
        );

        await AsyncStorage.multiRemove([...cacheKeys, ...expiryKeys]);

        if (__DEV__) {
          console.log(`🗑️ [Cache] Invalidated ${cacheKeys.length} items matching "${pattern}"`);
        }
      }
    } catch (error) {
      console.warn('Failed to invalidate cache pattern:', error);
    }
  }

  /**
   * Clear all cached data
   */
  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith(CACHE_PREFIX) || key.startsWith(CACHE_EXPIRY_PREFIX)
      );

      await AsyncStorage.multiRemove(cacheKeys);

      if (__DEV__) {
        console.log(`🧹 [Cache] Cleared ${cacheKeys.length} items`);
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getStats(): Promise<{
    totalItems: number;
    totalSize: number;
    expiredItems: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const expiryKeys = keys.filter(key => key.startsWith(CACHE_EXPIRY_PREFIX));

      let totalSize = 0;
      let expiredItems = 0;
      const now = Date.now();

      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;

          // Check if expired
          const expiryKey = key.replace(CACHE_PREFIX, CACHE_EXPIRY_PREFIX);
          const expiry = await AsyncStorage.getItem(expiryKey);
          if (expiry && now > parseInt(expiry)) {
            expiredItems++;
          }
        }
      }

      return {
        totalItems: cacheKeys.length,
        totalSize,
        expiredItems
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return { totalItems: 0, totalSize: 0, expiredItems: 0 };
    }
  }
}

/**
 * Higher-order function to add caching to API methods
 */
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  config: CacheConfig
) {
  return async (...args: T): Promise<R> => {
    const cacheKey = config.key;

    // Try to get from cache first
    const cached = await APICache.get<R>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const result = await fn(...args);

    // Cache the result
    await APICache.set(cacheKey, result, config.ttl);

    return result;
  };
}

/**
 * Cache configurations for different API endpoints
 */
export const API_CACHE_CONFIGS = {
  // Company filters change infrequently
  COMPANY_FILTERS: { key: 'company_filters', ttl: CACHE_TTL.LONG },

  // People filters change infrequently
  PEOPLE_FILTERS: { key: 'people_filters', ttl: CACHE_TTL.LONG },

  // User lists change when user creates/deletes lists
  USER_LISTS: { key: 'user_lists', ttl: CACHE_TTL.MEDIUM },

  // Company signals - cache briefly to allow for real-time updates
  COMPANY_SIGNALS: { key: 'company_signals', ttl: CACHE_TTL.SHORT },

  // People signals - cache briefly to allow for real-time updates
  PEOPLE_SIGNALS: { key: 'people_signals', ttl: CACHE_TTL.SHORT },
} as const;