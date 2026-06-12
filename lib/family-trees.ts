// Hand-curated family trees, dictated by Kate (June 2026). This is the
// genealogy of record for the family-line pages — names and structure are
// transcribed exactly as she gave them; do not "correct" spellings or
// relationships without her say-so.
//
// The Leusch page shows the top of the tree (Dick & Dorothy and their
// eight kids with spouses); kids who founded another line continue on
// that line's page, where their full branch lives.

export type TreePartner = {
  name: string;
  /** Renders the partner as a parenthetical after the others —
   *  "Brian Edwards (late husband, Ryan Hong)". Used only for Ryan;
   *  relationship labels like 'partner'/'stepson' are deliberately
   *  not noted (Kate's call). */
  label?: string;
};

export type TreeNode = {
  name: string;
  partners?: TreePartner[];
  children?: TreeNode[];
  /** Free-text line rendered under the person instead of child nodes
   *  (Ben & Megan's animals). */
  childrenNote?: string;
  /** Family-line slug where this person's branch continues. */
  continuesOn?: string;
};

export type FamilyTree = {
  /** The couple at the top, as displayed. */
  root: string;
  /** Quiet italic line under the root (Lawrence's siblings). */
  rootNote?: string;
  children: TreeNode[];
};

export const FAMILY_TREES: Record<string, FamilyTree> = {
  leusch: {
    root: 'Dick ‘Papa’ & Dorothy ‘Gramie’ (MacNamara) Leusch',
    children: [
      { name: 'Michael' },
      { name: 'Susan ‘Aunt Sue’', partners: [{ name: 'Scott Schenone' }] },
      { name: 'Nancy ‘Nanook’', partners: [{ name: 'Tom ‘CG’ Quinn' }], continuesOn: 'quinn' },
      { name: 'Laura' },
      { name: 'Rich ‘George’', partners: [{ name: 'Mary Ann ‘Miss Katie’ Hogan' }], continuesOn: 'richs-family' },
      { name: 'Martha ‘Minnie’', partners: [{ name: 'Bob Branion' }], continuesOn: 'branion' },
      { name: 'Annie ‘Nannie’', partners: [{ name: 'Gary ‘Poppy’ Sundy' }], continuesOn: 'sundy' },
      { name: 'Lucy ‘Gal’', partners: [{ name: 'Jay ‘Guj’ Williams' }] },
    ],
  },

  quinn: {
    root: 'Nancy ‘Nanook’ (Leusch) Quinn & Tom ‘CG’ Quinn',
    children: [
      {
        name: 'Michael',
        partners: [{ name: 'Regina' }],
        children: [
          { name: 'Tommy' },
          {
            name: 'RJ Mancuso',
            partners: [{ name: 'Kadi' }],
            children: [
              { name: 'Sykora Mancuso' },
              { name: 'Luca Mancuso' },
            ],
          },
        ],
      },
      {
        name: 'Kevin',
        partners: [{ name: 'Donna' }],
        children: [
          { name: 'Kailin' },
          { name: 'Brennan', partners: [{ name: 'Megan' }] },
        ],
      },
      {
        name: 'Kara',
        partners: [{ name: 'David Hope' }],
        children: [{ name: 'Matthew Richards' }],
      },
    ],
  },

  'richs-family': {
    root: 'Rich ‘George’ Leusch & Mary Ann ‘Miss Katie’ Hogan',
    rootNote: 'First wife: Barb Brooks, the children’s mother.',
    children: [
      {
        name: 'Paul',
        partners: [{ name: 'Dana' }],
        children: [{ name: 'Delilah' }, { name: 'Ethan' }],
      },
      {
        name: 'Ingrid',
        partners: [{ name: 'Shane Wiegand' }],
        children: [
          {
            name: 'Cole',
            partners: [{ name: 'Alyssa' }],
            children: [{ name: 'Parker' }],
          },
        ],
      },
      {
        name: 'Justin',
        partners: [{ name: 'Jessica' }],
        children: [{ name: 'Ellie' }, { name: 'Owen' }, { name: 'Brooks' }, { name: 'Hank' }],
      },
      {
        name: 'Hillary',
        partners: [{ name: 'Rodney Pitt' }],
        children: [{ name: 'Tatum' }, { name: 'Graham' }],
      },
    ],
  },

  branion: {
    root: 'Martha ‘Minnie’ (Leusch) Branion & Bob Branion',
    children: [
      { name: 'Tim', partners: [{ name: 'Colleen' }] },
      {
        name: 'Suzy',
        partners: [{ name: 'Tyson Back' }],
        children: [{ name: 'Dorothy' }],
      },
    ],
  },

  sundy: {
    root: 'Annie ‘Nannie’ (Leusch) Sundy & Gary ‘Poppy’ Sundy',
    children: [
      {
        name: 'Kate',
        partners: [
          { name: 'Brian Edwards' },
          { name: 'Ryan Hong', label: 'late husband' },
        ],
        children: [{ name: 'Charlotte' }, { name: 'Nora' }],
      },
      {
        name: 'Ben',
        partners: [{ name: 'Megan' }],
        childrenNote: 'their animals: Eeva, Alice, Walter & Fiona',
      },
    ],
  },

  edwards: {
    root: 'Jim ‘Papa’ Edwards & Susan ‘Grandma’ (Daugherty) Edwards',
    children: [
      {
        name: 'Brian',
        partners: [{ name: 'Kate' }],
        children: [{ name: 'Charlotte' }, { name: 'Nora' }],
      },
      { name: 'Elizabeth ‘Lizzie’' },
    ],
  },

  hong: {
    root: 'Lawrence ‘YeYe’ Hong & Darlene ‘Grandma’ (Steiger) Hong',
    rootNote: 'Lawrence’s siblings: Theresa, Ignatius & Cecilia.',
    children: [
      { name: 'Kylene' },
      {
        name: 'Ryan',
        partners: [{ name: 'Kate' }],
        children: [{ name: 'Charlotte' }],
      },
    ],
  },
};
