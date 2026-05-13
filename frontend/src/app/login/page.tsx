export default function LoginPage() {
  return (
    <main className="landing-shell flex min-h-screen items-center justify-center px-6">
      <section className="surface max-w-md p-8 text-center">
        <p className="text-mono mb-4">
          <span>Craft</span>
          <span className="text-[var(--accent)]">post</span>
        </p>
        <h1 className="text-h2 mb-3">Sign in</h1>
        <p className="text-body">
          Google sign-in will be connected in a later slice.
        </p>
      </section>
    </main>
  );
}
