import Image from "next/image";

export default function Page() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <section className="relative flex min-h-screen items-center">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,92,58,0.16),transparent_34rem)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(20,20,20,0.72))]"
          aria-hidden="true"
        />

        <div className="site-container relative z-10 py-12">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Image
              src="/icon.png"
              alt="Craftpost"
              width={72}
              height={72}
              className="mb-8 h-[72px] w-[72px] rounded-[var(--radius-lg)]"
              priority
            />

            <p className="text-mono mb-5 text-[var(--accent)]">
              Craftpost is getting ready
            </p>
            <h1 className="text-display max-w-2xl">
              Social publishing,
              <br />
              launching soon.
            </h1>
            <p className="text-body mt-6 max-w-md text-base">
              We are preparing the AI drafting, refinement, and publishing
              workflow before opening access.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
