import { describe, it, expect } from 'vitest';
import { formatDisplayName } from '@/lib/contributors/display-name';

describe('formatDisplayName', () => {
  it('returns just the full name when there are no extras', () => {
    expect(formatDisplayName({ fullName: 'Annie Sundy' })).toBe('Annie Sundy');
  });

  it('adds nickname in single quotes between first and last name', () => {
    expect(formatDisplayName({ fullName: 'Annie Sundy', nickname: 'Nannie' }))
      .toBe("Annie 'Nannie' Sundy");
  });

  it('adds birth name in parens between first and last name', () => {
    expect(formatDisplayName({ fullName: 'Annie Sundy', birth_name: 'Leusch' }))
      .toBe('Annie (Leusch) Sundy');
  });

  it('combines nickname and birth name in canonical order', () => {
    expect(formatDisplayName({ fullName: 'Annie Sundy', nickname: 'Nannie', birth_name: 'Leusch' }))
      .toBe("Annie 'Nannie' (Leusch) Sundy");
  });

  it('groups multi-word first names with the last whitespace as the split', () => {
    expect(formatDisplayName({ fullName: 'Mary Ann Hogan', birth_name: 'O\'Brien' }))
      .toBe("Mary Ann (O'Brien) Hogan");
  });

  it('handles already-split firstName/lastName input', () => {
    expect(formatDisplayName({ firstName: 'Lucy', lastName: 'Leusch', nickname: 'Gal' }))
      .toBe("Lucy 'Gal' Leusch");
  });

  it('treats blank nickname / birth_name as absent', () => {
    expect(formatDisplayName({ fullName: 'Kate Edwards', nickname: '   ', birth_name: '' }))
      .toBe('Kate Edwards');
  });

  it('handles null nickname and birth_name from DB rows', () => {
    expect(formatDisplayName({ fullName: 'Kate Edwards', nickname: null, birth_name: null }))
      .toBe('Kate Edwards');
  });

  it('returns just the first name for single-word full names', () => {
    expect(formatDisplayName({ fullName: 'Madonna' })).toBe('Madonna');
  });

  it('falls back to "First (Birth)" when there is no last name', () => {
    expect(formatDisplayName({ fullName: 'Madonna', birth_name: 'Ciccone' }))
      .toBe('Madonna (Ciccone)');
  });
});
