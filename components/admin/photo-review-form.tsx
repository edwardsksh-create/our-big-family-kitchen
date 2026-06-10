'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { formatDisplayName } from '@/lib/contributors/display-name';
import { submitPhotoReview, createOccasionType } from '@/app/admin/photo-review/actions';
import { suggestExistingOccasions } from '@/lib/photos/occasions';
import type {
  FamilyPhotoFull,
  PickerPerson,
  PickerRecipe,
  OccasionType,
} from '@/lib/queries/family-photos';

type Props = {
  photo:           FamilyPhotoFull;
  occasions:       OccasionType[];
  people:          PickerPerson[];
  recipes:         PickerRecipe[];
  previous:        FamilyPhotoFull | null;
};

function personRefOfTag(p: { person_type: 'contributor' | 'family_member'; id: string }): string {
  return `${p.person_type}:${p.id}`;
}

function formattedPerson(p: { name: string; nickname: string | null; birth_name: string | null }): string {
  return formatDisplayName({ fullName: p.name, nickname: p.nickname, birth_name: p.birth_name });
}

export function PhotoReviewForm(props: Props) {
  // Key the inner form by photo.id so the next photo always remounts with
  // clean state. `useState` initializers only run once per mount, so without
  // this the previous photo's caption, tagged people, occasions, year, etc.
  // would persist after "Save and next" — risking a photo being saved with
  // inherited data from the previous one. The explicit "Copy tags from
  // previous" button below still works because it sets state imperatively
  // from the `previous` prop.
  return <PhotoReviewFormInner key={props.photo.id} {...props} />;
}

function PhotoReviewFormInner({ photo, occasions: initialOccasions, people, recipes, previous }: Props) {
  // Local copy so newly-created occasions show up immediately without a
  // full server-round-trip / re-render.
  const [occasions, setOccasions] = useState<OccasionType[]>(initialOccasions);
  // Form state. Year and Occasion start from whatever the photo already has
  // saved; the AI hints (visible in the panel above) are NOT pre-applied
  // because the model's year ranges are wide and its occasion guesses miss
  // often enough that auto-checked defaults create more correction work
  // than they save. The AI hints stay displayed read-only for reference.
  const [caption,          setCaption]          = useState(photo.caption          ?? '');
  const [year,             setYear]             = useState(photo.year             ?? '');
  const [place,            setPlace]            = useState(photo.place            ?? '');
  const [additionalPeople, setAdditionalPeople] = useState(photo.additional_people ?? '');
  const [pets,             setPets]             = useState(photo.pets             ?? '');
  const [selectedPeople, setSelectedPeople] = useState<string[]>(
    photo.people.map((p) => personRefOfTag(p)),
  );
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(photo.occasions);
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>(
    photo.recipes.map((r) => r.id),
  );
  const [needsEditing, setNeedsEditing] = useState(photo.needs_editing);
  const [editingNote,  setEditingNote]  = useState(photo.editing_note ?? '');

  // Scroll the viewport to the top whenever a fresh photo loads. The outer
  // PhotoReviewForm keys this inner component on photo.id, so the mount-only
  // effect runs once per advance — covering Save and next, Skip, and Not for
  // archive, which all redirect back to /admin/photo-review with the next
  // unreviewed photo. Without this, the action buttons stay in view and the
  // newly loaded photo sits offscreen above. CSS sets scroll-behavior: smooth
  // on <html>, so the default scroll animation is honored.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const [newOccasionInput,   setNewOccasionInput]   = useState('');
  const [newOccasionFeedback, setNewOccasionFeedback] = useState<string | null>(null);
  const [creatingOccasion, startCreatingOccasion] = useTransition();

  const occasionSuggestions = useMemo(
    () => suggestExistingOccasions(newOccasionInput, occasions.map((o) => ({ slug: o.slug, name: o.name }))),
    [newOccasionInput, occasions],
  );

  function handleAddOccasion() {
    const raw = newOccasionInput.trim();
    if (!raw) return;
    setNewOccasionFeedback(null);
    startCreatingOccasion(async () => {
      const res = await createOccasionType(raw);
      if (!res.ok) {
        setNewOccasionFeedback(res.reason === 'invalid'
          ? 'That doesn’t look like a usable occasion name.'
          : 'Could not add the occasion.');
        return;
      }
      // Ensure it's in the local list, then select it.
      setOccasions((prev) => prev.some((o) => o.slug === res.slug)
        ? prev
        : [...prev, { slug: res.slug, name: res.name, sort_order: prev.length + 1 }]);
      setSelectedOccasions((prev) => prev.includes(res.slug) ? prev : [...prev, res.slug]);
      setNewOccasionInput('');
      setNewOccasionFeedback(res.created ? `Added “${res.name}.”` : `Selected existing “${res.name}.”`);
    });
  }

  // Autocomplete state.
  const [personQuery, setPersonQuery] = useState('');
  const [recipeQuery, setRecipeQuery] = useState('');

  const [pending, startTransition] = useTransition();

  const peopleByRef = useMemo(() => {
    const m = new Map<string, PickerPerson>();
    for (const p of people) m.set(p.ref, p);
    return m;
  }, [people]);

  const recipesById = useMemo(() => {
    const m = new Map<string, PickerRecipe>();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  const personMatches = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const haystack = (p: PickerPerson) => [p.name, p.nickname, p.birth_name].filter(Boolean).join(' ').toLowerCase();
    return people
      .filter((p) => haystack(p).includes(q))
      .filter((p) => !selectedPeople.includes(p.ref))
      .slice(0, 10);
  }, [people, personQuery, selectedPeople]);

  const recipeMatches = useMemo(() => {
    const q = recipeQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return recipes
      .filter((r) => r.title.toLowerCase().includes(q))
      .filter((r) => !selectedRecipes.includes(r.id))
      .slice(0, 10);
  }, [recipes, recipeQuery, selectedRecipes]);

  function copyFromPrevious() {
    if (!previous) return;
    setSelectedPeople(previous.people.map((p) => personRefOfTag(p)));
    setSelectedOccasions(previous.occasions);
    setYear(previous.year ?? '');
    setPlace(previous.place ?? '');
    // Pull the viewport back up so the just-prefilled fields and the photo
    // are in view, matching the post-advance scroll behavior.
    window.scrollTo({ top: 0 });
  }

  function submitWith(intent: 'save_and_next' | 'skip' | 'not_for_archive' | 'done') {
    startTransition(async () => {
      await submitPhotoReview({
        photoId:          photo.id,
        caption,
        year,
        place,
        additionalPeople,
        pets,
        occasionSlugs:    selectedOccasions,
        personRefs:       selectedPeople,
        recipeIds:        selectedRecipes,
        needsEditing,
        editingNote,
        intent,
      });
    });
  }

  return (
    <div className="space-y-8">
      {/* AI hints — collapsed by default so the photo + tagging fields are
          immediately reachable without scrolling past suggestions. Native
          <details> keeps state per-photo without React bookkeeping. */}
      {photo.ai_hints && (
        <details className="rounded-2xl border border-rule bg-cream/30 px-5 py-3 text-sm text-ink-soft">
          <summary className="label cursor-pointer list-none text-ink-soft marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-block">+ Show AI suggestions</span>
          </summary>
          <div className="mt-3 space-y-1">
            <p>
              <strong className="font-serif text-ink">{photo.ai_hints.estimated_year}</strong>
              <span className="text-ink-soft/70"> ({photo.ai_hints.estimated_year_confidence} confidence)</span>
              {' · '}
              {photo.ai_hints.person_count} {photo.ai_hints.person_count === 1 ? 'person' : 'people'}
              {' · '}
              {photo.ai_hints.setting}
            </p>
            {photo.ai_hints.probable_occasions.length > 0 && (
              <p>Suggested occasions: {photo.ai_hints.probable_occasions.join(', ')}</p>
            )}
            {photo.ai_hints.food_visible.length > 0 && (
              <p>Food: {photo.ai_hints.food_visible.join(', ')}</p>
            )}
            {photo.ai_hints.visible_occasion_clues.length > 0 && (
              <p className="italic">Clues: {photo.ai_hints.visible_occasion_clues.join('; ')}</p>
            )}
            {photo.ai_hints.date_stamp_visible && (
              <p>Date stamp: {photo.ai_hints.date_stamp_visible}</p>
            )}
            {photo.ai_hints.notes && (
              <p className="mt-2 max-w-prose text-ink-soft/80">{photo.ai_hints.notes}</p>
            )}
          </div>
        </details>
      )}

      {/* People */}
      <section>
        <label className="label mb-2 block text-ink">People in photo</label>
        {selectedPeople.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {selectedPeople.map((ref) => {
              const p = peopleByRef.get(ref);
              if (!p) return null;
              return (
                <li
                  key={ref}
                  className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1 text-sm text-ink"
                >
                  <span>{formattedPerson(p)}</span>
                  {p.family_line_names.length > 0 && (
                    <span className="text-xs text-ink-soft">· {p.family_line_names.join(' · ')}</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${p.name}`}
                    className="text-ink-soft hover:text-primary"
                    onClick={() => setSelectedPeople(selectedPeople.filter((r) => r !== ref))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="relative">
          <input
            type="text"
            value={personQuery}
            onChange={(e) => setPersonQuery(e.target.value)}
            placeholder="Type a name (contributor or family member)…"
            className="w-full rounded-xl border border-rule bg-paper px-4 py-2 text-sm"
          />
          {personMatches.length > 0 && (
            <ul className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-auto rounded-xl border border-rule bg-paper shadow-lg">
              {personMatches.map((p) => (
                <li key={p.ref}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-cream/40"
                    onClick={() => {
                      setSelectedPeople([...selectedPeople, p.ref]);
                      setPersonQuery('');
                    }}
                  >
                    <span>
                      {formattedPerson(p)}
                      {p.family_line_names.length > 0 && (
                        <span className="ml-2 text-xs text-ink-soft">
                          {p.family_line_names.join(' · ')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Field
        label="Additional people (not in DB)"
        value={additionalPeople}
        onChange={setAdditionalPeople}
        placeholder="e.g. Lawrence's cousin visiting from Hong Kong"
      />
      <Field
        label="Pets"
        value={pets}
        onChange={setPets}
        placeholder="e.g. Maizy"
      />

      {/* Occasions */}
      <section>
        <label className="label mb-2 block text-ink">Occasion(s)</label>
        <div className="flex flex-wrap gap-2">
          {occasions.map((o) => {
            const checked = selectedOccasions.includes(o.slug);
            return (
              <button
                key={o.slug}
                type="button"
                onClick={() => {
                  setSelectedOccasions(
                    checked
                      ? selectedOccasions.filter((s) => s !== o.slug)
                      : [...selectedOccasions, o.slug],
                  );
                }}
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors ' +
                  (checked
                    ? 'border-primary bg-primary text-paper'
                    : 'border-rule bg-paper text-ink-soft hover:border-ink')
                }
              >
                {o.name}
              </button>
            );
          })}
        </div>

        {/* Add a new reusable occasion. Persists to family_photo_occasion_types
            and becomes available everywhere (review form and /album filter).
            Visual treatment is intentionally loud: solid accent border + tinted
            backdrop + Plus icon + accent CTA. Earlier dashed-border versions
            were reading as a passive footnote and admins were missing it. */}
        <div className="mt-5 rounded-2xl border-2 border-accent/40 bg-accent/10 p-5">
          <p className="flex items-center gap-2 font-serif text-lg italic text-ink">
            <Plus size={18} className="text-accent" aria-hidden="true" />
            Don&rsquo;t see your occasion? Add one.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newOccasionInput}
              onChange={(e) => { setNewOccasionInput(e.target.value); setNewOccasionFeedback(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOccasion(); } }}
              placeholder="e.g. St. Patrick's Day, Confirmation, Crawfish boil…"
              className="min-w-[14rem] flex-1 rounded-xl border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <button
              type="button"
              onClick={handleAddOccasion}
              disabled={creatingOccasion || newOccasionInput.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
            >
              <Plus size={14} aria-hidden="true" />
              {creatingOccasion ? 'Adding…' : 'Add occasion'}
            </button>
          </div>
          {occasionSuggestions.length > 0 && (
            <p className="mt-2 text-xs text-ink-soft">
              Already in the list:{' '}
              {occasionSuggestions.map((s, i) => (
                <span key={s.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOccasions((prev) =>
                        prev.includes(s.slug) ? prev : [...prev, s.slug],
                      );
                      setNewOccasionInput('');
                      setNewOccasionFeedback(`Selected existing “${s.name}.”`);
                    }}
                    className="text-primary hover:underline"
                  >
                    {s.name}
                  </button>
                  {i < occasionSuggestions.length - 1 && ', '}
                </span>
              ))}
            </p>
          )}
          {newOccasionFeedback && (
            <p className="mt-1 text-xs italic text-ink-soft">{newOccasionFeedback}</p>
          )}
        </div>
      </section>

      <Field
        label="Year"
        value={year}
        onChange={setYear}
        placeholder='e.g. 1987-12-25, 1987, "around 1995", "early 90s"'
      />
      <Field
        label="Place"
        value={place}
        onChange={setPlace}
        placeholder="e.g. Quinn kitchen"
      />
      <Field
        label="Caption"
        value={caption}
        onChange={setCaption}
        placeholder="Brief description of the moment"
      />

      {/* Linked recipes */}
      <section>
        <label className="label mb-2 block text-ink">Linked recipes</label>
        {selectedRecipes.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {selectedRecipes.map((id) => {
              const r = recipesById.get(id);
              if (!r) return null;
              return (
                <li
                  key={id}
                  className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1 text-sm text-ink"
                >
                  <span>{r.title}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.title}`}
                    className="text-ink-soft hover:text-primary"
                    onClick={() => setSelectedRecipes(selectedRecipes.filter((x) => x !== id))}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="relative">
          <input
            type="text"
            value={recipeQuery}
            onChange={(e) => setRecipeQuery(e.target.value)}
            placeholder="Type a recipe title…"
            className="w-full rounded-xl border border-rule bg-paper px-4 py-2 text-sm"
          />
          {recipeMatches.length > 0 && (
            <ul className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-auto rounded-xl border border-rule bg-paper shadow-lg">
              {recipeMatches.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-cream/40"
                    onClick={() => {
                      setSelectedRecipes([...selectedRecipes, r.id]);
                      setRecipeQuery('');
                    }}
                  >
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Needs editing — independent of reviewed; admin-only flag for photos
          that need cropping/rotation/etc. outside this tool. */}
      <section className="rounded-2xl border border-dashed border-rule bg-cream/20 p-4">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={needsEditing}
            onChange={(e) => setNeedsEditing(e.target.checked)}
            className="h-4 w-4 rounded border-rule"
          />
          Needs editing (crop, rotate, color-fix outside this tool)
        </label>
        {needsEditing && (
          <input
            type="text"
            value={editingNote}
            onChange={(e) => setEditingNote(e.target.value)}
            placeholder='Short note — e.g. "crop tighter, too much background" or "rotate"'
            className="mt-3 w-full rounded-xl border border-rule bg-paper px-4 py-2 text-sm"
          />
        )}
      </section>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 border-t border-rule pt-6">
        <button
          type="button"
          disabled={pending}
          onClick={() => submitWith('save_and_next')}
          className="btn-primary"
        >
          Save and next →
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submitWith('skip')}
          className="btn-ghost"
        >
          Skip for now
        </button>
        {previous && (
          <button
            type="button"
            disabled={pending}
            onClick={copyFromPrevious}
            className="btn-ghost"
          >
            Copy tags from previous
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => submitWith('not_for_archive')}
          className="btn-ghost text-ink-soft"
        >
          Not for archive
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submitWith('done')}
          className="btn-ghost ml-auto"
        >
          Done for now
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <section>
      <label className="label mb-2 block text-ink">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-rule bg-paper px-4 py-2 text-sm"
      />
    </section>
  );
}
