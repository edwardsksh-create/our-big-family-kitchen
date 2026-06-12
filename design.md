# Design — Our Big Family Kitchen

## Section A — The Vision

Our Big Family Kitchen is a living collection of family recipes, traditions, stories, and memories — built to keep the people around the table connected, even when they're no longer sitting at the same one. It is NOT a food blog, cooking publication, influencer site, or recipe discovery platform. The primary goal is helping families stay connected through recipes, traditions, stories, photographs, comments, and shared memories.

The emotional feeling: warm but not rustic; modern but not trendy; premium but not luxury; nostalgic without feeling old-fashioned; personal without feeling homemade; timeless rather than seasonal.

Avoid: farmhouse design, mason jars, chalkboard fonts, script typography, Pinterest aesthetics, blogger aesthetics, scrapbook aesthetics, overly corporate SaaS design.

Inspiration: New York Times Cooking's typography, spacing, and editorial confidence; high-end coffee table books; modern magazine layouts; museum archives; Apple's attention to simplicity and hierarchy; family photo books and heirloom cookbooks.

Visual principles: generous whitespace, strong typography, restrained color palette, excellent photography, content-first design, subtle warmth, modern editorial layout.

North star: "If The New York Times built a digital family cookbook."

## Section B — The Current System (extracted from the code)

The factual baseline as implemented. Sources: `tailwind.config.ts`, `app/globals.css`, `lib/sections.ts`, `lib/family-lines.ts`, `app/layout.tsx`, and component conventions.

### Palette

Core tokens (defined in both `tailwind.config.ts` and as CSS variables in `globals.css`):

| Token | Value | Role |
|---|---|---|
| `paper` | `#FBF7EE` | Page background; light text on dark surfaces |
| `cream` | `#E6DFCA` | Tinted fills — emotional boxes use `cream/30`–`cream/40`, hovers `cream/40` |
| `ink` | `#2A2522` | Primary text, hover borders, dark surfaces (lightbox scrim `ink/80`) |
| `ink-soft` | `#5C544F` | Secondary text, metadata; `/70`–`/80` for tertiary |
| `primary` | `#8D2842` (burgundy) | Recipe titles (h1 on detail), primary buttons, link hovers, ingredient sub-headers |
| `accent` | `#C96236` (terracotta) | Needs/awaiting-input treatments (`accent/10` fill, `accent/40` border), inline error text |
| `rule` | `rgba(42,37,34,0.12)` | Hairline borders everywhere — cards, header, footer, inputs |

Card color set, 9 tokens shared by sections and family lines (`card.blush #EDAFA6`, `olive #A28E4C`, `sky #9EB7C5`, `gold #E4A041`, `mauve #AB92A4`, `slate #7F8AAC`, `rose #C96236`, `burgundy #8D2842`, `navy #213C66`). Used three ways:

1. **Section card backgrounds** (`SECTION_BG`) — full-bleed colored tiles on home, /sections, and section-page headers; text flips ink/paper per `SECTION_TEXT`.
2. **Accent swatches only, never text-on-paper** (`SECTION_BG` dots, `FAMILY_BG`) — in-page section headings (contributor pages) and family-line identity (cards, line-page h1) render in ink with a small color swatch dot or short rule as the accent. The light tokens (blush, sky, gold) fail contrast as text on paper, so the former `SECTION_HEADING_TEXT`/`FAMILY_TEXT` text-color maps were removed.

The 16 sections cycle through the 9 colors; the 8 family lines each own one color.

### Typography

- **Serif: Fraunces** (variable; `SOFT` + `opsz` axes loaded). All headings (`h1–h6` globally, `SOFT 30`, `-0.01em` tracking). The `.warm` utility = serif italic at `SOFT 80`. Serif italic is the voice of warmth: status notes, empty states, provenance lines, kitchen notes, byline asides, "Edit this recipe →".
- **Sans: Inter.** Body (17px / 1.6 on `body`), metadata sublines, badges, buttons, labels.
- **`.label`** = sans 12px uppercase, `tracking-[0.14em]`, `ink-soft`. Used for eyebrows, nav, metadata field labels (lightbox "People:", "Occasion:"), photo counts.
- Recipe detail h1 is `text-primary` (burgundy); all other page h1s are `text-ink`. Page h1s run `text-4xl`–`text-6xl`; section h2s `text-2xl`–`text-3xl`.

### Spacing, layout, borders

- Containers: `max-w-page` (76rem) for browse surfaces; `max-w-prose` (70ch) for reading surfaces (/about, contributor pages). Gutters `px-6`; page padding `py-16` (home hero up to `py-24`); section rhythm `mt-12`–`mt-16`; footer pushed by `mt-32`.
- Radii: `rounded-2xl` is the card/box radius; `rounded-3xl` home hero image; `rounded-xl` small notices/inputs; `rounded-full` buttons, pills, filter selects, search.
- Borders: `border-rule` hairline on every box; hover swaps to `border-ink` plus a soft long shadow (`shadow-[0_12px_40px_-20px_rgba(42,37,34,0.35)]`) and a `-translate-y-0.5` lift (`.card-hover`, eased by `ease-out-soft`).
- Empty states: dashed `border-rule` box, centered, serif-italic headline + small sans explanation.

### The card/box language

- **Default card**: `rounded-2xl border border-rule bg-paper p-5` — title in serif (semibold, lg–xl), sans metadata subline, optional italic provenance third line. Cards are **text-only**; no imagery on recipe, section-listing, contributor, or family cards.
- **Cream boxes** (`bg-cream/30`–`/40` + rule border): the *emotional/aside* register — Family Note, comment composer, provenance notes, recipe-index filter bar.
- **Accent boxes** (`bg-accent/10` + `border-accent/40`): the *awaiting-input* register — needs prompts.
- **Colored tiles**: the /sections index only — `aspect-[5/6]`, name bottom-left in serif 2xl–3xl. On home and /recipes, section browsing is a compact pill row instead.
- **Card photos**: recipe cards show a 3:2 image when one exists — dish photo first, else a top-crop of the first source scan (handwriting is the photography for heritage recipes); the text-only card is the dignified fallback. Served as 640px `thumbs/` derivatives, never originals.
- Badges: quiet editorial notes — small italic serif, sentence case ("ready to cook", "has the original card"); accent color marks awaiting-input states. No pills, dots, or uppercase tracking.
- Buttons: pill-shaped, sentence-case sans (`.btn`); `btn-primary` burgundy → ink on hover; `btn-ghost` hairline.
- Album lightbox metadata composes as a photo-book caption ("Thanksgiving 1987, at Grandma's — Nancy, Laura, and Annie"), not labeled fields; the album grid groups under decade headers.

### Established interaction rules (enforced in code, with in-code comments)

1. **No redundant eyebrows/labels where context establishes identity.** The recipe page removed its "At a glance" box because the breadcrumb already carries the section (comment at `app/recipes/[slug]/page.tsx:301-304`).
2. **Content-gated sections — never render an empty box or a heading pointing at nothing.** Ingredients/Method render only when populated; Family Note hidden without a story; federated boxes gated on count; "Needs family help" hides itself for viewers with nothing actionable. Browse pages (sections, family lines, album) use explicit dashed empty states instead — a deliberate, different register for *destination* pages.
3. **Cooking content first; contextual/emotional content below.** Detail-page order: hero dish photo → breadcrumb → title/byline → needs prompt (actors only) → Ingredients → Method → Kitchen notes → more dish photos → family photos → original-page scans → provenance note → **Family Note (boxed cream closer)** → communal memories → footer provenance ("Saved by … on …", "Last edited by …").
4. **The Family Note is the boxed emotional closer** — the cook's own story, distinct cream treatment, placed last before the communal comments layer.
5. **No system/machinery language in user-facing copy.** Status copy is named and human ("Pending review — Kate will take a look", "only you and Kate can see it", "Reach out to Kate if you'd like to be added", "That memory has already been removed"). Empty states are warm ("The archive is being tagged", "This section is waiting for its first recipe"). Needs states read as invitations, not flags ("would you help fix it?").
6. **Provenance is always quiet and factual** — italic serif, small, hairline-separated; "Originally from …", "Photographed from Lucy's collection", footer save/edit lines with dates.
7. **Print is a first-class surface** — dedicated print stylesheet, `data-no-print` opt-outs, recipes paginate cleanly for the physical recipe box.
