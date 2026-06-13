import Image from 'next/image';
import { signIn } from '@/auth';
import { FAMILY } from '@/config/family';

export const metadata = { title: 'Sign in' };

type SearchParams = { error?: string; callbackUrl?: string };

// Where the magic link returns to after verification. Default home. We allow
// ONLY the native sign-in bridge as an override — never an arbitrary URL — so
// this can't become an open redirect.
function safeRedirectTo(callbackUrl?: string): string {
  if (callbackUrl && callbackUrl.startsWith('/api/v1/auth/mobile-callback')) {
    return callbackUrl;
  }
  return '/';
}

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const isNotInvited = searchParams.error === 'not_invited';
  const isOtherError = !!searchParams.error && !isNotInvited;
  const redirectTo = safeRedirectTo(searchParams.callbackUrl);

  async function send(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    if (!email) return;
    await signIn('resend', {
      email,
      redirectTo: safeRedirectTo(String(formData.get('callbackUrl') ?? '') || undefined),
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      {/* One archival photo at the door — this is a family kitchen, not a
          login portal. */}
      <figure className="mb-8">
        <div className="relative aspect-[7/5] overflow-hidden rounded-2xl border border-rule">
          <Image
            src={FAMILY.heroFallback.src}
            alt={FAMILY.heroFallback.caption}
            fill
            priority
            sizes="448px"
            className="object-cover"
          />
        </div>
      </figure>
      <p className="label mb-4">Sign in</p>
      <h1 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
        Welcome to {FAMILY.siteName}.
      </h1>
      <p className="mt-3 text-ink-soft">
        Sign in with the email {FAMILY.adminName} invited.
      </p>

      <form action={send} className="mt-8 space-y-4">
        <input type="hidden" name="callbackUrl" value={redirectTo} />
        <label className="block">
          <span className="label">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="the email your invitation came to"
            className="mt-2 w-full rounded-full border border-rule bg-paper px-5 py-3 text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
        </label>

        <button type="submit" className="btn-primary w-full">
          Send me a sign-in link
        </button>
      </form>

      {isNotInvited && (
        <p className="mt-6 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          <span className="font-serif italic">Not yet invited.</span> Reach out
          to {FAMILY.adminName} if you’d like to be added.
        </p>
      )}

      {isOtherError && (
        <p className="mt-6 rounded-xl border border-rule bg-paper p-4 text-sm text-ink-soft">
          Something went wrong — please try again.
        </p>
      )}
    </div>
  );
}
