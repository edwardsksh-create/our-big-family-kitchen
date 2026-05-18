import { describe, it, expect } from 'vitest';
import { slugify, cn } from '@/lib/utils';

describe('slugify()', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Kate Edwards')).toBe('kate-edwards');
  });
  it('strips punctuation', () => {
    expect(slugify("Annie's Salsa! (2003)")).toBe('annies-salsa-2003');
  });
  it('collapses repeated whitespace and hyphens', () => {
    expect(slugify('  multiple   spaces -- and  dashes ')).toBe('multiple-spaces-and-dashes');
  });
  it('returns empty string for empty / whitespace-only input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });
  it('preserves digits', () => {
    expect(slugify('Recipe 42')).toBe('recipe-42');
  });
});

describe('cn()', () => {
  it('joins truthy class names with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });
  it('drops falsy entries', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });
  it('returns empty string when everything is falsy', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });
});
