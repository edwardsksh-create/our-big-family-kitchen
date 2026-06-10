import { describe, it, expect } from 'vitest';
import {
  dedupePeopleForPicker,
  type DedupeContributor,
  type DedupeFamilyMember,
  type DedupeContribLink,
  type DedupeFamilyLine,
} from '@/lib/queries/family-photos';

const LINES: DedupeFamilyLine[] = [
  { id: 'L1', name: 'Leusch' },
  { id: 'L2', name: 'Sundy'  },
  { id: 'L3', name: 'Edwards' },
];

describe('dedupePeopleForPicker', () => {
  it('emits exactly one entry per contributor', () => {
    const contribs: DedupeContributor[] = [
      { id: 'C1', name: 'Annie Sundy', nickname: 'Nannie', birth_name: 'Leusch' },
    ];
    const out = dedupePeopleForPicker(contribs, [], [], LINES);
    expect(out).toHaveLength(1);
    expect(out[0].ref).toBe('contributor:C1');
    expect(out[0].name).toBe('Annie Sundy');
  });

  it('drops a family_member entry whose contributor_slug matches a contributor', () => {
    const contribs: DedupeContributor[] = [
      { id: 'C1', name: 'Annie Sundy', nickname: null, birth_name: null },
    ];
    const members: DedupeFamilyMember[] = [
      { id: 'M1', name: 'Annie Sundy', nickname: null, birth_name: null, contributor_slug: 'annie-sundy', family_line_id: 'L1' },
    ];
    const out = dedupePeopleForPicker(contribs, members, [], LINES);
    expect(out).toHaveLength(1);
    expect(out[0].ref).toBe('contributor:C1');
  });

  it('drops a family_member entry whose name matches a contributor even without contributor_slug', () => {
    const contribs: DedupeContributor[] = [
      { id: 'C1', name: 'Martha Branion', nickname: null, birth_name: null },
    ];
    const members: DedupeFamilyMember[] = [
      { id: 'M1', name: 'Martha Branion', nickname: null, birth_name: null, contributor_slug: null, family_line_id: 'L1' },
    ];
    const out = dedupePeopleForPicker(contribs, members, [], LINES);
    expect(out).toHaveLength(1);
    expect(out[0].ref).toBe('contributor:C1');
  });

  it('collapses cross-listed family_members rows for the same person', () => {
    const members: DedupeFamilyMember[] = [
      { id: 'M1', name: 'Charlotte Hill', nickname: null, birth_name: null, contributor_slug: null, family_line_id: 'L1' },
      { id: 'M2', name: 'Charlotte Hill', nickname: null, birth_name: null, contributor_slug: null, family_line_id: 'L2' },
    ];
    const out = dedupePeopleForPicker([], members, [], LINES);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Charlotte Hill');
    expect(out[0].family_line_names).toEqual(['Leusch', 'Sundy']);
  });

  it('keeps a family_member entry when there is no matching contributor', () => {
    const members: DedupeFamilyMember[] = [
      { id: 'M1', name: 'Charlotte Hill', nickname: null, birth_name: null, contributor_slug: null, family_line_id: 'L1' },
    ];
    const out = dedupePeopleForPicker([], members, [], LINES);
    expect(out).toHaveLength(1);
    expect(out[0].ref).toBe('family_member:M1');
  });

  it("includes all of a contributor's family lines, primary first", () => {
    const contribs: DedupeContributor[] = [
      { id: 'C1', name: 'Annie Sundy', nickname: null, birth_name: null },
    ];
    const links: DedupeContribLink[] = [
      { contributor_id: 'C1', family_line_id: 'L2', rank: 'secondary' },
      { contributor_id: 'C1', family_line_id: 'L1', rank: 'primary'   },
    ];
    const out = dedupePeopleForPicker(contribs, [], links, LINES);
    expect(out).toHaveLength(1);
    expect(out[0].family_line_names).toEqual(['Leusch', 'Sundy']);
  });
});
