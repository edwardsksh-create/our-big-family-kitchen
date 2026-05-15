import { signOut } from '@/auth';

export const metadata = { title: 'Sign out' };

export default function SignOutPage() {
  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="label mb-4">Sign out</p>
      <h1 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
        Heading out?
      </h1>
      <form action={doSignOut} className="mt-8">
        <button type="submit" className="btn-primary w-full">Sign out</button>
      </form>
    </div>
  );
}
