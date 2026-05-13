import Link from "next/link";

type LandingNavProps = {
  isAuthenticated: boolean;
};

export default function LandingNav({ isAuthenticated }: LandingNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--bg-border)] bg-[var(--bg-nav)] backdrop-blur-xl">
      <div className="site-container flex h-16 items-center justify-between">
        <Link href="/" className="text-mono font-medium" aria-label="Craftpost">
          <span>Craft</span>
          <span className="text-[var(--accent)]">post</span>
        </Link>
        <nav className="flex items-center gap-2">
          <a className="btn btn-ghost" href="#pricing">
            Pricing
          </a>
          <a
            className="btn btn-secondary"
            href={isAuthenticated ? "/app/drafts/new" : "/login"}
          >
            {isAuthenticated ? "Go to app ->" : "Sign in ->"}
          </a>
        </nav>
      </div>
    </header>
  );
}
