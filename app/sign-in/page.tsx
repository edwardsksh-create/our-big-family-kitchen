import Image from 'next/image';
import { signIn } from '@/auth';

export const metadata = { title: 'Sign in' };

type SearchParams = { error?: string };

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const isNotInvited = searchParams.error === 'not_invited';
  const isOtherError = !!searchParams.error && !isNotInvited;

  async function send(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    if (!email) return;
    await signIn('resend', {
      email,
      redirectTo: '/',
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      {/* One archival photo at the door — this is a family kitchen, not a
          login portal. */}
      <figure className="mb-8">
        <div className="relative aspect-[7/5] overflow-hidden rounded-2xl border border-rule">
          <Image
            src="/hero/leusch-sisters-thanksgiving.jpg"
            alt="Nancy, Laura, and Annie in the Quinn kitchen on Thanksgiving, 1980s."
            fill
            priority
            sizes="448px"
            className="object-cover"
          />
        </div>
      </figure>
      <p className="label mb-4">Sign in</p>
      <h1 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
        Welcome to Our Big Family Kitchen.
      </h1>
      <p className="mt-3 text-ink-soft">
        The family&rsquo;s recipes, photos, and memories are inside. Sign in
        with the email Kate invited.
      </p>

      <form action={send} className="mt-8 space-y-4">
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
          to Kate if you’d like to be added.
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
