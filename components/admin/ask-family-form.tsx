'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { composeAskDraft, type EmailRecipient } from '@/lib/recipes/ask-family';
import { sendAskFamily } from '@/app/admin/recipes/[slug]/ask/actions';

type Props = {
  recipeId:           string;
  recipeSlug:         string;
  recipeTitle:        string;
  recipeUrl:          string;
  contributorId:      string | null;
  contributorName:    string;
  recipients:         EmailRecipient[];
  defaultRecipientId: string | null;
};

export function AskFamilyForm({
  recipeId,
  recipeSlug,
  recipeTitle,
  recipeUrl,
  contributorId,
  contributorName,
  recipients,
  defaultRecipientId,
}: Props) {
  const router = useRouter();

  // Pick the initial recipient. When no contributor email is on file, the
  // page-side default is null and the admin has to choose before sending.
  const [recipientId, setRecipientId] = useState<string>(defaultRecipientId ?? '');
  const initialRecipient = recipients.find((r) => r.id === (defaultRecipientId ?? ''));
  const initialDraft = useMemo(() => {
    if (!initialRecipient) {
      // No default — leave subject/body editable but populate the subject
      // with the canonical one. Body stays empty until a recipient is picked.
      return { subject: 'A recipe on Our Big Family Kitchen needs your help', bodyPlain: '', bodyHtml: '' };
    }
    return composeAskDraft({
      recipientName:             initialRecipient.displayName,
      contributorName,
      recipeTitle,
      recipeUrl,
      isRecipientTheContributor: initialRecipient.id === contributorId,
    });
  }, [initialRecipient, contributorName, recipeTitle, recipeUrl, contributorId]);

  const [subject, setSubject] = useState(initialDraft.subject);
  const [body,    setBody]    = useState(initialDraft.bodyPlain);

  // Track the body that auto-composition would produce for the current
  // recipient. While the textarea content matches this, switching recipient
  // safely re-templates. Once the admin has manually edited the body, the
  // values diverge and the template stops overwriting their changes.
  const lastTemplateBodyRef = useRef(initialDraft.bodyPlain);
  const [feedback, setFeedback] = useState<{ kind: 'ok'; to: string } | { kind: 'err'; reason: string } | null>(null);
  const [pending, startSend] = useTransition();

  function onRecipientChange(nextId: string) {
    setRecipientId(nextId);
    const next = recipients.find((r) => r.id === nextId);
    if (!next) {
      lastTemplateBodyRef.current = '';
      return;
    }
    const nextDraft = composeAskDraft({
      recipientName:             next.displayName,
      contributorName,
      recipeTitle,
      recipeUrl,
      isRecipientTheContributor: next.id === contributorId,
    });
    // Only swap the body if the admin hasn't edited away from the prior
    // template. Subject is left alone — admin may already have refined it.
    if (body === lastTemplateBodyRef.current || body.trim() === '') {
      setBody(nextDraft.bodyPlain);
    }
    lastTemplateBodyRef.current = nextDraft.bodyPlain;
  }

  function onSend() {
    setFeedback(null);
    const recipient = recipients.find((r) => r.id === recipientId);
    if (!recipient) {
      setFeedback({ kind: 'err', reason: 'Pick a recipient first.' });
      return;
    }
    // Rebuild HTML body so any plain-text edits the admin made are reflected
    // in the HTML version too. We preserve the admin's body verbatim in the
    // plain version and produce an HTML version by paragraph-splitting and
    // italicizing the brand reference.
    const html = bodyPlainToHtml(body);
    startSend(async () => {
      const res = await sendAskFamily({
        recipeId,
        recipientContributorId: recipient.id,
        subject:                subject.trim(),
        bodyPlain:              body,
        bodyHtml:               html,
      });
      if (!res.ok) {
        setFeedback({ kind: 'err', reason: humanError(res.error) });
        return;
      }
      setFeedback({ kind: 'ok', to: res.to });
      // Bounce back to the recipe after a brief beat so admin can see the
      // confirmation, but don't trap them on this page.
      setTimeout(() => router.push(`/recipes/${recipeSlug}`), 1500);
    });
  }

  return (
    <div className="space-y-6">
      <Field label="Send to">
        <select
          value={recipientId}
          onChange={(e) => onRecipientChange(e.target.value)}
          className="w-full rounded-full border border-rule bg-paper px-4 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        >
          <option value="">— Pick a family member —</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>
              {r.displayName}{r.id === contributorId ? ' (the contributor)' : ''} · {r.email}
            </option>
          ))}
        </select>
        {recipients.length === 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            No family member has a real email on file yet — invite someone first.
          </p>
        )}
      </Field>

      <Field label="Subject">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-full border border-rule bg-paper px-4 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </Field>

      <Field label="Message">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="w-full rounded-2xl border border-rule bg-paper px-4 py-3 text-sm leading-relaxed text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
        <p className="mt-1 text-xs text-ink-soft">
          The template adapts when you switch recipient — until you start editing, then it leaves your draft alone.
        </p>
      </Field>

      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <button
          type="button"
          onClick={onSend}
          disabled={pending || !recipientId || body.trim() === '' || subject.trim() === ''}
          className="rounded-full bg-primary px-5 py-2 font-sans text-sm font-medium text-paper transition-colors hover:bg-ink disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
        <Link
          href={`/recipes/${recipeSlug}`}
          className="font-serif italic text-ink-soft hover:text-primary"
        >
          Cancel
        </Link>
        {feedback?.kind === 'ok' && (
          <p className="ml-auto text-sm italic text-ink-soft">
            Sent to <span className="font-serif">{feedback.to}</span>.
          </p>
        )}
        {feedback?.kind === 'err' && (
          <p className="ml-auto text-sm italic text-accent">{feedback.reason}</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-2 block text-ink">{label}</span>
      {children}
    </label>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'unauthorized':         return 'Only admins can send this.';
    case 'invalid_recipient':    return 'That recipient can\'t receive email — pick someone with a real address.';
    case 'invalid_payload':      return 'Subject and message are required.';
    case 'email_not_configured': return 'Email isn\'t configured on this environment.';
    case 'send_failed':          return 'Send failed — try again in a moment.';
    default:                     return 'Could not send.';
  }
}

/**
 * Build a minimal HTML body from the admin's plain text edits: split into
 * paragraphs on blank lines, escape HTML, italicize the brand name. Keeps
 * the email readable in HTML mail clients without re-running the template.
 */
function bodyPlainToHtml(plain: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const paragraphs = plain.split(/\n\s*\n/);
  return paragraphs
    .map((p) => {
      const safe = esc(p).replace(/\n/g, '<br>');
      // Italicize the brand name reference.
      return `<p>${safe.replace(/Our Big Family Kitchen/g, '<em>Our Big Family Kitchen</em>')}</p>`;
    })
    .join('\n');
}
