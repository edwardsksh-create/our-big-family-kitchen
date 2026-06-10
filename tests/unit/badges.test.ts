import { describe, it, expect } from 'vitest';
import {
  badgesFor,
  canSeeNeedsFor,
  needsFamilyHelp,
  visibleInNeedsFamilyHelp,
  ANONYMOUS_VIEWER,
  type Viewer,
} from '@/lib/recipes/badges';
import type { RecipeIndexItem } from '@/lib/queries/recipes';

const NOW = new Date('2026-06-10T00:00:00Z').getTime();

const ADMIN:     Viewer = { isAdmin: true,  contributorId: 'kate-id' };
const OWNER:     Viewer = { isAdmin: false, contributorId: 'lucy-id' };
const OTHER:     Viewer = { isAdmin: false, contributorId: 'someone-else-id' };
const SIGNED_OUT       = ANONYMOUS_VIEWER;

function baseRecipe(overrides: Partial<RecipeIndexItem> = {}): RecipeIndexItem {
  return {
    id:              'r1',
    slug:            'r-1',
    title:           'Test',
    published_at:    '2026-06-09T00:00:00Z',
    updated_at:      '2026-06-09T00:00:00Z',
    originally_from: null,
    contributor_id:  'lucy-id',
    contributor:     { slug: 'lucy', display: 'Lucy' },
    section:         { slug: 'desserts', name: 'Desserts', color: 'navy' },
    family_line:     { slug: 'leusch', name: 'Leusch' },
    has_story:        false,
    has_method:       false,
    has_ingredients:  false,
    has_source_photo: false,
    tag_slugs:        [],
    ...overrides,
  };
}

describe('canSeeNeedsFor', () => {
  it('admin sees needs for any recipe', () => {
    expect(canSeeNeedsFor(ADMIN, 'lucy-id')).toBe(true);
    expect(canSeeNeedsFor(ADMIN, 'someone-else-id')).toBe(true);
    expect(canSeeNeedsFor(ADMIN, null)).toBe(true);
  });

  it('contributor sees needs only for their own recipes', () => {
    expect(canSeeNeedsFor(OWNER, 'lucy-id')).toBe(true);
    expect(canSeeNeedsFor(OWNER, 'someone-else-id')).toBe(false);
  });

  it('other family members never see needs', () => {
    expect(canSeeNeedsFor(OTHER, 'lucy-id')).toBe(false);
  });

  it('signed-out viewer never sees needs', () => {
    expect(canSeeNeedsFor(SIGNED_OUT, 'lucy-id')).toBe(false);
    expect(canSeeNeedsFor(SIGNED_OUT, null)).toBe(false);
  });
});

describe('badgesFor — needs gating', () => {
  it('shows Needs method and Needs story to admin', () => {
    const keys = badgesFor(baseRecipe(), ADMIN, NOW).map((b) => b.key);
    expect(keys).toContain('needs-method');
    expect(keys).toContain('needs-story');
  });

  it('shows Needs method and Needs story to the owner', () => {
    const keys = badgesFor(baseRecipe(), OWNER, NOW).map((b) => b.key);
    expect(keys).toContain('needs-method');
    expect(keys).toContain('needs-story');
  });

  it('hides Needs method and Needs story from another family member', () => {
    const keys = badgesFor(baseRecipe(), OTHER, NOW).map((b) => b.key);
    expect(keys).not.toContain('needs-method');
    expect(keys).not.toContain('needs-story');
  });

  it('hides Needs method and Needs story from signed-out visitors', () => {
    const keys = badgesFor(baseRecipe(), SIGNED_OUT, NOW).map((b) => b.key);
    expect(keys).not.toContain('needs-method');
    expect(keys).not.toContain('needs-story');
  });
});

describe('badgesFor — affirmative badges always render', () => {
  const finished = baseRecipe({
    has_method:       true,
    has_ingredients:  true,
    has_story:        true,
    has_source_photo: true,
    originally_from:  "Aunt Laura's 2003 cookbook",
    published_at:     new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  });

  it.each<['admin' | 'owner' | 'other' | 'signed_out', Viewer]>([
    ['admin',      ADMIN],
    ['owner',      OWNER],
    ['other',      OTHER],
    ['signed_out', SIGNED_OUT],
  ])('every viewer sees the affirmative badges (%s)', (_label, viewer) => {
    const keys = badgesFor(finished, viewer, NOW).map((b) => b.key);
    expect(keys).toContain('ready-to-cook');
    expect(keys).toContain('family-note');
    expect(keys).toContain('original-page');
    expect(keys).toContain('from-aunt-laura');
    expect(keys).toContain('recently-added');
    // And needs are absent for everyone (the recipe isn't lacking anything).
    expect(keys).not.toContain('needs-method');
    expect(keys).not.toContain('needs-story');
  });
});

describe('badgesFor — does not leak counts to non-entitled viewers', () => {
  it('viewer sees no needs even when the recipe is missing both method and story', () => {
    const incomplete = baseRecipe({ has_method: false, has_story: false });
    const keys = badgesFor(incomplete, OTHER, NOW).map((b) => b.key);
    expect(keys.every((k) => !k.startsWith('needs-'))).toBe(true);
  });
});

describe('visibleInNeedsFamilyHelp', () => {
  const flagged = baseRecipe({ tag_slugs: ['needs-instructions'] });
  const unflagged = baseRecipe({ tag_slugs: [] });

  it('returns false when the recipe has no needs-* tag', () => {
    expect(visibleInNeedsFamilyHelp(unflagged, ADMIN)).toBe(false);
    expect(visibleInNeedsFamilyHelp(unflagged, OWNER)).toBe(false);
  });

  it('admin sees every flagged recipe', () => {
    expect(visibleInNeedsFamilyHelp(flagged, ADMIN)).toBe(true);
  });

  it('contributor sees their own flagged recipes', () => {
    expect(visibleInNeedsFamilyHelp(flagged, OWNER)).toBe(true);
  });

  it('contributor does NOT see other contributors\' flagged recipes', () => {
    const someoneElses = baseRecipe({ tag_slugs: ['needs-instructions'], contributor_id: 'someone-else-id' });
    expect(visibleInNeedsFamilyHelp(someoneElses, OWNER)).toBe(false);
  });

  it('signed-out viewer never sees a flagged recipe', () => {
    expect(visibleInNeedsFamilyHelp(flagged, SIGNED_OUT)).toBe(false);
  });
});

describe('needsFamilyHelp — data classification (unchanged)', () => {
  it('matches any of the needs-* tag set', () => {
    expect(needsFamilyHelp(baseRecipe({ tag_slugs: ['low-confidence'] }))).toBe(true);
    expect(needsFamilyHelp(baseRecipe({ tag_slugs: ['needs-instructions'] }))).toBe(true);
    expect(needsFamilyHelp(baseRecipe({ tag_slugs: ['needs-story'] }))).toBe(true);
    expect(needsFamilyHelp(baseRecipe({ tag_slugs: ['lucys-recipe-collection'] }))).toBe(false);
    expect(needsFamilyHelp(baseRecipe({ tag_slugs: [] }))).toBe(false);
  });
});
