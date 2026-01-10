/**
 * @fileoverview Unit tests for AI Judge caching
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCacheKey,
  getCached,
  setCache,
  clearCache,
  getCacheSize,
} from './index.js';

describe('AI Judge Cache', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('createCacheKey', () => {
    it('should create a 64-character hex hash', () => {
      const key = createCacheKey({
        value: 'test value',
        question: 'Is this valid?',
      });

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
    });

    it('should create consistent keys for same inputs', () => {
      const key1 = createCacheKey({
        value: 'test',
        question: 'question?',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });

      const key2 = createCacheKey({
        value: 'test',
        question: 'question?',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });

      expect(key1).toBe(key2);
    });

    it('should create different keys for different values', () => {
      const key1 = createCacheKey({
        value: 'value1',
        question: 'question?',
      });

      const key2 = createCacheKey({
        value: 'value2',
        question: 'question?',
      });

      expect(key1).not.toBe(key2);
    });

    it('should create different keys for different questions', () => {
      const key1 = createCacheKey({
        value: 'same value',
        question: 'question 1?',
      });

      const key2 = createCacheKey({
        value: 'same value',
        question: 'question 2?',
      });

      expect(key1).not.toBe(key2);
    });

    it('should create different keys for different providers', () => {
      const key1 = createCacheKey({
        value: 'test',
        question: 'question?',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });

      const key2 = createCacheKey({
        value: 'test',
        question: 'question?',
        provider: 'anthropic',
        model: 'gpt-4o-mini',
      });

      expect(key1).not.toBe(key2);
    });

    it('should create different keys for different models', () => {
      const key1 = createCacheKey({
        value: 'test',
        question: 'question?',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });

      const key2 = createCacheKey({
        value: 'test',
        question: 'question?',
        provider: 'openai',
        model: 'gpt-4o',
      });

      expect(key1).not.toBe(key2);
    });

    it('should handle large values efficiently (key size stays constant)', () => {
      // Simulate a large document (100KB of text)
      const largeValue = 'x'.repeat(100_000);

      const key = createCacheKey({
        value: largeValue,
        question: 'Is this appropriate?',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });

      // Key should still be exactly 64 chars (SHA-256 hex)
      expect(key).toHaveLength(64);
    });

    it('should handle complex object values', () => {
      const key = createCacheKey({
        value: {
          nested: {
            array: [1, 2, 3],
            string: 'test',
          },
        },
        question: 'Is this valid?',
      });

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('cache operations', () => {
    it('should store and retrieve cached values', () => {
      const key = 'test-key';
      setCache(key, true);

      expect(getCached(key)).toBe(true);
    });

    it('should return undefined for non-existent keys', () => {
      expect(getCached('non-existent')).toBeUndefined();
    });

    it('should track cache size', () => {
      expect(getCacheSize()).toBe(0);

      setCache('key1', true);
      expect(getCacheSize()).toBe(1);

      setCache('key2', false);
      expect(getCacheSize()).toBe(2);
    });

    it('should clear all cached values', () => {
      setCache('key1', true);
      setCache('key2', false);
      expect(getCacheSize()).toBe(2);

      clearCache();
      expect(getCacheSize()).toBe(0);
    });
  });
});
