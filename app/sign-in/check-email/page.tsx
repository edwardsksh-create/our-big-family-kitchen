export const metadata = { title: 'Check your email' };

export default function CheckEmailPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="label mb-4">Check your email</p>
      <h1 className="font-serif text-3xl leading-tight text-ink md:text-4xl">
        A sign-in link is on the way.
      </h1>
      <p className="mt-4 text-ink-soft">
        Click the link in the email to finish signing in. You can close this tab.
      </p>
    </div>
  );
}
