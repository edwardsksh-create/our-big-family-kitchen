'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

type SubmitPayload = {
  photoId:          string;
  caption:          string;
  year:             string;
  place:            string;
  additionalPeople: string;
  pets:             string;
  occasionSlugs:    string[];
  // person rows: format 'contributor:<id>' or 'family_member:<id>'
  personRefs:       string[];
  recipeIds:        string[];
  needsEditing:     boolean;
  editingNote:      string;
  intent:           'save_and_next' | 'skip' | 'not_for_archive' | 'done';
};

export async function submitPhotoReview(payload: SubmitPayload): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    throw new Error('Not authorized.');
  }

  const db = supabaseAdmin();
  const trimmed = (s: string) => s.trim() || null;

  if (payload.intent === 'done') {
    redirect('/admin');
  }

  if (payload.intent === 'not_for_archive') {
    await db
      .from('family_photos')
      .update({ not_for_archive: true })
      .eq('id', payload.photoId);
    revalidatePath('/admin/photo-review');
    redirect('/admin/photo-review');
  }

  if (payload.intent === 'skip') {
    // Just navigate forward — leave reviewed=false. Skipping a single photo
    // wouldn't normally need a write, but we bump uploaded_at to push it to
    // the end of the queue so the reviewer doesn't see it next.
    await db
      .from('family_photos')
      .update({ uploaded_at: new Date().toISOString() })
      .eq('id', payload.photoId);
    revalidatePath('/admin/photo-review');
    redirect('/admin/photo-review');
  }

  // intent === 'save_and_next'
  const update = {
    caption:           trimmed(payload.caption),
    year:              trimmed(payload.year),
    place:             trimmed(payload.place),
    additional_people: trimmed(payload.additionalPeople),
    pets:              trimmed(payload.pets),
    reviewed:          true,
    needs_editing:     payload.needsEditing,
    // Clear the note when the flag is off, so we don't carry over stale text.
    editing_note:      payload.needsEditing ? trimmed(payload.editingNote) : null,
  };
  await db.from('family_photos').update(update).eq('id', payload.photoId);

  // Replace people / occasions / recipes (idempotent re-saves).
  await db.from('family_photo_people').delete().eq('family_photo_id', payload.photoId);
  if (payload.personRefs.length > 0) {
    const peopleRows = payload.personRefs.map((ref) => {
      const [type, id] = ref.split(':');
      if (type === 'contributor')   return { family_photo_id: payload.photoId, person_type: 'contributor', contributor_id: id, family_member_id: null };
      if (type === 'family_member') return { family_photo_id: payload.photoId, person_type: 'family_member', contributor_id: null, family_member_id: id };
      throw new Error(`Bad person ref: ${ref}`);
    });
    const { error } = await db.from('family_photo_people').insert(peopleRows);
    if (error) throw new Error(`save people: ${error.message}`);
  }

  await db.from('family_photo_occasions').delete().eq('family_photo_id', payload.photoId);
  if (payload.occasionSlugs.length > 0) {
    const rows = payload.occasionSlugs.map((slug) => ({ family_photo_id: payload.photoId, occasion_slug: slug }));
    const { error } = await db.from('family_photo_occasions').insert(rows);
    if (error) throw new Error(`save occasions: ${error.message}`);
  }

  await db.from('family_photo_recipes').delete().eq('family_photo_id', payload.photoId);
  if (payload.recipeIds.length > 0) {
    const rows = payload.recipeIds.map((id) => ({ family_photo_id: payload.photoId, recipe_id: id }));
    const { error } = await db.from('family_photo_recipes').insert(rows);
    if (error) throw new Error(`save recipes: ${error.message}`);
  }

  revalidatePath('/admin/photo-review');
  redirect('/admin/photo-review');
}
