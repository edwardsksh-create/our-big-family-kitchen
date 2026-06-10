'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { FamilyLineOption } from '@/lib/recipes/form-options';
import { updateContributorAsAdmin, type AdminContributorPatch } from '@/lib/contributors/admin-update';

type Props = {
  contributor: AdminContributorPatch;
  familyLines: FamilyLineOption[];
};

export function AdminContributorEditor({ contributor, familyLines }: Props) {
  const router = useRouter();
  const [patch, setPatch] = useState<AdminContributorPatch>(contributor);
  const [pending, startTransition] = useTransition();
  const [error, setError]    = useState<string | null>(null);

  function update<K extends keyof AdminContributorPatch>(key: K, value: AdminContributorPatch[K]) {
    setPatch((p) => ({ ...p, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateContributorAsAdmin(patch);
      if (!result.ok) {
        // Validation / server errors keep the admin on the form so the
        // message stays visible next to the field they were editing.
        setError(humanError(result.error));
        return;
      }
      // On success, bounce to the contributor's public page so the admin
      // sees the updated result instead of looking at the editor again.
      // result.slug already reflects any name change.
      router.push(`/contributors/${result.slug}`);
    });
  }

  return (
    <div className="mt-10 space-y-8">
      <label className="block">
        <span className="label">Name *</span>
        <input
          type="text"
          value={patch.name}
          onChange={(e) => update('name', e.target.value)}
          className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </label>

      <label className="block">
        <span className="label">Email</span>
        <input
          type="email"
          value={patch.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="leave empty for a stub contributor"
          className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
        <p className="mt-1 text-sm text-ink-soft">
          Adding a real email upgrades a stub into a contributor who can sign in.
        </p>
      </label>

      <label className="block">
        <span className="label">Role</span>
        <select
          value={patch.role}
          onChange={(e) => update('role', e.target.value as AdminContributorPatch['role'])}
          className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        >
          <option value="viewer">viewer (stub, no sign-in)</option>
          <option value="contributor">contributor (can submit recipes for review)</option>
          <option value="admin">admin (can publish + manage)</option>
        </select>
      </label>

      <label className="block">
        <span className="label">Bio</span>
        <textarea
          value={patch.bio}
          onChange={(e) => update('bio', e.target.value)}
          rows={4}
          placeholder="A short note shown on their /contributors/[slug] page."
          className="mt-2 w-full rounded-2xl border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </label>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="block">
          <span className="label">Primary family line</span>
          <select
            value={patch.primary_family_line_id ?? ''}
            onChange={(e) => update('primary_family_line_id', e.target.value || undefined)}
            className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          >
            <option value="">— None —</option>
            {familyLines.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Secondary family line</span>
          <select
            value={patch.secondary_family_line_id ?? ''}
            onChange={(e) => update('secondary_family_line_id', e.target.value || undefined)}
            className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          >
            <option value="">— None —</option>
            {familyLines.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-8">
        <button type="button" onClick={() => router.push('/admin/contributors')} className="btn-ghost">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-rule bg-paper p-3 text-sm text-ink-soft">
          <span className="font-serif italic">{error}</span>
        </p>
      )}
    </div>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized':           return 'You need to be signed in.';
    case 'admin_only':             return 'Admins only.';
    case 'name_too_short':         return 'Name must be at least 2 characters.';
    case 'email_taken':            return 'Another contributor already uses that email.';
    case 'family_line_link_failed': return 'Saved name + role, but family-line update failed.';
    case 'db_update_failed':        return 'Save failed — try again in a moment.';
    default:                        return 'Something went wrong.';
  }
}
