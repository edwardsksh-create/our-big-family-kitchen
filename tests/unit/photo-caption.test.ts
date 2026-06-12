import { describe, it, expect } from 'vitest';
import { captionLead, joinNames } from '@/lib/photos/photo-caption';

describe('captionLead', () => {
  it('composes occasion + numeric year + place', () => {
    expect(captionLead({ occasionNames: ['Thanksgiving'], year: '1987', place: "Grandma's" }))
      .toBe("Thanksgiving 1987, at Grandma's");
  });

  it('uses a comma before prose year text', () => {
    expect(captionLead({ occasionNames: ['Easter'], year: 'around 1995', place: null }))
      .toBe('Easter, around 1995');
  });

  it('joins multiple occasions with an ampersand', () => {
    expect(captionLead({ occasionNames: ['Thanksgiving', 'Birthday'], year: '1990', place: null }))
      .toBe('Thanksgiving & Birthday 1990');
  });

  it('handles year-only, place-only, and empty', () => {
    expect(captionLead({ occasionNames: [], year: '1987', place: null })).toBe('1987');
    expect(captionLead({ occasionNames: [], year: null, place: 'Toledo' })).toBe('At Toledo');
    expect(captionLead({ occasionNames: [], year: null, place: null })).toBeNull();
    expect(captionLead({ occasionNames: [], year: '  ', place: '' })).toBeNull();
  });
});

describe('joinNames', () => {
  it('joins like a sentence', () => {
    expect(joinNames(['Nancy'])).toBe('Nancy');
    expect(joinNames(['Nancy', 'Laura'])).toBe('Nancy and Laura');
    expect(joinNames(['Nancy', 'Laura', 'Annie'])).toBe('Nancy, Laura, and Annie');
  });
  it('drops empties', () => {
    expect(joinNames(['', 'Nancy', ' '])).toBe('Nancy');
    expect(joinNames([])).toBe('');
  });
});
