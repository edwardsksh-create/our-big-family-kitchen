// The per-family configuration for this deployment (product-track Phase 0,
// see docs/product-roadmap.md). Everything that makes this deployment *this
// family's* site — the name, the domain, copy that addresses the admin by
// name, the federation with the older archive, the founding letter — lives
// here as one typed object. Cloning the product for another family means
// editing this file plus the structural data modules, and setting the
// clone's env vars; no other source file should need to change.
//
// The structural half of the per-family data stays in its own modules so
// client components can import this file without pulling the genealogy into
// their bundles:
//   - lib/family-lines.ts  — the family lines, colors, photos
//   - lib/family-trees.ts  — the hand-curated genealogy
//   - lib/sections.ts      — recipe sections
// Per-deployment secrets and addresses stay in env vars (ADMIN_EMAIL,
// RESEND_API_KEY, NEXTAUTH_URL, …).
//
// Copy fields are stored verbatim, including typographic quotes — they are
// rendered as-is, so editing them is editing the site.

export type FamilyFederation = {
  /** The external archive site this deployment links out to. */
  url: string;
  /** Display form of that site's host, e.g. shown in the footer. */
  host: string;
  /** Family-line slugs that have a federated mirror on that site. */
  lineSlugs: string[];
  /** The archive named as a phrase: “Aunt Laura’s 2003 cookbook”. */
  archiveName: string;
  /** Short form used as a heading: “Aunt Laura’s archive”. */
  archiveShortName: string;
  /** Where the links land: “Aunt Laura’s original collection”. */
  collectionName: string;
  /** Conversational short form: “Aunt Laura’s cookbook”. */
  cookbookShortName: string;
  /** Link text in the /about prose. */
  aboutLinkText: string;
  /** Lead sentence of the home-page archive box (the “, with N preserved
   *  recipes…” tail is appended by the page). */
  homeBlurbLead: string;
  /** Matched against recipes.originally_from to detect archive provenance. */
  provenancePattern: RegExp;
  /** Recipe-page provenance note shown when the pattern matches. */
  provenanceNote: string;
  /** /recipes index badge label (lowercase, mid-sentence style). */
  badgeLabel: string;
};

export type FoundingLetter = {
  /** Heading of the /about#letter section. */
  heading: string;
  /** The admin's framing paragraph above the letter card. */
  intro: string;
  /** First line inside the card, e.g. “Dear Kate,”. */
  salutation: string;
  /** The letter body, one entry per paragraph, transcribed exactly. */
  paragraphs: string[];
  /** The closing row: left side and right (signature) side. */
  closingLeft: string;
  closingRight: string;
  /** Link text pointing at the letter from the home archive box. */
  homeLinkText: string;
  /** Link text pointing at the letter from the federated family-line page. */
  familyLineLinkText: string;
};

export type FamilyConfig = {
  /** The site's name as it appears everywhere user-facing. */
  siteName: string;
  /** Bare production host, shown in print footers and emails. */
  domain: string;
  /** Canonical origin for sitemap/robots and as the email-link fallback. */
  baseUrl: string;
  /** Root-layout <meta name="description">. */
  metaDescription: string;
  /** The admin-curator's name, as user-facing copy addresses them
   *  (“Kate will review your recipe”). */
  adminName: string;
  /** Placeholder-address suffix for contributors without a real email
   *  (contributors.email is NOT NULL UNIQUE). */
  stubEmailSuffix: string;
  /** Archival photo + caption used on home/about/sign-in whenever the
   *  curated hero pool is empty. */
  heroFallback: { src: string; caption: string };
  /** Per-area visibility. Each area is independently 'public' (anyone with
   *  the link can read it) or 'private' (sign-in required). Enforced
   *  site-wide via lib/access.ts. 'recipes' also covers /sections and
   *  /search; the home page shows whichever areas are public and hides the
   *  rest, so an all-private site is effectively a sign-in door. Editing,
   *  contributing, and admin are always sign-in-gated regardless. */
  visibility: {
    recipes:      AreaVisibility;
    family:       AreaVisibility;
    contributors: AreaVisibility;
    album:        AreaVisibility;
  };
  /** The older sibling archive this site federates with, or null. */
  federation: FamilyFederation | null;
  /** The founding letter on /about, or null. */
  foundingLetter: FoundingLetter | null;
};

export type AreaVisibility = 'public' | 'private';

export const FAMILY: FamilyConfig = {
  siteName: 'Our Big Family Kitchen',
  domain:   'bigfamilykitchen.com',
  baseUrl:  'https://bigfamilykitchen.com',
  metaDescription:
    'Recipes from the Leusch, Sundy, Edwards, Hong, Quinn, and Branion families. Kept, shared, and growing.',
  adminName: 'Kate',
  stubEmailSuffix: '@ourbigfamilykitchen.local',
  heroFallback: {
    src:     '/hero/leusch-sisters-thanksgiving.jpg',
    caption: 'Nancy, Laura, and Annie in the Quinn kitchen on Thanksgiving, 1980s.',
  },

  // Matches the site's behavior to date: recipes, family pages, and
  // contributors are publicly readable; the photo album is sign-in-only.
  // Flip any of these to 'private' (or 'public') to change what logged-out
  // visitors can see.
  visibility: {
    recipes:      'public',
    family:       'public',
    contributors: 'public',
    album:        'private',
  },

  federation: {
    url:  'https://leuschfamilyrecipes.com',
    host: 'leuschfamilyrecipes.com',
    lineSlugs: ['leusch'],
    archiveName:       'Aunt Laura’s 2003 cookbook',
    archiveShortName:  'Aunt Laura’s archive',
    collectionName:    'Aunt Laura’s original collection',
    cookbookShortName: 'Aunt Laura’s cookbook',
    aboutLinkText:     'the original Leusch family archive',
    homeBlurbLead:
      'The original Leusch family cookbook lives at leuschfamilyrecipes.com',
    provenancePattern: /aunt laura/i,
    provenanceNote:
      "From Aunt Laura's 2003 cookbook — the family recipe compilation she put together for everyone.",
    badgeLabel: "from Aunt Laura's archive",
  },

  foundingLetter: {
    heading: 'Aunt Laura’s letter',
    intro:
      'Aunt Laura made those original books as a college graduation gift for me — handwritten cards typed up, and recipes that had never been written down recreated from memory. This letter came with them. These are her exact words.',
    salutation: 'Dear Kate,',
    paragraphs: [
      'I have spent this past winter and spring trying to compile these books for you. It is a true labor of love, believe me! As you enter the big world, I am sending with you “The Leusch Family Recipes.” They have been gathered from three generations before yours. They also come from friends of ours, both old and new, some gone outgrown, or just lost. A piece of all of them stays with us. I hope you enjoy using these recipes and reading the occasional story connected with them.',
      'As I was copying these, I thought of many hints to give you. Most of them have disappeared as I came to this final point. I found that we have a lot of what I would call “weekend” recipes. They take a lot of time! Almost always, they are worth it. Some recipes are so old and well known to us that they were never written down; I have tried to recreate those for you.',
      'My hints… oh yes, Kate, I do have a few! Do you know that the only food you pack when measuring is brown sugar? Don’t be afraid to talk to the butcher or fish man for advice or to order a specific cut of meat or fish; they are there to help you. A lot of the recipes call for a small amount of liquor and you probably won’t want to buy a full bottle for just 2 tablespoons. Look for a store that sells small bottles; you’ll save a lot of money and still be able to make the recipe. Most of all, enjoy the cooking! Have fun with it. If you really hate an ingredient, leave it out. And finally, if you never want to cook, save this for your children.',
    ],
    closingLeft:  'Happy Graduation, Kate!',
    closingRight: 'Love, Aunt Laura',
    homeLinkText:       'Read her letter',
    familyLineLinkText: 'Read the letter Aunt Laura sent with the original books',
  },
};
