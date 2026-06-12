import { describe, it, expect } from 'vitest';
import { FAMILY_TREES, type TreeNode } from '@/lib/family-trees';
import { FAMILY_LINES } from '@/lib/family-lines';

const LINE_SLUGS = new Set(FAMILY_LINES.map((l) => l.slug));

function walk(nodes: TreeNode[], visit: (n: TreeNode) => void) {
  for (const n of nodes) {
    visit(n);
    if (n.children) walk(n.children, visit);
  }
}

describe('family trees', () => {
  it('every tree key is a real family-line slug', () => {
    for (const key of Object.keys(FAMILY_TREES)) {
      expect(LINE_SLUGS.has(key), `unknown line: ${key}`).toBe(true);
    }
  });

  it('every continuesOn points at a line that has its own tree', () => {
    for (const tree of Object.values(FAMILY_TREES)) {
      walk(tree.children, (n) => {
        if (n.continuesOn) {
          expect(LINE_SLUGS.has(n.continuesOn), `bad continuesOn: ${n.continuesOn}`).toBe(true);
          expect(FAMILY_TREES[n.continuesOn], `no tree behind continuesOn: ${n.continuesOn}`).toBeDefined();
        }
      });
    }
  });

  it('no empty names anywhere', () => {
    for (const tree of Object.values(FAMILY_TREES)) {
      expect(tree.root.trim().length).toBeGreaterThan(0);
      walk(tree.children, (n) => {
        expect(n.name.trim().length).toBeGreaterThan(0);
        for (const p of n.partners ?? []) expect(p.name.trim().length).toBeGreaterThan(0);
      });
    }
  });

  it('the Leusch top shows all eight kids', () => {
    expect(FAMILY_TREES.leusch.children.map((c) => c.name)).toEqual([
      'Michael', 'Susan', 'Nancy', 'Laura', 'Rich', 'Martha', 'Annie', 'Lucy',
    ]);
  });
});
