// House style for external-source attribution on the `originally_from` field.
//
// Rules (NEW external recipes only — family attribution flows through
// contributor_id, and the Aunt Laura archive imports keep their existing
// attribution copy intact):
//
//   author + publication/site  →  "Author for Source"
//                                e.g. "Sam Sifton for NYT Cooking"
//
//   author + cookbook          →  "Author, Source"      (book form — "for"
//                                e.g. "Ina Garten, Barefoot Contessa"
//                                reads wrong with a book title)
//
//   source only                →  "Source"
//                                e.g. "NYT Cooking", "Bon Appétit"
//
//   author only                →  "Author"              (rare fallback)
//
//   nothing parseable          →  null                  (leave the field empty)

export type SourceParts = {
  /** Named author/cook (e.g. "Sam Sifton"), or null. */
  author?: string | null;
  /** Publication, website, or cookbook title (e.g. "NYT Cooking", "Barefoot Contessa"), or null. */
  source?: string | null;
  /** When true, `source` is a cookbook — use "Author, Book"; otherwise "Author for Source". */
  isBook?: boolean;
};

function clean(s: string | null | undefined): string {
  return (s ?? '').trim();
}

export function formatSourceAttribution(parts: SourceParts): string | null {
  const author = clean(parts.author);
  const source = clean(parts.source);
  const isBook = !!parts.isBook;

  if (author && source) return isBook ? `${author}, ${source}` : `${author} for ${source}`;
  if (source) return source;
  if (author) return author;
  return null;
}
