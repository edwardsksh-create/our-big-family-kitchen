import Link from 'next/link';
import { familyLineBySlug } from '@/lib/family-lines';
import type { FamilyTree, TreeNode } from '@/lib/family-trees';

// A family tree at heirloom-book scale: nested lists with hairline
// connectors, no charting library. Names in serif ink; partners joined
// with an em dash; quiet italic notes; branches that continue on another
// line's page say so.

function partnerLine(node: TreeNode): string {
  const partners = (node.partners ?? [])
    .map((p) => (p.label ? `${p.name} (${p.label})` : p.name))
    .join(' · ');
  return partners ? ` — ${partners}` : '';
}

function TreeBranch({ node }: { node: TreeNode }) {
  const continues = node.continuesOn ? familyLineBySlug(node.continuesOn) : undefined;
  return (
    <li className="mt-3">
      <p className="font-serif text-base leading-snug text-ink md:text-lg">
        {node.name}
        {node.note && <span className="font-sans text-xs italic text-ink-soft"> ({node.note})</span>}
        <span className="text-ink-soft">{partnerLine(node)}</span>
      </p>
      {continues && (
        <p className="mt-0.5 font-serif text-sm italic text-ink-soft">
          <Link href={`/family-lines/${continues.slug}`} className="hover:text-primary">
            → continues on the {continues.name} page
          </Link>
        </p>
      )}
      {node.childrenNote && (
        <p className="mt-0.5 font-serif text-sm italic text-ink-soft">{node.childrenNote}</p>
      )}
      {node.children && node.children.length > 0 && (
        <ul className="ml-2 border-l border-rule pl-5">
          {node.children.map((c) => (
            <TreeBranch key={c.name} node={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FamilyTreeView({ tree }: { tree: FamilyTree }) {
  return (
    <div>
      <p className="font-serif text-xl leading-snug text-ink md:text-2xl">{tree.root}</p>
      {tree.rootNote && (
        <p className="mt-1 font-serif text-sm italic text-ink-soft">{tree.rootNote}</p>
      )}
      <ul className="ml-2 mt-1 border-l border-rule pl-5">
        {tree.children.map((c) => (
          <TreeBranch key={c.name} node={c} />
        ))}
      </ul>
    </div>
  );
}
