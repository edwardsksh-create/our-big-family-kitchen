import { describe, it, expect } from 'vitest';
import { dailyHeroIndex } from '@/lib/photos/hero';

describe('dailyHeroIndex', () => {
  it('is deterministic for a given day', () => {
    expect(dailyHeroIndex('2026-06-12', 5)).toBe(dailyHeroIndex('2026-06-12', 5));
  });

  it('advances by one each day, wrapping around the pool', () => {
    const a = dailyHeroIndex('2026-06-12', 5);
    const b = dailyHeroIndex('2026-06-13', 5);
    expect(b).toBe((a + 1) % 5);
  });

  it('covers every pool member across poolSize consecutive days', () => {
    const seen = new Set<number>();
    for (let d = 1; d <= 7; d++) {
      seen.add(dailyHeroIndex(`2026-06-${String(d).padStart(2, '0')}`, 7));
    }
    expect(seen.size).toBe(7);
  });

  it('stays in range for pool of one', () => {
    expect(dailyHeroIndex('2026-06-12', 1)).toBe(0);
  });

  it('throws on an empty pool', () => {
    expect(() => dailyHeroIndex('2026-06-12', 0)).toThrow();
  });
});
