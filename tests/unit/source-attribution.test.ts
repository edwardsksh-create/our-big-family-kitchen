import { describe, it, expect } from 'vitest';
import { formatSourceAttribution } from '@/lib/recipes/source-attribution';

describe('formatSourceAttribution', () => {
  it('joins author and publication with "for"', () => {
    expect(formatSourceAttribution({ author: 'Sam Sifton', source: 'NYT Cooking' }))
      .toBe('Sam Sifton for NYT Cooking');
    expect(formatSourceAttribution({ author: 'Deb Perelman', source: 'Smitten Kitchen' }))
      .toBe('Deb Perelman for Smitten Kitchen');
  });

  it('joins author and cookbook with a comma', () => {
    expect(formatSourceAttribution({ author: 'Ina Garten', source: 'Barefoot Contessa', isBook: true }))
      .toBe('Ina Garten, Barefoot Contessa');
  });

  it('returns just the source when no author is present', () => {
    expect(formatSourceAttribution({ source: 'NYT Cooking' })).toBe('NYT Cooking');
    expect(formatSourceAttribution({ source: 'Bon Appétit' })).toBe('Bon Appétit');
  });

  it('returns just the author when no source is present', () => {
    expect(formatSourceAttribution({ author: 'Sam Sifton' })).toBe('Sam Sifton');
  });

  it('returns null when nothing is parseable', () => {
    expect(formatSourceAttribution({})).toBeNull();
    expect(formatSourceAttribution({ author: '', source: '' })).toBeNull();
    expect(formatSourceAttribution({ author: null, source: null })).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(formatSourceAttribution({ author: '  Sam Sifton  ', source: '  NYT Cooking  ' }))
      .toBe('Sam Sifton for NYT Cooking');
  });

  it('ignores isBook when no source is given', () => {
    expect(formatSourceAttribution({ author: 'Ina Garten', isBook: true }))
      .toBe('Ina Garten');
  });
});
