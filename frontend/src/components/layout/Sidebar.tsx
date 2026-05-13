import Link from "next/link";

const navItems = [
  { href: "/app/drafts/new", label: "+ New draft" },
  { href: "/app/drafts", label: "Drafts" },
  { href: "/app/settings/identities", label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <Link href="/" className="text-mono text-base">
        <span>Craft</span>
        <span className="text-[var(--accent)]">post</span>
      </Link>

      <nav className="mt-10 grid gap-2">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="app-nav-link">
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
